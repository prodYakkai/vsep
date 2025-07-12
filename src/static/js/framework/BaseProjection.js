import { TestCard } from './TestCard.js';

export class BaseProjection {
    constructor(projectionId, type) {
        this.projectionId = projectionId;
        this.type = type;
        this.socket = null;
        this.apiSdk = null;
        this.projectionState = {};
        this.isConnected = false;
        this.testCard = null;
        this.heartbeatInterval = null;
        this.lastHeartbeat = Date.now();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        // Player status tracking
        this.playerStatus = {
            state: 'idle', // 'idle', 'loading', 'playing', 'paused', 'stopped', 'error'
            isActive: false, // True if player is actively engaged with content
            hasContent: false, // True if content is loaded
            url: null,
            type: null,
            error: null,
            timestamp: Date.now(),
            // Media-specific status
            mediaInfo: {
                canPlay: false,
                duration: null,
                currentTime: null,
                buffered: null,
                readyState: 0
            },
            // Connection statistics (mainly for WebRTC/WHEP)
            connectionStats: {
                rtt: null, // Round-trip time in milliseconds
                packetsLost: null, // Total packets lost
                packetsReceived: null, // Total packets received
                packetLossRate: null, // Packet loss rate percentage
                bytesReceived: null, // Total bytes received
                bitrate: null, // Current bitrate in bits per second
                jitter: null, // Jitter in seconds
                frameRate: null, // Video frame rate
                resolution: null, // Video resolution (width x height)
                codecName: null, // Codec being used
                timestamp: null // When stats were last updated
            }
        };
        
        this.init();
    }

    async init() {
        this.setupSocket();
        this.setupApi();
        this.initializeTestCard();
        await this.getMediaDeviceInfo();
        this.setupEventListeners();
        
        // Note: updateInitialStatuses will be called in handleSocketConnect
        // after socket connection is established
    }

    setupSocket() {
        const origin = window.location.host !== '' ? window.location.origin : 'https://localhost:3000';
        this.socket = io(origin);
        
        this.socket.on('connect', () => this.handleSocketConnect());
        this.socket.on('disconnect', () => this.handleSocketDisconnect());
        this.socket.on('error', (error) => this.handleSocketError(error));
        this.socket.on('action', (action) => this.handleSocketAction(action));
        this.socket.on('audioDevice', (device) => this.handleUpdateAudioDevice(device));
        this.socket.on('job', () => this.handleJobUpdate());
        this.socket.on('heartbeat_request', () => this.handleHeartbeatRequest());
        this.socket.on('reconnect', () => this.handleReconnect());
    }

    setupApi() {
        const origin = window.location.host !== '' ? window.location.origin : 'https://localhost:3000';
        this.apiSdk = apiSdkService(origin);
    }

    async getMediaDeviceInfo() {
        console.log('Getting media device info...');
        try {
            const streams = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            streams.getTracks().forEach(track => track.stop());
            console.log('Media device access granted');
        } catch (error) {
            console.error('Error accessing media devices:', error);
            // Update test card with error status
            if (this.testCard) {
                this.testCard.updateAudioStatus([], null);
            }
        }
        
        navigator.mediaDevices.addEventListener('devicechange', async () => {
            console.log('Device change detected');
            await this.syncMediaDevices();
        });
    }

    async handleSocketConnect() {
        console.log('Connected to server');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.lastHeartbeat = Date.now();
        
        // Register this projection with the server
        console.log('Registering projection:', this.projectionId, 'type:', this.type);
        this.socket.emit('projection_register', {
            projectionId: this.projectionId,
            type: this.type,
            timestamp: Date.now()
        });
        
        await this.loadProjectionState();
        
        // Now update all initial statuses after socket is connected and state is loaded
        await this.updateInitialStatuses();
        
        // Start heartbeat
        this.startHeartbeat();
    }

