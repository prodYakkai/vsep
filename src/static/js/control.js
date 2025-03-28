let socket = null;
let apiSdk = null;
let isConnected = false;
let activeProjectionId = null;

let projectionStates = [];

const sinkSelectElm = $('#sink-select');
const urlInputElm = $('#url-input');
const connectionStatusElm = $('#connection-status');

const handleSocketConnection = async () => {
    console.log('Connected to socket');
    isConnected = true;
    handleStateRefresh();
    // Update connection status
    connectionStatusElm.text('Connected');
};

const handleSocketDisconnection = () => {
    isConnected = false;
    console.log('Disconnected from socket');
    connectionStatusElm.text('Disconnected');
};

const renderProjectionMenu = (projections) => {
    const projectionList = $('#nav-tab');
    projectionList.empty();
    projections.forEach((projection) => {
        const projectionItem = $(`
            <button
                class="nav-link"
                id="nav-${projection.id}-tab"
                type="button"
                role="tab"
                aria-controls="nav-home"
                aria-selected="true"
            >
                ${projection.id} (${projection.type})
            </button>
            `);
        projectionItem.on('click', () => {
            renderProjectionDetails(projection);
            projectionItem.addClass('active').siblings().removeClass('active'); // Set active class for the clicked projection
        });
        projectionList.append(projectionItem);
    });
};

const renderSinkDeviceSelect = (devices, activeId) =>{
    sinkSelectElm.empty();
    devices.forEach((device) => {
        const option = $(`<option value="${device.deviceId}">${device.label}</option>`);
        if (device.deviceId === activeId) {
            option.attr('selected', 'selected');
        }
        sinkSelectElm.append(option);
    });
}

const handleStateRefresh = async () =>{
    console.log('Refreshing state');
    const [error, response] = await safeAwait(apiSdk.fetchAllProjections());
    if (error) {
        console.error(error);
        return;
    }
    projectionStates = response;
    if (response.length === 0) {
        console.log('No projections found');
        connectionStatusElm.text('No projections');
        return;
    }
    activeProjectionId = activeProjectionId || response[0].id; // Fallback to the first projection if no activeProjectionId is set
    renderProjectionDetails(response.find((p) => p.id === activeProjectionId));
    renderProjectionMenu(response);
}

const refreshProjectionMediaDevices = async (id, activeDeviceId) => {
    const [error, devices] = await safeAwait(apiSdk.fetchProjectionDevices(id));
    if (error) {
        console.error(error);
        return;
    }
    renderSinkDeviceSelect(devices, activeDeviceId);
}

const renderProjectionDetails = async (projection) => {
    console.log('Rendering projection details');
    console.log(projection);
    $('#url-input').val(projection.url);
    activeProjectionId = projection.id;
    refreshProjectionMediaDevices(projection.id, projection.activeDevice.deviceId);
}

const handleRTCPlay = async () => {
    const url = $('#url-input').val();
    if (!url || url === '') {
        console.error('No URL provided');
        return;
    }
    console.log('Submiting play job');
    const [error, response] = await safeAwait(apiSdk.submitProjectionJob(activeProjectionId, {
        id: activeProjectionId,
        url,
        type: 'whep',
        sinkId: sinkSelectElm.val(),
    }));
    if (error) {
        console.error(error);
        return;
    }
    console.log('Play job submitted');
    console.log(response);
};

const handleReload = async () => {
    console.log('Reloading page');
    toggleProjectionStatus(activeProjectionId, 'reload');
}

const handleProjectionDeviceChange = async (event) => {
    await apiSdk.updateProjectionDevice(activeProjectionId, {
        deviceId: event.target.value,
        label: event.target.selectedOptions[0].textContent
    });
}

jQuery(()=>{
    socket = io.connect();
    socket.on('connect', handleSocketConnection);
    socket.on('disconnect', handleSocketDisconnection);
    socket.on('refresh', handleStateRefresh);

    apiSdk = apiSdkService();

    $('#rtc-play').on('click', handleRTCPlay);
    $('#reload-btn').on('click', handleReload);
    $('#sink-select').on('change', handleProjectionDeviceChange);
    $('#sink-select').on('click', (event) => {
        event.stopPropagation();
        refreshProjectionMediaDevices(activeProjectionId, event.target.value);
    });
});