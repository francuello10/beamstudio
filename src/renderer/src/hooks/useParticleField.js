/**
 * useParticleField.js — WebGL2 "Particle Field" visual engine (BS-005, 2nd of 4 visuals).
 *
 * A GPU-rendered field of a few thousand glowing neon points that drifts
 * continuously (toroidal wrap, so nothing needs to be spawned/destroyed on
 * the JS heap every frame) and reacts to `AudioFrame`:
 *
 *   - levels.bass       -> transient-triggered "burst" re-launches of a small
 *                          batch of particles (kick punch) + a smoothed global
 *                          size pulse.
 *   - spectral (16 band) -> hue of particles as they refresh/burst, weighted
 *                          toward whichever bands are currently loud (low
 *                          bands -> warm magenta/violet, high bands -> cyan),
 *                          staying inside a saturated neon range that matches
 *                          the app's Fluid Neon palette family instead of the
 *                          full ugly RGB hue wheel. Ecosystem Color-Sync
 *                          (opt-in, defaults ON, see useAudioStore's
 *                          `visualColorSyncEnabled`): when enabled, this hue
 *                          range is swapped for the DMX side's current genre
 *                          theme (audio/genreColorTheme.js) instead, so this
 *                          visual can optionally share one color identity
 *                          with the fixture colors. Flag OFF is byte-
 *                          identical to before this feature existed.
 *   - spatial.left/right -> horizontal drift bias + burst spawn position, for
 *                          a sense of stereo width.
 *   - levels.volume       -> ambient brightness floor sampled at hue-refresh
 *                          time, so quiet passages are dimmer than loud ones.
 *   - status.silence      -> ambient turbulence/drift keeps running regardless
 *                          (it is not audio-gated), so the field never freezes
 *                          or disappears with audio OFF.
 *   - status.clipping     -> extra clamp on the burst brightness/size pulse
 *                          ceiling, on top of the normal clamp, so a clipping
 *                          input can never push particles toward a hard white
 *                          flash (this app has a documented history of
 *                          avoiding white-flash/clipping artifacts elsewhere
 *                          in its audio-reactive code).
 *
 * External shape matches useFluidSimulation(): { canvasRef, start, stop }.
 * Unlike Fluid Neon, this hook is designed to be cleanly started, stopped,
 * unmounted and remounted — stop() fully tears down GL resources (buffers,
 * VAOs, programs, context) instead of just pausing the rAF loop, since
 * ProjectorApp actually unmounts visual components on switch.
 *
 * @ai-constraints Pure canvas/WebGL visual driven only by AudioFrame. Never
 * import useDmxStore or reference window.dmx/window.ambilight — this must not
 * touch DMX/fixture output (see BS-005 "cuarto slice" DMX-isolation fix).
 */
import { useCallback, useRef } from 'react'
import { useAudioStore } from '../store/audioStore'
import { createProgram } from '../visuals/glUtils'
import { getThemeForGenre } from '../audio/genreColorTheme'

// ═══════════════════════════════════════════════════
// TUNING CONSTANTS
// ═══════════════════════════════════════════════════
const PARTICLE_COUNT = 4000

// Ambient ("field") ongoing ambient drift/wander — audio-independent so the
// field stays alive with audio OFF.
const TURBULENCE = 0.6 // random-walk accel scale, physical units/s^2
const DAMPING_RATE = 1.2 // velocity decay rate, 1/s
const AMBIENT_DRIFT_Y = -0.03 // slow constant rise, like embers/light motes
const DRIFT_STRENGTH = 0.12 // stereo bias -> horizontal accel scale

// Ambient particle lifecycle (hue/brightness "refresh", not a teleport —
// position just keeps wrapping/drifting so nothing visually pops).
const LIFE_MIN = 4
const LIFE_MAX = 9
const INITIAL_VELOCITY_SEED = 0.05 // initial random velocity range on seed
const PARTICLE_BASE_SIZE_MIN = 2
const PARTICLE_BASE_SIZE_RANGE = 4

