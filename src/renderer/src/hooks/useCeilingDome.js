/**
 * useCeilingDome.js — WebGL2 "Ceiling Dome" (Aurora/Nebula) visual engine
 * (BS-005, 5th visual, ceiling-mounted-projector specific).
 *
 * Effect: a single full-screen fragment shader pass that builds a 3-octave
 * domain-warped value-noise fbm (Inigo Quilez-style "warp the sampling
 * coordinate by another fbm" technique) and shapes it into slowly-drifting
 * aurora ribbons / nebula clouds, with a soft isotropic radial vignette
 * toward the edges so it reads as an ambient sky/dome rather than a
 * hard-edged rectangle — even before any projection-mapping mask is applied
 * on top. No external image/texture asset, matching this codebase's
 * zero-asset shader-only convention (same idiom as useTunnelGrid.js's
 * `ringHash()`/useKaleidoscope.js's domain-warped pattern, just applied to a
 * 2D noise field instead of a polar coordinate).
 *
 * WHY this technique (value noise + domain warp, not a geometry/particle
 * approach): aurora/nebula cloud shapes are exactly what a warped fbm
 * produces — soft, organic, non-repeating blobs and ribbons — for the cost
 * of a handful of hash calls per pixel, with zero CPU-side simulation and
 * zero per-object buffers, same "one full-screen quad, all the work happens
 * per pixel" shape as Tunnel Grid/Kaleidoscope.
 *
 * WHY THIS VISUAL IS DELIBERATELY DIFFERENT FROM THE OTHER 4: it's meant to
 * be viewed from BELOW (ceiling-mounted projector, viewers sometimes lying
 * down looking straight up), so two things are intentionally dialed back
 * versus every other visual in this library:
 *   - Motion is noticeably SLOWER (see AMBIENT_DRIFT_SPEED vs. e.g.
 *     useTunnelGrid.js's AMBIENT_BASE_SPEED/useKaleidoscope.js's
 *     AMBIENT_FLOW_SPEED, both ~5-10x faster).
 *   - Peak brightness is noticeably LOWER (BRIGHTNESS_MAX below — compare to
 *     Tunnel Grid's 0.9/Kaleidoscope's 0.95) so an overhead light source
 *     never reads as glare for someone directly underneath it.
 * The composition also carries no implied up/down reference (unlike a
 * tunnel's forward-recession point): drift moves diagonally at a fixed
 * axis ratio rather than "rising"/"falling", and the vignette is a plain
 * isotropic radius-from-center falloff, so the frame has no orientation a
 * ceiling mount would make visible as "wrong side up".
 *
 * `AudioFrame` mapping (read imperatively via `useAudioStore.getState()`
 * once per rAF frame, not the reactive selector form, to avoid 60fps
 * re-renders):
 *
 *   - levels.bass       -> continuous term added to the domain-warp
 *                          (turbulence) strength, PLUS a smoothed
 *                          kick-transient envelope (rolling average +
 *                          threshold, same idea as Tunnel Grid's/
 *                          Kaleidoscope's burst detector, independently
 *                          implemented here) that both boosts turbulence
 *                          further AND lifts brightness on kick onset. Both
 *                          the kick turbulence boost and the brightness lift
 *                          are clamped, with an extra-tight ceiling
 *                          specifically when `status.clipping` is true —
 *                          mirrors the app-wide anti-white-flash convention
 *                          documented in useTunnelGrid.js/useKaleidoscope.js.
 *   - spectral (16 band) -> THREE independently-sampled region hues (low
 *                          bands / mid bands / high bands, each its own
 *                          weighted-average-band sample like Tunnel Grid's
 *                          `sampleHueFromSpectral`, just scoped to a
 *                          sub-range), each smoothed, then blended across the
 *                          field by an independent coarse/slow noise sample
 *                          (not raw screen position) so the field reads as a
 *                          genuine HUE GRADIENT across different regions
 *                          instead of one global hue shifting together —
 *                          this is what makes it read as a nebula/aurora
 *                          instead of a flat neon wash. Uses its own aurora
 *                          palette (green -> cyan -> violet) rather than the
 *                          other 3 visuals' hot magenta/cyan neon range —
 *                          deliberate: this is meant to read as an ambient
 *                          sky, not a neon sign.
 *   - spatial.left/right -> stereo bias (right - left) smoothly offsets the
 *                          noise field's sampling coordinate HORIZONTALLY
 *                          only (never vertically — keeps the "no implied
 *                          up/down" property intact).
 *   - levels.volume       -> small continuous ambient-drift-speed term AND
 *                          an ambient brightness floor term, both
 *                          continuous (no on/off gating).
 *   - status.silence      -> never checked/gated on: drift speed, turbulence
 *                          and brightness all keep a nonzero ambient
 *                          baseline regardless, so the dome never freezes or
 *                          goes dark with audio OFF (same convention as
 *                          every other visual in this library).
 *   - status.clipping     -> extra-tight ceilings on the kick turbulence
 *                          boost AND overall brightness, on top of each
 *                          one's normal ceiling — same anti-white-flash/
 *                          anti-strobe convention as the other 4 visuals,
 *                          doubly important here since ceiling installs put
 *                          viewers directly beneath the light source.
 *
 * External shape matches useTunnelGrid()/useKaleidoscope()/useParticleField():
 * { canvasRef, start, stop }. stop() fully tears down GL resources (buffer,
 * VAO, program, lost context) so mount -> start -> stop -> unmount -> remount
 * is clean, since ProjectorApp.jsx unmounts/remounts the active visual
 * component on visual switch.
 *
 * @ai-constraints Pure canvas/WebGL visual driven only by AudioFrame. Never
 * import useDmxStore or reference window.dmx/window.ambilight.
 */
