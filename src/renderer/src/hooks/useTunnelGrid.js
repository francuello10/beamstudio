/**
 * useTunnelGrid.js — WebGL2 "Tunnel/Grid" visual engine (BS-005, 3rd of 4 visuals).
 *
 * Effect: a single full-screen fragment shader pass that computes polar
 * coordinates (radius/angle) around the screen center, maps radius to a
 * "depth" coordinate that keeps increasing over time, and draws periodic
 * neon rings (depth bands) plus radial spokes (angle bands) from it — the
 * classic "flying through an infinite tunnel/grid" demo-scene technique.
 *
 * WHY this technique (not a geometry/particle approach like Particle Field):
 * the whole "rings + spokes rushing at the viewer" look is a pure function of
 * screen-space polar coordinates and a single scalar depth-time value, so a
 * single-quad fragment shader reproduces it exactly with zero CPU-side
 * simulation and zero per-object buffers — cheaper and simpler than building
 * thousands of ring/spoke quads, and it's the standard real-time way this
 * effect is done (Shadertoy-style tunnel shaders). Rings/spokes are rendered
 * as glowing thin lines (`pow()` falloff around each band boundary), the same
 * glow idiom Particle Field's fragment shader uses for its points.
 *
 * `AudioFrame` mapping (read imperatively via `useAudioStore.getState()` once
 * per rAF frame, not the reactive selector form, to avoid 60fps re-renders):
 *
 *   - levels.bass       -> forward-travel speed (continuous term) plus a
 *                          smoothed kick-transient envelope (rolling average
 *                          + threshold, same idea as Particle Field's burst
 *                          detector) that both boosts speed further AND
 *                          compresses ring spacing on kicks. Both boosts are
 *                          clamped, with an extra-tight ceiling specifically
 *                          when `status.clipping` is true — a sudden speed/
 *                          spacing jump reads as a strobe just like a
 *                          brightness spike does, so it gets the same
 *                          anti-white-flash-style treatment.
 *   - spectral (16 band) -> a slow-smoothed base hue (weighted-average band
 *                          index, same HUE_LOW/HUE_HIGH neon range as Fluid
 *                          Neon/Particle Field) PLUS a small deterministic
 *                          per-ring hue jitter computed in the shader from a
 *                          hash of the ring index, so consecutive rings don't
 *                          all share the exact same color band (this covers
 *                          both options the task spec allowed: hue rotation
 *                          and per-ring color variation). Ecosystem
 *                          Color-Sync (opt-in, defaults ON, see
 *                          useAudioStore's `visualColorSyncEnabled`): when
 *                          enabled, the HUE_LOW/HUE_HIGH range is swapped for
 *                          the DMX side's current genre theme
 *                          (audio/genreColorTheme.js) instead. Flag OFF is
 *                          byte-identical to before this feature existed.
 *   - spatial.left/right -> stereo bias (right - left) biases rotation
 *                          direction/speed on top of a small always-on
 *                          ambient rotation, and smoothly offsets the
 *                          vanishing point horizontally (stereo width cue).
 *   - spatial.center      -> small brightness boost on the spokes only, so
 *                          center-channel presence makes the grid read more
 *                          clearly (bonus mapping beyond the minimum spec).
 *   - levels.volume       -> ambient brightness floor term, continuous.
 *   - status.silence      -> never checked/gated on: forward travel,
 *                          rotation and rings all keep a nonzero ambient
 *                          baseline regardless, so the tunnel never freezes
 *                          or goes dark with audio OFF.
 *   - status.clipping     -> extra-tight ceilings on the kick speed boost,
 *                          ring-pulse compression, AND overall brightness, on
 *                          top of each one's normal ceiling — mirrors the
 *                          app-wide anti-white-flash/anti-strobe convention.
 *
 * External shape matches useParticleField()/useFluidSimulation():
 * { canvasRef, start, stop }. stop() fully tears down GL resources (buffer,
 * VAO, program, lost context) so mount -> start -> stop -> unmount -> remount
 * is clean, since ProjectorApp.jsx unmounts/remounts visual components on
 * visual switch.
 *
 * @ai-constraints Pure canvas/WebGL visual driven only by AudioFrame. Never
 * import useDmxStore or reference window.dmx/window.ambilight.
 */
import { useCallback, useRef } from 'react'
import { useAudioStore } from '../store/audioStore'
import { createProgram } from '../visuals/glUtils'
import { getThemeForGenre } from '../audio/genreColorTheme'

// ═══════════════════════════════════════════════════
// TUNING CONSTANTS
// ═══════════════════════════════════════════════════

