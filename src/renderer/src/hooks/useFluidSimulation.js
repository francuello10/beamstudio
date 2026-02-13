/**
 * useFluidSimulation.js — WebGL2 "Neon Overdrive" Fluid Engine
 * 
 * Implements Navier-Stokes with aggressive physics presets:
 *   Explosive (Neon) → huge splats, extreme vorticity, HDR bloom
 *   Smooth (Lava/Ocean) → organic, slow, deep color transitions
 * 
 * Features:
 *   - Physics presets per palette (explosive vs smooth)
 *   - Audio-reactive splat force & radius multiplier  
 *   - HDR bloom display shader (pow 1/1.2 gamma + glow)
 *   - Exposed currentColors for UI zone feedback
 * 
 * @ai-constraints Do NOT simplify the shader pipeline.
 */
import { useRef, useCallback, useState, useEffect } from 'react'
import { useDmxStore } from '../store/dmxStore'

// ═══════════════════════════════════════════════════
// PHYSICS PRESETS
// ═══════════════════════════════════════════════════
const PHYSICS_PRESETS = {
    explosive: {
        velocityDissipation: 0.92,
        dyeDissipation: 0.96, // Slight increase to keep trails longer
        splatRadius: 0.012,
        curl: 55.0, // Increased for tight swirls
        splatForce: 18.0, // Harder impact
        pressure: 0.6,
        numSplats: 4,
        splatInterval: 0.4,
    },
    smooth: {
        velocityDissipation: 0.98,
        dyeDissipation: 0.985,
        splatRadius: 0.006,
        curl: 30.0,
        splatForce: 4.0,
        pressure: 0.8,
        numSplats: 2,
        splatInterval: 0.8,
    }
}

// ═══════════════════════════════════════════════════
// PALETTES (High Saturation, Controlled Brightness)
// ═══════════════════════════════════════════════════
export const FLUID_PALETTES = [
    { id: 'lava', name: 'Lava Flow', type: 'smooth', colors: [[1.0, 0.1, 0.0], [1.0, 0.3, 0.0], [0.8, 0.0, 0.0], [1.2, 0.2, 0.0]] },
    { id: 'ocean', name: 'Deep Ocean', type: 'smooth', colors: [[0.0, 0.3, 0.8], [0.0, 0.6, 0.9], [0.0, 0.1, 0.5], [0.0, 0.4, 1.0]] },
    { id: 'neon', name: 'Neon Pulse', type: 'explosive', colors: [[1.5, 0.0, 1.5], [0.0, 1.5, 1.5], [1.2, 1.2, 0.0], [1.5, 0.0, 0.2]] },
    { id: 'aurora', name: 'Aurora', type: 'smooth', colors: [[0.0, 1.0, 0.4], [0.4, 0.0, 1.0], [0.0, 0.4, 0.8], [0.1, 1.0, 0.2]] },
    { id: 'nebula', name: 'Nebula', type: 'explosive', colors: [[0.8, 0.0, 1.2], [0.2, 0.0, 1.0], [1.2, 0.0, 0.5], [0.4, 0.1, 1.2]] },
    { id: 'sunset', name: 'Sunset Drift', type: 'smooth', colors: [[1.0, 0.2, 0.4], [1.0, 0.4, 0.0], [1.0, 0.6, 0.0], [0.8, 0.0, 0.2]] },
    // New Scenes — Tuned for Pure Color
    { id: 'plasma', name: 'Electric Plasma', type: 'explosive', colors: [[0.1, 0.8, 1.5], [0.0, 0.5, 1.2], [0.2, 0.0, 1.0], [0.0, 0.8, 1.0]] },
    { id: 'crimson', name: 'Crimson Tide', type: 'explosive', colors: [[1.5, 0.0, 0.0], [1.0, 0.0, 0.0], [0.6, 0.0, 0.0], [1.2, 0.1, 0.0]] },
    { id: 'zen', name: 'Zen Garden', type: 'smooth', colors: [[0.4, 0.8, 0.1], [0.1, 0.5, 0.2], [0.6, 0.8, 0.4], [0.2, 0.4, 0.1]] },
    { id: 'cyber', name: 'Cyber Mist', type: 'smooth', colors: [[0.0, 1.0, 0.6], [1.0, 0.0, 0.8], [0.0, 0.1, 0.3], [0.0, 0.4, 0.5]] },
]

