#!/bin/bash

# query number of displays
monitors=($(xrandr --query | grep " connected" | awk '{print $1}'))

# Array to store Chromium PIDs
CHROMIUM_PIDS=()

# Function to kill all launched Chromium processes on script exit
cleanup() {
    echo "Closing Chromium windows..."
    kill "${CHROMIUM_PIDS[@]}" 2>/dev/null
    exit 0
}

# Set trap to catch script exit and execute cleanup
trap cleanup EXIT

# Iterate over each monitor and launch a Chromium window
for monitor in "${monitors[@]}"; do
    # Get the resolution and position of the monitor
    geom=$(xrandr --query | grep -A1 "^$monitor" | head -n1 | grep -oP "([0-9]+)x([0-9]+)\+([0-9]+)\+([0-9]+)")
    # print the resolution and position
    echo "Monitor: $monitor, Geometry: $geom"
    
    # Extract the x and y position from the resolution
    if [[ $geom =~ ([0-9]+)x([0-9]+)\+([0-9]+)\+([0-9]+) ]]; then
        width=${BASH_REMATCH[1]}
        height=${BASH_REMATCH[2]}
        x_offset=${BASH_REMATCH[3]}
        y_offset=${BASH_REMATCH[4]}
        echo "Width: $width, Height: $height, X Offset: $x_offset, Y Offset: $y_offset"

        # make a new directory for the monitor
        mkdir -p /home/$(whoami)/.config/chromium/$monitor
        
        # Launch Chromium window on the detected monitor
        /usr/bin/chromium-browser --chrome-frame -window-position=$x_offset,$y_offset \
        --user-data-dir=/home/$(whoami)/.config/chromium/$monitor --window-size=$width,$height --ignore-certificate-errors \
        --app=file:///home/linux/vsep/dist/static/projection-whep.html\?id=$monitor --autoplay-policy=no-user-gesture-required --kiosk \
        --allow-hidden-media-playback --use-fake-ui-for-media-stream --test-type --suppress-badflags-warnings &
        
        # Store the PID of the launched Chromium process
        CHROMIUM_PIDS+=($!)
    fi
done

echo "Chromium windows launched on all connected monitors."

# Keep the script running until interrupted (so the trap works)
while true; do sleep 1; done
