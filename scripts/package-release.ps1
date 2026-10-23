$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$taskDist = Join-Path $taskRoot 'dist'
$taskReleases = [IO.Path]::GetFullPath((Join-Path $taskRoot 'artifacts/releases'))
if (-not $taskReleases.StartsWith($taskRoot + [IO.Path]::DirectorySeparatorChar)) { throw '打包目录归属异常' }
if (-not (Test-Path -LiteralPath $taskReleases)) { New-Item -ItemType Directory -Path $taskReleases | Out-Null }
$taskZipPath = Join-Path $taskReleases '星域节点-前沿行动试玩.zip'
$taskStream = [IO.File]::Open($taskZipPath, [IO.FileMode]::Create, [IO.FileAccess]::Write)
$taskArchive = [IO.Compression.ZipArchive]::new($taskStream, [IO.Compression.ZipArchiveMode]::Create, $false, [Text.Encoding]::UTF8)
try {
  foreach ($taskName in @('星域节点.html','运行说明.txt')) {
    $taskPath = Join-Path $taskDist $taskName
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($taskArchive,$taskPath,$taskName,[IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
  $taskSources = @()
  foreach ($taskDirectory in @('src','scripts','tests','doc','public/art','.github')) {
    $taskSources += Get-ChildItem -LiteralPath (Join-Path $taskRoot $taskDirectory) -File -Recurse
  }
  foreach ($taskName in @('README.md','CHANGELOG.md','.gitignore','package.json','package-lock.json','tsconfig.json','vite.config.ts','index.html')) {
    $taskSources += Get-Item -LiteralPath (Join-Path $taskRoot $taskName)
  }
  foreach ($taskFile in $taskSources) {
    $taskRelative = [IO.Path]::GetRelativePath($taskRoot,$taskFile.FullName)
    if ($taskRelative.StartsWith('..')) { throw '源码文件越界' }
    $taskRelative = $taskRelative.Replace([IO.Path]::DirectorySeparatorChar,'/')
    if ($taskRelative -eq 'src/counter.ts' -or $taskRelative.StartsWith('src/assets/') -or $taskRelative.EndsWith('.tmp.md')) { continue }
    $taskEntry = 'source/' + $taskRelative
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($taskArchive,$taskFile.FullName,$taskEntry,[IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $taskArchive.Dispose(); $taskStream.Dispose() }
Get-Item -LiteralPath $taskZipPath | Select-Object FullName,Length
