import { BaseProjection } from './BaseProjection.js';

export class WHEPProjection extends BaseProjection {
    constructor(projectionId) {
        super(projectionId, 'whep');
        this.sdk = null;
        this.videoElement = null;
        this.statsInterval = null;
        this.lastStatsTimestamp = 0;
        this.lastBytesReceived = 0;
    }

    setupEventListeners() {
        this.videoElement = document.getElementById('rtc_media_player');
        this.testCardElement = document.getElementById('test-card');
        
        if (this.videoElement) {
            this.videoElement.style.display = 'none';
        }
    }

    async onProjectionStateLoaded(state) {
        await super.onProjectionStateLoaded(state);
        if (state.url && state.url !== '') {
            await this.startPlayWhep(state.url, state.activeDevice);
        }
    }

    async startPlayback() {
        await super.startPlayback();
        if (this.videoElement) {
            await this.videoElement.play();
        }
    }

    async stopPlayback() {
        // Stop stats collection when stopping playback
        this.stopStatsCollection();
        
        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.style.display = 'none';
        }
        if (this.sdk) {
            this.sdk.close();
            this.sdk = null;
        }
        
        // Call super method which will set player status to stopped
        await super.stopPlayback();
    }

    async setAudioDevice(device) {
        if (!this.videoElement) return;
        
        const deviceCandidate = await this.lookupDevice(device.deviceId, device.label);
        if (deviceCandidate && this.videoElement.setSinkId) {
            try {
                await this.videoElement.setSinkId(deviceCandidate.deviceId);
                console.log('Audio device set to:', deviceCandidate.label);
            } catch (error) {
                console.error('Error setting audio device:', error);
            }
        }
    }

    async getActiveAudioDevice() {
        if (!this.videoElement) {
            return { deviceId: 'default', label: 'default' };
        }
        
        const sinkId = this.videoElement.sinkId || 'default';
        return {
            deviceId: sinkId,
            label: sinkId
        };
    }

    async startPlayWhep(url, device) {
        if (!url || url === '') {
            console.error('Invalid URL provided for WHEP playback');
            this.setPlayerError(new Error('Invalid URL provided for WHEP playback'));
            return;
        }

        console.log('WHEPProjection: Starting WHEP playback, hiding test card');
        
        // Set player status to loading
        this.setPlayerLoading(url, 'whep');
        
        this.hideTestCard();
        
        // Hide fullscreen warning when media starts
        this.hideFullscreenWarning();
        
        if (this.videoElement) {
            this.videoElement.style.display = 'block';
        }

        // Close existing connection
        if (this.sdk) {
            this.sdk.close();
        }

        this.sdk = new SrsRtcWhipWhepAsync(device);
        
        this.sdk.pc.addEventListener('connectionstatechange', (event) => {
            console.log('Connection state change:', event.target.connectionState);
            if (event.target.connectionState === 'connected') {
                console.log('WebRTC connection established');
            } else if (event.target.connectionState === 'failed') {
                this.setPlayerError(new Error('WebRTC connection failed'));
            } else if (event.target.connectionState === 'disconnected') {
                this.setPlayerStopped();
            }
        });

        this.sdk.pc.addEventListener('iceconnectionstatechange', (event) => {
            console.log('ICE connection state change:', event.target.iceConnectionState);
            if (this.sdk.pc.iceConnectionState === 'failed') {
                console.warn('ICE connection failed, restarting...');
                this.setPlayerError(new Error('ICE connection failed'));
                this.sdk.pc.restartIce();
            } else if (this.sdk.pc.iceConnectionState === 'connected') {
                // Connection established, but wait for media events to set playing status
                console.log('ICE connection established');
            }
        });

        if (this.videoElement) {
            this.videoElement.srcObject = this.sdk.stream;
            
            // Add video element event handlers for player status tracking
            this.videoElement.addEventListener('loadstart', () => {
                console.log('Video load started');
                this.setPlayerLoading(url, 'whep');
            });
            
            this.videoElement.addEventListener('canplay', () => {
                console.log('Video can play');
                this.updatePlayerStatus({
                    mediaInfo: { canPlay: true, readyState: this.videoElement.readyState }
                });
            });
            
            this.videoElement.addEventListener('playing', () => {
                console.log('Video is playing');
                this.setPlayerPlaying({
                    canPlay: true,
                    duration: this.videoElement.duration,
                    readyState: this.videoElement.readyState
                });
                // Start collecting WebRTC stats when playback begins
                this.startStatsCollection();
            });
            
            this.videoElement.addEventListener('pause', () => {
                console.log('Video paused');
                this.setPlayerState('paused');
            });
            
            this.videoElement.addEventListener('ended', () => {
                console.log('Video ended');
                this.setPlayerStopped();
            });
            
            this.videoElement.addEventListener('error', (e) => {
                console.error('Video error:', e);
                this.setPlayerError(new Error(`Video error: ${e.message || 'Unknown error'}`));
            });
        }

        try {
            const session = await this.sdk.play(url, {
                videoOnly: false,
                audioOnly: false
            });
            
            if (this.videoElement) {
                await this.videoElement.play();
            }
            
            if (device) {
                await this.setAudioDevice(device);
            }
            
            
            console.log('WHEP playback started successfully');
        } catch (error) {
            console.error('Error starting WHEP playback:', error);
            
            // Set player error status
            this.setPlayerError(error);
            
            if (this.sdk) {
                this.sdk.close();
            }
            if (this.videoElement) {
                this.videoElement.style.display = 'none';
            }
            this.showTestCard();
            // Show fullscreen warning again if not in fullscreen
            if (this.testCard && !this.testCard.monitoringState?.isFullscreen) {
                this.showFullscreenWarning();
            }
        }
    }

    startStatsCollection() {
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
        }
        
        console.log('Starting WebRTC stats collection for WHEP');
        this.statsInterval = setInterval(() => {
            this.collectWebRTCStats();
        }, 2000); // Collect stats every 2 seconds
    }

    stopStatsCollection() {
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = null;
            console.log('Stopped WebRTC stats collection for WHEP');
        }
    }

    async collectWebRTCStats() {
        if (!this.sdk || !this.sdk.pc) {
            return;
        }

        try {
            const stats = await this.sdk.pc.getStats();
            const parsedStats = this.parseWebRTCStats(stats);
            
            if (parsedStats) {
                console.log('WHEP WebRTC Stats:', parsedStats);
                this.updateConnectionStats(parsedStats);
            }
        } catch (error) {
            console.error('Error collecting WebRTC stats:', error);
        }
    }

    parseWebRTCStats(stats) {
        let inboundRtp = null;
        let remoteInbound = null;
        let videoTrack = null;
        let candidatePair = null;

        // Find relevant stats
        stats.forEach((stat) => {
            switch (stat.type) {
                case 'inbound-rtp':
                    if (stat.mediaType === 'video' && stat.kind === 'video') {
                        inboundRtp = stat;
                    }
                    break;
                case 'remote-inbound-rtp':
                    if (stat.mediaType === 'video' && stat.kind === 'video') {
                        remoteInbound = stat;
                    }
                    break;
                case 'track':
                    if (stat.kind === 'video') {
                        videoTrack = stat;
                    }
                    break;
                case 'candidate-pair':
                    if (stat.state === 'succeeded') {
                        candidatePair = stat;
                    }
                    break;
            }
        });

        if (!inboundRtp) {
            return null;
        }

        const now = Date.now();
        const timeDelta = (now - this.lastStatsTimestamp) / 1000; // seconds
        this.lastStatsTimestamp = now;

        // Calculate bitrate
        let bitrate = null;
        if (this.lastBytesReceived > 0 && timeDelta > 0) {
            const bytesDelta = (inboundRtp.bytesReceived || 0) - this.lastBytesReceived;
            bitrate = Math.round((bytesDelta * 8) / timeDelta); // bits per second
        }
        this.lastBytesReceived = inboundRtp.bytesReceived || 0;

        // Calculate packet loss rate
        let packetLossRate = null;
        if (inboundRtp.packetsReceived && inboundRtp.packetsLost !== undefined) {
            const totalPackets = inboundRtp.packetsReceived + inboundRtp.packetsLost;
            packetLossRate = totalPackets > 0 ? ((inboundRtp.packetsLost / totalPackets) * 100) : 0;
        }

        return {
            rtt: candidatePair?.currentRoundTripTime ? Math.round(candidatePair.currentRoundTripTime * 1000) : null,
            packetsLost: inboundRtp.packetsLost || 0,
            packetsReceived: inboundRtp.packetsReceived || 0,
            packetLossRate: packetLossRate ? Math.round(packetLossRate * 100) / 100 : null,
            bytesReceived: inboundRtp.bytesReceived || 0,
            bitrate: bitrate,
            jitter: inboundRtp.jitter ? Math.round(inboundRtp.jitter * 1000) : null,
            frameRate: videoTrack?.framesPerSecond || inboundRtp.framesPerSecond || null,
            resolution: videoTrack ? `${videoTrack.frameWidth}x${videoTrack.frameHeight}` : null,
            codecName: inboundRtp.codecId ? this.getCodecName(stats, inboundRtp.codecId) : null
        };
    }

    getCodecName(stats, codecId) {
        let codecName = null;
        stats.forEach((stat) => {
            if (stat.type === 'codec' && stat.id === codecId) {
                codecName = stat.mimeType ? stat.mimeType.split('/')[1] : null;
            }
        });
        return codecName;
    }

    destroy() {
        this.stopStatsCollection();
        if (this.sdk) {
            this.sdk.close();
            this.sdk = null;
        }
        super.destroy();
    }
}