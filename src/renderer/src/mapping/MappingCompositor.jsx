import React, { useEffect, useRef, useState } from 'react'
import { createProgram } from '../visuals/glUtils'

/**
 * MappingCompositor — BS-006 phase 1: visual-agnostic quad-warp compositor.
 *
 * Takes whichever visual is currently active — as a live HTMLCanvasElement
 * handed in via `visualCanvasRef` — and perspective-warps it onto a single
 * quad "surface" using Heckbert's unit-square-to-quad projective mapping.
 * This component's own <canvas> is the ONLY thing actually shown on the
 * projector; the source visual canvas stays `visibility: hidden` in
 * ProjectorApp.jsx and is only ever read here as a texture source.
 *
 * @ai-constraints Never imports or references a specific visual's hook or
 * internals — it only ever touches a plain HTMLCanvasElement. Phase 2 will
 * add polygon masks/feather/multiple surfaces/preset persistence; this phase
 * is intentionally a single in-memory surface (no save/load).
 */

// Default/passthrough surface — identical geometry to "no mapping at all".
// Order: top-left, top-right, bottom-right, bottom-left. Shaped as an object
// (not flattened top-level state) so phase 2 can grow this into an array of
// surfaces without a rewrite.
export const DEFAULT_SURFACE = {
    id: 'default',
    corners: [
        { x: 0, y: 0 }, // TL
        { x: 1, y: 0 }, // TR
        { x: 1, y: 1 }, // BR
        { x: 0, y: 1 }  // BL
    ]
}

const VERTEX_SHADER = `#version 300 es
in vec3 aClipXYW;
in vec2 aUV;
out vec2 vUV;
void main() {
    // aClipXYW = (X, Y, W) precomputed on the CPU by the Heckbert projective
    // mapping in computeQuadWarpVertices(). Setting gl_Position.w = W (not 1)
    // is what makes WebGL's automatic perspective-correct varying
    // interpolation produce a true keystone warp instead of a
    // bilinear-looking one.
    gl_Position = vec4(aClipXYW.xy, 0.0, aClipXYW.z);
    vUV = aUV;
}
`

const FRAGMENT_SHADER = `#version 300 es
precision mediump float;
in vec2 vUV;
uniform sampler2D uTexture;
out vec4 outColor;
void main() {
    outColor = texture(uTexture, vUV);
}
`

/**
 * Heckbert's unit-square -> quad projective mapping (do NOT replace with
 * naive bilinear UV interpolation — that produces visibly wrong,
 * non-perspective results for a true keystoned trapezoid).
 *
 * Verification for the default passthrough surface (TL/TR/BR/BL at
 * (0,0)/(1,0)/(1,1)/(0,1), i.e. NDC (-1,1)/(1,1)/(1,-1)/(-1,-1)):
 *   dx1=0, dx2=-2, dx3=0, dy1=2, dy2=0, dy3=0
 *   -> dx3===0 && dy3===0, so this takes the AFFINE branch (a13=a23=0).
 *   a11=2, a21=0, a12=0, a22=-2, a31=-1, a32=1
 *   TL(u=0,v=0) -> (a31, a32, 1)             = (-1,  1, 1)
 *   TR(u=1,v=0) -> (a11+a31, a12+a32, 1)     = ( 1,  1, 1)
 *   BR(u=1,v=1) -> (a11+a21+a31, a12+a22+a32, 1) = ( 1, -1, 1)
 *   BL(u=0,v=1) -> (a21+a31, a22+a32, 1)     = (-1, -1, 1)
 * All 4 corners land exactly on the target NDC rectangle with W=1 (pure
 * affine, no perspective term) — confirming passthrough renders identically
 * to no mapping at all.
 */
