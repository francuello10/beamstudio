import React, { useEffect, useRef, useState } from 'react'
import { createProgram } from '../visuals/glUtils'

/**
 * MappingCompositor — BS-006 phase 2: polygon masks/feather + multiple
 * surfaces, built directly on phase 1's quad-warp compositor.
 *
 * Takes whichever visual is currently active — as a live HTMLCanvasElement
 * handed in via `visualCanvasRef` — and perspective-warps it onto one or more
 * quad "surfaces" using Heckbert's unit-square-to-quad projective mapping
 * (computeQuadWarpVertices, unchanged from phase 1). Each surface can also
 * carry a polygon mask + feather, rendered via a signed-distance alpha
 * multiplier in the fragment shader. This component's own <canvas> is the
 * ONLY thing actually shown on the projector; the source visual canvas stays
 * `visibility: hidden` in ProjectorApp.jsx and is only ever read here as a
 * texture source.
 *
 * @ai-constraints Never imports or references a specific visual's hook or
 * internals — it only ever touches a plain HTMLCanvasElement.
 */

// Default/passthrough surface — identical geometry to "no mapping at all".
// Order: top-left, top-right, bottom-right, bottom-left.
export const DEFAULT_SURFACE = {
    id: 'default',
    name: 'Surface 1',
    corners: [
        { x: 0, y: 0 }, // TL
        { x: 1, y: 0 }, // TR
        { x: 1, y: 1 }, // BR
        { x: 0, y: 1 }  // BL
    ],
    mask: null,
    feather: 0
}

// Default mask seed: a slightly-inset quadrilateral in quad-local UV space,
// per BS-006 phase 2 spec — the operator drags these 4 points out from here.
const DEFAULT_MASK = [
    { x: 0.1, y: 0.1 },
    { x: 0.9, y: 0.1 },
    { x: 0.9, y: 0.9 },
    { x: 0.1, y: 0.9 }
]

const MAX_MASK_POINTS = 16

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

