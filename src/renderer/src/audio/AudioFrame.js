export const createEmptyAudioFrame = () => ({
    timestamp: 0,
    source: {
        deviceId: '',
        label: '',
        fallbackToDefault: false
    },
    levels: {
        bass: 0,
        mid: 0,
        high: 0,
        volume: 0,
        stereoWidth: 0
    },
    stereo: {
        lowMidLeft: 0,
        lowMidRight: 0,
        midHighLeft: 0,
        midHighRight: 0
    },
    spatial: { left: 0, center: 0, right: 0 },
    spectral: new Array(16).fill(0),
    telemetry: {
        lowEndDynamics: 0,
        transientDensity: 0,
        midRms: 0,
        stereoWidth: 0
    },
    status: {
        silence: true,
        clipping: false,
        playbackPaused: false,
        playbackStatus: 'unknown'
    },
    genre: 'UNKNOWN'
})

export const createAudioFrame = ({
    timestamp,
    source,
    levels,
    stereo,
    spatial,
    spectral,
    telemetry,
    status,
    genre
}) => ({
    timestamp,
    source: {
        deviceId: source?.deviceId || '',
        label: source?.label || '',
        fallbackToDefault: !!source?.fallbackToDefault
    },
    levels: {
        bass: Math.max(0, Math.min(1, levels?.bass || 0)),
        mid: Math.max(0, Math.min(1, levels?.mid || 0)),
        high: Math.max(0, Math.min(1, levels?.high || 0)),
        volume: Math.max(0, Math.min(1, levels?.volume || 0)),
        stereoWidth: Math.max(0, Math.min(1, levels?.stereoWidth || 0))
    },
    stereo: {
        lowMidLeft: Math.max(0, Math.min(1, stereo?.lowMidLeft || 0)),
        lowMidRight: Math.max(0, Math.min(1, stereo?.lowMidRight || 0)),
        midHighLeft: Math.max(0, Math.min(1, stereo?.midHighLeft || 0)),
        midHighRight: Math.max(0, Math.min(1, stereo?.midHighRight || 0))
    },
    spatial: {
        left: Math.max(0, Math.min(1, spatial?.left || 0)),
        center: Math.max(0, Math.min(1, spatial?.center || 0)),
        right: Math.max(0, Math.min(1, spatial?.right || 0))
    },
    spectral: Array.isArray(spectral)
        ? spectral.map(value => Math.max(0, Math.min(1, value || 0)))
        : new Array(16).fill(0),
    telemetry: {
        lowEndDynamics: telemetry?.lowEndDynamics || 0,
        transientDensity: telemetry?.transientDensity || 0,
        midRms: telemetry?.midRms || 0,
        stereoWidth: telemetry?.stereoWidth || 0
    },
    status: {
        silence: !!status?.silence,
        clipping: !!status?.clipping,
        playbackPaused: !!status?.playbackPaused,
        playbackStatus: status?.playbackStatus || 'unknown'
    },
    genre: genre || 'UNKNOWN'
})
