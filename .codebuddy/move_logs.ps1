$LOGDIR = 'D:\project\springbladeandreact\log'
New-Item -ItemType Directory -Force -Path $LOGDIR | Out-Null

$files = @(
  'D:\project\springbladeandreact\SpringBlade\blade-auth\target\auth.err.log',
  'D:\project\springbladeandreact\SpringBlade\blade-auth\target\auth.out.log',
  'D:\project\springbladeandreact\SpringBlade\blade-auth\target\blade-auth-run.log',
  'D:\project\springbladeandreact\SpringBlade\blade-auth\target\blade-auth.err.log',
  'D:\project\springbladeandreact\SpringBlade\blade-auth\target\blade-auth.out.log',
  'D:\project\springbladeandreact\SpringBlade\blade-gateway\target\blade-gateway-run.log',
  'D:\project\springbladeandreact\SpringBlade\blade-service\blade-message\msg_stderr.log',
  'D:\project\springbladeandreact\SpringBlade\blade-service\blade-message\msg_stdout.log',
  'D:\project\springbladeandreact\SpringBlade\blade-service\blade-workflow\wf_stdout.log',
  'D:\project\springbladeandreact\SpringBlade\blade-service\blade-system\target\blade-system.err.log',
  'D:\project\springbladeandreact\SpringBlade\blade-service\blade-system\target\blade-system.out.log',
  'D:\project\springbladeandreact\SpringBlade\blade-gateway-d.err.log',
  'D:\project\springbladeandreact\SpringBlade\blade-gateway-d.log',
  'D:\project\springbladeandreact\SpringBlade\nacos-start.err.log',
  'D:\project\springbladeandreact\SpringBlade\nacos-start.log',
  'D:\project\springbladeandreact\SpringBlade\doc\tools\verify_migration.out.log'
)

$moved = @(); $locked = @()
foreach ($f in $files) {
  if (-not (Test-Path $f)) { continue }
  try {
    Move-Item -LiteralPath $f -Destination (Join-Path $LOGDIR ([IO.Path]::GetFileName($f))) -ErrorAction Stop
    $moved += [IO.Path]::GetFileName($f)
  } catch {
    $locked += [IO.Path]::GetFileName($f)
  }
}
"MOVED: $($moved -join ', ')"
"LOCKED (in use, skip): $($locked -join ', ')"
