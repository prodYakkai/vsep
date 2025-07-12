export class ControlPanel {
    constructor() {
        this.socket = null;
        this.apiSdk = null;
        this.isConnected = false;
        this.activeProjectionId = null;
        this.projectionStates = [];
        this.connectedSockets = new Set();
        this.projectionHealthStatus = new Map(); // projectionId -> health data
        this.projectionPlayerStatus = new Map(); // projectionId -> player status data
        
        this.elements = {
            screenList: null,
            connectionStatus: null,
            activeScreenTitle: null,
            screenStatus: null,
            deleteScreenBtn: null,
            noSelection: null,
            screenControls: null,
            urlInput: null,
            sinkSelect: null,
            flvPlayBtn: null,
            rtcPlayBtn: null,
            stopBtn: null,
            reloadBtn: null,
            refreshBtn: null,
            showTestCardBtn: null,
            hideTestCardBtn: null,
            showAllTestCardsBtn: null,
            hideAllTestCardsBtn: null,
            screenId: null,
            screenProtocol: null,
            screenActiveDevice: null,
            screenLastUpdated: null,
            connectionStatsProtocol: null,
            connectionRtt: null,
            connectionPacketLoss: null,
            connectionBitrate: null,
            connectionFrameRate: null,
            connectionResolution: null,
            connectionCodec: null,
            connectionStatsUpdated: null,
            deleteModal: null,
            deleteScreenName: null,
            confirmDeleteBtn: null
        };
        
        this.init();
    }

    init() {
        this.setupElements();
        this.setupSocket();
        this.setupApi();
        this.setupEventListeners();
    }

    setupElements() {
        this.elements.screenList = document.getElementById('screen-list');
        this.elements.connectionStatus = document.getElementById('connection-status');
        this.elements.activeScreenTitle = document.getElementById('active-screen-title');
        this.elements.screenStatus = document.getElementById('screen-status');
        this.elements.deleteScreenBtn = document.getElementById('delete-screen-btn');
        this.elements.noSelection = document.getElementById('no-selection');
        this.elements.screenControls = document.getElementById('screen-controls');
        this.elements.urlInput = document.getElementById('url-input');
        this.elements.sinkSelect = document.getElementById('sink-select');
        this.elements.flvPlayBtn = document.getElementById('flv-play');
        this.elements.rtcPlayBtn = document.getElementById('rtc-play');
        this.elements.stopBtn = document.getElementById('stop-btn');
        this.elements.reloadBtn = document.getElementById('reload-btn');
        this.elements.refreshBtn = document.getElementById('refresh-btn');
        this.elements.showTestCardBtn = document.getElementById('show-test-card-btn');
        this.elements.hideTestCardBtn = document.getElementById('hide-test-card-btn');
        this.elements.showAllTestCardsBtn = document.getElementById('show-all-test-cards-btn');
        this.elements.hideAllTestCardsBtn = document.getElementById('hide-all-test-cards-btn');
        this.elements.screenId = document.getElementById('screen-id');
        this.elements.screenProtocol = document.getElementById('screen-protocol');
        this.elements.screenActiveDevice = document.getElementById('screen-active-device');
        this.elements.screenLastUpdated = document.getElementById('screen-last-updated');
        this.elements.connectionStatsProtocol = document.getElementById('connection-stats-protocol');
        this.elements.connectionRtt = document.getElementById('connection-rtt');
        this.elements.connectionPacketLoss = document.getElementById('connection-packet-loss');
        this.elements.connectionBitrate = document.getElementById('connection-bitrate');
        this.elements.connectionFrameRate = document.getElementById('connection-frame-rate');
        this.elements.connectionResolution = document.getElementById('connection-resolution');
        this.elements.connectionCodec = document.getElementById('connection-codec');
        this.elements.connectionStatsUpdated = document.getElementById('connection-stats-updated');
        this.elements.deleteModal = document.getElementById('deleteModal');
        this.elements.deleteScreenName = document.getElementById('delete-screen-name');
        this.elements.confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    }

    setupSocket() {
        this.socket = io.connect();
        this.socket.on('connect', () => this.handleSocketConnection());
        this.socket.on('disconnect', () => this.handleSocketDisconnection());
        this.socket.on('refresh', () => this.handleStateRefresh());
        this.socket.on('client_connected', (data) => this.handleClientConnected(data));
        this.socket.on('client_disconnected', (data) => this.handleClientDisconnected(data));
        this.socket.on('projection_status_update', (data) => this.handleProjectionStatusUpdate(data));
        this.socket.on('projection_health_update', (data) => this.handleProjectionHealthUpdate(data));
        this.socket.on('projection_player_status_update', (data) => this.handlePlayerStatusUpdate(data));
    }

    setupApi() {
        this.apiSdk = apiSdkService();
    }

    setupEventListeners() {
        // Playback controls
        if (this.elements.flvPlayBtn) {
            this.elements.flvPlayBtn.addEventListener('click', () => this.handleFLVPlay());
        }
        
        if (this.elements.rtcPlayBtn) {
            this.elements.rtcPlayBtn.addEventListener('click', () => this.handleRTCPlay());
        }

        if (this.elements.stopBtn) {
            this.elements.stopBtn.addEventListener('click', () => this.handleStop());
        }
        
        if (this.elements.reloadBtn) {
            this.elements.reloadBtn.addEventListener('click', () => this.handleReload());
        }

        if (this.elements.refreshBtn) {
            this.elements.refreshBtn.addEventListener('click', () => this.handleStateRefresh());
        }

        // Test card controls
        if (this.elements.showTestCardBtn) {
            this.elements.showTestCardBtn.addEventListener('click', () => this.handleShowTestCard());
        }

        if (this.elements.hideTestCardBtn) {
            this.elements.hideTestCardBtn.addEventListener('click', () => this.handleHideTestCard());
        }

        if (this.elements.showAllTestCardsBtn) {
            this.elements.showAllTestCardsBtn.addEventListener('click', () => this.handleShowAllTestCards());
        }

        if (this.elements.hideAllTestCardsBtn) {
            this.elements.hideAllTestCardsBtn.addEventListener('click', () => this.handleHideAllTestCards());
        }

        // Audio device selection
        if (this.elements.sinkSelect) {
            this.elements.sinkSelect.addEventListener('change', (e) => this.handleProjectionDeviceChange(e));
        }

        // Delete functionality
        if (this.elements.deleteScreenBtn) {
            this.elements.deleteScreenBtn.addEventListener('click', () => this.showDeleteModal());
        }

        if (this.elements.confirmDeleteBtn) {
            this.elements.confirmDeleteBtn.addEventListener('click', () => this.handleDeleteScreen());
        }
    }

    async handleSocketConnection() {
        console.log('Connected to socket');
        this.isConnected = true;
        this.updateConnectionStatus('Connected', 'text-bg-success');
        
        // Request current projection statuses
        this.socket.emit('get_projection_status', {}, (statuses) => {
            if (statuses && Array.isArray(statuses)) {
                statuses.forEach(status => {
                    if (status.isOnline) {
                        this.connectedSockets.add(status.projectionId);
                    }
                    if (status.health) {
                        this.projectionHealthStatus.set(status.projectionId, status.health);
                    }
                    if (status.playerStatus) {
                        this.projectionPlayerStatus.set(status.projectionId, status.playerStatus);
                    }
                });
                this.updateAllScreensStatus();
            }
        });
        
        await this.handleStateRefresh();
    }

    handleSocketDisconnection() {
        this.isConnected = false;
        console.log('Disconnected from socket');
        this.updateConnectionStatus('Disconnected', 'text-bg-danger');
        this.connectedSockets.clear();
        this.updateAllScreensStatus();
    }

    handleClientConnected(data) {
        console.log('Client connected:', data);
        if (data.projectionId) {
            this.connectedSockets.add(data.projectionId);
            this.updateScreenStatus(data.projectionId, true);
        }
    }

    handleClientDisconnected(data) {
        console.log('Client disconnected:', data);
        if (data.projectionId) {
            this.connectedSockets.delete(data.projectionId);
            this.projectionHealthStatus.delete(data.projectionId);
            this.updateScreenStatus(data.projectionId, false);
        }
    }

    handleProjectionStatusUpdate(data) {
        console.log('Projection status update:', data);
        const { projectionId, status } = data;
        
        if (status.isOnline) {
            this.connectedSockets.add(projectionId);
        } else {
            this.connectedSockets.delete(projectionId);
            this.projectionHealthStatus.delete(projectionId);
        }
        
        this.updateScreenStatus(projectionId, status.isOnline);
        this.updateScreenHealth(projectionId, status);
    }

    handleProjectionHealthUpdate(data) {
        console.log('Projection health update:', data);
        const { projectionId, health } = data;
        
        if (health) {
            this.projectionHealthStatus.set(projectionId, health);
            this.updateScreenHealth(projectionId, { health });
        }
    }

    handlePlayerStatusUpdate(data) {
        console.log('Player status update:', data);
        const { projectionId, playerStatus } = data;
        
        if (playerStatus) {
            this.projectionPlayerStatus.set(projectionId, playerStatus);
            
            // Update control locking if this is the active projection
            if (projectionId === this.activeProjectionId) {
                const isOnline = this.connectedSockets.has(projectionId);
                this.updateControlLockStateFromPlayerStatus(playerStatus, isOnline);
                // Update connection statistics display
                this.updateConnectionStatsDisplay(playerStatus);
            }
            
            // Update visual indicators in the projection list
            this.updateProjectionListPlayerStatus(projectionId, playerStatus);
        }
    }

    updateConnectionStatus(text, badgeClass) {
        if (this.elements.connectionStatus) {
            this.elements.connectionStatus.textContent = text;
            this.elements.connectionStatus.className = `badge ${badgeClass}`;
        }
    }

    async handleStateRefresh() {
        console.log('Refreshing state');
        const [error, response] = await safeAwait(this.apiSdk.fetchAllProjections());
        if (error) {
            console.error('Error fetching projections:', error);
            return;
        }
        
        this.projectionStates = response || [];
        this.renderProjectionList();
        
        if (this.projectionStates.length === 0) {
            this.showNoSelection();
            return;
        }
        
        // If we have an active projection, refresh its details
        if (this.activeProjectionId) {
            const activeProjection = this.projectionStates.find(p => p.id === this.activeProjectionId);
            if (activeProjection) {
                this.renderProjectionDetails(activeProjection);
            } else {
                // Active projection no longer exists, clear selection
                this.showNoSelection();
            }
        }
    }

    renderProjectionList() {
        if (!this.elements.screenList) return;
        
        this.elements.screenList.innerHTML = '';
        
        if (this.projectionStates.length === 0) {
            const emptyItem = document.createElement('div');
            emptyItem.className = 'list-group-item text-center text-muted';
            emptyItem.innerHTML = '<em>No projection screens found</em>';
            this.elements.screenList.appendChild(emptyItem);
            return;
        }

        this.projectionStates.forEach(projection => {
            const item = document.createElement('a');
            item.href = '#';
            item.className = 'list-group-item list-group-item-action';
            item.dataset.projectionId = projection.id;
            
            const isOnline = this.connectedSockets.has(projection.id);
            const health = this.projectionHealthStatus.get(projection.id);
            
            let statusBadge = isOnline 
                ? '<span class="badge text-bg-success ms-2">Online</span>'
                : '<span class="badge text-bg-danger ms-2">Offline</span>';
            
            // Add health warning badges
            let healthIndicators = '';
            if (isOnline && health) {
                const warnings = [];
                if (!health.isFullscreen) warnings.push('⚠️');
                if (health.hasMouseCursor) warnings.push('🖱️');
                if (!health.isFocused) warnings.push('👁️');
                if (!health.isVisible) warnings.push('📱');
                
                if (warnings.length > 0) {
                    healthIndicators = `<small class="text-warning ml-1">${warnings.join('')}</small>`;
                }
            }
            
            item.innerHTML = `
                <div class="d-flex w-100 justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1">${projection.id}${healthIndicators}</h6>
                        <small class="text-muted">${projection.type.toUpperCase()}</small>
                    </div>
                    ${statusBadge}
                </div>
            `;
            
            if (projection.id === this.activeProjectionId) {
                item.classList.add('active');
            }
            
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.selectProjection(projection, isOnline);
            });
            
            this.elements.screenList.appendChild(item);
        });
    }

    updateAllScreensStatus() {
        const items = this.elements.screenList?.querySelectorAll('.list-group-item[data-projection-id]');
        items?.forEach(item => {
            const projectionId = item.dataset.projectionId;
            const isOnline = this.connectedSockets.has(projectionId);
            const badge = item.querySelector('.badge');
            if (badge) {
                badge.textContent = isOnline ? 'Online' : 'Offline';
                badge.className = `badge ${isOnline ? 'text-bg-success' : 'text-bg-danger'} ms-2`;
            }
        });
    }

    updateScreenStatus(projectionId, isOnline) {
        // Update in the list
        const item = this.elements.screenList?.querySelector(`[data-projection-id="${projectionId}"]`);
        if (item) {
            const badge = item.querySelector('.badge');
            if (badge) {
                badge.textContent = isOnline ? 'Online' : 'Offline';
                badge.className = `badge ${isOnline ? 'text-bg-success' : 'text-bg-danger'} ms-2`;
            }
        }

        // Update active screen status if it's the selected one
        if (projectionId === this.activeProjectionId && this.elements.screenStatus) {
            this.elements.screenStatus.textContent = isOnline ? 'Online' : 'Offline';
            this.elements.screenStatus.className = `badge ${isOnline ? 'text-bg-success' : 'text-bg-danger'}`;
            
            // Show/hide delete button for offline screens
            if (this.elements.deleteScreenBtn) {
                this.elements.deleteScreenBtn.style.display = isOnline ? 'none' : 'inline-block';
            }
        }
    }

    updateScreenHealth(projectionId, statusData) {
        const health = statusData.health || statusData;
        
        // Update health indicators in the list
        const item = this.elements.screenList?.querySelector(`[data-projection-id="${projectionId}"]`);
        if (item && health) {
            const h6 = item.querySelector('h6');
            if (h6) {
                // Remove existing health indicators
                const existingIndicators = h6.querySelector('.text-warning');
                if (existingIndicators) {
                    existingIndicators.remove();
                }
                
                // Add new health indicators
                const warnings = [];
                if (!health.isFullscreen) warnings.push('⚠️');
                if (health.hasMouseCursor) warnings.push('🖱️');
                if (!health.isFocused) warnings.push('👁️');
                if (!health.isVisible) warnings.push('📱');
                
                if (warnings.length > 0) {
                    const healthSpan = document.createElement('small');
                    healthSpan.className = 'text-warning ml-1';
                    healthSpan.textContent = warnings.join('');
                    h6.appendChild(healthSpan);
                }
            }
        }

        // Update detailed health info if this is the active projection
        if (projectionId === this.activeProjectionId) {
            this.updateActiveProjectionHealth(health);
        }
    }

    updateActiveProjectionHealth(health) {
        if (!health) return;

        // Update screen information panel with health details
        const healthSummary = [];
        if (!health.isFullscreen) healthSummary.push('Not Fullscreen');
        if (health.hasMouseCursor) healthSummary.push('Mouse Detected');
        if (!health.isFocused) healthSummary.push('Not Focused');
        if (!health.isVisible) healthSummary.push('Not Visible');
        
        // Check if there's an active stream and lock controls accordingly
        if (health.hasActiveStream !== undefined) {
            const isOnline = this.connectedSockets.has(this.activeProjectionId);
            this.updateControlLockStateFromHealth(health.hasActiveStream, isOnline);
        }
        
        // You could add more detailed health display here
        console.log(`Health update for ${this.activeProjectionId}:`, health);
    }

    updateControlLockStateFromHealth(hasActiveStream, isOnline) {
        const shouldLockControls = hasActiveStream && isOnline;
        
        console.log(`Updating control lock state from health: hasActiveStream=${hasActiveStream}, isOnline=${isOnline}, shouldLock=${shouldLockControls}`);
        
        // Lock/unlock input controls
        if (this.elements.urlInput) {
            this.elements.urlInput.disabled = shouldLockControls;
        }
        if (this.elements.sinkSelect) {
            this.elements.sinkSelect.disabled = shouldLockControls;
        }
        
        // Lock/unlock play buttons
        if (this.elements.flvPlayBtn) {
            this.elements.flvPlayBtn.disabled = shouldLockControls;
        }
        if (this.elements.rtcPlayBtn) {
            this.elements.rtcPlayBtn.disabled = shouldLockControls;
        }
        
        // Lock/unlock test card controls
        if (this.elements.showTestCardBtn) {
            this.elements.showTestCardBtn.disabled = shouldLockControls;
        }
        if (this.elements.hideTestCardBtn) {
            this.elements.hideTestCardBtn.disabled = shouldLockControls;
        }
        
        // Reload button should be locked when stream is active
        if (this.elements.reloadBtn) {
            this.elements.reloadBtn.disabled = shouldLockControls;
        }
        
        // Stop button should be enabled when stream is active and projection is online
        if (this.elements.stopBtn) {
            this.elements.stopBtn.disabled = !shouldLockControls;
        }
        
        // Update visual feedback
        this.updateControlLockVisualsFromHealth(shouldLockControls, hasActiveStream);
    }

    updateControlLockVisualsFromHealth(isLocked, hasActiveStream) {
        const controlsContainer = this.elements.screenControls;
        if (!controlsContainer) return;
        
        // Add/remove locked class for styling
        if (isLocked) {
            controlsContainer.classList.add('controls-locked');
        } else {
            controlsContainer.classList.remove('controls-locked');
        }
        
        // Update button states based on health status
        if (hasActiveStream) {
            // Stream is active
            if (this.elements.flvPlayBtn) {
                this.elements.flvPlayBtn.innerHTML = '<strong>FLV</strong> Stream Active';
                this.elements.flvPlayBtn.classList.add('btn-success');
                this.elements.flvPlayBtn.classList.remove('btn-primary');
            }
            if (this.elements.rtcPlayBtn) {
                this.elements.rtcPlayBtn.innerHTML = '<strong>WHEP</strong> Stream Active';
                this.elements.rtcPlayBtn.classList.add('btn-success');
                this.elements.rtcPlayBtn.classList.remove('btn-info');
            }
            if (this.elements.stopBtn) {
                this.elements.stopBtn.classList.add('btn-danger');
                this.elements.stopBtn.classList.remove('btn-warning', 'btn-secondary');
                this.elements.stopBtn.textContent = 'Stop Stream';
            }
        } else {
            // No active stream
            if (this.elements.flvPlayBtn) {
                this.elements.flvPlayBtn.innerHTML = '<strong>FLV</strong> Play';
                this.elements.flvPlayBtn.classList.remove('btn-success');
                this.elements.flvPlayBtn.classList.add('btn-primary');
            }
            if (this.elements.rtcPlayBtn) {
                this.elements.rtcPlayBtn.innerHTML = '<strong>WHEP</strong> Play';
                this.elements.rtcPlayBtn.classList.remove('btn-success');
                this.elements.rtcPlayBtn.classList.add('btn-info');
            }
            if (this.elements.stopBtn) {
                this.elements.stopBtn.classList.remove('btn-danger');
                this.elements.stopBtn.classList.add('btn-warning');
                this.elements.stopBtn.textContent = 'Stop';
            }
        }
    }

    async selectProjection(projection, isOnline) {
        // Update active selection in list
        this.elements.screenList?.querySelectorAll('.list-group-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const selectedItem = this.elements.screenList?.querySelector(`[data-projection-id="${projection.id}"]`);
        if (selectedItem) {
            selectedItem.classList.add('active');
        }

        this.activeProjectionId = projection.id;
        await this.renderProjectionDetails(projection, isOnline);
    }

    async renderProjectionDetails(projection, isOnline = null) {
        if (isOnline === null) {
            isOnline = this.connectedSockets.has(projection.id);
        }

        // Show controls, hide no-selection message
        if (this.elements.noSelection) {
            this.elements.noSelection.style.display = 'none';
        }
        if (this.elements.screenControls) {
            this.elements.screenControls.style.display = 'block';
        }

        // Update header
        if (this.elements.activeScreenTitle) {
            this.elements.activeScreenTitle.textContent = projection.id;
        }
        
        if (this.elements.screenStatus) {
            this.elements.screenStatus.textContent = isOnline ? 'Online' : 'Offline';
            this.elements.screenStatus.className = `badge ${isOnline ? 'text-bg-success' : 'text-bg-danger'}`;
        }

        // Show/hide delete button
        if (this.elements.deleteScreenBtn) {
            this.elements.deleteScreenBtn.style.display = isOnline ? 'none' : 'inline-block';
        }

        // Update form fields
        if (this.elements.urlInput) {
            this.elements.urlInput.value = projection.url || '';
        }

        // Update screen information
        if (this.elements.screenId) {
            this.elements.screenId.textContent = projection.id;
        }
        if (this.elements.screenProtocol) {
            this.elements.screenProtocol.textContent = projection.type?.toUpperCase() || '-';
        }
        if (this.elements.screenActiveDevice) {
            this.elements.screenActiveDevice.textContent = projection.activeDevice?.label || 'Default';
        }
        if (this.elements.screenLastUpdated) {
            this.elements.screenLastUpdated.textContent = new Date().toLocaleTimeString();
        }

        // Load audio devices
        await this.refreshProjectionMediaDevices(projection.id, projection.activeDevice?.deviceId);
        
        // Check if we have real-time player status for this projection
        const playerStatus = this.projectionPlayerStatus.get(projection.id);
        if (playerStatus) {
            // Use real-time player status for control locking and stats display
            this.updateControlLockStateFromPlayerStatus(playerStatus, isOnline);
            this.updateConnectionStatsDisplay(playerStatus);
        } else {
            // Fallback to database state for control locking
            this.updateControlLockState(projection, isOnline);
            // Clear connection stats since no real-time data available
            this.clearConnectionStats();
        }
    }

    isProjectionJobActive(projection) {
        // First check real-time player status if available
        const playerStatus = this.projectionPlayerStatus.get(projection?.id);
        if (playerStatus) {
            return playerStatus.isActive && (playerStatus.state === 'playing' || playerStatus.state === 'loading');
        }
        
        // Fallback to database state for backward compatibility
        return projection && 
               projection.playbackStatus === 'playing' && 
               projection.url && 
               projection.url.trim() !== '';
    }

    getPlayerStatusForProjection(projectionId) {
        return this.projectionPlayerStatus.get(projectionId) || null;
    }

    updateControlLockStateFromPlayerStatus(playerStatus, isOnline) {
        const isActive = playerStatus.isActive && (playerStatus.state === 'playing' || playerStatus.state === 'loading');
        const shouldLockControls = isActive && isOnline;
        
        // Lock/unlock input controls
        if (this.elements.urlInput) {
            this.elements.urlInput.disabled = shouldLockControls;
        }
        if (this.elements.sinkSelect) {
            this.elements.sinkSelect.disabled = shouldLockControls;
        }
        
        // Lock/unlock play buttons
        if (this.elements.flvPlayBtn) {
            this.elements.flvPlayBtn.disabled = shouldLockControls;
        }
        if (this.elements.rtcPlayBtn) {
            this.elements.rtcPlayBtn.disabled = shouldLockControls;
        }
        
        // Lock/unlock test card controls
        if (this.elements.showTestCardBtn) {
            this.elements.showTestCardBtn.disabled = shouldLockControls;
        }
        if (this.elements.hideTestCardBtn) {
            this.elements.hideTestCardBtn.disabled = shouldLockControls;
        }
        
        // Reload button should be locked when job is active
        if (this.elements.reloadBtn) {
            this.elements.reloadBtn.disabled = shouldLockControls;
        }
        
        // Stop button should be enabled when job is active and projection is online
        if (this.elements.stopBtn) {
            this.elements.stopBtn.disabled = !shouldLockControls;
        }
        
        // Update visual feedback with real-time player status
        this.updateControlLockVisualsFromPlayerStatus(shouldLockControls, playerStatus);
    }

    updateControlLockVisualsFromPlayerStatus(isLocked, playerStatus) {
        const controlsContainer = this.elements.screenControls;
        if (!controlsContainer) return;
        
        // Add/remove locked class for styling
        if (isLocked) {
            controlsContainer.classList.add('controls-locked');
        } else {
            controlsContainer.classList.remove('controls-locked');
        }
        
        const state = playerStatus.state;
        
        // Update play buttons based on real-time player state
        if (state === 'playing') {
            // Playing state
            if (this.elements.flvPlayBtn) {
                this.elements.flvPlayBtn.innerHTML = '<strong>FLV</strong> Playing...';
                this.elements.flvPlayBtn.classList.add('btn-success');
                this.elements.flvPlayBtn.classList.remove('btn-primary');
            }
            if (this.elements.rtcPlayBtn) {
                this.elements.rtcPlayBtn.innerHTML = '<strong>WHEP</strong> Playing...';
                this.elements.rtcPlayBtn.classList.add('btn-success');
                this.elements.rtcPlayBtn.classList.remove('btn-info');
            }
            if (this.elements.stopBtn) {
                this.elements.stopBtn.classList.add('btn-danger');
                this.elements.stopBtn.classList.remove('btn-warning', 'btn-secondary');
                this.elements.stopBtn.textContent = 'Stop Stream';
            }
        } else if (state === 'loading') {
            // Loading state
            if (this.elements.flvPlayBtn) {
                this.elements.flvPlayBtn.innerHTML = '<strong>FLV</strong> Loading...';
                this.elements.flvPlayBtn.classList.add('btn-warning');
                this.elements.flvPlayBtn.classList.remove('btn-primary', 'btn-success');
            }
            if (this.elements.rtcPlayBtn) {
                this.elements.rtcPlayBtn.innerHTML = '<strong>WHEP</strong> Loading...';
                this.elements.rtcPlayBtn.classList.add('btn-warning');
                this.elements.rtcPlayBtn.classList.remove('btn-info', 'btn-success');
            }
            if (this.elements.stopBtn) {
                this.elements.stopBtn.classList.add('btn-warning');
                this.elements.stopBtn.classList.remove('btn-danger', 'btn-secondary');
                this.elements.stopBtn.textContent = 'Stop Loading';
            }
        } else if (state === 'error') {
            // Error state
            if (this.elements.flvPlayBtn) {
                this.elements.flvPlayBtn.innerHTML = '<strong>FLV</strong> Error';
                this.elements.flvPlayBtn.classList.add('btn-outline-danger');
                this.elements.flvPlayBtn.classList.remove('btn-primary', 'btn-success', 'btn-warning');
            }
            if (this.elements.rtcPlayBtn) {
                this.elements.rtcPlayBtn.innerHTML = '<strong>WHEP</strong> Error';
                this.elements.rtcPlayBtn.classList.add('btn-outline-danger');
                this.elements.rtcPlayBtn.classList.remove('btn-info', 'btn-success', 'btn-warning');
            }
            if (this.elements.stopBtn) {
                this.elements.stopBtn.classList.add('btn-secondary');
                this.elements.stopBtn.classList.remove('btn-danger', 'btn-warning');
                this.elements.stopBtn.textContent = 'Clear Error';
            }
        } else {
            // Idle/stopped state
            if (this.elements.flvPlayBtn) {
                this.elements.flvPlayBtn.innerHTML = '<strong>FLV</strong> Play';
                this.elements.flvPlayBtn.classList.remove('btn-success', 'btn-warning', 'btn-outline-danger');
                this.elements.flvPlayBtn.classList.add('btn-primary');
            }
            if (this.elements.rtcPlayBtn) {
                this.elements.rtcPlayBtn.innerHTML = '<strong>WHEP</strong> Play';
                this.elements.rtcPlayBtn.classList.remove('btn-success', 'btn-warning', 'btn-outline-danger');
                this.elements.rtcPlayBtn.classList.add('btn-info');
            }
            if (this.elements.stopBtn) {
                this.elements.stopBtn.classList.remove('btn-danger', 'btn-secondary');
                this.elements.stopBtn.classList.add('btn-warning');
                this.elements.stopBtn.textContent = 'Stop';
            }
        }
    }

    updateProjectionListPlayerStatus(projectionId, playerStatus) {
        // Update player status indicators in the projection list
        const item = this.elements.screenList?.querySelector(`[data-projection-id="${projectionId}"]`);
        if (!item) return;
        
        // Find or create player status indicator
        let statusIndicator = item.querySelector('.player-status-indicator');
        if (!statusIndicator) {
            statusIndicator = document.createElement('small');
            statusIndicator.className = 'player-status-indicator ms-1';
            
            // Insert after the projection title
            const titleElement = item.querySelector('h6');
            if (titleElement) {
                titleElement.appendChild(statusIndicator);
            }
        }
        
        // Update indicator based on player state
        switch (playerStatus.state) {
            case 'playing':
                statusIndicator.textContent = '▶️';
                statusIndicator.title = 'Playing';
                break;
            case 'loading':
                statusIndicator.textContent = '⏳';
                statusIndicator.title = 'Loading';
                break;
            case 'paused':
                statusIndicator.textContent = '⏸️';
                statusIndicator.title = 'Paused';
                break;
            case 'error':
                statusIndicator.textContent = '❌';
                statusIndicator.title = `Error: ${playerStatus.error || 'Unknown error'}`;
                break;
            case 'stopped':
                statusIndicator.textContent = '⏹️';
                statusIndicator.title = 'Stopped';
                break;
            default:
                statusIndicator.textContent = '';
                statusIndicator.title = '';
        }
    }

    updateConnectionStatsDisplay(playerStatus) {
        if (!playerStatus || !playerStatus.connectionStats) {
            // Clear stats if no data available
            this.clearConnectionStats();
            return;
        }

        const stats = playerStatus.connectionStats;
        
        // Update protocol display
        if (this.elements.connectionStatsProtocol) {
            this.elements.connectionStatsProtocol.textContent = `(${playerStatus.type?.toUpperCase() || 'Unknown'})`;
        }

        // Update RTT
        if (this.elements.connectionRtt) {
            this.elements.connectionRtt.textContent = stats.rtt !== null ? `${stats.rtt}ms` : '-';
            this.elements.connectionRtt.className = this.getRttStatusClass(stats.rtt);
        }

        // Update Packet Loss
        if (this.elements.connectionPacketLoss) {
            const lossText = stats.packetLossRate !== null ? `${stats.packetLossRate}%` : '-';
            const lossCount = stats.packetsLost !== null ? ` (${stats.packetsLost})` : '';
            this.elements.connectionPacketLoss.textContent = lossText + lossCount;
            this.elements.connectionPacketLoss.className = this.getPacketLossStatusClass(stats.packetLossRate);
        }

        // Update Bitrate
        if (this.elements.connectionBitrate) {
            this.elements.connectionBitrate.textContent = stats.bitrate !== null ? this.formatBitrate(stats.bitrate) : '-';
        }

        // Update Frame Rate
        if (this.elements.connectionFrameRate) {
            this.elements.connectionFrameRate.textContent = stats.frameRate !== null ? `${stats.frameRate} fps` : '-';
        }

        // Update Resolution
        if (this.elements.connectionResolution) {
            this.elements.connectionResolution.textContent = stats.resolution || '-';
        }

        // Update Codec
        if (this.elements.connectionCodec) {
            this.elements.connectionCodec.textContent = stats.codecName || '-';
        }

        // Update timestamp
        if (this.elements.connectionStatsUpdated) {
            const updateTime = stats.timestamp ? new Date(stats.timestamp).toLocaleTimeString() : 'Never';
            this.elements.connectionStatsUpdated.textContent = updateTime;
        }
    }

    clearConnectionStats() {
        // Clear all connection stats when no data is available
        const elementsToUpdate = [
            'connectionRtt', 'connectionPacketLoss', 'connectionBitrate',
            'connectionFrameRate', 'connectionResolution', 'connectionCodec'
        ];
        
        elementsToUpdate.forEach(elementKey => {
            if (this.elements[elementKey]) {
                this.elements[elementKey].textContent = '-';
                this.elements[elementKey].className = '';
            }
        });

        if (this.elements.connectionStatsUpdated) {
            this.elements.connectionStatsUpdated.textContent = '-';
        }
        if (this.elements.connectionStatsProtocol) {
            this.elements.connectionStatsProtocol.textContent = '';
        }
    }

    getRttStatusClass(rtt) {
        if (rtt === null) return '';
        if (rtt < 50) return 'text-success'; // Good
        if (rtt < 150) return 'text-warning'; // Fair
        return 'text-danger'; // Poor
    }

    getPacketLossStatusClass(lossRate) {
        if (lossRate === null) return '';
        if (lossRate === 0) return 'text-success'; // Perfect
        if (lossRate < 1) return 'text-warning'; // Acceptable
        return 'text-danger'; // Poor
    }

    formatBitrate(bitrate) {
        if (bitrate < 1000) return `${bitrate} bps`;
        if (bitrate < 1000000) return `${Math.round(bitrate / 1000)} kbps`;
        return `${(bitrate / 1000000).toFixed(1)} Mbps`;
    }

    updateControlLockState(projection, isOnline) {
        const hasActiveJob = this.isProjectionJobActive(projection);
        const shouldLockControls = hasActiveJob && isOnline;
        
        // Lock/unlock input controls
        if (this.elements.urlInput) {
            this.elements.urlInput.disabled = shouldLockControls;
        }
        if (this.elements.sinkSelect) {
            this.elements.sinkSelect.disabled = shouldLockControls;
        }
        
        // Lock/unlock play buttons
        if (this.elements.flvPlayBtn) {
            this.elements.flvPlayBtn.disabled = shouldLockControls;
        }
        if (this.elements.rtcPlayBtn) {
            this.elements.rtcPlayBtn.disabled = shouldLockControls;
        }
        
        // Lock/unlock test card controls
        if (this.elements.showTestCardBtn) {
            this.elements.showTestCardBtn.disabled = shouldLockControls;
        }
        if (this.elements.hideTestCardBtn) {
            this.elements.hideTestCardBtn.disabled = shouldLockControls;
        }
        
        // Reload button should be locked when job is active
        if (this.elements.reloadBtn) {
            this.elements.reloadBtn.disabled = shouldLockControls;
        }
        
        // Stop button should be enabled when job is active and projection is online
        if (this.elements.stopBtn) {
            this.elements.stopBtn.disabled = !shouldLockControls;
        }
        
        // Update visual feedback
        this.updateControlLockVisuals(shouldLockControls, hasActiveJob);
    }

    updateControlLockVisuals(isLocked, hasActiveJob) {
        const controlsContainer = this.elements.screenControls;
        if (!controlsContainer) return;
        
        // Add/remove locked class for styling
        if (isLocked) {
            controlsContainer.classList.add('controls-locked');
        } else {
            controlsContainer.classList.remove('controls-locked');
        }
        
        // Get current projection to check status
        const currentProjection = this.projectionStates.find(p => p.id === this.activeProjectionId);
        const playbackStatus = currentProjection?.playbackStatus || 'idle';
        
        // Update play buttons to show current state
        if (hasActiveJob && playbackStatus === 'playing') {
            if (this.elements.flvPlayBtn) {
                this.elements.flvPlayBtn.innerHTML = '<strong>FLV</strong> Playing...';
                this.elements.flvPlayBtn.classList.add('btn-success');
                this.elements.flvPlayBtn.classList.remove('btn-primary');
            }
            if (this.elements.rtcPlayBtn) {
                this.elements.rtcPlayBtn.innerHTML = '<strong>WHEP</strong> Playing...';
                this.elements.rtcPlayBtn.classList.add('btn-success');
                this.elements.rtcPlayBtn.classList.remove('btn-info');
            }
            if (this.elements.stopBtn) {
                this.elements.stopBtn.classList.add('btn-danger');
                this.elements.stopBtn.classList.remove('btn-warning');
                this.elements.stopBtn.textContent = 'Stop Stream';
            }
        } else if (playbackStatus === 'stopped') {
            // Show stopped state
            if (this.elements.flvPlayBtn) {
                this.elements.flvPlayBtn.innerHTML = '<strong>FLV</strong> Play';
                this.elements.flvPlayBtn.classList.remove('btn-success');
                this.elements.flvPlayBtn.classList.add('btn-primary');
            }
            if (this.elements.rtcPlayBtn) {
                this.elements.rtcPlayBtn.innerHTML = '<strong>WHEP</strong> Play';
                this.elements.rtcPlayBtn.classList.remove('btn-success');
                this.elements.rtcPlayBtn.classList.add('btn-info');
            }
            if (this.elements.stopBtn) {
                this.elements.stopBtn.classList.remove('btn-danger');
                this.elements.stopBtn.classList.add('btn-secondary');
                this.elements.stopBtn.textContent = 'Stopped';
            }
        } else {
            // Idle state
            if (this.elements.flvPlayBtn) {
                this.elements.flvPlayBtn.innerHTML = '<strong>FLV</strong> Play';
                this.elements.flvPlayBtn.classList.remove('btn-success');
                this.elements.flvPlayBtn.classList.add('btn-primary');
            }
            if (this.elements.rtcPlayBtn) {
                this.elements.rtcPlayBtn.innerHTML = '<strong>WHEP</strong> Play';
                this.elements.rtcPlayBtn.classList.remove('btn-success');
                this.elements.rtcPlayBtn.classList.add('btn-info');
            }
            if (this.elements.stopBtn) {
                this.elements.stopBtn.classList.remove('btn-danger', 'btn-secondary');
                this.elements.stopBtn.classList.add('btn-warning');
                this.elements.stopBtn.textContent = 'Stop';
            }
        }
    }

    showNoSelection() {
        this.activeProjectionId = null;
        
        if (this.elements.noSelection) {
            this.elements.noSelection.style.display = 'block';
        }
        if (this.elements.screenControls) {
            this.elements.screenControls.style.display = 'none';
            // Remove locked state when no selection
            this.elements.screenControls.classList.remove('controls-locked');
        }
        if (this.elements.activeScreenTitle) {
            this.elements.activeScreenTitle.textContent = 'None Selected';
        }
        if (this.elements.deleteScreenBtn) {
            this.elements.deleteScreenBtn.style.display = 'none';
        }
    }

    async refreshProjectionMediaDevices(id, activeDeviceId) {
        const [error, devices] = await safeAwait(this.apiSdk.fetchProjectionDevices(id));
        if (error) {
            console.error('Error fetching devices:', error);
            this.renderSinkDeviceSelect([], activeDeviceId);
            return;
        }
        this.renderSinkDeviceSelect(devices || [], activeDeviceId);
    }

    renderSinkDeviceSelect(devices, activeId) {
        if (!this.elements.sinkSelect) return;
        
        this.elements.sinkSelect.innerHTML = '';
        
        if (!devices || devices.length === 0) {
            const option = document.createElement('option');
            option.value = 'default';
            option.textContent = 'Default Device';
            option.selected = true;
            this.elements.sinkSelect.appendChild(option);
            return;
        }

        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || device.deviceId;
            if (device.deviceId === activeId) {
                option.selected = true;
            }
            this.elements.sinkSelect.appendChild(option);
        });
    }

    async handleFLVPlay() {
        await this.submitPlayJob('flv');
    }

    async handleRTCPlay() {
        await this.submitPlayJob('whep');
    }

    async handleStop() {
        if (!this.activeProjectionId) {
            console.error('No active projection selected');
            return;
        }
        
        // Get current projection to check if it has active job
        const currentProjection = this.projectionStates.find(p => p.id === this.activeProjectionId);
        const hasActiveJob = this.isProjectionJobActive(currentProjection);
        
        if (hasActiveJob) {
            // Show confirmation dialog for stopping active stream
            const confirmed = confirm(
                `Are you sure you want to stop the active video stream on "${this.activeProjectionId}"?\n\n` +
                `This will immediately stop the current playback and unlock all controls.`
            );
            
            if (!confirmed) {
                return;
            }
        }
        
        await this.toggleProjectionStatus(this.activeProjectionId, 'stop');
        
        // Refresh the projection state to update controls
        await this.handleStateRefresh();
    }

    async handleReload() {
        await this.toggleProjectionStatus(this.activeProjectionId, 'reload');
    }

    async submitPlayJob(type) {
        if (!this.activeProjectionId) {
            console.error('No active projection selected');
            return;
        }

        const url = this.elements.urlInput?.value;
        if (!url || url === '') {
            console.error('No URL provided');
            alert('Please enter a stream URL');
            return;
        }
        
        console.log(`Submitting ${type} play job for ${this.activeProjectionId}`);
        const [error, response] = await safeAwait(this.apiSdk.submitProjectionJob(this.activeProjectionId, {
            id: this.activeProjectionId,
            url,
            type,
            sinkId: this.elements.sinkSelect?.value
        }));
        
        if (error) {
            console.error('Error submitting job:', error);
            alert('Failed to submit play job');
            return;
        }
        
        console.log('Play job submitted:', response);
        
        // Refresh the projection state to update controls
        await this.handleStateRefresh();
    }

    async toggleProjectionStatus(id, action) {
        if (!id) {
            console.error('No projection ID provided');
            return;
        }

        console.log(`Sending ${action} command to projection ${id}`);
        const [error, response] = await safeAwait(this.apiSdk.toggleProjectionStatus(id, action));
        if (error) {
            console.error('Error sending command:', error);
            alert(`Failed to send ${action} command`);
            return;
        }
        console.log('Command sent:', response);
    }

    async handleProjectionDeviceChange(event) {
        if (!this.activeProjectionId) return;

        const selectedOption = event.target.selectedOptions[0];
        const device = {
            deviceId: event.target.value,
            label: selectedOption.textContent
        };
        
        console.log(`Changing audio device for ${this.activeProjectionId}:`, device);
        const [error] = await safeAwait(this.apiSdk.updateProjectionDevice(this.activeProjectionId, device));
        if (error) {
            console.error('Error updating projection device:', error);
            alert('Failed to update audio device');
        }
    }

    showDeleteModal() {
        if (!this.activeProjectionId) return;

        if (this.elements.deleteScreenName) {
            this.elements.deleteScreenName.textContent = this.activeProjectionId;
        }

        // Show Bootstrap modal
        if (this.elements.deleteModal && window.$ && window.$.fn.modal) {
            $(this.elements.deleteModal).modal('show');
        }
    }

    async handleDeleteScreen() {
        if (!this.activeProjectionId) return;

        console.log(`Deleting projection ${this.activeProjectionId}`);
        const [error, response] = await safeAwait(this.apiSdk.deleteProjection(this.activeProjectionId));
        
        // Hide modal
        if (this.elements.deleteModal && window.$ && window.$.fn.modal) {
            $(this.elements.deleteModal).modal('hide');
        }

        if (error) {
            console.error('Error deleting projection:', error);
            alert('Failed to delete projection screen');
            return;
        }

        console.log('Projection deleted:', response);
        
        // Clear selection and refresh
        this.showNoSelection();
        await this.handleStateRefresh();
    }

    async handleShowTestCard() {
        if (!this.activeProjectionId) {
            console.error('No active projection selected');
            return;
        }
        await this.toggleProjectionStatus(this.activeProjectionId, 'show_test_card');
    }

    async handleHideTestCard() {
        if (!this.activeProjectionId) {
            console.error('No active projection selected');
            return;
        }
        await this.toggleProjectionStatus(this.activeProjectionId, 'hide_test_card');
    }

    async handleShowAllTestCards() {
        // Show confirmation dialog
        const projectionCount = this.projectionStates.length;
        if (projectionCount === 0) {
            alert('No projection screens found to send command to.');
            return;
        }
        
        const confirmed = confirm(
            `Are you sure you want to show test cards on all ${projectionCount} projection screen(s)?\n\n` +
            `This will display the test card overlay on all screens, which may interrupt any currently playing content.`
        );
        
        if (!confirmed) {
            return;
        }
        
        console.log('Showing test cards on all projections');
        const promises = this.projectionStates.map(projection => 
            this.apiSdk.toggleProjectionStatus(projection.id, 'show_test_card')
        );
        
        const results = await Promise.allSettled(promises);
        
        // Count successes and failures
        let successCount = 0;
        let failureCount = 0;
        const failures = [];
        
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                successCount++;
            } else {
                failureCount++;
                failures.push(this.projectionStates[index].id);
                console.error(`Failed to show test card for projection ${this.projectionStates[index].id}:`, result.reason);
            }
        });
        
        // Show result alert
        if (failureCount === 0) {
            alert(`✅ Success!\n\nTest cards have been shown on all ${successCount} projection screen(s).`);
        } else if (successCount === 0) {
            alert(`❌ Failed!\n\nFailed to show test cards on all ${failureCount} projection screen(s).\n\nFailed screens: ${failures.join(', ')}`);
        } else {
            alert(
                `⚠️ Partial Success!\n\n` +
                `Successfully showed test cards on ${successCount} screen(s).\n` +
                `Failed on ${failureCount} screen(s): ${failures.join(', ')}\n\n` +
                `Check the console for detailed error information.`
            );
        }
    }

    async handleHideAllTestCards() {
        // Show confirmation dialog
        const projectionCount = this.projectionStates.length;
        if (projectionCount === 0) {
            alert('No projection screens found to send command to.');
            return;
        }
        
        const confirmed = confirm(
            `Are you sure you want to hide test cards on all ${projectionCount} projection screen(s)?\n\n` +
            `This will hide the test card overlay on all screens, returning them to their normal display state.`
        );
        
        if (!confirmed) {
            return;
        }
        
        console.log('Hiding test cards on all projections');
        const promises = this.projectionStates.map(projection => 
            this.apiSdk.toggleProjectionStatus(projection.id, 'hide_test_card')
        );
        
        const results = await Promise.allSettled(promises);
        
        // Count successes and failures
        let successCount = 0;
        let failureCount = 0;
        const failures = [];
        
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                successCount++;
            } else {
                failureCount++;
                failures.push(this.projectionStates[index].id);
                console.error(`Failed to hide test card for projection ${this.projectionStates[index].id}:`, result.reason);
            }
        });
        
        // Show result alert
        if (failureCount === 0) {
            alert(`✅ Success!\n\nTest cards have been hidden on all ${successCount} projection screen(s).`);
        } else if (successCount === 0) {
            alert(`❌ Failed!\n\nFailed to hide test cards on all ${failureCount} projection screen(s).\n\nFailed screens: ${failures.join(', ')}`);
        } else {
            alert(
                `⚠️ Partial Success!\n\n` +
                `Successfully hid test cards on ${successCount} screen(s).\n` +
                `Failed on ${failureCount} screen(s): ${failures.join(', ')}\n\n` +
                `Check the console for detailed error information.`
            );
        }
    }

    destroy() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}