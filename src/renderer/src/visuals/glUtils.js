/**
 * glUtils.js — shared, generic WebGL2 plumbing for the visuals library
 * (BS-005: Fluid Neon, Particle Field, Tunnel/Grid, Kaleidoscope).
 *
 * Intentionally minimal: just shader compilation/linking. No visual-specific
 * shaders, buffers, or rendering logic belong here — those live inside each
 * visual's own hook (e.g. useParticleField.js).
 *
 * This is an independent implementation, not shared code extracted from
 * useFluidSimulation.js — that hook keeps its own internal copy of the same
 * shape and is not imported from or modified here.
 */

/**
 * Compiles a single shader stage.
 * @returns {WebGLShader|null} the shader, or null on failure (logs via console.error)
 */
export function compileShader(gl, type, source) {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('[glUtils] Shader compile error:', gl.getShaderInfoLog(shader))
        gl.deleteShader(shader)
        return null
    }

    return shader
}

/**
 * Compiles + links a vertex/fragment pair into a program and collects every
 * active uniform's location, so callers don't have to look each one up by
 * name individually.
 * @returns {{ program: WebGLProgram, uniforms: Record<string, WebGLUniformLocation> } | null}
 */
export function createProgram(gl, vertSrc, fragSrc) {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertSrc)
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc)
    if (!vertexShader || !fragmentShader) return null

    const program = gl.createProgram()
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    // Shader objects aren't needed anymore once linked into the program.
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('[glUtils] Program link error:', gl.getProgramInfoLog(program))
        gl.deleteProgram(program)
        return null
    }

    const uniforms = {}
    const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS)
    for (let i = 0; i < numUniforms; i++) {
        const info = gl.getActiveUniform(program, i)
        uniforms[info.name] = gl.getUniformLocation(program, info.name)
    }

    return { program, uniforms }
}