// Bass-burst behavior.
const BASS_AVG_SMOOTH = 0.02 // rolling-average smoothing (slow, ~1-2s)
const TRANSIENT_THRESHOLD = 0.08 // bass must clear its own average by this much
const BURST_SCALE = PARTICLE_COUNT * 0.06
const MAX_BURST_PER_FRAME = 160
const BURST_LIFE_MIN = 1.2
const BURST_LIFE_MAX = 2.2
const BURST_SPEED_BASE = 0.25
const BURST_SPEED_SCALE = 0.9
const BURST_SPAWN_X_SPREAD = 0.35 // stereoBias -> horizontal spawn-point offset scale
const BURST_SPAWN_JITTER_X = 0.1
const BURST_SPAWN_JITTER_Y = 0.3

// Size pulse envelope (smoothed so kicks read as a pulse, not a strobe).
const SIZE_ENV_ATTACK = 0.35
const SIZE_ENV_RELEASE = 0.08
const SIZE_PULSE_MAX = 0.35 // final multiplier is 1 + min(env,1)*this
const SIZE_PULSE_MAX_CLIPPING = 0.2 // extra-safe ceiling while clipping

// Brightness clamps — never pure white/max brightness (see file header).
const AMBIENT_BRIGHTNESS_MIN = 0.25
const AMBIENT_BRIGHTNESS_RANGE = 0.2 // + up to this, + up to volume term below
const AMBIENT_BRIGHTNESS_VOLUME_TERM = 0.15
const BURST_BRIGHTNESS_BASE = 0.55
const BURST_BRIGHTNESS_ENV_TERM = 0.35
const BURST_BRIGHTNESS_MAX = 0.85
const BURST_BRIGHTNESS_MAX_CLIPPING = 0.7

// Neon hue range sampled from spectral content — low bands skew toward
// warm magenta/violet, high bands toward cyan, matching the Fluid Neon
// palette family (see FLUID_PALETTES in useFluidSimulation.js) instead of
// sweeping the full (muddier) RGB hue wheel.
const HUE_LOW = 0.82
const HUE_HIGH = 0.52
const HUE_JITTER = 0.05

const FADE_ALPHA = 0.16 // per-frame black overlay alpha -> trail length

// ═══════════════════════════════════════════════════
// GLSL SHADERS
// ═══════════════════════════════════════════════════
const particleVertexShader = `#version 300 es
layout(location = 0) in vec2 aPosition;
layout(location = 1) in float aSize;
layout(location = 2) in float aHue;
layout(location = 3) in float aBrightness;

out float vHue;
out float vBrightness;

void main () {
    vHue = aHue;
    vBrightness = aBrightness;
    gl_Position = vec4(aPosition, 0.0, 1.0);
    gl_PointSize = aSize;
}
`

const particleFragmentShader = `#version 300 es
precision mediump float;

in float vHue;
in float vBrightness;
out vec4 fragColor;

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main () {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float d = dot(uv, uv);
    if (d > 1.0) discard;

    // Soft radial glow instead of a hard disc.
    float falloff = pow(1.0 - d, 2.0);

    // Saturated neon color, never pure white — brightness is clamped on the
    // CPU side well below 1.0 for exactly this reason.
    vec3 color = hsv2rgb(vec3(vHue, 0.85, 1.0));

    fragColor = vec4(color * vBrightness, falloff);
}
`