// ═══════════════════════════════════════════════════
// GLSL SHADERS
// ═══════════════════════════════════════════════════
const baseVertexShader = `#version 300 es
precision highp float;
in vec2 aPosition;
out vec2 vUv;
out vec2 vL, vR, vT, vB;
uniform vec2 texelSize;
void main () {
    vUv = aPosition * 0.5 + 0.5;
    vL = vUv - vec2(texelSize.x, 0.0);
    vR = vUv + vec2(texelSize.x, 0.0);
    vT = vUv + vec2(0.0, texelSize.y);
    vB = vUv - vec2(0.0, texelSize.y);
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

const splatShader = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTarget;
uniform float aspectRatio;
uniform vec3 color;
uniform vec2 point;
uniform float radius;
out vec4 fragColor;
void main () {
    vec2 p = vUv - point;
    p.x *= aspectRatio;
    vec3 splat = exp(-dot(p, p) / radius) * color;
    vec3 base = texture(uTarget, vUv).rgb;
    fragColor = vec4(base + splat, 1.0);
}
`

const advectionShader = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 texelSize;
uniform float dt;
uniform float dissipation;
out vec4 fragColor;
void main () {
    vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * texelSize;
    vec4 result = texture(uSource, coord);
    fragColor = dissipation * result;
}
`

const curlShader = `#version 300 es
precision highp float;
in vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uVelocity;
out vec4 fragColor;
void main () {
    float L = texture(uVelocity, vL).y;
    float R = texture(uVelocity, vR).y;
    float T = texture(uVelocity, vT).x;
    float B = texture(uVelocity, vB).x;
    float vorticity = R - L - T + B;
    fragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
}
`

const vorticityShader = `#version 300 es
precision highp float;
in vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float curl;
uniform float dt;
out vec4 fragColor;
void main () {
    float T = texture(uCurl, vT).x;
    float B = texture(uCurl, vB).x;
    float C = texture(uCurl, vUv).x;
    float L = texture(uCurl, vL).x;
    float R = texture(uCurl, vR).x;
    vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
    force /= length(force) + 2.4414e-4;
    force *= curl * C;
    force.y *= -1.0;
    vec2 velocity = texture(uVelocity, vUv).xy;
    velocity += force * dt;
    velocity = min(max(velocity, -1000.0), 1000.0);
    fragColor = vec4(velocity, 0.0, 1.0);
}
`

const divergenceShader = `#version 300 es
precision highp float;
in vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uVelocity;
out vec4 fragColor;
void main () {
    float L = texture(uVelocity, vL).x;
    float R = texture(uVelocity, vR).x;
    float T = texture(uVelocity, vT).y;
    float B = texture(uVelocity, vB).y;
    float div = 0.5 * (R - L + T - B);
    fragColor = vec4(div, 0.0, 0.0, 1.0);
}
`

const pressureShader = `#version 300 es
precision highp float;
in vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
out vec4 fragColor;
void main () {
    float L = texture(uPressure, vL).x;
    float R = texture(uPressure, vR).x;
    float T = texture(uPressure, vT).x;
    float B = texture(uPressure, vB).x;
    float divergence = texture(uDivergence, vUv).x;
    float pressure = (L + R + B + T - divergence) * 0.25;
    fragColor = vec4(pressure, 0.0, 0.0, 1.0);
}
`

const gradientSubtractShader = `#version 300 es
precision highp float;
in vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
out vec4 fragColor;
void main () {
    float L = texture(uPressure, vL).x;
    float R = texture(uPressure, vR).x;
    float T = texture(uPressure, vT).x;
    float B = texture(uPressure, vB).x;
    vec2 velocity = texture(uVelocity, vUv).xy;
    velocity.xy -= vec2(R - L, T - B);
    fragColor = vec4(velocity, 0.0, 1.0);
}
`

// HDR Bloom display shader — gamma correction + glow for values > 1.0
const displayShader = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTexture;
out vec4 fragColor;
void main () {
    vec3 c = texture(uTexture, vUv).rgb;
    
    // 1. Sharpen / Contrast Curve (S-Curve)
    c = smoothstep(0.1, 1.2, c); 

    // 2. HDR bloom (Hue Preserving)
    float luma = dot(c, vec3(0.299, 0.587, 0.114));
    float bloomFactor = max(0.0, luma - 0.65);
    // Add colored glow instead of white bloat
    c += c * bloomFactor * 1.5;

    // 3. Gamma correction for vibrancy
    c = pow(max(c, 0.0), vec3(1.0 / 1.1)); 

    // 4. Vignette
    vec2 uv = vUv * 2.0 - 1.0;
    float vig = 1.0 - dot(uv * 0.35, uv * 0.35);
    c *= vig;

    fragColor = vec4(c, 1.0);
}
`