import { useCallback, useRef } from 'react'
import { useAudioStore } from '../store/audioStore'
import { createProgram } from '../visuals/glUtils'

// ═══════════════════════════════════════════════════
// TUNING CONSTANTS
// ═══════════════════════════════════════════════════

// Ambient drift (domain-warp sampling-coordinate motion). Noticeably SLOWER
// than every other visual in this library — see file header for why.
const AMBIENT_DRIFT_SPEED = 0.045 // noise-domain units/s, always-on so drift never stops with audio OFF
const VOLUME_DRIFT_SCALE = 0.03 // continuous volume level -> small extra drift speed
const TIME_WRAP = 1e6 // periodic wrap so accumulated drift-time float never degrades on long soak runs

// Rolling-average + transient detection for the kick envelope (same idea as
// Tunnel Grid's/Kaleidoscope's bass-burst detector, independently
// implemented here, with a slightly softer attack — less "punchy", more
// appropriate for something hanging directly overhead).
const BASS_AVG_SMOOTH = 0.02
const TRANSIENT_THRESHOLD = 0.08
const KICK_ENV_ATTACK = 0.28
const KICK_ENV_RELEASE = 0.05

// Domain-warp (turbulence) strength — bass drives this, not raw drift speed,
// so the ambient motion itself always stays calm even when bass is loud; only
// the ribbons' internal churn/fold responds to bass.
const TURBULENCE_BASE = 0.35 // ambient floor, always present
const BASS_TURBULENCE_SCALE = 0.8 // continuous bass level -> extra domain-warp strength
const KICK_TURBULENCE_BOOST = 0.45 // smoothed kick-transient envelope -> extra turbulence ceiling
const KICK_TURBULENCE_BOOST_CLIPPING = 0.2 // extra-tight ceiling while clipping

// Stereo bias -> horizontal-only noise-field offset.
const STEREO_DRIFT_SCALE = 0.6
const STEREO_DRIFT_SMOOTH = 0.05

// Aurora hue range sampled from spectral content — green -> cyan -> violet,
// deliberately NOT the other 3 visuals' hot magenta/cyan neon range (see
// file header: this should read as an ambient sky, not a neon sign).
const HUE_LOW = 0.36
const HUE_HIGH = 0.8
const HUE_SMOOTH = 0.03

// Brightness — never pure white (see anti-white-flash convention), and
// noticeably LOWER peak than every other visual in this library (compare
// Tunnel Grid's 0.9/Kaleidoscope's 0.95) since ceiling installs put viewers
// directly beneath the light source.
const AMBIENT_BRIGHTNESS_MIN = 0.16
const AMBIENT_BRIGHTNESS_VOLUME_TERM = 0.14
const BRIGHTNESS_KICK_TERM = 0.14
const BRIGHTNESS_MAX = 0.55
const BRIGHTNESS_MAX_CLIPPING = 0.32

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
uniform float uTime;
uniform float uTurbulence;
uniform float uStereoOffset;
uniform float uHueA;
uniform float uHueB;
uniform float uHueC;
uniform float uBrightness;

out vec4 fragColor;

const float NOISE_SCALE = 1.6;
const float ZONE_SCALE = 0.55;
const float DRIFT_Y_RATIO = 0.7;
const float VIGNETTE_INNER = 0.35;
const float VIGNETTE_OUTER = 1.05;

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Cheap 2D hash -> pseudo-random value in [0, 1) at each lattice point, same
// "fract of a scaled/offset dot product" idiom useTunnelGrid.js's
// ringHash() uses for its 1D case.
float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

