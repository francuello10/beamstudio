import { useDmxStore } from '../store/dmxStore'
import { CORE_REFRESH_RATE } from '../utils/hardware-specs'

/**
 * DmxScheduler - Elite Independent Transmission Engine
 * 
 * Provides a stable DMX signal regardless of UI performance.
 * Implements value-diffing to minimize IPC saturation.
 * 
 * @ai-constraints Mantener el throttle en 22-25ms (44Hz) para evitar el jitter del chip FTDI.
 * No intentar enviar ráfagas (bursts) asincrónicas fuera de este ciclo.
 */
class DmxScheduler {
    constructor() {
        this.intervalId = null
        this.lastSentValues = {}
        this.hz = CORE_REFRESH_RATE
    }

    start() {
        if (this.intervalId) return

        console.log(`[DmxScheduler] Initializing engine at ${this.hz}Hz...`)

        this.intervalId = setInterval(() => {
            this.tick()
        }, 1000 / this.hz)
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId)
            this.intervalId = null
        }
    }

    tick() {
        const state = useDmxStore.getState()
        const currentUniverse = state.dmxUniverseState
        const fixtures = state.dmxFixtures

        // 1. Check if values have changed (Dirty-Checking)
        const hasChanged = Object.keys(currentUniverse).some(
            key => currentUniverse[key] !== this.lastSentValues[key]
        )

        if (!hasChanged) return

        // 2. Identify active fixtures
        const selectedIds = fixtures.filter(f => f.selected).map(f => f.id)
        if (selectedIds.length === 0) return

        // 3. Send via IPC (Preload API)
        // We use the async one-way call for maximum performance
        if (window.dmx?.setChannelsAsync) {
            window.dmx.setChannelsAsync(selectedIds, currentUniverse)

            // 4. Update memory for next tick
            this.lastSentValues = { ...currentUniverse }
        }
    }
}

export const dmxScheduler = new DmxScheduler()
