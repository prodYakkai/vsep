# Array to store Chromium PIDs
$chromiumPids = @()
# Variable to store Node process ID
$nodePid = $null

$appDir = "$env:USERPROFILE/vsep"

# Patch for self-signed certificate handling in PowerShell
#check if the certificate check is already bypassed
if (-not $([System.Net.ServicePointManager]::CertificatePolicy).Equals("TrustAllCertsPolicy")) {
add-type @"
using System.Net;
using System.Security.Cryptography.X509Certificates;
public class TrustAllCertsPolicy : ICertificatePolicy {
    public bool CheckValidationResult(
        ServicePoint srvPoint, X509Certificate certificate,
        WebRequest request, int certificateProblem) {
            return true;
        }
 }
"@
[System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllCertsPolicy
}

# Function to kill all launched Chromium processes on script exit
function Cleanup {
    Write-Host "Closing Chromium windows and Node app..."
    foreach ($pidChrome in $chromiumPids) {
        try {
            Stop-Process -Id $pidChrome -Force -ErrorAction SilentlyContinue
        }
        catch {
            # Ignore errors if process already closed
        }
    }
    if ($nodePid) {
        try {
            Write-Host "Closing Node.js process with PID: $nodePid"
            Stop-Process -Id $nodePid -Force -ErrorAction SilentlyContinue
        }
        catch {
            # Ignore errors if process already closed
        }
    }
}

# Register cleanup function to run on script exit
Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { 
    Cleanup
    exit 0
}
Register-EngineEvent -SourceIdentifier ([System.Management.Automation.PsEngineEvent]::Exiting) -Action { 
    Cleanup
    exit 0
}

# Function to test endpoint with self-signed certificate
function Test-Endpoint {
    try {
        $response = Invoke-WebRequest -Uri "https://localhost:3000/ping" -Method Get -TimeoutSec 5
        # print response status code for debugging
        Write-Host "Response Status Code: $($response.StatusCode)" -ForegroundColor Green
        return $response.StatusCode -eq 200
    }
    catch {
        return $false
    }
}

# Function to find Node.js process
function Get-NodeProcess {
    # Wait a moment for the process to start
    Start-Sleep -Seconds 1
    # Look for node.exe processes started recently
    $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | 
        Where-Object { $_.StartTime -gt (Get-Date).AddSeconds(-5) }
    
    if ($nodeProcesses) {
        # Return the first matching node process ID
        return $nodeProcesses[0].Id
    }
    return $null
}

# Function to check if port 6379 is open and listening
function Test-Port6379 {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("localhost", 6379)
        $tcp.Close()
        return $true
    }
    catch {
        return $false
    }
}

# Check if port 6379 is open
Write-Host "Checking if port 6379 is open and listening..."
$portMaxAttempts = 10  # Maximum attempts to check port
$portAttempt = 0
$portOpen = $false

while (-not $portOpen -and $portAttempt -lt $portMaxAttempts) {
    $portOpen = Test-Port6379
    if (-not $portOpen) {
        Start-Sleep -Seconds 1
        $portAttempt++
        Write-Host "Port check attempt $portAttempt of $portMaxAttempts..."
    }
}

if (-not $portOpen) {
    Write-Host "Error: Port 6379 is not open after $portMaxAttempts attempts. Is Redis running?"
    exit 1
}
Write-Host "Port 6379 is open and listening!"

# Install node app dependencies if not already installed
if (-not (Test-Path -Path "$appDir/node_modules")) {
    Write-Host "Node modules not found, installing dependencies..."
    # Ensure the directory exists
    if (-not (Test-Path -Path $appDir)) {
        New-Item -ItemType Directory -Path $appDir -Force | Out-Null
    }
    Set-Location -Path $appDir | Out-Null
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "npm install failed."
        exit $LASTEXITCODE
    }
    Set-Location -Path ".." | Out-Null # Return to the original directory
} else {
    Write-Host "Node modules already installed."
}