// Bilinear value noise: smoothstep-eased interpolation between hash21() at
// the four corners of the integer lattice cell containing p.
float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// 3-octave fbm — cheap, no external texture/image asset, matches this
// codebase's zero-asset shader-only convention.
float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 3; i++) {
        value += amplitude * valueNoise(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

void main () {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;

    // Ambient drift moves diagonally at a fixed axis ratio (not a single
    // "rising"/"falling" direction) so the composition carries no implied
    // up/down reference — see file header. Stereo bias only ever offsets
    // the horizontal (x) component.
    vec2 drift = vec2(uTime, uTime * DRIFT_Y_RATIO);
    vec2 p = uv * NOISE_SCALE + drift + vec2(uStereoOffset, 0.0);

    // Domain warp (Inigo Quilez-style): offset the sampling coordinate by
    // another fbm evaluation so ribbons curl and fold instead of reading as
    // a flat, static noise field. Warp strength (uTurbulence) is CPU-driven
    // by bass + kick-onset envelope, ambient-floored so it never fully
    // flattens even with audio OFF.
    vec2 warp = vec2(
        fbm(p + vec2(5.2, 1.3)),
        fbm(p + vec2(1.7, 9.2))
    ) * uTurbulence;

    float n = fbm(p + warp);
    float cloud = smoothstep(0.15, 0.85, n);

    // Independent, coarser/slower noise sample decides which hue zone a
    // pixel falls into — this is what turns the spectral mapping into a HUE
    // GRADIENT across the field (different region, different hue) instead
    // of one global hue shifting together like the other 3 visuals.
    float zoneNoise = fbm(uv * ZONE_SCALE + vec2(uTime * 0.6, -uTime * 0.5) + vec2(37.1, 91.7));
    float zone = clamp(zoneNoise, 0.0, 1.0);
    float hue = zone < 0.5
        ? mix(uHueA, uHueB, zone * 2.0)
        : mix(uHueB, uHueC, (zone - 0.5) * 2.0);

    vec3 aurora = hsv2rgb(vec3(hue, 0.7, 1.0));

    // Soft radial vignette toward the edges — plain isotropic distance from
    // center, so it reads as an ambient dome/sky rather than a hard-edged
    // rectangle, with no directional (up/down) bias of its own.
    float dist = length(uv);
    float vignette = 1.0 - smoothstep(VIGNETTE_INNER, VIGNETTE_OUTER, dist);

    // Faint near-black ambient base (never fully dark) plus the vignetted
    // aurora term, both scaled by uBrightness (already clamped CPU-side,
    // tighter while clipping) so the final color can never approach white —
    // same anti-white-flash convention as the other 3 visuals.
    vec3 base = vec3(0.01, 0.015, 0.03) * (0.6 + 0.4 * uBrightness);
    vec3 color = base + aurora * cloud * vignette * uBrightness;

    fragColor = vec4(color, 1.0);
}
`

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

/**
 * Weighted-average spectral band -> aurora hue position (0..1 within the
 * HUE_LOW..HUE_HIGH range), scoped to a [startIdx, endIdxExclusive) sub-range
 * of the 16-band spectrum. Same technique as useTunnelGrid.js's/
 * useKaleidoscope.js's `sampleHueFromSpectral`, just parameterized so it can
 * be called 3x (low/mid/high bands) to build the 3 region hues the shader
 * blends across the field. Feeds a single continuous shader uniform, so it
 * settles on the sub-range midpoint on near-silence instead of falling back
 * to Math.random() — a random fallback would read as frame-to-frame hue
 * flicker during quiet passages.
 */
function sampleHueFromBandRange(spectral, startIdx, endIdxExclusive) {
    let weighted = 0
    let total = 0
    for (let b = startIdx; b < endIdxExclusive; b++) {
        weighted += (b - startIdx) * spectral[b]
        total += spectral[b]
    }
    const span = endIdxExclusive - startIdx
    const t = total > 0.001
        ? weighted / total / Math.max(1, span - 1)
        : 0.5
    return HUE_LOW + (HUE_HIGH - HUE_LOW) * t
}

// ═══════════════════════════════════════════════════
// MAIN HOOK
// ═══════════════════════════════════════════════════
export function useCeilingDome() {
    const canvasRef = useRef(null)
    const glRef = useRef(null)
    const programRef = useRef(null)
    const vaoRef = useRef(null)
    const bufferRef = useRef(null)

    const runningRef = useRef(false)
    const rafRef = useRef(null)
    const timerRef = useRef(null)
    const lastTimeRef = useRef(0)

    const timeRef = useRef(0)
    const stereoOffsetRef = useRef(0)
    const hueARef = useRef((HUE_LOW + HUE_HIGH) / 2)
    const hueBRef = useRef((HUE_LOW + HUE_HIGH) / 2)
    const hueCRef = useRef((HUE_LOW + HUE_HIGH) / 2)
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
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance'
        })
        if (!gl) { console.error('[useCeilingDome] WebGL2 not supported'); return false }

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

        timeRef.current = 0
        stereoOffsetRef.current = 0
        hueARef.current = (HUE_LOW + HUE_HIGH) / 2
        hueBRef.current = (HUE_LOW + HUE_HIGH) / 2
        hueCRef.current = (HUE_LOW + HUE_HIGH) / 2
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

        // Ambient drift-time accumulation: always-on ambient base + a small
        // continuous volume term, so drift never stops with audio OFF and
        // never speeds up sharply on loud passages (stays "noticeably
        // slower" than the other 3 visuals per the file header).
        const driftSpeed = AMBIENT_DRIFT_SPEED + levels.volume * VOLUME_DRIFT_SCALE
        timeRef.current = (timeRef.current + driftSpeed * dt) % TIME_WRAP

        // Domain-warp (turbulence) strength: ambient floor + continuous bass
        // term + smoothed kick boost, extra-clamped while clipping — same
        // anti-white-flash-style treatment as brightness below.
        const kickTurbulenceCeiling = status.clipping ? KICK_TURBULENCE_BOOST_CLIPPING : KICK_TURBULENCE_BOOST
        const turbulence = TURBULENCE_BASE + bass * BASS_TURBULENCE_SCALE + kickEnvRef.current * kickTurbulenceCeiling

        // Stereo width cue: bias the noise field's horizontal sampling
        // offset only, smoothly, so it never jumps.
        const targetStereoOffset = stereoBias * STEREO_DRIFT_SCALE
        stereoOffsetRef.current += (targetStereoOffset - stereoOffsetRef.current) * STEREO_DRIFT_SMOOTH

        // Spectral -> 3 independently-smoothed region hues (low/mid/high
        // bands) that the shader blends across the field by a noise-driven
        // zone coordinate (see sampleHueFromBandRange doc comment).
        const targetHueA = sampleHueFromBandRange(spectral, 0, 5)
        const targetHueB = sampleHueFromBandRange(spectral, 5, 11)
        const targetHueC = sampleHueFromBandRange(spectral, 11, 16)
        hueARef.current += (targetHueA - hueARef.current) * HUE_SMOOTH
        hueBRef.current += (targetHueB - hueBRef.current) * HUE_SMOOTH
        hueCRef.current += (targetHueC - hueCRef.current) * HUE_SMOOTH

        // Ambient brightness floor (never fully dark) + volume + kick term,
        // ceiling clamped tighter while clipping — never approaches white,
        // and the ceiling itself sits well below the other 3 visuals' (see
        // BRIGHTNESS_MAX/BRIGHTNESS_MAX_CLIPPING doc comment above).
        const brightnessCeiling = status.clipping ? BRIGHTNESS_MAX_CLIPPING : BRIGHTNESS_MAX
        const brightness = Math.min(
            brightnessCeiling,
            AMBIENT_BRIGHTNESS_MIN + levels.volume * AMBIENT_BRIGHTNESS_VOLUME_TERM + kickEnvRef.current * BRIGHTNESS_KICK_TERM
        )

        const { uniforms, program } = programRef.current
        gl.useProgram(program)
        gl.uniform2f(uniforms.uResolution, gl.canvas.width, gl.canvas.height)
        gl.uniform1f(uniforms.uTime, timeRef.current)
        gl.uniform1f(uniforms.uTurbulence, turbulence)
        gl.uniform1f(uniforms.uStereoOffset, stereoOffsetRef.current)
        gl.uniform1f(uniforms.uHueA, hueARef.current)
        gl.uniform1f(uniforms.uHueB, hueBRef.current)
        gl.uniform1f(uniforms.uHueC, hueCRef.current)
        gl.uniform1f(uniforms.uBrightness, brightness)

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

            const ext = gl.getExtension('WEBGL_lose_context')
            if (ext) ext.loseContext()
        }

        glRef.current = null
        programRef.current = null
        vaoRef.current = null
        bufferRef.current = null
    }, [])

    return { canvasRef, start, stop }
}
