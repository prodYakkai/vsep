# Define paths
$outputDir = "out"
$outputZip = Join-Path -Path $outputDir -ChildPath "vsep.zip"

# Run npm install in src/static
Write-Host "Running npm install in src/static..."
Set-Location -Path "src/static" | Out-Null
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Error "npm install in src/static failed."
    exit $LASTEXITCODE
}
Set-Location -Path ".." | Out-Null # Return to the original directory
Set-Location -Path ".." | Out-Null # Return to the original directory

# Ensure output directory exists
if (-not (Test-Path -Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

# Run npm build
Write-Host "Running npm build..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "npm build failed."
    exit $LASTEXITCODE
}

# Create the zip file
Compress-Archive -Path "dist/", "keys/", "node_modules" , "package-lock.json" ,"package.json", "launch.ps1" -DestinationPath $outputZip -Force

Write-Host "Package created at $outputZip"