// BS-006 phase 2: polygon mask + feather. vUV is still the quad-local 0..1
// UV space from phase 1 (unchanged) — the mask polygon is defined in that
// exact same space, so no extra coordinate transform is needed here, only
// the signed-distance-to-polygon alpha multiplier.
const FRAGMENT_SHADER = `#version 300 es
precision mediump float;
in vec2 vUV;
uniform sampler2D uTexture;
#define MAX_MASK_POINTS 16
uniform vec2 uMaskPoints[MAX_MASK_POINTS];
uniform int uMaskPointCount; // 0 means "no mask" — treat as fully visible
uniform float uFeather;
out vec4 outColor;

// Inigo Quilez's sdPolygon — signed distance from p to a simple (non-self-
// intersecting) polygon boundary. Negative = inside, positive = outside.
float sdPolygon(vec2 p) {
    int n = uMaskPointCount;
    float d = dot(p - uMaskPoints[0], p - uMaskPoints[0]);
    float s = 1.0;
    for (int i = 0; i < MAX_MASK_POINTS; i++) {
        if (i >= n) break;
        int j = (i == 0) ? (n - 1) : (i - 1);
        vec2 e = uMaskPoints[j] - uMaskPoints[i];
        vec2 w = p - uMaskPoints[i];
        vec2 b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
        d = min(d, dot(b, b));
        bvec3 c = bvec3(p.y >= uMaskPoints[i].y, p.y < uMaskPoints[j].y, e.x * w.y > e.y * w.x);
        if (all(c) || all(not(c))) s *= -1.0;
    }
    return s * sqrt(d);
}

void main() {
    float maskAlpha = 1.0;
    if (uMaskPointCount >= 3) {
        float dist = sdPolygon(vUV);
        maskAlpha = uFeather > 0.0
            ? smoothstep(0.0, uFeather, -dist)
            : (dist <= 0.0 ? 1.0 : 0.0);
    }
    vec4 texel = texture(uTexture, vUV);
    outColor = vec4(texel.rgb, texel.a * maskAlpha);
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
 *
 * @ai-constraints Do NOT modify this function's math — it's already correct
 * and verified. Phase 2 reuses it unchanged, once per surface.
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

/**
 * BS-006 phase 2: standalone helper (NOT reused by/reusing
 * computeQuadWarpVertices, deliberately, so that verified function stays
 * byte-for-byte untouched) that recomputes the same Heckbert coefficients
 * for a set of 4 corners. Used to place/drag mask handles (arbitrary
 * quad-local (u,v) points, not just the 4 unit-square corners) at their
 * correct warped screen position — see projectQuadPoint/unprojectScreenPoint
 * below.
 */
function computeQuadCoefficients(corners) {
    const ndc = corners.map(({ x, y }) => ({ x: x * 2 - 1, y: 1 - y * 2 }))
    const [p0, p1, p2, p3] = ndc
    const x0 = p0.x, y0 = p0.y
    const x1 = p1.x, y1 = p1.y
    const x2 = p2.x, y2 = p2.y
    const x3 = p3.x, y3 = p3.y

    const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3
    const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3

    let a11, a12, a13, a21, a22, a23
    if (dx3 === 0 && dy3 === 0) {
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
    return { a11, a12, a13, a21, a22, a23, a31: x0, a32: y0 }
}

/**
 * Forward-projects an arbitrary quad-local (u,v) point (e.g. a mask vertex)
 * to its warped screen-space fraction (0..1), so mask handles render at the
 * correct position even when the surface's quad itself is keystoned.
 */
function projectQuadPoint(corners, u, v) {
    const { a11, a12, a13, a21, a22, a23, a31, a32 } = computeQuadCoefficients(corners)
    const X = a11 * u + a21 * v + a31
    const Y = a12 * u + a22 * v + a32
    const W = a13 * u + a23 * v + 1
    if (Math.abs(W) < 1e-9) return { x: 0.5, y: 0.5 } // degenerate quad guard, mirrors unprojectScreenPoint's fallback
    const ndcX = X / W
    const ndcY = Y / W
    return { x: (ndcX + 1) / 2, y: (1 - ndcY) / 2 }
}

/**
 * Inverse of projectQuadPoint: given a screen-space fraction (0..1) — e.g.
 * where the operator's pointer is — solves for the quad-local (u,v) it
 * corresponds to, so dragging a mask handle stays correct under keystoning.
 * The forward map is projective (X,Y,W linear in u,v with a shared W), which
 * reduces to a 2x2 linear system in (u,v) once screenX/Y are known — solved
 * here via Cramer's rule.
 */
function unprojectScreenPoint(corners, screenX, screenY) {
    const { a11, a12, a13, a21, a22, a23, a31, a32 } = computeQuadCoefficients(corners)
    const ndcX = screenX * 2 - 1
    const ndcY = 1 - screenY * 2

    const A = a11 - ndcX * a13, B = a21 - ndcX * a23, C = ndcX - a31
    const D = a12 - ndcY * a13, E = a22 - ndcY * a23, F = ndcY - a32
    const det = A * E - B * D
    if (Math.abs(det) < 1e-9) return { u: 0.5, v: 0.5 } // degenerate quad guard
    return {
        u: (C * E - B * F) / det,
        v: (A * F - C * D) / det
    }
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

/** Flattens+pads a mask's {x,y} points into a fixed MAX_MASK_POINTS*2 array for the uMaskPoints uniform. */
function buildMaskUniformData(mask) {
    const data = new Float32Array(MAX_MASK_POINTS * 2)
    if (!mask) return data
    mask.slice(0, MAX_MASK_POINTS).forEach((p, i) => {
        data[i * 2] = p.x
        data[i * 2 + 1] = p.y
    })
    return data
}

const CORNER_LABELS = ['TL', 'TR', 'BR', 'BL']

let surfaceCounter = 1
function nextSurfaceId() {
    surfaceCounter += 1
    return `surface-${Date.now()}-${surfaceCounter}`
}

/**
 * Builds a new surface with a default quad inset 10% from a reference
 * surface's own corners (or the full screen if none), so newly-added
 * surfaces don't perfectly overlap an existing one and are individually
 * draggable right away.
 */
export function createInsetSurface(referenceCorners, name) {
    const ref = referenceCorners || DEFAULT_SURFACE.corners
    const inset = 0.1
    // Move each corner 10% toward the quad's own centroid instead of a fixed
    // screen-space inset, so this still looks like "shrunk toward the
    // middle" even if the reference quad is itself already warped/dragged.
    const cx = ref.reduce((s, p) => s + p.x, 0) / ref.length
    const cy = ref.reduce((s, p) => s + p.y, 0) / ref.length
    const corners = ref.map((p) => ({
        x: p.x + (cx - p.x) * inset,
        y: p.y + (cy - p.y) * inset
    }))
    return { id: nextSurfaceId(), name: name || `Surface ${surfaceCounter}`, corners, mask: null, feather: 0 }
}

/**
 * @param {{ current: HTMLCanvasElement|null }} visualCanvasRef - ref to the
 *   currently-active visual's own <canvas>, forwarded down from
 *   ProjectorApp.jsx. May be null momentarily while visuals switch.
 * @param {boolean} editMode - when true, renders draggable corner/mask handles.
 */
const MappingCompositor = ({ visualCanvasRef, editMode }) => {
    const containerRef = useRef(null)
    const canvasRef = useRef(null)
    const glStateRef = useRef(null)
    const [surfaces, setSurfaces] = useState([DEFAULT_SURFACE])
    const surfacesRef = useRef(surfaces)
    surfacesRef.current = surfaces

    const [selectedSurfaceId, setSelectedSurfaceId] = useState(DEFAULT_SURFACE.id)

    // BS-006 phase 2: feedback-loop guard for the two-way setSurfaces/
    // onSurfacesChanged sync. When a remote surfaces array arrives via
    // onSurfacesChanged we setSurfaces(...) locally, which would otherwise
    // immediately re-broadcast the exact array we just received right back
    // out over IPC. Setting this ref true right before that setState, and
    // checking+clearing it in the outgoing-broadcast effect, skips exactly
    // that one redundant echo without needing deep-equality checks or a
    // sequence/version number.
    //
    // Starts `true` (not `false`) so the outbound-broadcast effect's very
    // first mount-time run — which always fires once for the synchronous
    // [DEFAULT_SURFACE] initial state, since it depends on [surfaces] — is
    // also suppressed. That initial state is a placeholder, not new operator
    // data; broadcasting it would race the async getSurfaces() pull below
    // (see that effect's comment) and could overwrite the main process's
    // cached real state with the default before the pull ever reads it.
    const suppressNextBroadcastRef = useRef(true)

    // --- Cross-window sync: receive pushed surfaces (e.g. a loaded preset
    // from ProjectorPage, or edits made while a second projector window was
    // open) and adopt them as this window's live state. ---
    useEffect(() => {
        const unsubscribe = window.mapping?.onSurfacesChanged((remoteSurfaces) => {
            if (!Array.isArray(remoteSurfaces) || remoteSurfaces.length === 0) return
            suppressNextBroadcastRef.current = true
            setSurfaces(remoteSurfaces)
            setSelectedSurfaceId((current) => {
                if (remoteSurfaces.some((s) => s.id === current)) return current
                return remoteSurfaces[remoteSurfaces.length - 1].id
            })
        })
        return () => unsubscribe?.()
    }, [])

    // BS-006 phase 2 fix: on mount, pull whatever the main process last knew
    // as the current surfaces array — set by ANY window's previous
    // setSurfaces call, including one made while THIS window was closed
    // (e.g. the operator loaded a preset in ProjectorPage while the
    // projector window was shut, then reopened it). Without this, a freshly
    // mounted MappingCompositor always starts from [DEFAULT_SURFACE] and the
    // outbound-broadcast effect below would push that stale default back
    // out, silently discarding whatever multi-surface/masked layout was
    // already live. Only true first-ever-run (cache genuinely empty/null)
    // falls through to the [DEFAULT_SURFACE] initial state untouched.
    useEffect(() => {
        let cancelled = false
        ;(async () => {
            const cached = await window.mapping?.getSurfaces()
            if (cancelled || !Array.isArray(cached) || cached.length === 0) return
            // Same round-tripping-is-harmless-but-pointless guard as the
            // onSurfacesChanged handler above — this is adopting state that
            // was already the source of truth, not producing new data, so
            // there's nothing useful to broadcast back out.
            suppressNextBroadcastRef.current = true
            setSurfaces(cached)
            setSelectedSurfaceId((current) => {
                if (cached.some((s) => s.id === current)) return current
                return cached[cached.length - 1].id
            })
        })()
        return () => { cancelled = true }
    }, [])

    // --- Cross-window sync: broadcast whenever this window's own surfaces
    // array changes (drag, add, remove, rename, mask edit), so ProjectorPage
    // stays in sync for its surface list / save-preset UI. ---
    useEffect(() => {
        if (suppressNextBroadcastRef.current) {
            suppressNextBroadcastRef.current = false
            return
        }
        window.mapping?.setSurfaces(surfaces)
    }, [surfaces])

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
        const uMaskPoints = gl.getUniformLocation(program, 'uMaskPoints[0]')
        const uMaskPointCount = gl.getUniformLocation(program, 'uMaskPointCount')
        const uFeather = gl.getUniformLocation(program, 'uFeather')

        const vao = gl.createVertexArray()
        gl.bindVertexArray(vao)

        // Single shared vertex buffer, reused sequentially for every surface
        // within one frame (bufferData'd right before each surface's draw
        // call instead of once up front) — see the render loop below for why
        // phase 1's "only update on corners change" optimization doesn't
        // carry over cleanly to N surfaces sharing one buffer.
        const vertexBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, buildVertexBufferData(surfacesRef.current[0].corners), gl.DYNAMIC_DRAW)

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

        // BS-006 phase 2: alpha blending, needed so a masked/feathered
        // surface's partially-transparent edges actually blend against
        // whatever was drawn earlier in the same frame (the black clear
        // color, or an earlier surface underneath) instead of hard-cutting.
        // This is draw-call blending inside the GL context's own
        // framebuffer — it does NOT depend on the canvas context's own
        // `alpha` creation option (that option only controls how the
        // canvas's final composited pixels blend with the HTML page behind
        // it). Since this canvas already clears to opaque black every frame
        // and is never itself layered over other page content, `alpha:
        // false` stays correct and unchanged; only gl.BLEND + blendFunc are
        // new here.
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

        glStateRef.current = { gl, program, vertexBuffer, texture, vao, uTexture, uMaskPoints, uMaskPointCount, uFeather }

        function renderFrame() {
            const state = glStateRef.current
            if (!state) return
            const { gl: ctx, program: prog, texture: tex, vao: vertexArray, uTexture: texUniform, uMaskPoints: maskUniform, uMaskPointCount: maskCountUniform, uFeather: featherUniform } = state

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

            // Draw every surface in array order (painter's algorithm — later
            // surfaces land on top). Each surface's quad is uploaded into the
            // single shared vertex buffer right before its own draw call:
            // with N surfaces sharing one buffer within a single frame,
            // phase 1's "bufferSubData only when corners changed" trick
            // doesn't apply cleanly (every surface's data must be live in
            // the buffer at the moment of ITS draw call, not just whichever
            // one last happened to change) — recomputing+reuploading a
            // ~120-byte buffer per surface per frame is trivial CPU/GPU cost
            // for the surface counts this feature targets.
            surfacesRef.current.forEach((surface) => {
                ctx.bufferData(ctx.ARRAY_BUFFER, buildVertexBufferData(surface.corners), ctx.DYNAMIC_DRAW)
                const maskPointCount = surface.mask ? Math.min(surface.mask.length, MAX_MASK_POINTS) : 0
                ctx.uniform2fv(maskUniform, buildMaskUniformData(surface.mask))
                ctx.uniform1i(maskCountUniform, maskPointCount)
                ctx.uniform1f(featherUniform, surface.feather || 0)
                ctx.drawArrays(ctx.TRIANGLES, 0, QUAD_TRIANGLE_ORDER.length)
            })
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

    const selectedSurface = surfaces.find((s) => s.id === selectedSurfaceId) || surfaces[0]

    const updateSelectedSurface = (updater) => {
        setSurfaces((prev) => prev.map((s) => (s.id === selectedSurface.id ? updater(s) : s)))
    }

    // --- Corner-drag handles (edit mode only, selected surface only) ---
    const handlePointerDown = (e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
    }

    const handlePointerUp = (e) => {
        e.currentTarget.releasePointerCapture(e.pointerId)
    }

    const handleCornerPointerMove = (index) => (e) => {
        if (e.buttons === 0) return
        const rect = containerRef.current.getBoundingClientRect()
        const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
        const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
        updateSelectedSurface((s) => {
            const nextCorners = s.corners.slice()
            nextCorners[index] = { x, y }
            return { ...s, corners: nextCorners }
        })
    }

    // --- Mask-vertex-drag handles (edit mode only, selected surface only) ---
    // Mask points live in quad-local UV space, so a screen-space pointer
    // position must be un-projected through the surface's OWN (possibly
    // keystoned) corners to get back to the (u,v) the operator is dragging
    // toward — see unprojectScreenPoint's doc comment.
    const handleMaskPointerMove = (index) => (e) => {
        if (e.buttons === 0) return
        const rect = containerRef.current.getBoundingClientRect()
        const screenX = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
        const screenY = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
        updateSelectedSurface((s) => {
            const { u, v } = unprojectScreenPoint(s.corners, screenX, screenY)
            const nextMask = s.mask.slice()
            nextMask[index] = { x: u, y: v }
            return { ...s, mask: nextMask }
        })
    }

    const handleAddMask = () => {
        updateSelectedSurface((s) => ({ ...s, mask: DEFAULT_MASK.map((p) => ({ ...p })) }))
    }

    const handleAddVertex = () => {
        updateSelectedSurface((s) => {
            if (!s.mask || s.mask.length === 0) return s
            const cx = s.mask.reduce((sum, p) => sum + p.x, 0) / s.mask.length
            const cy = s.mask.reduce((sum, p) => sum + p.y, 0) / s.mask.length
            return { ...s, mask: [...s.mask, { x: cx, y: cy }] }
        })
    }

    const handleRemoveVertex = () => {
        updateSelectedSurface((s) => {
            if (!s.mask || s.mask.length <= 3) return s
            return { ...s, mask: s.mask.slice(0, -1) }
        })
    }

    const handleFeatherChange = (value) => {
        updateSelectedSurface((s) => ({ ...s, feather: value }))
    }

    const handleSelectSurface = (id) => {
        setSelectedSurfaceId(id)
    }

    return (
        <div ref={containerRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

            {editMode && surfaces.map((surface) => {
                const isSelected = surface.id === selectedSurface.id
                if (!isSelected) {
                    // Non-selected surfaces only get a small centroid selector
                    // dot — full corner/mask handles for every surface at once
                    // would be unusable clutter with more than 1-2 surfaces.
                    const cx = surface.corners.reduce((s, p) => s + p.x, 0) / surface.corners.length
                    const cy = surface.corners.reduce((s, p) => s + p.y, 0) / surface.corners.length
                    return (
                        <SurfaceSelector
                            key={surface.id}
                            name={surface.name}
                            x={cx}
                            y={cy}
                            onSelect={() => handleSelectSurface(surface.id)}
                        />
                    )
                }
                return (
                    <React.Fragment key={surface.id}>
                        {surface.corners.map((corner, i) => (
                            <CornerHandle
                                key={CORNER_LABELS[i]}
                                label={CORNER_LABELS[i]}
                                x={corner.x}
                                y={corner.y}
                                onPointerDown={handlePointerDown}
                                onPointerMove={handleCornerPointerMove(i)}
                                onPointerUp={handlePointerUp}
                            />
                        ))}
                        {surface.mask && surface.mask.map((point, i) => {
                            const screenPos = projectQuadPoint(surface.corners, point.x, point.y)
                            return (
                                <MaskHandle
                                    key={`mask-${i}`}
                                    x={screenPos.x}
                                    y={screenPos.y}
                                    onPointerDown={handlePointerDown}
                                    onPointerMove={handleMaskPointerMove(i)}
                                    onPointerUp={handlePointerUp}
                                />
                            )
                        })}
                    </React.Fragment>
                )
            })}

            {editMode && (
                <MaskControls
                    surfaceName={selectedSurface.name}
                    hasMask={!!selectedSurface.mask}
                    maskPointCount={selectedSurface.mask?.length || 0}
                    feather={selectedSurface.feather || 0}
                    onAddMask={handleAddMask}
                    onAddVertex={handleAddVertex}
                    onRemoveVertex={handleRemoveVertex}
                    onFeatherChange={handleFeatherChange}
                />
            )}
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

/** A single draggable mask-vertex handle — visually distinct (orange square) from quad corner handles (green circles). */
const MaskHandle = ({ x, y, onPointerDown, onPointerMove, onPointerUp }) => (
    <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
            position: 'absolute',
            left: `${x * 100}%`,
            top: `${y * 100}%`,
            transform: 'translate(-50%, -50%)',
            width: '16px',
            height: '16px',
            borderRadius: '3px',
            background: '#ff9500',
            border: '2px solid #000',
            boxShadow: '0 0 6px rgba(0,0,0,0.8)',
            cursor: 'grab',
            touchAction: 'none',
            userSelect: 'none'
        }}
    />
)

/** Small clickable marker at a non-selected surface's centroid, used to switch which surface's handles are shown. */
const SurfaceSelector = ({ name, x, y, onSelect }) => (
    <div
        onPointerDown={onSelect}
        title={`Select ${name}`}
        style={{
            position: 'absolute',
            left: `${x * 100}%`,
            top: `${y * 100}%`,
            transform: 'translate(-50%, -50%)',
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.25)',
            border: '2px dashed rgba(255,255,255,0.7)',
            cursor: 'pointer',
            touchAction: 'none',
            userSelect: 'none'
        }}
    />
)

