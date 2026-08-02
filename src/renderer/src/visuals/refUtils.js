/**
 * refUtils.js — shared React ref-merging helper for the visuals library.
 *
 * Separate from glUtils.js on purpose: that file is GL-only plumbing, this
 * is a generic React concern (merging a visual hook's own canvasRef with
 * whatever ref MappingCompositor.jsx forwards down to read as a texture
 * source).
 */

/**
 * Returns a callback ref that writes the DOM node into every ref passed in —
 * object refs (`{current}`) and callback refs alike, ignoring nullish ones.
 * @param {...(React.RefObject|Function|null|undefined)} refs
 */
export function mergeRefs(...refs) {
    return (node) => {
        refs.forEach((ref) => {
            if (!ref) return
            if (typeof ref === 'function') ref(node)
            else ref.current = node
        })
    }
}