// Forward travel (depth-time accumulation).
const AMBIENT_BASE_SPEED = 0.35 // depth units/s, always-on so travel never stops with audio OFF
const BASS_SPEED_SCALE = 0.9 // continuous bass level -> extra travel speed
const KICK_SPEED_BOOST = 0.6 // smoothed kick-transient envelope -> extra speed ceiling
const KICK_SPEED_BOOST_CLIPPING = 0.3 // extra-tight ceiling while clipping
const DEPTH_WRAP = 1e6 // periodic wrap so accumulated depth-time float never degrades on long soak runs

// Rolling-average + transient detection for the kick envelope (same idea as
// Particle Field's bass-burst detector, independently implemented here).
const BASS_AVG_SMOOTH = 0.02
const TRANSIENT_THRESHOLD = 0.08
const KICK_ENV_ATTACK = 0.35
const KICK_ENV_RELEASE = 0.06

// Ring-spacing pulse (rings compress on kicks).
const RING_DENSITY_BASE = 5.0
const RING_PULSE_SCALE = 3.0
const RING_PULSE_MAX = 1.0
const RING_PULSE_MAX_CLIPPING = 0.5

// Rotation + vanishing-point offset (stereo width cue).
const ROTATION_BASE_SPEED = 0.05 // rad/s, always-on ambient rotation
const ROTATION_BIAS_SCALE = 0.35 // stereo bias -> extra rotation speed/direction
const VANISH_OFFSET_SCALE = 0.3 // stereo bias -> horizontal vanishing-point offset
const VANISH_OFFSET_SMOOTH = 0.08 // per-frame lerp so the vanishing point never jumps

// Neon hue range sampled from spectral content — same family as Fluid Neon /
// Particle Field: low bands skew warm magenta/violet, high bands toward cyan.
const HUE_LOW = 0.82
const HUE_HIGH = 0.52
const HUE_SMOOTH = 0.03

// Brightness — never pure white (see anti-white-flash convention).
const AMBIENT_BRIGHTNESS_MIN = 0.35
const AMBIENT_BRIGHTNESS_VOLUME_TERM = 0.25
const BRIGHTNESS_KICK_TERM = 0.2
const BRIGHTNESS_MAX = 0.9
const BRIGHTNESS_MAX_CLIPPING = 0.65

// ═══════════════════════════════════════════════════
// GLSL SHADERS
// ═══════════════════════════════════════════════════
const vertexShaderSrc = `#version 300 es
layout(location = 0) in vec2 aPosition;
void main () {
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

const fragmentShaderSrc = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uDepthTime;
uniform float uRingDensity;
uniform float uRotation;
uniform float uVanishOffsetX;
uniform float uHue;
uniform float uBrightness;
uniform float uCenterBoost;

out vec4 fragColor;

const float PI = 3.14159265359;
const float SPOKE_COUNT = 20.0;
const float RING_WIDTH = 0.12;
const float SPOKE_WIDTH = 0.05;

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Cheap deterministic per-ring hash -> small hue jitter so consecutive rings
// don't all share the exact same color (see file header: covers the
// "per-ring color variation" half of the spectral mapping).
float ringHash(float n) {
    return fract(sin(n * 12.9898) * 43758.5453);
}

void main () {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
    uv.x -= uVanishOffsetX;

    float ca = cos(uRotation);
    float sa = sin(uRotation);
    uv = mat2(ca, sa, -sa, ca) * uv;

    float radius = length(uv) + 0.0008; // epsilon avoids a div-by-zero at dead center
    float angle = atan(uv.y, uv.x);

    // Classic "flying tunnel" depth coordinate: 1/radius sends the center to
    // infinity; subtracting accumulated travel time streams rings from the
    // vanishing point toward the viewer as uDepthTime grows.
    float depthCoord = 1.0 / radius - uDepthTime;
    float ringSpace = depthCoord * uRingDensity;

    float ringFrac = fract(ringSpace);
    float ringDist = min(ringFrac, 1.0 - ringFrac);
    float ringGlow = pow(1.0 - clamp(ringDist / RING_WIDTH, 0.0, 1.0), 2.0);

    float spokeSpace = angle / (2.0 * PI) * SPOKE_COUNT;
    float spokeFrac = fract(spokeSpace);
    float spokeDist = min(spokeFrac, 1.0 - spokeFrac);
    float spokeGlow = pow(1.0 - clamp(spokeDist / SPOKE_WIDTH, 0.0, 1.0), 2.0);
    spokeGlow *= (0.7 + 0.3 * uCenterBoost);

    float pattern = clamp(ringGlow + spokeGlow * 0.6, 0.0, 1.0);

    float ringIndex = floor(ringSpace);
    float hue = fract(uHue + (ringHash(ringIndex) - 0.5) * 0.08);
    vec3 neon = hsv2rgb(vec3(hue, 0.85, 1.0));

    // Faint never-fully-dark ambient base plus the neon pattern, both scaled
    // by uBrightness (already clamped CPU-side, tighter while clipping) so
    // the final color can never approach pure white.
    vec3 bg = vec3(0.008, 0.01, 0.02) * (0.6 + 0.4 * uBrightness);
    vec3 color = bg + neon * pattern * uBrightness;

    fragColor = vec4(color, 1.0);
}
`

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

