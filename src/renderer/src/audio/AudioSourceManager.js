export const AUDIO_INPUT_STORAGE_KEY = 'beamstudio.audio.inputDeviceId'

const MONITOR_INPUT_PATTERN = /monitor|loopback|stereo mix|what u hear|output.*monitor|monitor.*output|sink.*monitor/i

const stopStream = (stream) => {
    stream?.getTracks?.().forEach(track => track.stop())
}

const getStreamDeviceId = (stream) => stream?.getAudioTracks?.()[0]?.getSettings?.().deviceId || ''

const createSystemAudioSourceError = (message) => {
    const error = new Error(message)
    error.name = 'SystemAudioSourceNotFoundError'
    return error
}

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
            isMonitor: MONITOR_INPUT_PATTERN.test(device.label || '')
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
    let preferredInput = !selectedDeviceId ? getPreferredAudioInput(inputs) : null
    let requestedDeviceId = selectedDeviceId || preferredInput?.deviceId || ''
    let discoveredMonitorAfterPermission = false

    let stream
    let fallbackToDefault = false

    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: requestedDeviceId
                ? { ...constraints, deviceId: { exact: requestedDeviceId } }
                : constraints,
            video: false
        })

        // Linux/Chromium can hide device labels before permission is granted.
        // If the first pass fell back to the default input, enumerate again after
        // permission and switch to the monitor/loopback source when it appears.
        if (!selectedDeviceId && !preferredInput) {
            const unlockedInputs = await listAudioInputs()
            const unlockedPreferredInput = getPreferredAudioInput(unlockedInputs)
            const activeDeviceId = getStreamDeviceId(stream)

            if (unlockedPreferredInput && unlockedPreferredInput.deviceId !== activeDeviceId) {
                stopStream(stream)
                preferredInput = unlockedPreferredInput
                requestedDeviceId = unlockedPreferredInput.deviceId
                discoveredMonitorAfterPermission = true
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: { ...constraints, deviceId: { exact: requestedDeviceId } },
                    video: false
                })
            } else if (!unlockedPreferredInput) {
                stopStream(stream)
                throw createSystemAudioSourceError('No system monitor/loopback input was detected.')
            }
        }
    } catch (error) {
        if (!requestedDeviceId) throw error
        if (!selectedDeviceId) throw createSystemAudioSourceError('The preferred system monitor/loopback input is unavailable.')

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
        requestedDeviceId,
        discoveredMonitorAfterPermission
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
        fallbackToDefault,
        isMonitor: !!matchedInput?.isMonitor || !!preferredInput?.isMonitor
    }
}