const clearShader = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTexture;
uniform float value;
out vec4 fragColor;
void main () {
    fragColor = value * texture(uTexture, vUv);
}
`

// ═══════════════════════════════════════════════════
// WEBGL HELPERS
// ═══════════════════════════════════════════════════
function compileShader(gl, type, source) {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader))
        gl.deleteShader(shader)
        return null
    }
    return shader
}

function createProgram(gl, vertSrc, fragSrc) {
    const prog = gl.createProgram()
    const vs = compileShader(gl, gl.VERTEX_SHADER, vertSrc)
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc)
    if (!vs || !fs) return null
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(prog))
        return null
    }
    const uniforms = {}
    const numUniforms = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS)
    for (let i = 0; i < numUniforms; i++) {
        const info = gl.getActiveUniform(prog, i)
        uniforms[info.name] = gl.getUniformLocation(prog, info.name)
    }
    return { program: prog, uniforms }
}

function createDoubleFBO(gl, w, h, internalFormat, format, type, filter) {
    let fbo1 = createFBO(gl, w, h, internalFormat, format, type, filter)
    let fbo2 = createFBO(gl, w, h, internalFormat, format, type, filter)
    return {
        width: w, height: h,
        get read() { return fbo1 },
        set read(v) { fbo1 = v },
        get write() { return fbo2 },
        set write(v) { fbo2 = v },
        swap() { const tmp = fbo1; fbo1 = fbo2; fbo2 = tmp }
    }
}

function createFBO(gl, w, h, internalFormat, format, type, filter) {
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null)
    const fbo = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    gl.viewport(0, 0, w, h)
    gl.clear(gl.COLOR_BUFFER_BIT)
    return { texture, fbo, width: w, height: h }
}

// ═══════════════════════════════════════════════════
// MAIN HOOK
// ═══════════════════════════════════════════════════
export function useFluidSimulation(audioIntensity = 0) {
    const canvasRef = useRef(null)
    const glRef = useRef(null)
    const programsRef = useRef(null)
    const fbosRef = useRef(null)
    const runningRef = useRef(false)
    const rafRef = useRef(null)
    const lastTimeRef = useRef(0)
    const splatTimerRef = useRef(0)
    const paletteIdxRef = useRef(0)
    const audioIntensityRef = useRef(0)

    const [running, setRunning] = useState(false)
    const [activePalette, setActivePalette] = useState(FLUID_PALETTES[0])
    const [currentColors, setCurrentColors] = useState([
        { r: 0, g: 0, b: 0 },
        { r: 0, g: 0, b: 0 },
        { r: 0, g: 0, b: 0 }
    ])

    const sendPixelMapBuffer = useDmxStore(state => state.sendPixelMapBuffer)

    // Keep audioIntensity ref in sync
    useEffect(() => {
        audioIntensityRef.current = audioIntensity
    }, [audioIntensity])

    // Get current physics preset
    const getPhysics = useCallback(() => {
        const palette = FLUID_PALETTES[paletteIdxRef.current]
        return PHYSICS_PRESETS[palette.type] || PHYSICS_PRESETS.smooth
    }, [])

    // ── Initialize WebGL ──
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
        if (!gl) { console.error('WebGL2 not supported'); return false }

        const ext = gl.getExtension('EXT_color_buffer_float')
        if (!ext) { console.error('EXT_color_buffer_float not supported'); return false }
        gl.getExtension('OES_texture_float_linear')

        glRef.current = gl

        const programs = {
            splat: createProgram(gl, baseVertexShader, splatShader),
            advection: createProgram(gl, baseVertexShader, advectionShader),
            curl: createProgram(gl, baseVertexShader, curlShader),
            vorticity: createProgram(gl, baseVertexShader, vorticityShader),
            divergence: createProgram(gl, baseVertexShader, divergenceShader),
            pressure: createProgram(gl, baseVertexShader, pressureShader),
            gradientSubtract: createProgram(gl, baseVertexShader, gradientSubtractShader),
            display: createProgram(gl, baseVertexShader, displayShader),
            clear: createProgram(gl, baseVertexShader, clearShader),
        }
        programsRef.current = programs

        // Full-screen quad
        const quadVerts = new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1])
        const quadIdx = new Uint16Array([0, 1, 2, 0, 2, 3])
        const vao = gl.createVertexArray()
        gl.bindVertexArray(vao)
        const vb = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, vb)
        gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW)
        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
        const ib = gl.createBuffer()
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib)
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, quadIdx, gl.STATIC_DRAW)

        // Framebuffers — Ultra Quality for RX 6700 XT
        const simRes = 512
        const dyeRes = 1024
        const fbos = {
            velocity: createDoubleFBO(gl, simRes, simRes, gl.RG16F, gl.RG, gl.HALF_FLOAT, gl.LINEAR),
            dye: createDoubleFBO(gl, dyeRes, dyeRes, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR),
            curl: createFBO(gl, simRes, simRes, gl.R16F, gl.RED, gl.HALF_FLOAT, gl.NEAREST),
            divergence: createFBO(gl, simRes, simRes, gl.R16F, gl.RED, gl.HALF_FLOAT, gl.NEAREST),
            pressure: createDoubleFBO(gl, simRes, simRes, gl.R16F, gl.RED, gl.HALF_FLOAT, gl.NEAREST),
        }
        fbosRef.current = fbos

        return true
    }, [])

    // ── Blit ──
    const blit = useCallback((target) => {
        const gl = glRef.current
        if (target) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo)
            gl.viewport(0, 0, target.width, target.height)
        } else {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null)
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
        }
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0)
    }, [])

    // ── Splat a color blob ──
    const splat = useCallback((x, y, dx, dy, color, forceMultiplier = 1.0, radiusMultiplier = 1.0) => {
        const gl = glRef.current
        const p = programsRef.current
        const fbos = fbosRef.current
        if (!gl || !p || !fbos) return

        const physics = getPhysics()
        const totalForce = physics.splatForce * forceMultiplier
        const totalRadius = physics.splatRadius * radiusMultiplier

        // Velocity splat
        gl.useProgram(p.splat.program)
        gl.uniform1i(p.splat.uniforms.uTarget, 0)
        gl.uniform1f(p.splat.uniforms.aspectRatio, gl.canvas.width / gl.canvas.height)
        gl.uniform2f(p.splat.uniforms.point, x, y)
        gl.uniform3f(p.splat.uniforms.color, dx * totalForce, dy * totalForce, 0)
        gl.uniform1f(p.splat.uniforms.radius, totalRadius)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, fbos.velocity.read.texture)
        blit(fbos.velocity.write)
        fbos.velocity.swap()

        // Dye splat — color intensity
        const colorIntensity = 0.8 * forceMultiplier
        gl.uniform3f(p.splat.uniforms.color,
            color[0] * colorIntensity,
            color[1] * colorIntensity,
            color[2] * colorIntensity
        )
        gl.uniform1f(p.splat.uniforms.radius, totalRadius * 1.5) // Dye slightly larger
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, fbos.dye.read.texture)
        blit(fbos.dye.write)
        fbos.dye.swap()
    }, [blit, getPhysics])

    // ── Auto-splat ──
    const autoSplat = useCallback(() => {
        const palette = FLUID_PALETTES[paletteIdxRef.current]
        const physics = getPhysics()
        const colors = palette.colors
        const audio = audioIntensityRef.current

        // Audio multiplier: at 0 audio = 1.0x, at full audio = 3.0x
        const audioMult = 1.0 + audio * 2.0
        const numSplats = physics.numSplats + (audio > 0.3 ? 2 : 0)

        for (let i = 0; i < numSplats; i++) {
            const color = colors[Math.floor(Math.random() * colors.length)]
            const x = 0.05 + Math.random() * 0.9
            const y = 0.05 + Math.random() * 0.9

            // Organic circular + traveling motion
            const angle = Math.random() * Math.PI * 2
            const speed = (0.8 + Math.random() * 2.5) * audioMult
            const dx = Math.cos(angle) * speed
            const dy = Math.sin(angle) * speed

            splat(x, y, dx, dy, color, audioMult, audioMult)
        }
    }, [splat, getPhysics])

    // ── Physics step ──
    const step = useCallback((dt) => {
        const gl = glRef.current
        const p = programsRef.current
        const fbos = fbosRef.current
        if (!gl || !p || !fbos) return

        const physics = getPhysics()
        const simTexel = [1.0 / fbos.velocity.width, 1.0 / fbos.velocity.height]
        const dyeTexel = [1.0 / fbos.dye.width, 1.0 / fbos.dye.height]

        // 1. Curl
        gl.useProgram(p.curl.program)
        gl.uniform2f(p.curl.uniforms.texelSize, simTexel[0], simTexel[1])
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, fbos.velocity.read.texture)
        gl.uniform1i(p.curl.uniforms.uVelocity, 0)
        blit(fbos.curl)

        // 2. Vorticity confinement
        gl.useProgram(p.vorticity.program)
        gl.uniform2f(p.vorticity.uniforms.texelSize, simTexel[0], simTexel[1])
        gl.uniform1f(p.vorticity.uniforms.curl, physics.curl)
        gl.uniform1f(p.vorticity.uniforms.dt, dt)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, fbos.velocity.read.texture)
        gl.uniform1i(p.vorticity.uniforms.uVelocity, 0)
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, fbos.curl.texture)
        gl.uniform1i(p.vorticity.uniforms.uCurl, 1)
        blit(fbos.velocity.write)
        fbos.velocity.swap()

        // 3. Divergence
        gl.useProgram(p.divergence.program)
        gl.uniform2f(p.divergence.uniforms.texelSize, simTexel[0], simTexel[1])
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, fbos.velocity.read.texture)
        gl.uniform1i(p.divergence.uniforms.uVelocity, 0)
        blit(fbos.divergence)

        // 4. Clear pressure
        gl.useProgram(p.clear.program)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, fbos.pressure.read.texture)
        gl.uniform1i(p.clear.uniforms.uTexture, 0)
        gl.uniform1f(p.clear.uniforms.value, physics.pressure)
        blit(fbos.pressure.write)
        fbos.pressure.swap()

        // 5. Pressure solve (more iterations = sharper)
        gl.useProgram(p.pressure.program)
        gl.uniform2f(p.pressure.uniforms.texelSize, simTexel[0], simTexel[1])
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, fbos.divergence.texture)
        gl.uniform1i(p.pressure.uniforms.uDivergence, 1)
        for (let i = 0; i < 30; i++) {
            gl.activeTexture(gl.TEXTURE0)
            gl.bindTexture(gl.TEXTURE_2D, fbos.pressure.read.texture)
            gl.uniform1i(p.pressure.uniforms.uPressure, 0)
            blit(fbos.pressure.write)
            fbos.pressure.swap()
        }

        // 6. Gradient subtract
        gl.useProgram(p.gradientSubtract.program)
        gl.uniform2f(p.gradientSubtract.uniforms.texelSize, simTexel[0], simTexel[1])
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, fbos.pressure.read.texture)
        gl.uniform1i(p.gradientSubtract.uniforms.uPressure, 0)
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, fbos.velocity.read.texture)
        gl.uniform1i(p.gradientSubtract.uniforms.uVelocity, 1)
        blit(fbos.velocity.write)
        fbos.velocity.swap()

        // 7. Advect velocity
        gl.useProgram(p.advection.program)
        gl.uniform2f(p.advection.uniforms.texelSize, simTexel[0], simTexel[1])
        gl.uniform1f(p.advection.uniforms.dt, dt)
        gl.uniform1f(p.advection.uniforms.dissipation, physics.velocityDissipation)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, fbos.velocity.read.texture)
        gl.uniform1i(p.advection.uniforms.uVelocity, 0)
        gl.uniform1i(p.advection.uniforms.uSource, 0)
        blit(fbos.velocity.write)
        fbos.velocity.swap()

        // 8. Advect dye
        gl.uniform2f(p.advection.uniforms.texelSize, dyeTexel[0], dyeTexel[1])
        gl.uniform1f(p.advection.uniforms.dissipation, physics.dyeDissipation)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, fbos.velocity.read.texture)
        gl.uniform1i(p.advection.uniforms.uVelocity, 0)
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, fbos.dye.read.texture)
        gl.uniform1i(p.advection.uniforms.uSource, 1)
        blit(fbos.dye.write)
        fbos.dye.swap()
    }, [blit, getPhysics])

    // ── Sample 3 zones for DMX ──
    const sampleZones = useCallback(() => {
        const gl = glRef.current
        const fbos = fbosRef.current
        if (!gl || !fbos) return null

        const w = fbos.dye.width
        const h = fbos.dye.height
        const zoneW = Math.floor(w / 3)

        gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.dye.read.fbo)

        const zones = []
        for (let z = 0; z < 3; z++) {
            // Sample a center strip from each zone
            const stripX = Math.floor(z * zoneW + zoneW * 0.3)
            const stripW = Math.floor(zoneW * 0.4)
            const stripH = Math.floor(h * 0.6)
            const stripY = Math.floor(h * 0.2)
            const pixels = new Float32Array(stripW * stripH * 4)
            gl.readPixels(stripX, stripY, stripW, stripH, gl.RGBA, gl.FLOAT, pixels)

            let r = 0, g = 0, b = 0, count = 0
            for (let i = 0; i < pixels.length; i += 4) {
                r += pixels[i]
                g += pixels[i + 1]
                b += pixels[i + 2]
                count++
            }
            if (count > 0) { r /= count; g /= count; b /= count }

            // Apply same gamma as display shader for consistency
            r = Math.pow(Math.max(r, 0), 1.0 / 1.1)
            g = Math.pow(Math.max(g, 0), 1.0 / 1.1)
            b = Math.pow(Math.max(b, 0), 1.0 / 1.1)

            zones.push({
                r: Math.min(255, Math.max(0, Math.round(r * 255))),
                g: Math.min(255, Math.max(0, Math.round(g * 255))),
                b: Math.min(255, Math.max(0, Math.round(b * 255)))
            })
        }

        return zones
    }, [])

    // ── Main render loop ──
    const renderLoop = useCallback((timestamp) => {
        if (!runningRef.current) return

        const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.033)
        lastTimeRef.current = timestamp

        const physics = getPhysics()
        const audio = audioIntensityRef.current

        // Auto-splat: faster when audio is pumping
        const interval = physics.splatInterval * (1.0 - audio * 0.5) // Audio shortens interval
        splatTimerRef.current += dt
        if (splatTimerRef.current > interval) {
            splatTimerRef.current = 0
            autoSplat()
        }

        // Physics
        step(dt)

        // Display to canvas
        const gl = glRef.current
        const p = programsRef.current
        const fbos = fbosRef.current
        if (gl && p && fbos) {
            gl.useProgram(p.display.program)
            gl.activeTexture(gl.TEXTURE0)
            gl.bindTexture(gl.TEXTURE_2D, fbos.dye.read.texture)
            gl.uniform1i(p.display.uniforms.uTexture, 0)
            blit(null)

            // Sample zones → DMX + UI feedback
            const colors = sampleZones()
            if (colors) {
                sendPixelMapBuffer(colors)
                setCurrentColors(colors)
            }
        }

        rafRef.current = requestAnimationFrame(renderLoop)
    }, [autoSplat, step, blit, sampleZones, sendPixelMapBuffer, getPhysics])

    // ── Start ──
    const start = useCallback(() => {
        if (runningRef.current) return
        if (!glRef.current) {
            if (!initGL()) return
        }
        window.dmx?.setDynamicRendererActive(true)
        // Ensure dimmer is up
        window.dmx?.setAllFixturesChannel?.('dim', 255)
        runningRef.current = true
        setRunning(true)
        lastTimeRef.current = performance.now()
        splatTimerRef.current = 999 // Immediate first splat
        rafRef.current = requestAnimationFrame(renderLoop)
    }, [initGL, renderLoop])

    // ── Stop ──
    const stop = useCallback(() => {
        runningRef.current = false
        setRunning(false)
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current)
            rafRef.current = null
        }
        window.dmx?.setDynamicRendererActive(false)
    }, [])

    // ── Change palette ──
    const changePalette = useCallback((paletteId) => {
        const idx = FLUID_PALETTES.findIndex(p => p.id === paletteId)
        if (idx >= 0) {
            paletteIdxRef.current = idx
            setActivePalette(FLUID_PALETTES[idx])
        }
    }, [])

    // Cleanup
    useEffect(() => {
        return () => {
            runningRef.current = false
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
            window.dmx?.setDynamicRendererActive(false)
            const gl = glRef.current
            if (gl) {
                const ext = gl.getExtension('WEBGL_lose_context')
                if (ext) ext.loseContext()
            }
        }
    }, [])

    return {
        canvasRef,
        start,
        stop,
        running,
        activePalette,
        changePalette,
        currentColors, // L/C/R zone feedback for UI
        splat,
    }
}
