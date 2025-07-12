export interface ProjectionState {
    id: string;
    
    url: string;
    type: 'whep' | 'flv';
    playbackStatus?: 'playing' | 'stopped' | 'idle';

    mediaDevices?: MediaDeviceInfo[];
    activeDevice: MediaDeviceInfo | null;
}

export interface MediaDeviceInfo {
    deviceId: string;
    label: string;
}