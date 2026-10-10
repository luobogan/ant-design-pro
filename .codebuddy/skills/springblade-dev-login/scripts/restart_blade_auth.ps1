<#
.SYNOPSIS
    【已废弃】临时关闭 blade-auth 的验证码校验，并（可选）热重启 blade-auth 使改动生效。

.DESCRIPTION
    ⚠️ 已废弃：验证码现在由系统参数 captcha_mode 控制（blade_param 中 captcha_mode:000000=false，
    租户级，实时读取，无需改代码/重启）。不要再本脚本用于“关闭验证码”——它会注释
    CaptchaTokenGranter 源码并制造需要回滚的脏改动。保留仅作 blade-auth 热重启的通用手段参考。

    旧逻辑：调试期需要用 Playwright 自动登录时，验证码是拦路虎。本脚本：
      1. 注释掉 CaptchaTokenGranter 里的验证码判断（幂等，已关闭则跳过）。
      2. 从正在运行的 blade-auth 进程提取 classpath，单文件重编译改动类到 target/classes。
      3. （仅当 -Restart 时）杀掉旧 blade-auth 进程并用原命令行重新拉起。

    默认只做 1+2（安全地改代码+编译），不杀任何进程；需要让改动生效时再加 -Restart。

.PARAMETER JavaSource
    CaptchaTokenGranter.java 绝对路径。默认取本仓库路径。

.PARAMETER Restart
    开关。传入则杀掉旧 blade-auth 并用原命令行重启（改动才会生效）。

.EXAMPLE
    # 仅改代码 + 重编译（不重启）
    pwsh scripts/restart_blade_auth.ps1

.EXAMPLE
    # 改代码 + 重编译 + 热重启 blade-auth
    pwsh scripts/restart_blade_auth.ps1 -Restart
#>

param(
    [string]$JavaSource = 'd:/workproject/springbladeandreact/springBlade/blade-auth/src/main/java/org/springblade/auth/granter/CaptchaTokenGranter.java',
    [switch]$Restart
)

$ErrorActionPreference = 'Stop'

# ---------- 1. 注释验证码校验（幂等）----------
if (-not (Test-Path $JavaSource)) { throw "找不到源文件: $JavaSource" }
$content = Get-Content $JavaSource -Raw

if ($content -match '临时关闭验证码') {
    Write-Host "INFO: 验证码校验已处于关闭状态，跳过编辑。"
} else {
    $newContent = $content `
        -replace 'if \(code == null \|\| !StringUtil\.equalsIgnoreCase\(redisCode, code\)\) \{',
                 '// 临时关闭验证码，调试用，后续需恢复
	if (code == null || !StringUtil.equalsIgnoreCase(redisCode, code)) {' `
        -replace 'throw new ServiceException\(TokenUtil\.CAPTCHA_NOT_CORRECT\);',
                 '// throw new ServiceException(TokenUtil.CAPTCHA_NOT_CORRECT);'
    Set-Content $JavaSource $newContent -NoNewline
    Write-Host "OK: 已注释验证码校验块。"
}

# ---------- 2. 从运行中的 blade-auth 提取 classpath 并重编译----------
# 兼容两种启动：内联 `-cp ... org.springblade.auth.AuthApplication`，
# 或 `java @args.txt`（主类写在参数文件里，命令行不含主类名）。
$proc = Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq 'java.exe' -and (
        ($_.CommandLine -match 'AuthApplication') -or
        ($_.CommandLine -match '@([^\s"]+)' -and (Test-Path $Matches[1]) -and ((Get-Content $Matches[1] -Raw) -match 'AuthApplication'))
    )
} | Select-Object -First 1

if (-not $proc) {
    Write-Warning "未找到运行中的 blade-auth 进程，无法提取 classpath。请先启动 blade-auth 后再运行本脚本（仅重编译需要）。"
    exit 0
}

# javac 取自运行进程同目录
$javaExe = $proc.ExecutablePath
$javac = Join-Path (Split-Path $javaExe) 'javac.exe'
if (-not (Test-Path $javac)) { $javac = 'javac' }

# 展开 @file 参数文件（blade-auth 常以 `java @args.txt` 方式启动，classpath 在文件里），得到完整参数字符串
$argsText = $proc.CommandLine
foreach ($m in [regex]::Matches($proc.CommandLine, '@([^\s"]+)')) {
    $af = $m.Groups[1].Value
    if (Test-Path $af) { $argsText += "`n" + (Get-Content $af -Raw) }
}

# 从完整参数里提取 -cp / -classpath 的值（classpath 不含空格，以 ; 分隔）
$cpMatch = [regex]::Match($argsText, '(?:-cp|-classpath)\s+([^\s]+)')
if (-not $cpMatch.Success) {
    Write-Warning "未能提取 classpath，跳过重编译。"
    exit 0
}
$cp = $cpMatch.Groups[1].Value

# 输出目录：<module>/src/main/java -> <module>/target/classes
$outDir = $JavaSource.Substring(0, $JavaSource.IndexOf('src/main/java')) + 'target/classes'

Write-Host "INFO: javac = $javac"
Write-Host "INFO: outDir = $outDir"

# 用 @argfile 方式传参：classpath 极长，直接作为命令行参数会超出 Windows 长度限制
$tmpArgs = Join-Path $env:TEMP 'blade-auth-javac.args'
@"
-cp $cp -processorpath $cp -d $outDir $JavaSource
"@ | Set-Content -NoNewline $tmpArgs

# -processorpath 确保 Lombok(@Slf4j 等) 注解处理器运行，否则生成不出 log 等字段
& $javac "@$tmpArgs"
if ($LASTEXITCODE -ne 0) { throw "javac 重编译失败 (exit=$LASTEXITCODE)" }
Write-Host "OK: 已重编译 CaptchaTokenGranter 到 $outDir"

# ---------- 3. （可选）热重启 ----------
if (-not $Restart) {
    Write-Host "INFO: 未传 -Restart，未重启进程。改动将在下次 blade-auth 启动时生效（或在 IDE 里重启）。"
    exit 0
}

$oldPid = $proc.ProcessId
$cmdline = $proc.CommandLine
$runCmd = Join-Path $env:TEMP 'blade-auth-run.cmd'
"@echo off`n$cmdline" | Set-Content -NoNewline $runCmd

Write-Host "INFO: 杀掉旧 blade-auth (pid=$oldPid) ..."
Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "INFO: 用原命令行重启 blade-auth ..."
Start-Process -FilePath 'cmd.exe' -ArgumentList "/c","$runCmd" -WindowStyle Hidden
Start-Sleep -Seconds 3

# 轮询等待新进程起来（Spring Boot 启动较慢，最多等 60s），排除旧 pid 与 @file 形式
$newProc = $null
for ($i = 0; $i -lt 30; $i++) {
    $newProc = Get-CimInstance Win32_Process | Where-Object {
        $_.ProcessId -ne $oldPid -and $_.Name -eq 'java.exe' -and (
            ($_.CommandLine -match 'AuthApplication') -or
            ($_.CommandLine -match '@([^\s"]+)' -and (Test-Path $Matches[1]) -and ((Get-Content $Matches[1] -Raw) -match 'AuthApplication'))
        )
    } | Select-Object -First 1
    if ($newProc) { break }
    Start-Sleep -Seconds 2
}
if ($newProc) {
    Write-Host ("OK: blade-auth 已重启，新 pid=" + $newProc.ProcessId)
} else {
    Write-Warning "重启后未检测到 blade-auth 进程，请检查 $runCmd"
}
