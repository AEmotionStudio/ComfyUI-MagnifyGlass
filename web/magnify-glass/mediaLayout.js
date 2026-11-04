function captureRegion(pivotX, pivotY, glassSize, zoomFactor) {
  const size = glassSize / zoomFactor;
  return { left: pivotX - size / 2, top: pivotY - size / 2, size, k: glassSize / size };
}
function toGlass(box, cap) {
  return { x: (box.x - cap.left) * cap.k, y: (box.y - cap.top) * cap.k, w: box.w * cap.k, h: box.h * cap.k };
}
function graphBoxToCss(box, nodePos, scale, offset) {
  return {
    x: (nodePos[0] + box.x + offset[0]) * scale,
    y: (nodePos[1] + box.y + offset[1]) * scale,
    w: box.w * scale,
    h: box.h * scale
  };
}
function scaleAbout(box, px, py, s) {
  return { x: px + (box.x - px) * s, y: py + (box.y - py) * s, w: box.w * s, h: box.h * s };
}
function fitContent(box, nw, nh, objectFit) {
  if (objectFit !== "contain" && objectFit !== "scale-down" && objectFit !== "cover") return box;
  let s = objectFit === "cover" ? Math.max(box.w / nw, box.h / nh) : Math.min(box.w / nw, box.h / nh);
  if (objectFit === "scale-down") s = Math.min(s, 1);
  const w = nw * s;
  const h = nh * s;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}
function previewImageBoxes(imgs, widget, node, sizeTextMargin) {
  var _a, _b;
  const loaded = (img) => !!(img == null ? void 0 : img.naturalWidth) && !!img.naturalHeight;
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
  const ratio = ((_a = imgs[0]) == null ? void 0 : _a.naturalWidth) / ((_b = imgs[0]) == null ? void 0 : _b.naturalHeight);
  const inset = imgs.every((img) => img.naturalWidth / img.naturalHeight === ratio) ? 0 : 2;
  const boxes = [];
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
function isSafeMediaSource(el) {
  if (el.crossOrigin !== null) return true;
  const src = el.currentSrc || el.src;
  if (!src) return false;
  const url = new URL(src, location.href);
  return url.protocol === "blob:" || url.protocol === "data:" || url.origin === location.origin;
}
export {
  captureRegion,
  fitContent,
  graphBoxToCss,
  isSafeMediaSource,
  previewImageBoxes,
  scaleAbout,
  toGlass
};