/**
 * Weighted-average spectral band -> neon hue position (0..1 within the
 * HUE_LOW..HUE_HIGH range). Unlike Particle Field's per-particle hue
 * refresh (which falls back to Math.random() on near-silence — fine when
 * averaged across thousands of independently-refreshing particles), this
 * feeds a single continuous shader uniform, so a random fallback would read
 * as frame-to-frame hue flicker during quiet passages. It settles on the
 * midpoint of the range instead.
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
        : 0.5
    return HUE_LOW + (HUE_HIGH - HUE_LOW) * t
}

/**
 * Ecosystem Color-Sync (opt-in, defaults ON — see useAudioStore's
 * `visualColorSyncEnabled`): same weighted-average spectral -> hue mapping
 * as sampleHueFromSpectral above, but with the hue range passed in instead
 * of the module HUE_LOW/HUE_HIGH constants, so the tunnel can borrow its hue
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
        : 0.5
    return hueLow + (hueHigh - hueLow) * t
}

// ═══════════════════════════════════════════════════
// MAIN HOOK
// ═══════════════════════════════════════════════════
export function useTunnelGrid() {
    const canvasRef = useRef(null)
    const glRef = useRef(null)
    const programRef = useRef(null)
    const vaoRef = useRef(null)
    const bufferRef = useRef(null)

    const runningRef = useRef(false)
    const rafRef = useRef(null)
    const timerRef = useRef(null)
    const lastTimeRef = useRef(0)

    const depthTimeRef = useRef(0)
    const rotationRef = useRef(0)
    const vanishOffsetRef = useRef(0)
    const hueRef = useRef((HUE_LOW + HUE_HIGH) / 2)
    const bassAvgRef = useRef(0)
    const kickEnvRef = useRef(0)

    // ── Initialize WebGL + full-screen quad ──
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
        if (!gl) { console.error('[useTunnelGrid] WebGL2 not supported'); return false }

        glRef.current = gl

        programRef.current = createProgram(gl, vertexShaderSrc, fragmentShaderSrc)
        if (!programRef.current) return false

        const vao = gl.createVertexArray()
        gl.bindVertexArray(vao)
        const buffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
        vaoRef.current = vao
        bufferRef.current = buffer

        gl.bindVertexArray(null)
        gl.bindBuffer(gl.ARRAY_BUFFER, null)

        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.disable(gl.BLEND) // single opaque full-screen pass, nothing to blend against
        gl.clearColor(0, 0, 0, 1)
        gl.clear(gl.COLOR_BUFFER_BIT)

        depthTimeRef.current = 0
        rotationRef.current = 0
        vanishOffsetRef.current = 0
        hueRef.current = (HUE_LOW + HUE_HIGH) / 2
        bassAvgRef.current = 0
        kickEnvRef.current = 0

        return true
    }, [])

    // ── Per-frame audio mapping + draw ──
    const render = useCallback((dt, audioFrame) => {
        const gl = glRef.current
        if (!gl) return

        const { levels, spatial, spectral, status } = audioFrame
        const bass = levels.bass
        const stereoBias = spatial.right - spatial.left // -1..1

        // Rolling average + transient detection for the kick envelope.
        bassAvgRef.current += (bass - bassAvgRef.current) * BASS_AVG_SMOOTH
        const transient = Math.max(0, bass - bassAvgRef.current - TRANSIENT_THRESHOLD)
        const kickEnvTarget = Math.min(1, transient * 4)
        kickEnvRef.current += (kickEnvTarget - kickEnvRef.current)
            * (kickEnvTarget > kickEnvRef.current ? KICK_ENV_ATTACK : KICK_ENV_RELEASE)

        // Forward-travel speed: always-on ambient base + continuous bass
        // term + smoothed kick boost, extra-clamped while clipping.
        const kickSpeedCeiling = status.clipping ? KICK_SPEED_BOOST_CLIPPING : KICK_SPEED_BOOST
        const speed = AMBIENT_BASE_SPEED + bass * BASS_SPEED_SCALE + kickEnvRef.current * kickSpeedCeiling
        depthTimeRef.current = (depthTimeRef.current + speed * dt) % DEPTH_WRAP

        // Ring-spacing pulse (rings compress on kicks), same tighter-while-
        // clipping ceiling.
        const ringPulseCeiling = status.clipping ? RING_PULSE_MAX_CLIPPING : RING_PULSE_MAX
        const ringPulse = kickEnvRef.current * ringPulseCeiling
        const ringDensity = RING_DENSITY_BASE + ringPulse * RING_PULSE_SCALE

        // Stereo width cue: bias rotation direction/speed, smoothly offset
        // the vanishing point horizontally.
        rotationRef.current = (rotationRef.current
            + (ROTATION_BASE_SPEED + stereoBias * ROTATION_BIAS_SCALE) * dt) % (Math.PI * 2)
        const targetVanishOffset = stereoBias * VANISH_OFFSET_SCALE
        vanishOffsetRef.current += (targetVanishOffset - vanishOffsetRef.current) * VANISH_OFFSET_SMOOTH

        // Ecosystem Color-Sync (opt-in, defaults ON): when enabled, sample
        // from the DMX side's current genre theme instead of this hook's own
        // fixed HUE_LOW/HUE_HIGH range. Resolved via an imperative getState()
        // read, same idiom this hook already uses for `audioFrame` itself.
        const colorSyncEnabled = useAudioStore.getState().visualColorSyncEnabled
        const syncTheme = colorSyncEnabled ? getThemeForGenre(audioFrame.genre) : null

        // Spectral -> hue, smoothed (see sampleHueFromSpectral doc comment
        // for why this doesn't fall back to Math.random() like Particle
        // Field does).
        const targetHue = syncTheme
            ? sampleHueFromSpectralInRange(spectral, syncTheme.hueLow, syncTheme.hueHigh)
            : sampleHueFromSpectral(spectral)
        hueRef.current += (targetHue - hueRef.current) * HUE_SMOOTH

        // Ambient brightness floor (never fully dark) + volume + kick term,
        // ceiling clamped tighter while clipping — never approaches white.
        const brightnessCeiling = status.clipping ? BRIGHTNESS_MAX_CLIPPING : BRIGHTNESS_MAX
        const brightness = Math.min(
            brightnessCeiling,
            AMBIENT_BRIGHTNESS_MIN + levels.volume * AMBIENT_BRIGHTNESS_VOLUME_TERM + kickEnvRef.current * BRIGHTNESS_KICK_TERM
        )

        const { uniforms, program } = programRef.current
        gl.useProgram(program)
        gl.uniform2f(uniforms.uResolution, gl.canvas.width, gl.canvas.height)
        gl.uniform1f(uniforms.uDepthTime, depthTimeRef.current)
        gl.uniform1f(uniforms.uRingDensity, ringDensity)
        gl.uniform1f(uniforms.uRotation, rotationRef.current)
        gl.uniform1f(uniforms.uVanishOffsetX, vanishOffsetRef.current)
        gl.uniform1f(uniforms.uHue, hueRef.current)
        gl.uniform1f(uniforms.uBrightness, brightness)
        gl.uniform1f(uniforms.uCenterBoost, spatial.center)

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
        gl.bindVertexArray(vaoRef.current)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        gl.bindVertexArray(null)
    }, [])

    // ── Main render loop (background-aware, dt-capped like the other hooks) ──
    const loop = useCallback(() => {
        if (!runningRef.current) return

        const now = performance.now()
        const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05)
        lastTimeRef.current = now

        const audioFrame = useAudioStore.getState().audioFrame
        render(dt, audioFrame)

        if (document.hidden) {
            timerRef.current = setTimeout(loop, 33)
        } else {
            rafRef.current = requestAnimationFrame(loop)
        }
    }, [render])

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
            if (bufferRef.current) gl.deleteBuffer(bufferRef.current)
            if (vaoRef.current) gl.deleteVertexArray(vaoRef.current)
            if (programRef.current) gl.deleteProgram(programRef.current.program)

            // Do not force WEBGL_lose_context here. React StrictMode in
            // development intentionally runs effect cleanup + setup twice;
            // forcibly losing the context during that probe leaves the
            // remounted projector source canvas permanently black. Deleting
            // GL resources above is enough for normal teardown.
        }

        glRef.current = null
        programRef.current = null
        vaoRef.current = null
        bufferRef.current = null
    }, [])

    return { canvasRef, start, stop }
}