    handleSocketDisconnect() {
        console.log('Disconnected from server');
        this.isConnected = false;
        
        if (this.testCard) {
            this.testCard.updateNetworkStatus(false);
        }
        
        // Stop heartbeat
        this.stopHeartbeat();
        
        // Attempt reconnection
        this.attemptReconnect();
    }

    handleSocketError(error) {
        console.error('Socket error:', error);
    }

    async handleSocketAction(action) {
        console.log('Action received:', action);
        switch (action.action) {
            case 'stop':
                await this.stopPlayback();
                this.showTestCard(); // Show test card when stopped
                break;
            case 'play':
                await this.startPlayback();
                this.hideTestCard(); // Hide test card when playing
                break;
            case 'reload':
                window.location.reload();
                break;
            case 'show_test_card':
                this.showTestCard();
                break;
            case 'hide_test_card':
                this.hideTestCard();
                break;
            default:
                console.warn('Unknown action:', action.action);
        }
    }

    async handleUpdateAudioDevice(device) {
        console.log('Audio device update received:', device);
        await this.setAudioDevice(device);
        await this.syncMediaDevices();
    }

    async handleJobUpdate() {
        console.log('BaseProjection: Job update received');
        await this.loadProjectionState();
        console.log('BaseProjection: Job update processing complete');
    }

    async loadProjectionState() {
        const [err, state] = await safeAwait(
            this.apiSdk.fetchProjection(this.projectionId, this.type, this.socket.id)
        );
        if (err) {
            console.error('Error loading projection state:', err);
            return;
        }
        this.projectionState = state;
        console.log('Projection state loaded:', state);
        await this.onProjectionStateLoaded(state);
    }

    async syncMediaDevices() {
        console.log('Syncing media devices...');
        const [err, devices] = await safeAwait(navigator.mediaDevices.enumerateDevices());
        if (err) {
            console.error('Error loading media devices:', err);
            if (this.testCard) {
                this.testCard.updateAudioStatus([], null);
            }
            return;
        }

        if (!devices || devices.length === 0) {
            console.warn('No media devices found');
            if (this.testCard) {
                this.testCard.updateAudioStatus([], null);
            }
            return;
        }

        console.log('Found devices:', devices.length, 'devices');
        const audioOutputDevices = devices.filter(device => device.kind === 'audiooutput');
        console.log('Audio output devices:', audioOutputDevices.length);
        
        const activeDevice = await this.getActiveAudioDevice();
        console.log('Active device:', activeDevice);
        
        // Update test card with current audio device
        if (this.testCard) {
            console.log('Updating test card audio status');
            this.testCard.updateAudioStatus(audioOutputDevices, activeDevice);
        }
        
        const [errState] = await safeAwait(
            this.apiSdk.updateProjectionDevices(
                this.projectionId,
                audioOutputDevices.map(device => ({
                    deviceId: device.deviceId,
                    label: device.label
                })),
                activeDevice
            )
        );
        
        if (errState) {
            console.error('Error syncing media devices:', errState);
        }
    }

    async lookupDevice(deviceId, label = '') {
        const devices = await navigator.mediaDevices.enumerateDevices();
        let device = devices.find(d => d.deviceId === deviceId);
        
        if (!device && label) {
            device = devices.find(d => d.label === label);
            if (device) {
                console.warn(`Device not found by ID, found by label: ${device.label}`);
            }
        }
        
        if (!device) {
            console.warn('Device not found, defaulting to first audio output device');
            device = devices.find(d => d.kind === 'audiooutput');
        }
        
        return device;
    }

    setupEventListeners() {
        // Override in subclasses
    }

    async onProjectionStateLoaded(state) {
        // Update display status based on projection state
        if (this.testCard) {
            this.testCard.updateDisplayStatus(state && state.url);
        }
        
        // Default behavior: show test card when no URL is set, hide when URL is set
        if (!state || !state.url) {
            console.log('BaseProjection: No play job defined, showing test card');
            this.showTestCard();
        } else {
            console.log('BaseProjection: Play job defined with URL:', state.url, 'hiding test card');
            this.hideTestCard();
        }
        
        // Override in subclasses
    }