export function computeQuadWarpVertices(corners) {
    // Map normalized 0..1 screen-space fractions to NDC (-1..1), flipping Y
    // since screen-space Y grows downward and NDC Y grows upward.
    const ndc = corners.map(({ x, y }) => ({ x: x * 2 - 1, y: 1 - y * 2 }))
    const [p0, p1, p2, p3] = ndc // TL, TR, BR, BL
    const x0 = p0.x, y0 = p0.y
    const x1 = p1.x, y1 = p1.y
    const x2 = p2.x, y2 = p2.y
    const x3 = p3.x, y3 = p3.y

    const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3
    const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3

    let a11, a12, a13, a21, a22, a23
    if (dx3 === 0 && dy3 === 0) {
        // Affine case (parallelogram) — no perspective term needed.
        a13 = 0
        a23 = 0
        a11 = x1 - x0
        a21 = x2 - x1
        a12 = y1 - y0
        a22 = y2 - y1
    } else {
        const denom = dx1 * dy2 - dx2 * dy1
        a13 = (dx3 * dy2 - dx2 * dy3) / denom
        a23 = (dx1 * dy3 - dx3 * dy1) / denom
        a11 = x1 - x0 + a13 * x1
        a21 = x3 - x0 + a23 * x3
        a12 = y1 - y0 + a13 * y1
        a22 = y3 - y0 + a23 * y3
    }
    const a31 = x0
    const a32 = y0

    // H maps unit-square (u,v) -> (X,Y,W):
    //   X = a11*u + a21*v + a31; Y = a12*u + a22*v + a32; W = a13*u + a23*v + 1
    const unitSquare = [
        { u: 0, v: 0 }, // TL
        { u: 1, v: 0 }, // TR
        { u: 1, v: 1 }, // BR
        { u: 0, v: 1 }  // BL
    ]

    return unitSquare.map(({ u, v }) => ({
        x: a11 * u + a21 * v + a31,
        y: a12 * u + a22 * v + a32,
        w: a13 * u + a23 * v + 1,
        u,
        v
    }))
}

// Two triangles covering the quad (TL=0, TR=1, BR=2, BL=3), fan from TL.
const QUAD_TRIANGLE_ORDER = [0, 1, 2, 0, 2, 3]
const FLOATS_PER_VERTEX = 5 // x, y, w, u, v
const STRIDE = FLOATS_PER_VERTEX * Float32Array.BYTES_PER_ELEMENT

function buildVertexBufferData(corners) {
    const verts = computeQuadWarpVertices(corners)
    const data = new Float32Array(QUAD_TRIANGLE_ORDER.length * FLOATS_PER_VERTEX)
    QUAD_TRIANGLE_ORDER.forEach((vertexIndex, i) => {
        const v = verts[vertexIndex]
        data.set([v.x, v.y, v.w, v.u, v.v], i * FLOATS_PER_VERTEX)
    })
    return data
}

const CORNER_LABELS = ['TL', 'TR', 'BR', 'BL']

/**
 * @param {{ current: HTMLCanvasElement|null }} visualCanvasRef - ref to the
 *   currently-active visual's own <canvas>, forwarded down from
 *   ProjectorApp.jsx. May be null momentarily while visuals switch.
 * @param {boolean} editMode - when true, renders draggable corner handles.
 */
