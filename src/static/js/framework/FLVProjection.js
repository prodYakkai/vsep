import { BaseProjection } from './BaseProjection.js';

export class FLVProjection extends BaseProjection {
    constructor(projectionId) {
        super(projectionId, 'flv');
        this.player = null;
        this.videoElement = null;
    }

    setupEventListeners() {
        this.videoElement = document.getElementById('flv_media_player');
        this.testCardElement = document.getElementById('test-card');
        
        if (this.videoElement) {
            this.videoElement.style.display = 'none';
        }
    }

    async onProjectionStateLoaded(state) {
        await super.onProjectionStateLoaded(state);
        if (state.url && state.url !== '') {
            await this.startPlayFLV(state.url, state.activeDevice);
        }
    }

    async startPlayback() {
        await super.startPlayback();
        if (this.videoElement) {
            await this.videoElement.play();
        }
    }

    async stopPlayback() {
        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.style.display = 'none';
        }
        if (this.player) {
            this.player.destroy();
            this.player = null;
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

    async startPlayFLV(url, device) {
        if (!url || url === '') {
            console.error('Invalid URL provided for FLV playback');
            this.setPlayerError(new Error('Invalid URL provided for FLV playback'));
            return;
        }

        console.log('FLVProjection: Starting FLV playback, hiding test card');
        
        // Set player status to loading
        this.setPlayerLoading(url, 'flv');
        
        this.hideTestCard();
        
        // Hide fullscreen warning when media starts
        this.hideFullscreenWarning();
        
        if (this.videoElement) {
            this.videoElement.style.display = 'block';
        }

        // Destroy existing player
        if (this.player) {
            this.player.destroy();
        }

        try {
            // Check if mpegts is available
            if (typeof mpegts === 'undefined') {
                throw new Error('mpegts.js library not loaded');
            }

            if (mpegts.getFeatureList().mseLivePlayback) {
                this.player = mpegts.createPlayer({
                    type: 'flv',
                    url: url,
                    isLive: true
                });

                this.player.attachMediaElement(this.videoElement);
                this.player.load();
                
                // Set up FLV player event listeners
                this.player.on(mpegts.Events.ERROR, (errorType, errorDetail) => {
                    console.error('FLV Player Error:', errorType, errorDetail);
                    this.setPlayerError(new Error(`FLV Error: ${errorType} - ${errorDetail}`));
                });

                this.player.on(mpegts.Events.LOADING_COMPLETE, () => {
                    console.log('FLV loading complete');
                    this.updatePlayerStatus({
                        hasContent: true,
                        mediaInfo: { canPlay: true }
                    });
                });

                this.player.on(mpegts.Events.RECOVERED_EARLY_EOF, () => {
                    console.log('FLV recovered from early EOF');
                });
                
                // Add video element event handlers for player status tracking
                if (this.videoElement) {
                    this.videoElement.addEventListener('canplay', () => {
                        console.log('FLV video can play');
                        this.updatePlayerStatus({
                            mediaInfo: { canPlay: true, readyState: this.videoElement.readyState }
                        });
                    });
                    
                    this.videoElement.addEventListener('playing', () => {
                        console.log('FLV video is playing');
                        this.setPlayerPlaying({
                            canPlay: true,
                            duration: this.videoElement.duration,
                            readyState: this.videoElement.readyState
                        });
                    });
                    
                    this.videoElement.addEventListener('pause', () => {
                        console.log('FLV video paused');
                        this.setPlayerState('paused');
                    });
                    
                    this.videoElement.addEventListener('ended', () => {
                        console.log('FLV video ended');
                        this.setPlayerStopped();
                    });
                    
                    this.videoElement.addEventListener('error', (e) => {
                        console.error('FLV video error:', e);
                        this.setPlayerError(new Error(`Video error: ${e.message || 'Unknown error'}`));
                    });
                }

                await this.player.play();
                
                if (device) {
                    await this.setAudioDevice(device);
                }
                
                
                console.log('FLV playback started successfully');
            } else {
                throw new Error('MSE Live Playback not supported');
            }
        } catch (error) {
            console.error('Error starting FLV playback:', error);
            
            // Set player error status
            this.setPlayerError(error);
            
            if (this.player) {
                this.player.destroy();
                this.player = null;
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

    destroy() {
        if (this.player) {
            this.player.destroy();
            this.player = null;
        }
        super.destroy();
    }
}