/** Edit-mode floating panel: add/remove mask, feather slider — for whichever surface is currently selected. */
const MaskControls = ({ surfaceName, hasMask, maskPointCount, feather, onAddMask, onAddVertex, onRemoveVertex, onFeatherChange }) => (
    <div
        style={{
            position: 'absolute',
            left: '16px',
            bottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '10px 12px',
            borderRadius: '8px',
            background: 'rgba(0,0,0,0.75)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff',
            fontSize: '11px',
            fontFamily: 'sans-serif',
            minWidth: '180px'
        }}
    >
        <strong>{surfaceName}</strong>
        {!hasMask ? (
            <button onClick={onAddMask} style={buttonStyle}>Add Mask</button>
        ) : (
            <>
                <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={onAddVertex} style={buttonStyle}>Add Vertex</button>
                    <button onClick={onRemoveVertex} disabled={maskPointCount <= 3} style={{ ...buttonStyle, opacity: maskPointCount <= 3 ? 0.4 : 1 }}>Remove Vertex</button>
                </div>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    Feather ({feather.toFixed(2)})
                    <input
                        type="range"
                        min={0}
                        max={0.3}
                        step={0.01}
                        value={feather}
                        onChange={(e) => onFeatherChange(Number(e.target.value))}
                    />
                </label>
            </>
        )}
    </div>
)

const buttonStyle = {
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid rgba(255,255,255,0.2)',
    background: '#222',
    color: '#fff',
    fontSize: '11px',
    cursor: 'pointer'
}

export default MappingCompositor
