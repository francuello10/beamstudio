/**
 * useKaleidoscope.js — WebGL2 "Kaleidoscope" visual engine (BS-005, 4th and
 * FINAL of the 4 planned visuals).
 *
 * Effect: a single full-screen fragment shader pass that folds screen-space
 * polar angle into a repeating mirrored wedge (classic two-mirror
 * kaleidoscope math) and colors the folded coordinate with a flowing,
 * domain-warped procedural pattern — purely a function of screen position,
 * a time accumulator and a handful of scalar uniforms, no external image/
 * texture asset and no CPU-side simulation.
 *
 * WHY this technique (single fragment-shader pass, like Tunnel/Grid, not a
 * geometry/particle approach like Particle Field): an N-fold mirror
 * symmetry is a pure function of screen-space polar coordinates — folding
 * the angle into `[0, wedge]` and then mirroring around the wedge midline
 * (`abs(mod(angle, wedge) - wedge/2)`) reproduces the "look through two
 * mirrors" kaleidoscope effect exactly and for free, with zero per-object
 * buffers. This is the same "one full-screen quad, all the work happens per
 * pixel in the fragment shader" shape as `useTunnelGrid.js`, just with a
 * folded-wedge coordinate standing in for that hook's radial depth
 * coordinate.
 *
 * `AudioFrame` mapping (read imperatively via `useAudioStore.getState()`
 * once per rAF frame, not the reactive selector form, to avoid 60fps
 * re-renders):
 *
 *   - levels.bass       -> continuous term added to both the pattern's flow
 *                          speed (time accumulator) and the ambient rotation
 *                          speed, PLUS a smoothed kick-transient envelope
 *                          (rolling average + threshold, same idea as
 *                          Particle Field's/Tunnel Grid's burst detector,
 *                          independently implemented here) that drives a
 *                          brief "zoom-in punch" (radius scale dips below 1
 *                          for an instant) and a brightness lift. Both the
 *                          zoom-punch depth and the brightness lift are
 *                          clamped, with an extra-tight ceiling specifically
 *                          when `status.clipping` is true — mirrors the
 *                          app-wide anti-white-flash convention documented
 *                          in useTunnelGrid.js/useParticleField.js.
 *   - spectral (16 band) -> a slow-smoothed base hue (weighted-average band
 *                          index, same HUE_LOW/HUE_HIGH neon range as Fluid
 *                          Neon/Particle Field/Tunnel Grid) that the shader
 *                          then varies further across the folded wedge angle
 *                          and pattern value, so the kaleidoscope shows a
 *                          coherent but ever-shifting spread of hues instead
 *                          of one flat color per frame. Ecosystem Color-Sync
 *                          (opt-in, defaults ON, see useAudioStore's
 *                          `visualColorSyncEnabled`): when enabled, the
 *                          HUE_LOW/HUE_HIGH range is swapped for the DMX
 *                          side's current genre theme
 *                          (audio/genreColorTheme.js) instead. Flag OFF is
 *                          byte-identical to before this feature existed.
 *   - spatial.left/right -> stereo bias (right - left) biases rotation
 *                          direction/speed on top of a small always-on
 *                          ambient rotation (same pattern as Tunnel Grid).
 *   - levels.volume       -> ambient brightness floor term AND a small
 *                          continuous pattern flow-speed term, both
 *                          continuous (no on/off gating).
 *   - status.silence      -> never checked/gated on: pattern flow, rotation
 *                          and the fold count's slow drift all keep a
 *                          nonzero ambient baseline regardless, so the
 *                          kaleidoscope never freezes or goes dark with
 *                          audio OFF.
 *   - status.clipping     -> extra-tight ceilings on the kick zoom-punch AND
 *                          overall brightness, on top of each one's normal
 *                          ceiling — same anti-white-flash/anti-strobe
 *                          convention as the other 3 visuals.
 *
 * Optional flourish (creative call, not required by spec): the mirror-fold
 * count slowly drifts between 6-fold and 12-fold over a long, slow cycle
 * (independent of audio) with a small additional nudge from the smoothed
 * bass average, so the wedge count itself breathes over the course of a
 * track instead of staying fixed at one N forever.
 *
 * External shape matches useTunnelGrid()/useParticleField(): { canvasRef,
 * start, stop }. stop() fully tears down GL resources (buffer, VAO,
 * program, lost context) so mount -> start -> stop -> unmount -> remount is
 * clean, since ProjectorApp.jsx unmounts/remounts the active visual
 * component on visual switch.
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

// Pattern flow (time accumulator driving the domain-warped wedge pattern).
const AMBIENT_FLOW_SPEED = 0.5 // flow units/s, always-on so the pattern never stops with audio OFF
const BASS_FLOW_SCALE = 0.9 // continuous bass level -> extra flow speed
const VOLUME_FLOW_SCALE = 0.3 // continuous volume level -> extra flow speed
const FLOW_WRAP = 1e6 // periodic wrap so accumulated flow-time float never degrades on long soak runs

// Rolling-average + transient detection for the kick envelope (same idea as
// Particle Field's/Tunnel Grid's bass-burst detector, independently
// implemented here).
const BASS_AVG_SMOOTH = 0.03
const TRANSIENT_THRESHOLD = 0.09
const KICK_ENV_ATTACK = 0.4
const KICK_ENV_RELEASE = 0.07

// Zoom-punch pulse (radius scale briefly dips below 1 on kicks, i.e. the
// pattern "punches in" toward the viewer).
const ZOOM_PUNCH_SCALE = 0.22
const ZOOM_PUNCH_SCALE_CLIPPING = 0.1

// Rotation (stereo width cue), same shape as Tunnel Grid.
const ROTATION_BASE_SPEED = 0.06 // rad/s, always-on ambient rotation
const BASS_ROTATION_SCALE = 0.25 // continuous bass level -> extra rotation speed
const ROTATION_BIAS_SCALE = 0.35 // stereo bias -> extra rotation speed/direction

// Fold count: slow ambient drift between 6-fold and 12-fold, plus a small
// nudge from the smoothed bass average (optional flourish, see file header).
const FOLD_COUNT_MIN = 6
const FOLD_COUNT_MAX = 12
const FOLD_CYCLE_PERIOD = 50 // seconds for one full slow drift cycle
const FOLD_BASS_NUDGE = 1.5 // smoothed bass average -> extra fold count

// Neon hue range sampled from spectral content — same family as Fluid Neon /
// Particle Field / Tunnel Grid: low bands skew warm magenta/violet, high
// bands toward cyan.
const HUE_LOW = 0.82
const HUE_HIGH = 0.52
const HUE_SMOOTH = 0.03

// Brightness — never pure white (see anti-white-flash convention).
const AMBIENT_BRIGHTNESS_MIN = 0.4
const AMBIENT_BRIGHTNESS_VOLUME_TERM = 0.2
const BRIGHTNESS_KICK_TERM = 0.25
const BRIGHTNESS_MAX = 0.95
const BRIGHTNESS_MAX_CLIPPING = 0.7

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
uniform float uFlowTime;
uniform float uFoldCount;
uniform float uRotation;
uniform float uZoom;
uniform float uHue;
uniform float uBrightness;

out vec4 fragColor;

const float PI = 3.14159265359;

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main () {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;

    float radius = length(uv) * uZoom + 0.0008; // epsilon avoids a div-by-zero look at dead center
    float angle = atan(uv.y, uv.x) + uRotation;

    // Classic two-mirror kaleidoscope fold: wrap the angle into one wedge of
    // the circle, then mirror around the wedge's own midline so each wedge
    // is internally symmetric too (doubles the visible symmetry to 2x the
    // fold count, exactly like a real two-mirror kaleidoscope tube).
    float wedge = (2.0 * PI) / uFoldCount;
    float wedgeAngle = mod(angle, wedge);
    float foldedAngle = abs(wedgeAngle - wedge * 0.5);

    // Domain-warped flowing pattern built from the folded wedge coordinate
    // (radius + foldedAngle + flow time) instead of Tunnel Grid's radial
    // depth coordinate — layered sine waves, one of them phase-warping
    // another, for an ornate, ever-shifting look.
    float warp = sin(radius * 6.0 - uFlowTime * 1.3) * 0.5;
    float pattern1 = sin(foldedAngle * 10.0 + radius * 8.0 - uFlowTime * 2.0 + warp);
    float pattern2 = sin(radius * 14.0 - uFlowTime * 1.7 + foldedAngle * 6.0);
    float pattern3 = cos(foldedAngle * 18.0 - radius * 4.0 + uFlowTime);
    float pattern = (pattern1 + pattern2 * 0.7 + pattern3 * 0.5) / 2.2;
    pattern = pattern * 0.5 + 0.5; // 0..1

    // Hue flows across the folded wedge angle and the pattern value on top
    // of the smoothed spectral-driven base hue, so color keeps shifting
    // even while the base hue itself is barely moving.
    float hue = fract(uHue + foldedAngle / wedge * 0.35 + pattern * 0.12);
    vec3 neon = hsv2rgb(vec3(hue, 0.85, 1.0));

    // Faint never-fully-dark ambient base plus the neon pattern, both scaled
    // by uBrightness (already clamped CPU-side, tighter while clipping) so
    // the final color can never approach pure white.
    vec3 bg = vec3(0.01, 0.008, 0.02) * (0.6 + 0.4 * uBrightness);
    vec3 color = bg + neon * pattern * uBrightness;

    fragColor = vec4(color, 1.0);
}
`

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

/**
 * Weighted-average spectral band -> neon hue position (0..1 within the
 * HUE_LOW..HUE_HIGH range). Feeds a single continuous shader uniform (like
 * Tunnel Grid's sampleHueFromSpectral, independently reimplemented here), so
 * it settles on the range midpoint on near-silence instead of falling back
 * to Math.random() — a random fallback would read as frame-to-frame hue
 * flicker during quiet passages.
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
 * of the module HUE_LOW/HUE_HIGH constants, so the kaleidoscope can borrow
 * its hue range from the DMX side's current genre theme
 * (audio/genreColorTheme.js). Kept as its OWN separate function (not a
 * parameterized rewrite of sampleHueFromSpectral) so the flag-off code path
 * above is untouched by this feature and stays byte-for-byte the same as
 * before it existed.
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
export function useKaleidoscope() {
    const canvasRef = useRef(null)
    const glRef = useRef(null)
    const programRef = useRef(null)
    const vaoRef = useRef(null)
    const bufferRef = useRef(null)

    const runningRef = useRef(false)
    const rafRef = useRef(null)
    const timerRef = useRef(null)
    const lastTimeRef = useRef(0)
    const cycleTimeRef = useRef(0)

    const flowTimeRef = useRef(0)
    const rotationRef = useRef(0)
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
        if (!gl) { console.error('[useKaleidoscope] WebGL2 not supported'); return false }

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

        cycleTimeRef.current = 0
        flowTimeRef.current = 0
        rotationRef.current = 0
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

        cycleTimeRef.current += dt

        // Rolling average + transient detection for the kick envelope.
        bassAvgRef.current += (bass - bassAvgRef.current) * BASS_AVG_SMOOTH
        const transient = Math.max(0, bass - bassAvgRef.current - TRANSIENT_THRESHOLD)
        const kickEnvTarget = Math.min(1, transient * 4)
        kickEnvRef.current += (kickEnvTarget - kickEnvRef.current)
            * (kickEnvTarget > kickEnvRef.current ? KICK_ENV_ATTACK : KICK_ENV_RELEASE)

        // Pattern flow speed: always-on ambient base + continuous bass and
        // volume terms, so the kaleidoscope keeps flowing with audio OFF.
        const flowSpeed = AMBIENT_FLOW_SPEED + bass * BASS_FLOW_SCALE + levels.volume * VOLUME_FLOW_SCALE
        flowTimeRef.current = (flowTimeRef.current + flowSpeed * dt) % FLOW_WRAP

        // Zoom-punch pulse: kick envelope briefly pulls the radius scale
        // in, extra-clamped while clipping — never a harsh jump.
        const zoomPunchCeiling = status.clipping ? ZOOM_PUNCH_SCALE_CLIPPING : ZOOM_PUNCH_SCALE
        const zoom = 1 - kickEnvRef.current * zoomPunchCeiling

        // Stereo width cue: bias rotation direction/speed on top of a small
        // always-on ambient rotation plus a continuous bass term.
        rotationRef.current = (rotationRef.current
            + (ROTATION_BASE_SPEED + bass * BASS_ROTATION_SCALE + stereoBias * ROTATION_BIAS_SCALE) * dt
        ) % (Math.PI * 2)

        // Fold count: slow ambient drift between MIN/MAX-fold, plus a small
        // nudge from the smoothed bass average (optional flourish).
        const foldCyclePhase = (cycleTimeRef.current / FOLD_CYCLE_PERIOD) * Math.PI * 2
        const foldDrift = (Math.sin(foldCyclePhase) * 0.5 + 0.5) * (FOLD_COUNT_MAX - FOLD_COUNT_MIN)
        const foldCount = FOLD_COUNT_MIN + foldDrift + bassAvgRef.current * FOLD_BASS_NUDGE

        // Ecosystem Color-Sync (opt-in, defaults ON): when enabled, sample
        // from the DMX side's current genre theme instead of this hook's own
        // fixed HUE_LOW/HUE_HIGH range. Resolved via an imperative getState()
        // read, same idiom this hook already uses for `audioFrame` itself.
        const colorSyncEnabled = useAudioStore.getState().visualColorSyncEnabled
        const syncTheme = colorSyncEnabled ? getThemeForGenre(audioFrame.genre) : null

        // Spectral -> hue, smoothed (see sampleHueFromSpectral doc comment).
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
        gl.uniform1f(uniforms.uFlowTime, flowTimeRef.current)
        gl.uniform1f(uniforms.uFoldCount, foldCount)
        gl.uniform1f(uniforms.uRotation, rotationRef.current)
        gl.uniform1f(uniforms.uZoom, zoom)
        gl.uniform1f(uniforms.uHue, hueRef.current)
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