    async startPlayback() {
        // Set status to playing
        this.setPlayerPlaying();
        // Override in subclasses
    }

    async stopPlayback() {
        // Set player status to stopped
        this.setPlayerStopped();
        // Show test card when playback stops
        this.showTestCard();
        // Override in subclasses
    }

    async setAudioDevice(device) {
        // Override in subclasses
    }

    async getActiveAudioDevice() {
        // Override in subclasses
        return {
            deviceId: 'default',
            label: 'default'
        };
    }

    initializeTestCard() {
        this.testCard = new TestCard(this.projectionId, this.type);
    }

    hideTestCard() {
        console.log('BaseProjection: Hiding test card');
        if (this.testCard) {
            this.testCard.hide();
        } else {
            console.warn('BaseProjection: No test card available to hide');
        }
    }

    showTestCard() {
        console.log('BaseProjection: Showing test card');
        if (this.testCard) {
            this.testCard.show();
        } else {
            console.warn('BaseProjection: No test card available to show');
        }
    }

    // Delegate methods for backward compatibility
    hideFullscreenWarning() {
        if (this.testCard) {
            this.testCard.hideFullscreenWarning();
        }
    }

    showFullscreenWarning() {
        if (this.testCard) {
            this.testCard.showFullscreenWarning();
        }
    }

    getDisplayStatus() {
        if (this.testCard) {
            return this.testCard.getDisplayStatus();
        }
        return null;
    }

    startHeartbeat() {
        // Stop any existing heartbeat
        this.stopHeartbeat();
        
        console.log('Starting heartbeat for projection:', this.projectionId);
        
        // Send heartbeat every 10 seconds (for testing - should be 30 in production)
        this.heartbeatInterval = setInterval(() => {
            if (this.socket && this.isConnected) {
                const healthStatus = this.getProjectionHealth();
                console.log('Sending heartbeat for', this.projectionId, 'with health:', healthStatus);
                
                this.socket.emit('projection_heartbeat', {
                    projectionId: this.projectionId,
                    timestamp: Date.now(),
                    status: healthStatus
                });
                this.lastHeartbeat = Date.now();
            } else {
                console.warn('Cannot send heartbeat - socket not connected');
            }
        }, 10000);
        
        // Send initial heartbeat after a short delay to ensure everything is initialized
        setTimeout(() => {
            if (this.socket && this.isConnected) {
                const healthStatus = this.getProjectionHealth();
                console.log('Sending initial heartbeat for', this.projectionId, 'with health:', healthStatus);
                
                this.socket.emit('projection_heartbeat', {
                    projectionId: this.projectionId,
                    timestamp: Date.now(),
                    status: healthStatus
                });
            }
        }, 2000);
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    handleHeartbeatRequest() {
        // Respond to server heartbeat request
        if (this.socket && this.isConnected) {
            this.socket.emit('projection_heartbeat_response', {
                projectionId: this.projectionId,
                timestamp: Date.now(),
                status: this.getProjectionHealth()
            });
        }
    }

    handleReconnect() {
        console.log('Reconnection successful');
        this.reconnectAttempts = 0;
    }

    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        
        console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
        
        setTimeout(() => {
            if (!this.isConnected && this.socket) {
                this.socket.connect();
            }
        }, delay);
    }

    getProjectionHealth() {
        const displayStatus = this.testCard?.getDisplayStatus() || {};
        console.log('Getting projection health - testCard exists:', !!this.testCard, 'displayStatus:', displayStatus);
        
        const health = {
            isFullscreen: displayStatus.isFullscreen || false,
            hasMouseCursor: displayStatus.hasMouseCursor || false,
            isFocused: displayStatus.isFocused || true,
            isVisible: displayStatus.isVisible || true,
            hasActiveStream: this.playerStatus.isActive && (this.playerStatus.state === 'playing' || this.playerStatus.state === 'loading'),
            lastUpdate: Date.now(),
            type: this.type,
            reconnectAttempts: this.reconnectAttempts
        };
        
        console.log('Final health object:', health);
        return health;
    }

