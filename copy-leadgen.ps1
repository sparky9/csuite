$source = 'C:\Users\pc\projects\Lead gen app'
$destRoot = Join-Path $source 'csuite-pivot\lead-gen-app'
if (-not (Test-Path $destRoot)) {
    New-Item -ItemType Directory -Path $destRoot | Out-Null
}
$excludeTop = @('csuite-pivot','online-c-suite','.claude')
$reserved = @('con','prn','aux','nul','com1','com2','com3','com4','com5','com6','com7','com8','com9','lpt1','lpt2','lpt3','lpt4','lpt5','lpt6','lpt7','lpt8','lpt9')
$excludeSub = @('node_modules','dist','.git','.vscode','.claude','.cache','.turbo','.next','coverage','build','out','tmp','temp','logs','.venv','__pycache__','.mypy_cache','.pytest_cache','build_env')
$excludeFiles = @('.env','*.log','package-lock.json','pnpm-lock.yaml','yarn.lock','DockerDesktopInstaller.exe')

Get-ChildItem -Path $source -Directory | Where-Object { $excludeTop -notcontains $_.Name -and $reserved -notcontains $_.Name.ToLowerInvariant() } | ForEach-Object {
    $target = Join-Path $destRoot $_.Name
    $args = @($_.FullName, $target, '/E','/NFL','/NDL','/NJH','/NJS','/NC','/NS','/XO')
    foreach ($x in $excludeSub) { $args += '/XD'; $args += $x }
    foreach ($f in $excludeFiles) { $args += '/XF'; $args += $f }
    robocopy @args | Out-Null
}

Get-ChildItem -Path $source -File | Where-Object { $excludeFiles -notcontains $_.Name -and $reserved -notcontains $_.Name.ToLowerInvariant() } | ForEach-Object {
    Copy-Item $_.FullName -Destination $destRoot -Force
}
