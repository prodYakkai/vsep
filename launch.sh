#!/bin/bash

# Array to store Chromium PIDs
CHROMIUM_PIDS=()
# Variable to store Node process ID
NODE_PID=""

# Function to kill all launched processes on script exit
cleanup() {
    echo "Closing Chromium windows and Node app..."
    for pid in "${CHROMIUM_PIDS[@]}"; do
        kill "$pid" 2>/dev/null
    done
    if [ -n "$NODE_PID" ]; then
        kill "$NODE_PID" 2>/dev/null
    fi
    exit 0
}

# Set trap to catch script exit and execute cleanup
trap cleanup EXIT

# Function to test endpoint with self-signed certificate
test_endpoint() {
    curl -s --insecure "https://localhost:3000/ping" >/dev/null 2>&1
    return $?
}


# Function to check if port 6379 is open
test_port_6379() {
    nc -z localhost 6379 2>/dev/null
    return $?
}

# Function to find Node.js process
get_node_process() {
    # Wait briefly for the process to start
    sleep 1
    # Use pgrep to find node process running in the current directory
    # Assuming npm run start executes a node process with a specific script
    NODE_PID=$(pgrep -f "node.*$(pwd)" | head -n1)
    if [ -z "$NODE_PID" ]; then
        # Fallback: look for any recent node process if specific match fails
        NODE_PID=$(pgrep -n node)
    fi
    echo "$NODE_PID"
}

# Check if port 6379 is open
echo "Checking if port 6379 is open and listening..."
port_max_attempts=10
port_attempt=0
port_open=0

while [ $port_open -eq 0 ] && [ $port_attempt -lt $port_max_attempts ]; do
    if test_port_6379; then
        port_open=1
    else
        sleep 1
        port_attempt=$((port_attempt + 1))
        echo "Port check attempt $port_attempt of $port_max_attempts..."
    fi
done

if [ $port_open -eq 0 ]; then
    echo "Error: Port 6379 is not open after $port_max_attempts attempts. Is Redis running?"
    exit 1
fi
echo "Port 6379 is open and listening!"

# Launch Node.js app with npm run start
echo "Starting Node.js application..."
npm run start >/dev/null 2>&1 &
# Capture the PID of the last background process (should be the npm command)
CMD_PID=$!
# Wait briefly and get the actual node process spawned by npm
NODE_PID=$(get_node_process)
if [ -z "$NODE_PID" ]; then
    echo "Warning: Could not find Node.js process ID, cleanup might not work properly"
    # Kill the cmd process as fallback
    NODE_PID=$CMD_PID
fi

# Wait for the Node app to respond
echo "Waiting for Node app to respond at https://localhost:3000/ping..."
max_attempts=30
attempt=0
success=0

while [ $success -eq 0 ] && [ $attempt -lt $max_attempts ]; do
    if test_endpoint; then
        success=1
    else
        sleep 1
        attempt=$((attempt + 1))
        echo "Attempt $attempt of $max_attempts..."
        if [ -z "$NODE_PID" ]; then
            NODE_PID=$(get_node_process)
        fi
    fi
done

if [ $success -eq 0 ]; then
    echo "Error: Node app failed to respond after $max_attempts attempts"
    cleanup
    exit 1
fi

echo "Node app is responding successfully!"

# Query number of displays
monitors=($(xrandr --query | grep " connected" | awk '{print $1}'))

# Iterate over each monitor and launch a Chromium window
for monitor in "${monitors[@]}"; do
    # Get the resolution and position of the monitor
    geom=$(xrandr --query | grep -A1 "^$monitor" | head -n1 | grep -oP "([0-9]+)x([0-9]+)\+([0-9]+)\+([0-9]+)")
    echo "Monitor: $monitor, Geometry: $geom"
    
    # Extract the x and y position from the resolution
    if [[ $geom =~ ([0-9]+)x([0-9]+)\+([0-9]+)\+([0-9]+) ]]; then
        width=${BASH_REMATCH[1]}
        height=${BASH_REMATCH[2]}
        x_offset=${BASH_REMATCH[3]}
        y_offset=${BASH_REMATCH[4]}
        echo "Width: $width, Height: $height, X Offset: $x_offset, Y Offset: $y_offset"

        # Make a new directory for the monitor
        mkdir -p "/home/$(whoami)/vsep-profile/$monitor"
        
        # Launch Chromium window on the detected monitor
        /usr/bin/chromium-browser --chrome-frame --window-position="$x_offset,$y_offset" \
            --user-data-dir="/home/$(whoami)/vsep-profile/$monitor" --window-size="$width,$height" \
            --app="file:///home/$(whoami)/ingester-web/dist/static/projection-whep.html?id=$monitor" \
            --autoplay-policy=no-user-gesture-required --kiosk --ignore-certificate-errors \
            --allow-hidden-media-playback --use-fake-ui-for-media-stream --test-type --suppress-badflags-warnings &
        
        # Store the PID of the launched Chromium process
        CHROMIUM_PIDS+=($!)
    fi
done

echo "Node app and Chromium windows launched on all connected monitors."

# Keep the script running until interrupted
while true; do sleep 1; done