// Full-screen quad shaders for the per-frame fade pass that gives particles
// a soft trailing glow instead of a hard-cut disappearance.
const fadeVertexShader = `#version 300 es
layout(location = 0) in vec2 aPosition;
void main () {
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

const fadeFragmentShader = `#version 300 es
precision mediump float;
uniform float uFadeAlpha;
out vec4 fragColor;
void main () {
    fragColor = vec4(0.0, 0.0, 0.0, uFadeAlpha);
}
`

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════
const clamp01 = (v) => Math.max(0, Math.min(1, v))

/**
 * Weighted-average spectral band -> neon hue. Falls back to a random hue
 * when the spectrum is essentially silent, so the idle/ambient field still
 * shows color variety with audio OFF.
 */
function sampleHueFromSpectral(spectral) {
    let weighted = 0
    let total = 0
    for (let b = 0; b < spectral.length; b++) {
        weighted += b * spectral[b]
        total += spectral[b]
    }
    const t = total > 0.001
        ? weighted / total / Math.max(1, spectral.length - 1)
        : Math.random()
    const base = HUE_LOW + (HUE_HIGH - HUE_LOW) * t
    return clamp01(base + (Math.random() - 0.5) * HUE_JITTER)
}

/**
 * Ecosystem Color-Sync (opt-in, defaults ON — see useAudioStore's
 * `visualColorSyncEnabled`): same weighted-average spectral -> hue mapping
 * as sampleHueFromSpectral above, but with the hue range passed in instead
 * of the module HUE_LOW/HUE_HIGH constants, so the field can borrow its hue
 * range from the DMX side's current genre theme (audio/genreColorTheme.js).
 * Kept as its OWN separate function (not a parameterized rewrite of
 * sampleHueFromSpectral) so the flag-off code path above is untouched by
 * this feature and stays byte-for-byte the same as before it existed.
 */
function sampleHueFromSpectralInRange(spectral, hueLow, hueHigh) {
    let weighted = 0
    let total = 0
    for (let b = 0; b < spectral.length; b++) {
        weighted += b * spectral[b]
        total += spectral[b]
    }
    const t = total > 0.001
        ? weighted / total / Math.max(1, spectral.length - 1)
        : Math.random()
    const base = hueLow + (hueHigh - hueLow) * t
    return clamp01(base + (Math.random() - 0.5) * HUE_JITTER)
}

// ═══════════════════════════════════════════════════
// MAIN HOOK
// ═══════════════════════════════════════════════════
export function useParticleField() {
    const canvasRef = useRef(null)
    const glRef = useRef(null)
    const particleProgramRef = useRef(null)
    const fadeProgramRef = useRef(null)
    const particleVaoRef = useRef(null)
    const particleBufferRef = useRef(null)
    const fadeVaoRef = useRef(null)
    const fadeBufferRef = useRef(null)
    const gpuArrayRef = useRef(null)
    const aspectRef = useRef(1)

    const runningRef = useRef(false)
    const rafRef = useRef(null)
    const timerRef = useRef(null)
    const lastTimeRef = useRef(0)

    // Particle CPU state (physical space: x in [0, aspect], y in [0, 1]).
    const posXRef = useRef(null)
    const posYRef = useRef(null)
    const velXRef = useRef(null)
    const velYRef = useRef(null)
    const ageRef = useRef(null)
    const lifeRef = useRef(null)
    const hueRef = useRef(null)
    const brightnessRef = useRef(null)
    const baseSizeRef = useRef(null)

    const burstCursorRef = useRef(0)
    const bassAvgRef = useRef(0)
    const sizeEnvRef = useRef(0)

    // ── Initialize WebGL + particle pool ──
    const initGL = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return false

        const gl = canvas.getContext('webgl2', {
            alpha: false,
            depth: false,
            stencil: false,
            antialias: false,
            // These canvases are sampled by MappingCompositor via texImage2D;
            // keeping the drawing buffer prevents Chromium from presenting a
            // cleared/black frame to the projector compositor.
            preserveDrawingBuffer: true,
            powerPreference: 'high-performance'
        })
        if (!gl) { console.error('[useParticleField] WebGL2 not supported'); return false }

        glRef.current = gl
        aspectRef.current = canvas.width / canvas.height

        particleProgramRef.current = createProgram(gl, particleVertexShader, particleFragmentShader)
        fadeProgramRef.current = createProgram(gl, fadeVertexShader, fadeFragmentShader)
        if (!particleProgramRef.current || !fadeProgramRef.current) return false

        // Particle buffer: interleaved [x_ndc, y_ndc, size, hue, brightness] per vertex.
        const particleVao = gl.createVertexArray()
        gl.bindVertexArray(particleVao)
        const particleBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, PARTICLE_COUNT * 5 * 4, gl.DYNAMIC_DRAW)
        const stride = 5 * 4
        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0)
        gl.enableVertexAttribArray(1)
        gl.vertexAttribPointer(1, 1, gl.FLOAT, false, stride, 8)
        gl.enableVertexAttribArray(2)
        gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 12)
        gl.enableVertexAttribArray(3)
        gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 16)
        particleVaoRef.current = particleVao
        particleBufferRef.current = particleBuffer

        // Full-screen quad for the fade pass.
        const fadeVao = gl.createVertexArray()
        gl.bindVertexArray(fadeVao)
        const fadeBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, fadeBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
        fadeVaoRef.current = fadeVao
        fadeBufferRef.current = fadeBuffer

        gl.bindVertexArray(null)
        gl.bindBuffer(gl.ARRAY_BUFFER, null)

        gl.clearColor(0, 0, 0, 1)
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.enable(gl.BLEND)

        // Seed the particle pool, staggering `age` within `life` so the
        // whole field doesn't refresh hue in lockstep every few seconds.
        const aspect = aspectRef.current
        gpuArrayRef.current = new Float32Array(PARTICLE_COUNT * 5)
        posXRef.current = new Float32Array(PARTICLE_COUNT)
        posYRef.current = new Float32Array(PARTICLE_COUNT)
        velXRef.current = new Float32Array(PARTICLE_COUNT)
        velYRef.current = new Float32Array(PARTICLE_COUNT)
        ageRef.current = new Float32Array(PARTICLE_COUNT)
        lifeRef.current = new Float32Array(PARTICLE_COUNT)
        hueRef.current = new Float32Array(PARTICLE_COUNT)
        brightnessRef.current = new Float32Array(PARTICLE_COUNT)
        baseSizeRef.current = new Float32Array(PARTICLE_COUNT)

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            posXRef.current[i] = Math.random() * aspect
            posYRef.current[i] = Math.random()
            velXRef.current[i] = (Math.random() - 0.5) * INITIAL_VELOCITY_SEED
            velYRef.current[i] = (Math.random() - 0.5) * INITIAL_VELOCITY_SEED
            lifeRef.current[i] = LIFE_MIN + Math.random() * (LIFE_MAX - LIFE_MIN)
            ageRef.current[i] = Math.random() * lifeRef.current[i]
            hueRef.current[i] = Math.random()
            brightnessRef.current[i] = AMBIENT_BRIGHTNESS_MIN + Math.random() * AMBIENT_BRIGHTNESS_RANGE
            baseSizeRef.current[i] = PARTICLE_BASE_SIZE_MIN + Math.random() * PARTICLE_BASE_SIZE_RANGE
        }

        burstCursorRef.current = 0
        bassAvgRef.current = 0
        sizeEnvRef.current = 0

        return true
    }, [])

    // ── Per-frame particle simulation + GPU buffer fill ──
    const updateParticles = useCallback((dt, audioFrame) => {
        const aspect = aspectRef.current
        const posX = posXRef.current
        const posY = posYRef.current
        const velX = velXRef.current
        const velY = velYRef.current
        const age = ageRef.current
        const life = lifeRef.current
        const hue = hueRef.current
        const brightness = brightnessRef.current
        const baseSize = baseSizeRef.current
        const gpu = gpuArrayRef.current

        const { levels, spatial, spectral, status } = audioFrame
        const bass = levels.bass
        const stereoBias = spatial.right - spatial.left // -1..1

        // Ecosystem Color-Sync (opt-in, defaults ON): when enabled, both hue
        // refresh sites below sample from the DMX side's current genre theme
        // instead of this field's own fixed HUE_LOW/HUE_HIGH range. Resolved
        // once per frame (not per-particle) via an imperative getState() read,
        // same idiom this hook already uses for `audioFrame` itself.
        const colorSyncEnabled = useAudioStore.getState().visualColorSyncEnabled
        const syncTheme = colorSyncEnabled ? getThemeForGenre(audioFrame.genre) : null

        // Rolling average + transient detection for burst triggering.
        bassAvgRef.current += (bass - bassAvgRef.current) * BASS_AVG_SMOOTH
        const transient = Math.max(0, bass - bassAvgRef.current - TRANSIENT_THRESHOLD)

        // Smoothed size-pulse envelope (attack fast, release slow) so kicks
        // read as a pulse rather than a per-frame strobe.
        const sizeEnvTarget = bass
        sizeEnvRef.current += (sizeEnvTarget - sizeEnvRef.current)
            * (sizeEnvTarget > sizeEnvRef.current ? SIZE_ENV_ATTACK : SIZE_ENV_RELEASE)
        const sizePulseCeiling = status.clipping ? SIZE_PULSE_MAX_CLIPPING : SIZE_PULSE_MAX
        const sizePulse = 1 + Math.min(sizeEnvRef.current, 1) * sizePulseCeiling

        const driftBiasX = stereoBias * DRIFT_STRENGTH

        // ── Bass-triggered bursts: re-launch a small, capped batch of
        // particles radially from a stereo-biased spawn point. ──
        const burstCount = Math.min(Math.floor(transient * BURST_SCALE), MAX_BURST_PER_FRAME)
        const burstBrightnessCeiling = status.clipping ? BURST_BRIGHTNESS_MAX_CLIPPING : BURST_BRIGHTNESS_MAX
        const spawnX = Math.min(aspect, Math.max(0, aspect * 0.5 + stereoBias * aspect * BURST_SPAWN_X_SPREAD))
        const spawnY = 0.5

        for (let k = 0; k < burstCount; k++) {
            const i = burstCursorRef.current
            burstCursorRef.current = (burstCursorRef.current + 1) % PARTICLE_COUNT

            const angle = Math.random() * Math.PI * 2
            const speed = BURST_SPEED_BASE + bass * BURST_SPEED_SCALE
            posX[i] = Math.min(aspect, Math.max(0, spawnX + (Math.random() - 0.5) * BURST_SPAWN_JITTER_X))
            posY[i] = Math.min(1, Math.max(0, spawnY + (Math.random() - 0.5) * BURST_SPAWN_JITTER_Y))
            velX[i] = Math.cos(angle) * speed
            velY[i] = Math.sin(angle) * speed
            age[i] = 0
            life[i] = BURST_LIFE_MIN + Math.random() * (BURST_LIFE_MAX - BURST_LIFE_MIN)
            hue[i] = syncTheme
                ? sampleHueFromSpectralInRange(spectral, syncTheme.hueLow, syncTheme.hueHigh)
                : sampleHueFromSpectral(spectral)
            brightness[i] = Math.min(
                burstBrightnessCeiling,
                BURST_BRIGHTNESS_BASE + sizeEnvRef.current * BURST_BRIGHTNESS_ENV_TERM
            )
        }

        // ── Main per-particle physics + ambient lifecycle + GPU write ──
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            age[i] += dt

            velX[i] += ((Math.random() - 0.5) * TURBULENCE + driftBiasX) * dt
            velY[i] += ((Math.random() - 0.5) * TURBULENCE + AMBIENT_DRIFT_Y) * dt

            const damping = Math.max(0, 1 - DAMPING_RATE * dt)
            velX[i] *= damping
            velY[i] *= damping

            posX[i] += velX[i] * dt
            posY[i] += velY[i] * dt

            // Toroidal wrap — the field never needs particles removed/added.
            if (posX[i] < 0) posX[i] += aspect
            else if (posX[i] > aspect) posX[i] -= aspect
            if (posY[i] < 0) posY[i] += 1
            else if (posY[i] > 1) posY[i] -= 1

            // Ambient lifecycle: refresh hue/brightness (not position), so
            // color evolves with the audio without particles ever popping.
            if (age[i] >= life[i]) {
                age[i] = 0
                life[i] = LIFE_MIN + Math.random() * (LIFE_MAX - LIFE_MIN)
                hue[i] = syncTheme
                    ? sampleHueFromSpectralInRange(spectral, syncTheme.hueLow, syncTheme.hueHigh)
                    : sampleHueFromSpectral(spectral)
                brightness[i] = AMBIENT_BRIGHTNESS_MIN
                    + Math.random() * AMBIENT_BRIGHTNESS_RANGE
                    + levels.volume * AMBIENT_BRIGHTNESS_VOLUME_TERM
            }

            const o = i * 5
            gpu[o] = (posX[i] / aspect) * 2 - 1
            gpu[o + 1] = posY[i] * 2 - 1
            gpu[o + 2] = baseSize[i] * sizePulse
            gpu[o + 3] = hue[i]
            gpu[o + 4] = brightness[i]
        }
    }, [])

    // ── Render: fade pass (trail) + additive particle pass ──
    const render = useCallback(() => {
        const gl = glRef.current
        if (!gl) return

        gl.bindBuffer(gl.ARRAY_BUFFER, particleBufferRef.current)
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, gpuArrayRef.current)

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

        // Fade pass — soft black overlay so particle trails glow instead of
        // hard-cutting to black between frames.
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
        gl.useProgram(fadeProgramRef.current.program)
        gl.bindVertexArray(fadeVaoRef.current)
        gl.uniform1f(fadeProgramRef.current.uniforms.uFadeAlpha, FADE_ALPHA)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

        // Particle pass — additive glow.
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
        gl.useProgram(particleProgramRef.current.program)
        gl.bindVertexArray(particleVaoRef.current)
        gl.drawArrays(gl.POINTS, 0, PARTICLE_COUNT)

        gl.bindVertexArray(null)
    }, [])

    // ── Main render loop (background-aware, dt-capped like useFluidSimulation) ──
    const loop = useCallback(() => {
        if (!runningRef.current) return

        const now = performance.now()
        const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05)
        lastTimeRef.current = now

        const audioFrame = useAudioStore.getState().audioFrame
        updateParticles(dt, audioFrame)
        render()

        if (document.hidden) {
            timerRef.current = setTimeout(loop, 33)
        } else {
            rafRef.current = requestAnimationFrame(loop)
        }
    }, [updateParticles, render])

    // ── Start ──
    const start = useCallback(() => {
        if (runningRef.current) return
        if (!glRef.current) {
            if (!initGL()) return
        }

        runningRef.current = true
        lastTimeRef.current = performance.now()
        loop()
    }, [initGL, loop])

    // ── Stop: fully tears down GL resources so this hook supports clean
    // mount -> start -> stop -> unmount -> remount cycles. ──
    const stop = useCallback(() => {
        runningRef.current = false
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current)
            rafRef.current = null
        }
        if (timerRef.current) {
            clearTimeout(timerRef.current)
            timerRef.current = null
        }

        const gl = glRef.current
        if (gl) {
            if (particleBufferRef.current) gl.deleteBuffer(particleBufferRef.current)
            if (fadeBufferRef.current) gl.deleteBuffer(fadeBufferRef.current)
            if (particleVaoRef.current) gl.deleteVertexArray(particleVaoRef.current)
            if (fadeVaoRef.current) gl.deleteVertexArray(fadeVaoRef.current)
            if (particleProgramRef.current) gl.deleteProgram(particleProgramRef.current.program)
            if (fadeProgramRef.current) gl.deleteProgram(fadeProgramRef.current.program)

            // Do not force WEBGL_lose_context here. React StrictMode in
            // development intentionally runs effect cleanup + setup twice;
            // forcibly losing the context during that probe leaves the
            // remounted projector source canvas permanently black. Deleting
            // GL resources above is enough for normal teardown.
        }

        glRef.current = null
        particleProgramRef.current = null
        fadeProgramRef.current = null
        particleVaoRef.current = null
        particleBufferRef.current = null
        fadeVaoRef.current = null
        fadeBufferRef.current = null
        gpuArrayRef.current = null
    }, [])

    return { canvasRef, start, stop }
}
