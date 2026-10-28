$ErrorActionPreference='Stop'
$repoRoot=Split-Path -Parent $PSScriptRoot
$pluginRoot=Join-Path $repoRoot 'plugins\codex-quota-panel'
$distRoot=Join-Path $repoRoot 'dist'
$archivePath=Join-Path $distRoot 'codex-quota-panel.zip'
$manifest=Get-Content -LiteralPath (Join-Path $pluginRoot 'plugin.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if($manifest.name -ne 'codex-quota-panel'){throw 'Unexpected plugin identity'}
if($manifest.'$schema' -ne 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json'){throw 'Invalid plugin schema'}
$files=@(Get-ChildItem -LiteralPath $pluginRoot -Recurse -Force -File)
foreach($file in $files){if($file.Name -in @('auth.json','.env') -or $file.FullName -match '[\\/]node_modules[\\/]'){throw 'Unexpected private or dependency file in package'}}
New-Item -ItemType Directory -Path $distRoot -Force | Out-Null
if(Test-Path -LiteralPath $archivePath){Remove-Item -LiteralPath $archivePath -Force}
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$writer=[IO.Compression.ZipFile]::Open($archivePath,[IO.Compression.ZipArchiveMode]::Create)
try {
    foreach($file in $files){
        $relative=$file.FullName.Substring($pluginRoot.Length+1).Replace('\','/')
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($writer,$file.FullName,'codex-quota-panel/'+$relative,[IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
}finally{$writer.Dispose()}
$zip=[IO.Compression.ZipFile]::OpenRead($archivePath)
try {
    if($zip.Entries.Count -ne $files.Count){throw 'Archive file count mismatch'}
    foreach($required in @('plugin.json','mcp.json','.codex-plugin/plugin.json','server/index.cjs','ui/index.html','bin/QuotaReader.exe','assets/icon.svg')){if($null -eq $zip.GetEntry('codex-quota-panel/'+$required)){throw "Missing archive entry: $required"}}
}finally{$zip.Dispose()}
$algorithm=[Security.Cryptography.SHA256]::Create()
$archiveStream=[IO.File]::OpenRead($archivePath)
try{$digest=[BitConverter]::ToString($algorithm.ComputeHash($archiveStream)).Replace('-','').ToLowerInvariant()}finally{$archiveStream.Dispose();$algorithm.Dispose()}
[IO.File]::WriteAllText((Join-Path $distRoot 'SHA256SUMS.txt'),$digest+'  codex-quota-panel.zip'+[Environment]::NewLine,[Text.Encoding]::ASCII)
Write-Output "Package: $archivePath"
