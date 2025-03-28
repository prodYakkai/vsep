const apiSdkService = (
    BASE_URL = window.location.origin,
) => {
    let self = {};
    const API_URL = `${BASE_URL}/api`;
    
    const fetchAllProjections = async () => {
        return fetch(`${API_URL}/projections`)
            .then((response) => response.json());
    }
    
    const fetchProjection = async (id, type, socketId='') => {
        return fetch(`${API_URL}/projection/${id}?type=${type}${socketId ? `&socketId=${socketId}` : ''}`)
            .then((response) => response.json())
    }
    
    const toggleProjectionStatus = async (id, action) => {
        return fetch(`${API_URL}/projection/${id}/action`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action
            })
        })
            .then((response) => response.json());
    }
    
    const updateProjectionDevices = async (id, devices, activeDevice) => {
        return fetch(`${API_URL}/projection/${id}/devices`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                devices,
                activeDevice
            })
        })
            .then((response) => response.json());
    }
    
    const updateProjectionDevice = async (id, device) => {
        return fetch(`${API_URL}/projection/${id}/device`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                device
            })
        })
            .then((response) => response.json());
    }
    
    const fetchProjectionDevices = async (id) => {
        return fetch(`${API_URL}/projection/${id}/devices`)
            .then((response) => response.json());
    }
    
    const submitProjectionJob = async (id, job) => {
        return fetch(`${API_URL}/projection/${id}/job`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                job
            })
        })
            .then((response) => response.json());
    }

    self = {
        fetchAllProjections,
        fetchProjection,
        toggleProjectionStatus,
        updateProjectionDevices,
        updateProjectionDevice,
        fetchProjectionDevices,
        submitProjectionJob
    }

    return self;
}