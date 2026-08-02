export const AUDIO_INPUT_STORAGE_KEY = 'beamstudio.audio.inputDeviceId'

export const readStoredAudioInputId = () => {
    try {
        return localStorage.getItem(AUDIO_INPUT_STORAGE_KEY) || ''
    } catch {
        return ''
    }
}

export const writeStoredAudioInputId = (deviceId) => {
    try {
        if (deviceId) localStorage.setItem(AUDIO_INPUT_STORAGE_KEY, deviceId)
        else localStorage.removeItem(AUDIO_INPUT_STORAGE_KEY)
    } catch { }
}

export const listAudioInputs = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return []

    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices
        .filter(device => device.kind === 'audioinput')
        .map((device, index) => ({
            deviceId: device.deviceId,
            label: device.label || `Audio Input ${index + 1}`,
            isMonitor: /monitor|loopback|stereo mix/i.test(device.label || '')
        }))
}

export const getPreferredAudioInput = (inputs) => {
    if (!Array.isArray(inputs) || inputs.length === 0) return null
    return inputs.find(input => input.isMonitor) || null
}

export const requestAudioInputStream = async ({
    selectedDeviceId,
    inputs,
    constraints
}) => {
    const preferredInput = !selectedDeviceId ? getPreferredAudioInput(inputs) : null
    const requestedDeviceId = selectedDeviceId || preferredInput?.deviceId || ''

    let stream
    let fallbackToDefault = false

    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: requestedDeviceId
                ? { ...constraints, deviceId: { exact: requestedDeviceId } }
                : constraints,
            video: false
        })
    } catch (error) {
        if (!requestedDeviceId) throw error

        fallbackToDefault = true
        stream = await navigator.mediaDevices.getUserMedia({
            audio: constraints,
            video: false
        })
    }

    return {
        stream,
        fallbackToDefault,
        preferredInput,
        requestedDeviceId
    }
}

export const resolveActiveAudioSource = ({
    stream,
    refreshedInputs,
    requestedDeviceId,
    selectedDeviceId,
    preferredInput,
    fallbackToDefault
}) => {
    const actualDeviceId = stream.getAudioTracks?.()[0]?.getSettings?.().deviceId || requestedDeviceId || ''
    const matchedInput = refreshedInputs.find(input => input.deviceId === actualDeviceId)

    return {
        deviceId: actualDeviceId,
        label: matchedInput?.label
            || preferredInput?.label
            || (selectedDeviceId ? 'Selected audio input' : 'Default audio input'),
        fallbackToDefault
    }
}