# Install static dir npm dependencies if not already installed
if (-not (Test-Path -Path "$appDir/src/static/node_modules")) {
    Write-Host "Static dir node modules not found, installing dependencies..."
    # Change to the static directory
    Set-Location -Path "$appDir/src/static" | Out-Null
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "npm install in src/static failed."
        exit $LASTEXITCODE
    }
    Set-Location -Path "../../" | Out-Null # Return to the original directory
} else {
    Write-Host "Static dir node modules already installed."
}

# Launch Node.js app with npm run start
Write-Host "Starting Node.js application..."
$nodeProcess = Start-Process -FilePath "node.exe" -ArgumentList "./dist/index.js" -WorkingDirectory $appDir -PassThru
# Try to find the actual Node.js process
$nodePid = Get-NodeProcess
if (-not $nodePid) {
    Write-Host "Warning: Could not find Node.js process ID, cleanup might not work properly"
}
# Wait for the Node app to respond
Write-Host "Waiting for Node app to respond at https://localhost:3000/ping..."
$maxAttempts = 30  # Maximum attempts (30 seconds if 1 second between attempts)
$attempt = 0
$success = $false

while (-not $success -and $attempt -lt $maxAttempts) {
    $success = Test-Endpoint
    if (-not $success) {
        Start-Sleep -Seconds 1
        $attempt++
        Write-Host "Attempt $attempt of $maxAttempts..."
    }
}

if (-not $success) {
    Write-Host "Error: Node app failed to respond after $maxAttempts attempts"
    Cleanup
    exit 1
}

Write-Host "Node app is responding successfully!"

# Get all connected monitors
$monitors = Get-WmiObject -Namespace root\wmi -Class WmiMonitorBasicDisplayParams | 
    Where-Object { $_.Active -eq $true }

# Get monitor positions and sizes using System.Windows.Forms
Add-Type -AssemblyName System.Windows.Forms
$screenInfo = [System.Windows.Forms.Screen]::AllScreens

# Counter for monitor identification
$monitorCount = 0

foreach ($monitor in $screenInfo) {
    $monitorCount++
    # Get monitor properties
    $width = $monitor.Bounds.Width
    $height = $monitor.Bounds.Height
    $x_offset = $monitor.Bounds.X
    $y_offset = $monitor.Bounds.Y

    Write-Host "Monitor: $monitorCount, Geometry: $($width)x$($height)+$($x_offset)+$($y_offset)"
    Write-Host "Width: $width, Height: $height, X Offset: $x_offset, Y Offset: $y_offset"

    # Create a new directory for the monitor config
    $userProfile = $env:USERPROFILE
    $configDir = Join-Path $userProfile ".config\chromium\monitor$monitorCount"
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null

    # Assuming Chromium is installed in default Program Files location
    # Adjust the path if your Chromium installation is different
    $chromiumPath = "C:\Program Files\Chromium\chrome.exe"
    if (-not (Test-Path $chromiumPath)) {
        $chromiumPath = "$env:USERPROFILE\AppData\Local\Chromium\Application\chrome.exe"
    }

    # Launch Chromium window with parameters
    $process = Start-Process -FilePath $chromiumPath -ArgumentList `
        "--chrome-frame",
        "--window-position=$x_offset,$y_offset",
        "--window-size=$width,$height",
        "--user-data-dir=`"$configDir`"",
        "--app=file:///$appDir/dist/static/projection-whep.html?id=monitor$monitorCount",
        "--autoplay-policy=no-user-gesture-required",
        "--kiosk",
        "--allow-hidden-media-playback",
        "--use-fake-ui-for-media-stream",
        "--test-type",
        "--enable-exclusive-audio",
        "--ignore-certificate-errors",
        "--suppress-badflags-warnings" `
        -PassThru

    # Store the PID
    $chromiumPids += $process.Id
}

Write-Host "Chromium windows launched on all connected monitors."

[reflection.assembly]::LoadWithPartialName('system.windows.forms')
$frm = New-Object System.Windows.Forms.Form
$frm.Text = "VSEP Application"
$frm.Size = New-Object System.Drawing.Size(300, 200)
$frm.StartPosition = "CenterScreen"
$frm.FormBorderStyle = 'FixedDialog'
$frm.add_FormClosing({ 
    Cleanup
})
$frm.ShowDialog()

exit 0 