const MappingCompositor = ({ visualCanvasRef, editMode }) => {
    const containerRef = useRef(null)
    const canvasRef = useRef(null)
    const glStateRef = useRef(null)
    const [corners, setCorners] = useState(DEFAULT_SURFACE.corners)
    const cornersRef = useRef(corners)
    cornersRef.current = corners

    // --- WebGL2 setup + render loop (once per mount) ---
    useEffect(() => {
        const canvas = canvasRef.current
        const gl = canvas.getContext('webgl2', {
            alpha: false,
            depth: false,
            stencil: false,
            antialias: false,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance'
        })
        if (!gl) {
            console.error('[MappingCompositor] WebGL2 not available')
            return undefined
        }

        const programInfo = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER)
        if (!programInfo) return undefined
        const { program } = programInfo

        const aClipXYW = gl.getAttribLocation(program, 'aClipXYW')
        const aUV = gl.getAttribLocation(program, 'aUV')
        const uTexture = gl.getUniformLocation(program, 'uTexture')

        const vao = gl.createVertexArray()
        gl.bindVertexArray(vao)

        const vertexBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, buildVertexBufferData(cornersRef.current), gl.DYNAMIC_DRAW)

        gl.enableVertexAttribArray(aClipXYW)
        gl.vertexAttribPointer(aClipXYW, 3, gl.FLOAT, false, STRIDE, 0)
        gl.enableVertexAttribArray(aUV)
        gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, STRIDE, 3 * Float32Array.BYTES_PER_ELEMENT)

        const texture = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        // Canvas pixel data is uploaded top-row-first; flipping here is the
        // standard WebGL fix (MDN) so a sampled v=0 corresponds to the top
        // of the source visual canvas instead of rendering it upside down.
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)

        glStateRef.current = { gl, program, vertexBuffer, texture, vao, uTexture }

        function renderFrame() {
            const state = glStateRef.current
            if (!state) return
            const { gl: ctx, program: prog, texture: tex, vao: vertexArray, uTexture: texUniform } = state

            const cssWidth = canvas.clientWidth || 1
            const cssHeight = canvas.clientHeight || 1
            const dpr = window.devicePixelRatio || 1
            const targetW = Math.max(1, Math.round(cssWidth * dpr))
            const targetH = Math.max(1, Math.round(cssHeight * dpr))
            if (canvas.width !== targetW || canvas.height !== targetH) {
                canvas.width = targetW
                canvas.height = targetH
            }
            ctx.viewport(0, 0, canvas.width, canvas.height)
            ctx.clearColor(0, 0, 0, 1)
            ctx.clear(ctx.COLOR_BUFFER_BIT)

            const sourceCanvas = visualCanvasRef?.current
            if (!sourceCanvas || !sourceCanvas.width || !sourceCanvas.height) return

            ctx.useProgram(prog)
            ctx.bindVertexArray(vertexArray)
            ctx.activeTexture(ctx.TEXTURE0)
            ctx.bindTexture(ctx.TEXTURE_2D, tex)
            try {
                ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, ctx.RGBA, ctx.UNSIGNED_BYTE, sourceCanvas)
            } catch (e) {
                // Source canvas can be transiently unreadable while a visual
                // is mid-teardown/remount (e.g. switching visuals) — skip
                // this frame, next one will succeed once it settles.
                return
            }
            ctx.uniform1i(texUniform, 0)
            ctx.drawArrays(ctx.TRIANGLES, 0, QUAD_TRIANGLE_ORDER.length)
        }

        let rafId = requestAnimationFrame(function loop() {
            renderFrame()
            rafId = requestAnimationFrame(loop)
        })

        return () => {
            cancelAnimationFrame(rafId)
            gl.deleteBuffer(vertexBuffer)
            gl.deleteTexture(texture)
            gl.deleteVertexArray(vao)
            gl.deleteProgram(program)
            glStateRef.current = null
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // --- Update vertex buffer only when corners actually change, not per-frame ---
    useEffect(() => {
        const state = glStateRef.current
        if (!state) return
        const { gl, vertexBuffer } = state
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, buildVertexBufferData(corners))
    }, [corners])

    // --- Corner-drag handles (edit mode only) ---
    const handlePointerDown = (e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
    }

    const handlePointerUp = (e) => {
        e.currentTarget.releasePointerCapture(e.pointerId)
    }

    const handlePointerMove = (index) => (e) => {
        if (e.buttons === 0) return
        const rect = containerRef.current.getBoundingClientRect()
        const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
        const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
        setCorners((prev) => {
            const next = prev.slice()
            next[index] = { x, y }
            return next
        })
    }

    return (
        <div ref={containerRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

            {editMode && corners.map((corner, i) => (
                <CornerHandle
                    key={CORNER_LABELS[i]}
                    label={CORNER_LABELS[i]}
                    x={corner.x}
                    y={corner.y}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove(i)}
                    onPointerUp={handlePointerUp}
                />
            ))}
        </div>
    )
}

/** A single draggable quad-corner handle, shown only in edit mode. */
const CornerHandle = ({ label, x, y, onPointerDown, onPointerMove, onPointerUp }) => (
    <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
            position: 'absolute',
            left: `${x * 100}%`,
            top: `${y * 100}%`,
            transform: 'translate(-50%, -50%)',
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            background: '#39ff14',
            border: '2px solid #000',
            boxShadow: '0 0 6px rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '9px',
            fontWeight: 700,
            color: '#000',
            cursor: 'grab',
            touchAction: 'none',
            userSelect: 'none'
        }}
    >
        {label}
    </div>
)

export default MappingCompositor
