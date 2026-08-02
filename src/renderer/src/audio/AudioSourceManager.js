export const AUDIO_INPUT_STORAGE_KEY = 'beamstudio.audio.inputDeviceId'

const MONITOR_INPUT_PATTERN = /monitor|loopback|stereo mix|what u hear|output.*monitor|monitor.*output|sink.*monitor|monitor.*speaker|speaker.*monitor|parlante|altavoz|salida.*audio/i
const MICROPHONE_INPUT_PATTERN = /microphone|microfono|micrófono|\bmic\b|webcam|camera/i
const GENERIC_SYSTEM_INPUT_PATTERN = /^default$|pipewire|pulse|pulseaudio/i

const stopStream = (stream) => {
    stream?.getTracks?.().forEach(track => track.stop())
}

const getStreamSettings = (stream) => stream?.getAudioTracks?.()[0]?.getSettings?.() || {}
const getStreamDeviceId = (stream) => getStreamSettings(stream).deviceId || ''

export const createSystemAudioSourceError = (message) => {
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

export const isExplicitMicrophoneLabel = (label = '') => MICROPHONE_INPUT_PATTERN.test(label)

export const isSystemAudioInputLabel = (label = '') => {
    if (!label || isExplicitMicrophoneLabel(label)) return false
    return MONITOR_INPUT_PATTERN.test(label)
}

export const isGenericSystemAudioInputLabel = (label = '') => {
    if (!label || isExplicitMicrophoneLabel(label)) return false
    return GENERIC_SYSTEM_INPUT_PATTERN.test(label)
}

export const listAudioInputs = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return []

    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices
        .filter(device => device.kind === 'audioinput')
        .map((device, index) => {
            const rawLabel = device.label || ''
            const label = rawLabel || `Audio Input ${index + 1}`
            return {
                deviceId: device.deviceId,
                label,
                isMonitor: isSystemAudioInputLabel(rawLabel),
                isGenericSystem: isGenericSystemAudioInputLabel(rawLabel),
                isMicrophone: isExplicitMicrophoneLabel(rawLabel)
            }
        })
        .filter(input => input.isMonitor || input.isGenericSystem)
}

export const getPreferredAudioInput = (inputs) => {
    if (!Array.isArray(inputs) || inputs.length === 0) return null
    return inputs.find(input => input.isMonitor)
        || inputs.find(input => input.isGenericSystem)
        || null
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
        if (selectedDeviceId && !inputs.some(input => input.deviceId === selectedDeviceId && (input.isMonitor || input.isGenericSystem))) {
            throw createSystemAudioSourceError('Selected audio device is not a speaker monitor/loopback source.')
        }

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
        if (error?.name === 'SystemAudioSourceNotFoundError') throw error
        if (!requestedDeviceId) throw error

        throw createSystemAudioSourceError(selectedDeviceId
            ? 'Selected system monitor/loopback input is unavailable. BeamStudio will not use a microphone.'
            : 'The preferred system monitor/loopback input is unavailable. BeamStudio will not use a microphone.')
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
    const streamSettings = getStreamSettings(stream)
    const actualDeviceId = streamSettings.deviceId || requestedDeviceId || ''
    const matchedInput = refreshedInputs.find(input => input.deviceId === actualDeviceId)

    return {
        deviceId: actualDeviceId,
        label: matchedInput?.label
            || preferredInput?.label
            || (selectedDeviceId ? 'Selected system monitor' : 'Auto speaker monitor'),
        fallbackToDefault,
        channelCount: streamSettings.channelCount || 0,
        sampleRate: streamSettings.sampleRate || 0,
        isMonitor: !!matchedInput?.isMonitor || !!preferredInput?.isMonitor,
        isGenericSystem: !!matchedInput?.isGenericSystem || !!preferredInput?.isGenericSystem
    }
}
