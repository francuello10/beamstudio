import { useDmxStore } from '../store/dmxStore'
import { CORE_TIMING } from '../../../shared/hardware-specs'

/**
 * DmxScheduler - Elite Independent Transmission Engine
 * 
 * Provides a stable DMX signal regardless of UI performance.
 * Implements value-diffing to minimize IPC saturation.
 * 
 * @ai-constraints Mantener el throttle según CORE_TIMING.THROTTLE_BUFFER_MS para evitar jitter.
 * No intentar enviar ráfagas (bursts) asincrónicas fuera de este ciclo.
 */
class DmxScheduler {
    constructor() {
        this.intervalId = null
        this.lastSentValues = {}
    }

    start() {
        if (this.intervalId) return

        console.log(`[DmxScheduler] Initializing engine with ${CORE_TIMING.THROTTLE_BUFFER_MS}ms throttle...`)

        this.intervalId = setInterval(() => {
            this.tick()
        }, CORE_TIMING.THROTTLE_BUFFER_MS)
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
        const selectedIds = fixtures.filter(f => f.selected).map(f => f.id)

        // Identify if we are in a mode where colors are handled by the backend (Main Process)
        const isDynamicMode = !!(state.activeDynamicScene || state.activeFlag)

        if (isDynamicMode) {
            // SYNC ONLY SPECIFIC CONTROL ATTRIBUTES (No RGB to avoid flickering)
            const controlAttrs = ['dim', 'spd', 'flash', 'func']
            const updates = {}
            let hasChanged = false

            controlAttrs.forEach(attr => {
                if (currentUniverse[attr] !== this.lastSentValues[attr]) {
                    updates[attr] = currentUniverse[attr]
                    hasChanged = true
                }
            })

            if (hasChanged && selectedIds.length > 0) {
                if (window.dmx?.setChannelsAsync) {
                    window.dmx.setChannelsAsync(selectedIds, updates)
                    this.lastSentValues = { ...this.lastSentValues, ...updates }
                }
            }
            return
        }

        // 1. Check if values have changed (Dirty-Checking for Manual Mode)
        const hasChanged = Object.keys(currentUniverse).some(
            key => currentUniverse[key] !== this.lastSentValues[key]
        )

        if (!hasChanged) return

        // 2. Identify active fixtures
        if (selectedIds.length === 0) return

        // 3. Send via IPC (Preload API)
        if (window.dmx?.setChannelsAsync) {
            window.dmx.setChannelsAsync(selectedIds, currentUniverse)

            // 4. Update memory for next tick
            this.lastSentValues = { ...currentUniverse }
        }
    }
}

export const dmxScheduler = new DmxScheduler()
