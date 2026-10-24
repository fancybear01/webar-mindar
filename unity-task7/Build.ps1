param(
    [string]$UnityEditor = 'C:\Program Files\Unity\Hub\Editor\6000.3.7f1\Editor\Unity.exe',
    [switch]$CopyToSite
)
$ErrorActionPreference = 'Stop'
$project = $PSScriptRoot
if (-not (Test-Path -LiteralPath $UnityEditor)) { throw "Unity Editor not found: $UnityEditor" }
if (-not (Test-Path -LiteralPath (Join-Path (Split-Path $UnityEditor) 'Data\PlaybackEngines\WebGLSupport'))) {
    throw 'Install Web Build Support for Unity 6000.3.7f1 in Unity Hub first.'
}
# Remove the previous success marker so a failed build cannot pass validation.
$metrics = Join-Path $project 'Build\WebGL\build-metrics.json'
if (Test-Path -LiteralPath $metrics) { Remove-Item -LiteralPath $metrics }
$buildLog = Join-Path $project 'build.log'
$unityArgs = '-batchmode -quit -nographics -accept-apiupdate -buildTarget WebGL -projectPath "{0}" -executeMethod WebAR.Task7.Editor.BuildTask7.Build -logFile "{1}"' -f $project, $buildLog
$process = Start-Process -FilePath $UnityEditor -ArgumentList $unityArgs -WindowStyle Hidden -PassThru -Wait
if ($process.ExitCode -ne 0) { throw "Unity failed (exit $($process.ExitCode)). Read $buildLog" }
$webgl = Join-Path $project 'Build\WebGL'
foreach ($file in @('index.html', 'build-metrics.json', 'task7-input.mjs')) {
    if (-not (Test-Path -LiteralPath (Join-Path $webgl $file))) { throw "Build file missing: $file. Read $buildLog" }
}
if (-not (Get-ChildItem -LiteralPath (Join-Path $webgl 'Build') -Filter '*.wasm')) { throw 'WebGL WASM is missing.' }
$buildMetrics = Get-Content -Raw -LiteralPath $metrics | ConvertFrom-Json
if ($buildMetrics.task -ne 7) { throw 'Wrong task build. Expected task 7.' }
if (-not (Select-String -LiteralPath $buildLog -SimpleMatch 'TASK7_BUILD_SUCCESS' -Quiet)) { throw "No successful build marker in $buildLog" }
Write-Host "Task 7 WebGL build ready: $webgl"
Get-Content -LiteralPath $metrics
if ($CopyToSite) {
    $siteOutput = Join-Path (Split-Path $project) 'unity-interactive'
    if (-not (Test-Path -LiteralPath $siteOutput)) { New-Item -ItemType Directory -Path $siteOutput | Out-Null }
    Copy-Item -Path (Join-Path $webgl '*') -Destination $siteOutput -Recurse -Force
    Write-Host "Copied task 7 build to $siteOutput. Commit and push this folder to publish it."
}
