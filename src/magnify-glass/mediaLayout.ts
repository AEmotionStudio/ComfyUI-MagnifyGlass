/**
 * ComfyUI MagnifyGlass - Media Layout
 *
 * Pure geometry for drawing image/video previews into the glass.
 * All values are CSS pixels relative to the canvas element.
 */

export interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface CaptureRegion {
    left: number;
    top: number;
    size: number;
    /** Glass pixels per CSS pixel */
    k: number;
}

export function captureRegion(pivotX: number, pivotY: number, glassSize: number, zoomFactor: number): CaptureRegion {
    const size = glassSize / zoomFactor;
    return { left: pivotX - size / 2, top: pivotY - size / 2, size, k: glassSize / size };
}

export function toGlass(box: Box, cap: CaptureRegion): Box {
    return { x: (box.x - cap.left) * cap.k, y: (box.y - cap.top) * cap.k, w: box.w * cap.k, h: box.h * cap.k };
}

/** Node-local graph box to canvas CSS pixels, matching LiteGraph's (pos + offset) * scale. */
export function graphBoxToCss(box: Box, nodePos: ArrayLike<number>, scale: number, offset: ArrayLike<number>): Box {
    return {
        x: (nodePos[0] + box.x + offset[0]) * scale,
        y: (nodePos[1] + box.y + offset[1]) * scale,
        w: box.w * scale,
        h: box.h * scale
    };
}

/** Scale a box about a fixed point, e.g. a DOM rect measured at the real zoom into the Virtual Zoom frame. */
export function scaleAbout(box: Box, px: number, py: number, s: number): Box {
    return { x: px + (box.x - px) * s, y: py + (box.y - py) * s, w: box.w * s, h: box.h * s };
}

/** Where an element's content lands inside its box for the given CSS object-fit. */
export function fitContent(box: Box, nw: number, nh: number, objectFit: string): Box {
    if (objectFit !== 'contain' && objectFit !== 'scale-down' && objectFit !== 'cover') return box;
    let s = objectFit === 'cover' ? Math.max(box.w / nw, box.h / nh) : Math.min(box.w / nw, box.h / nh);
    if (objectFit === 'scale-down') s = Math.min(s, 1);
    const w = nw * s;
    const h = nh * s;
    return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

/**
 * Node-local boxes of the frontend's `$$canvas-image-preview` images
 * (mirrors renderPreview in the ComfyUI frontend).
 */
export function previewImageBoxes(
    imgs: HTMLImageElement[],
    widget: { y: number; computedHeight?: number; width?: number },
    node: { size: ArrayLike<number>; imageIndex?: number | null; imageRects?: number[][] },
    sizeTextMargin: number
): { img: HTMLImageElement; box: Box }[] {
    const loaded = (img: HTMLImageElement | undefined) => !!img?.naturalWidth && !!img.naturalHeight;
    const index = node.imageIndex ?? (imgs.length === 1 ? 0 : null);

    if (index != null) {
        const img = imgs.at(index);
        if (!img || !loaded(img)) return [];
        const w = widget.width || node.size[0];
        const h = widget.computedHeight ? widget.computedHeight - sizeTextMargin : 0;
        const s = Math.min(w / img.naturalWidth, h / img.naturalHeight, 1);
        const dw = img.naturalWidth * s;
        const dh = img.naturalHeight * s;
        return [{ img, box: { x: (w - dw) / 2, y: widget.y + (h - dh) / 2, w: dw, h: dh } }];
    }

    const rects = node.imageRects ?? [];
    const ratio = imgs[0]?.naturalWidth / imgs[0]?.naturalHeight;
    const inset = imgs.every(img => img.naturalWidth / img.naturalHeight === ratio) ? 0 : 2;
    const boxes: { img: HTMLImageElement; box: Box }[] = [];
    imgs.forEach((img, i) => {
        const cell = rects[i];
        if (!cell || !loaded(img)) return;
        const [cx, cy, cw, ch] = cell;
        const s = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
        const dw = img.naturalWidth * s;
        const dh = img.naturalHeight * s;
        boxes.push({
            img,
            box: { x: cx + (cw - dw) / 2 + inset, y: cy + (ch - dh) / 2 + inset, w: dw - inset * 2, h: dh - inset * 2 }
        });
    });
    return boxes;
}

/**
 * Whether drawing this element keeps the canvas origin-clean. A cross-origin
 * drawImage does not throw; it silently taints the canvas, which later breaks
 * the WebGL upload and the pop-out.
 */
export function isSafeMediaSource(el: HTMLImageElement | HTMLVideoElement): boolean {
    if (el.crossOrigin !== null) return true;
    const src = el.currentSrc || el.src;
    if (!src) return false;
    const url = new URL(src, location.href);
    return url.protocol === 'blob:' || url.protocol === 'data:' || url.origin === location.origin;
}
