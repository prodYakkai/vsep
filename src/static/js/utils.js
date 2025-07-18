// Global utility functions available to all modules
const safeAwait = async (promise) => {
  try {
    return [null, await promise];
  } catch (error) {
    return [error, null];
  }
}

const getMediaDeviceInfo = async () => {
    try{
      const streams = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); // Request permission
      streams.getTracks().forEach((track) => track.stop());
    } catch (error) {
        console.error('Error accessing media devices:', error);
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioOutput = devices.find(
      (device) => device.kind === 'audiooutput',
    );
    if (audioOutput) {
      console.log(
        'default Media Device ID:',
        audioOutput.deviceId,
        audioOutput.label,
      );
      return true;
    }
    console.warn('No default Media Device found');
    return false;
};

const lookupDevice = async (deviceId, label='') => {
    console.log('Looking up device:', deviceId, label); 
    const devices = await navigator.mediaDevices.enumerateDevices();
    const device = devices.find((d) => d.deviceId === deviceId);
    if (device) {
        return device;
    }
    if (label) {
        const device = devices.find((d) => d.label === label);
        if (device) {
            console.warn(`Device not found by ID, found by label: ${device.label}`);
            return device;
        }
    }
    console.warn('Device not found, defaulting to first device');
    return devices.find((d) => d.kind === 'audiooutput');
};

// Make functions available globally for both ES6 modules and legacy scripts
window.safeAwait = safeAwait;
window.getMediaDeviceInfo = getMediaDeviceInfo;
window.lookupDevice = lookupDevice;
