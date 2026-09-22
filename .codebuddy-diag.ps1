$ErrorActionPreference = 'SilentlyContinue'
$p = 'd:/workproject/springbladeandreact/ant-design-pro'
$src = Join-Path $p 'src'
$up = Join-Path $src 'univer-packages'
$ul = Join-Path $src 'univer-lib'
$all = Get-ChildItem $src -Recurse -File
'src total MB: ' + [math]::Round((($all | Measure-Object Length -Sum).Sum / 1MB), 1)
'src total files: ' + ($all).Count
if (Test-Path $up) {
  $f = Get-ChildItem $up -Recurse -File
  'univer-packages MB: ' + [math]::Round((($f | Measure-Object Length -Sum).Sum / 1MB), 1) + ' files: ' + $f.Count
}
if (Test-Path $ul) {
  $f2 = Get-ChildItem $ul -Recurse -File
  'univer-lib MB: ' + [math]::Round((($f2 | Measure-Object Length -Sum).Sum / 1MB), 1) + ' files: ' + $f2.Count
}
$rest = $all | Where-Object { $_.FullName -notlike '*univer-packages*' -and $_.FullName -notlike '*univer-lib*' }
'src excluding univer* MB: ' + [math]::Round((($rest | Measure-Object Length -Sum).Sum / 1MB), 1) + ' files: ' + $rest.Count
'top 15 biggest files in src (excluding univer*):'
$rest | Sort-Object Length -Descending | Select-Object -First 15 | ForEach-Object { [math]::Round($_.Length / 1KB, 0).ToString() + ' KB  ' + $_.FullName.Substring($p.Length + 1) }
