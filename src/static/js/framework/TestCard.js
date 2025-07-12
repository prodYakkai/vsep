export class TestCard {
    constructor(projectionId, projectionType) {
        this.projectionId = projectionId;
        this.projectionType = projectionType;
        this.isVisible = false; // Start hidden since CSS has display: none
        this.timestampInterval = null;
        
        this.monitoringState = {
            isFullscreen: false,
            hasMouseCursor: false,
            isFocused: true,
            isVisible: true,
            mouseTimer: null,
            performanceTimer: null,
            fullscreenWarningTimer: null
        };

        this.init();
    }

    init() {
        this.initializeContent();
        this.setupDisplayMonitoring();
    }

    initializeContent() {
        console.log('TestCard: Initializing content');
        
        // Update monitor ID from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const monitorId = urlParams.get('id') || 'unknown';
        this.updateValue('monitor-id', monitorId);
        
        // Update screen resolution
        const resolution = `${window.screen.width}×${window.screen.height}`;
        this.updateValue('screen-resolution', resolution);
        
        // Update user agent (truncated for display)
        const userAgent = navigator.userAgent.length > 50 
            ? navigator.userAgent.substring(0, 50) + '...' 
            : navigator.userAgent;
        this.updateValue('user-agent', userAgent);
        
        // Update timestamp
        this.updateTimestamp();
        
        // Set initial statuses - these will be updated later by BaseProjection
        this.updateStatus('network-status', 'CONNECTING', 'status-connecting');
        this.updateStatus('audio-status', 'CHECKING', 'status-connecting');
        this.updateStatus('display-status', 'INITIALIZING', 'status-connecting');
        
        // Start timestamp update interval
        this.timestampInterval = setInterval(() => this.updateTimestamp(), 1000);
    }

    updateValue(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        } else {
            console.warn(`TestCard: Element with id '${elementId}' not found`);
        }
    }

    updateStatus(elementId, status, statusClass) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = status;
            element.className = `test-card-status ${statusClass}`;
        } else {
            console.warn(`TestCard: Element with id '${elementId}' not found`);
        }
    }

    updateTimestamp() {
        const now = new Date();
        const timestamp = now.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        this.updateValue('timestamp', timestamp);
    }

    show() {
        console.log('TestCard: Showing test card');
        const testCard = document.getElementById('test-card');
        if (testCard) {
            testCard.style.display = 'flex';
            this.isVisible = true;
            console.log('TestCard: Test card shown successfully');
        } else {
            console.warn('TestCard: test-card element not found');
        }
    }

    hide() {
        console.log('TestCard: Hiding test card');
        const testCard = document.getElementById('test-card');
        if (testCard) {
            testCard.style.display = 'none';
            this.isVisible = false;
            console.log('TestCard: Test card hidden successfully');
        } else {
            console.warn('TestCard: test-card element not found');
        }
    }

    setupDisplayMonitoring() {
        this.setupFullscreenMonitoring();
        this.setupMouseCursorMonitoring();
        this.setupVisibilityMonitoring();
        this.setupFocusMonitoring();
        this.setupPerformanceMonitoring();
    }

    setupFullscreenMonitoring() {
        const checkFullscreen = () => {
            const isFullscreen = !!(
                document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement
            );
            
            this.monitoringState.isFullscreen = isFullscreen;
            
            if (isFullscreen) {
                this.updateStatus('fullscreen-status', 'ACTIVE', 'status-ready');
            } else {
                this.updateStatus('fullscreen-status', 'WINDOWED', 'status-warning');
            }
        };

        // Check initial state
        checkFullscreen();

        // Monitor fullscreen changes
        document.addEventListener('fullscreenchange', checkFullscreen);
        document.addEventListener('webkitfullscreenchange', checkFullscreen);
        document.addEventListener('mozfullscreenchange', checkFullscreen);
        document.addEventListener('MSFullscreenChange', checkFullscreen);

        // Periodic check in case events don't fire
        setInterval(checkFullscreen, 5000);
    }

    setupMouseCursorMonitoring() {
        let mouseEnterTime = null;
        let mouseMoveTimer = null;

        const showMouseIndicator = () => {
            if (!this.monitoringState.hasMouseCursor) {
                this.monitoringState.hasMouseCursor = true;
                mouseEnterTime = Date.now();
                this.updateStatus('mouse-status', 'DETECTED', 'status-warning');
                
                console.log('Mouse cursor detected on projection screen');
            }
        };

        const hideMouseIndicator = () => {
            if (this.monitoringState.hasMouseCursor) {
                const duration = mouseEnterTime ? Date.now() - mouseEnterTime : 0;
                this.monitoringState.hasMouseCursor = false;
                this.updateStatus('mouse-status', 'HIDDEN', 'status-ready');

                console.log(`Mouse cursor hidden after ${duration}ms`);
            }
        };

        // Mouse enter/leave detection
        document.addEventListener('mouseenter', () => {
            showMouseIndicator();
        });

        document.addEventListener('mouseleave', () => {
            hideMouseIndicator();
        });

        // Mouse movement detection with timeout
        document.addEventListener('mousemove', () => {
            showMouseIndicator();
            
            // Clear existing timer
            if (mouseMoveTimer) {
                clearTimeout(mouseMoveTimer);
            }
            
            // Set timer to hide indicator after 3 seconds of no movement
            mouseMoveTimer = setTimeout(() => {
                hideMouseIndicator();
            }, 3000);
        });

        // Initial state
        this.updateStatus('mouse-status', 'HIDDEN', 'status-ready');
    }

    setupVisibilityMonitoring() {
        const handleVisibilityChange = () => {
            const isVisible = !document.hidden;
            this.monitoringState.isVisible = isVisible;
            
            if (isVisible) {
                this.updateStatus('visibility-status', 'VISIBLE', 'status-ready');
            } else {
                this.updateStatus('visibility-status', 'HIDDEN', 'status-warning');
                console.warn('Projection screen is hidden/minimized');
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        handleVisibilityChange(); // Check initial state
    }

    setupFocusMonitoring() {
        const handleFocusChange = (focused) => {
            this.monitoringState.isFocused = focused;
            
            if (focused) {
                this.updateStatus('focus-status', 'FOCUSED', 'status-ready');
            } else {
                this.updateStatus('focus-status', 'UNFOCUSED', 'status-warning');
                console.warn('Projection screen lost focus');
            }
        };

        window.addEventListener('focus', () => handleFocusChange(true));
        window.addEventListener('blur', () => handleFocusChange(false));
        
        // Check initial state
        handleFocusChange(document.hasFocus());
    }

    setupPerformanceMonitoring() {
        let frameCount = 0;
        let lastTime = performance.now();
        
        const updatePerformanceInfo = () => {
            const now = performance.now();
            const deltaTime = now - lastTime;
            frameCount++;
            
            // Update every 5 seconds
            if (deltaTime >= 5000) {
                const fps = Math.round((frameCount * 1000) / deltaTime);
                const memory = navigator.memory ? 
                    Math.round(navigator.memory.usedJSHeapSize / 1024 / 1024) + 'MB' : 
                    'Unknown';
                
                let performanceText = `${fps} FPS`;
                if (navigator.memory) {
                    performanceText += ` | ${memory}`;
                }
                
                this.updateValue('performance-info', performanceText);
                
                frameCount = 0;
                lastTime = now;
            }
            
            requestAnimationFrame(updatePerformanceInfo);
        };
        
        requestAnimationFrame(updatePerformanceInfo);
    }

    showFullscreenWarning() {
        // No longer showing fullscreen warning popup
        console.log('Fullscreen warning would be shown (disabled)');
    }

    hideFullscreenWarning() {
        // No longer hiding fullscreen warning popup
        console.log('Fullscreen warning would be hidden (disabled)');
    }

    updateNetworkStatus(isConnected) {
        if (isConnected) {
            this.updateStatus('network-status', 'CONNECTED', 'status-ready');
        } else {
            this.updateStatus('network-status', 'DISCONNECTED', 'status-error');
        }
    }

    updateAudioStatus(devices, activeDevice) {
        console.log('TestCard: Updating audio status with devices:', devices?.length, 'activeDevice:', activeDevice);
        
        if (!devices || devices.length === 0) {
            console.log('TestCard: No audio devices available');
            this.updateStatus('audio-status', 'NO DEVICES', 'status-error');
            this.updateValue('audio-device', 'None');
            return;
        }

        if (activeDevice && activeDevice.label) {
            const displayLabel = activeDevice.label.length > 30 
                ? activeDevice.label.substring(0, 30) + '...' 
                : activeDevice.label;
            console.log('TestCard: Setting audio device to:', displayLabel);
            this.updateValue('audio-device', displayLabel);
            this.updateStatus('audio-status', 'READY', 'status-ready');
        } else {
            console.log('TestCard: Using default audio device');
            this.updateValue('audio-device', 'Default');
            this.updateStatus('audio-status', 'DEFAULT', 'status-connecting');
        }
    }

    updateDisplayStatus(hasUrl) {
        if (hasUrl) {
            this.updateStatus('display-status', 'READY', 'status-ready');
        } else {
            this.updateStatus('display-status', 'WAITING', 'status-connecting');
        }
    }


    getDisplayStatus() {
        return {
            isFullscreen: this.monitoringState.isFullscreen,
            hasMouseCursor: this.monitoringState.hasMouseCursor,
            isFocused: this.monitoringState.isFocused,
            isVisible: this.monitoringState.isVisible,
            timestamp: Date.now()
        };
    }

    destroy() {
        // Clear timestamp interval
        if (this.timestampInterval) {
            clearInterval(this.timestampInterval);
            this.timestampInterval = null;
        }

        // Clear fullscreen warning timer
        if (this.monitoringState.fullscreenWarningTimer) {
            clearTimeout(this.monitoringState.fullscreenWarningTimer);
            this.monitoringState.fullscreenWarningTimer = null;
        }

        // Clear mouse timer
        if (this.monitoringState.mouseTimer) {
            clearTimeout(this.monitoringState.mouseTimer);
            this.monitoringState.mouseTimer = null;
        }

        console.log('TestCard destroyed');
    }
}