    async updateInitialStatuses() {
        console.log('Updating initial statuses - isConnected:', this.isConnected, 'testCard exists:', !!this.testCard);
        console.log('Projection state:', this.projectionState);
        
        if (this.testCard) {
            // Update network status based on current connection
            this.testCard.updateNetworkStatus(this.isConnected);
            
            // Update display status based on projection state
            this.testCard.updateDisplayStatus(!!this.projectionState?.url);
            
            // Trigger audio device sync which will update audio status
            await this.syncMediaDevices();
        }
    }

    // Player Status Management Methods
    updatePlayerStatus(updates) {
        const oldStatus = { ...this.playerStatus };
        
        // Update status with new values
        if (typeof updates === 'object') {
            Object.assign(this.playerStatus, updates);
            this.playerStatus.timestamp = Date.now();
        }
        
        // Determine if player is active
        this.playerStatus.isActive = this.playerStatus.state === 'playing' || 
                                    this.playerStatus.state === 'loading' ||
                                    this.playerStatus.state === 'paused';
        
        console.log(`Player status updated for ${this.projectionId}:`, this.playerStatus);
        
        // Emit status change if significant changes occurred
        if (this.hasSignificantStatusChange(oldStatus, this.playerStatus)) {
            this.emitPlayerStatusUpdate();
        }
    }

    hasSignificantStatusChange(oldStatus, newStatus) {
        // Check for significant changes that should trigger control panel updates
        return oldStatus.state !== newStatus.state ||
               oldStatus.isActive !== newStatus.isActive ||
               oldStatus.hasContent !== newStatus.hasContent ||
               oldStatus.error !== newStatus.error;
    }

    emitPlayerStatusUpdate() {
        if (this.socket && this.isConnected) {
            console.log(`Emitting player status update for ${this.projectionId}`);
            this.socket.emit('player_status_update', {
                projectionId: this.projectionId,
                playerStatus: { ...this.playerStatus },
                timestamp: Date.now()
            });
        }
    }

    setPlayerState(state, additionalInfo = {}) {
        this.updatePlayerStatus({
            state,
            ...additionalInfo
        });
    }

    setPlayerLoading(url, type) {
        this.updatePlayerStatus({
            state: 'loading',
            hasContent: false,
            url,
            type,
            error: null
        });
    }

    setPlayerPlaying(mediaInfo = {}) {
        this.updatePlayerStatus({
            state: 'playing',
            hasContent: true,
            error: null,
            mediaInfo: { ...this.playerStatus.mediaInfo, ...mediaInfo }
        });
    }

    setPlayerStopped() {
        this.updatePlayerStatus({
            state: 'stopped',
            isActive: false,
            hasContent: false,
            url: null,
            type: null,
            error: null,
            mediaInfo: {
                canPlay: false,
                duration: null,
                currentTime: null,
                buffered: null,
                readyState: 0
            }
        });
    }

    setPlayerError(error) {
        this.updatePlayerStatus({
            state: 'error',
            isActive: false,
            error: error.message || error.toString(),
            mediaInfo: { ...this.playerStatus.mediaInfo, canPlay: false }
        });
    }

    getPlayerStatus() {
        return { ...this.playerStatus };
    }

    isPlayerActive() {
        return this.playerStatus.isActive;
    }

    updateConnectionStats(stats) {
        this.updatePlayerStatus({
            connectionStats: {
                ...this.playerStatus.connectionStats,
                ...stats,
                timestamp: Date.now()
            }
        });
    }

    destroy() {
        // Stop heartbeat
        this.stopHeartbeat();
        
        // Unregister from server
        if (this.socket && this.isConnected) {
            this.socket.emit('projection_unregister', {
                projectionId: this.projectionId,
                timestamp: Date.now()
            });
        }
        
        if (this.testCard) {
            this.testCard.destroy();
            this.testCard = null;
        }
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}