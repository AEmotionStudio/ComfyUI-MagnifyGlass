import { describe, it, expect } from 'vitest';
import {
    captureRegion,
    toGlass,
    graphBoxToCss,
    scaleAbout,
    fitContent,
    previewImageBoxes,
    isSafeMediaSource
} from '../../src/magnify-glass/mediaLayout';

const fakeImg = (naturalWidth: number, naturalHeight: number) =>
    ({ naturalWidth, naturalHeight }) as HTMLImageElement;

describe('mediaLayout', () => {
    describe('captureRegion / toGlass', () => {
        it('centres the region on the pivot and scales by glassSize / size', () => {
            expect(captureRegion(300, 200, 200, 2)).toEqual({ left: 250, top: 150, size: 100, k: 2 });
        });

        it('maps a CSS box into glass pixels', () => {
            expect(toGlass({ x: 280, y: 180, w: 40, h: 30 }, captureRegion(300, 200, 200, 2))).toEqual({ x: 60, y: 60, w: 80, h: 60 });
        });
    });

    describe('graphBoxToCss', () => {
        it('uses (pos + offset) * scale like LiteGraph', () => {
            const css = graphBoxToCss({ x: 10, y: 20, w: 100, h: 50 }, [150, 100], 1.5, [-40, 20]);
            expect(css).toEqual({ x: (150 + 10 - 40) * 1.5, y: (100 + 20 + 20) * 1.5, w: 150, h: 75 });
        });
    });

    describe('scaleAbout', () => {
        it('keeps the pivot fixed and scales distances and sizes', () => {
            expect(scaleAbout({ x: 280, y: 180, w: 40, h: 30 }, 300, 200, 2)).toEqual({ x: 260, y: 160, w: 80, h: 60 });
            expect(scaleAbout({ x: 300, y: 200, w: 10, h: 10 }, 300, 200, 4)).toEqual({ x: 300, y: 200, w: 40, h: 40 });
        });
    });

    describe('fitContent', () => {
        const box = { x: 0, y: 0, w: 200, h: 100 };

        it('contain letterboxes and centres', () => {
            expect(fitContent(box, 100, 100, 'contain')).toEqual({ x: 50, y: 0, w: 100, h: 100 });
        });

        it('scale-down never enlarges', () => {
            expect(fitContent(box, 50, 20, 'scale-down')).toEqual({ x: 75, y: 40, w: 50, h: 20 });
            expect(fitContent(box, 400, 400, 'scale-down')).toEqual({ x: 50, y: 0, w: 100, h: 100 });
        });

        it('cover fills and overflows', () => {
            expect(fitContent(box, 100, 100, 'cover')).toEqual({ x: 0, y: -50, w: 200, h: 200 });
        });

        it('fill stretches to the box', () => {
            expect(fitContent(box, 100, 100, 'fill')).toEqual(box);
        });
    });

    describe('previewImageBoxes', () => {
        const widget = { y: 40, computedHeight: 215 };

        it('never enlarges a single image and leaves the 15px size-text margin', () => {
            const img = fakeImg(100, 50);
            const [entry] = previewImageBoxes([img], widget, { size: [200, 300] }, 15);
            // Area 200 x 200 (215 - 15); image fits at scale 1, centred
            expect(entry.img).toBe(img);
            expect(entry.box).toEqual({ x: 50, y: 40 + 75, w: 100, h: 50 });
        });

        it('fits a large single image inside the area without the margin when size text is off', () => {
            const [entry] = previewImageBoxes([fakeImg(800, 400)], widget, { size: [200, 300] }, 0);
            // Area 200 x 215: scale min(0.25, 0.5375, 1) = 0.25
            expect(entry.box).toEqual({ x: 0, y: 40 + (215 - 100) / 2, w: 200, h: 100 });
        });

        it('imageIndex picks the selected image of a batch', () => {
            const imgs = [fakeImg(100, 100), fakeImg(64, 32), fakeImg(100, 100)];
            const boxes = previewImageBoxes(imgs, widget, { size: [200, 300], imageIndex: 1 }, 15);
            expect(boxes).toHaveLength(1);
            expect(boxes[0].img).toBe(imgs[1]);
            expect(boxes[0].box).toEqual({ x: 68, y: 40 + 84, w: 64, h: 32 });
        });

        it('lays a batch out in the node.imageRects cells, inset 2px when aspect ratios differ', () => {
            const imageRects = [[0, 40, 100, 100], [100, 40, 100, 100]];
            const same = previewImageBoxes([fakeImg(50, 50), fakeImg(50, 50)], widget, { size: [200, 300], imageRects }, 15);
            expect(same.map(b => b.box)).toEqual([
                { x: 0, y: 40, w: 100, h: 100 },
                { x: 100, y: 40, w: 100, h: 100 }
            ]);

            const mixed = previewImageBoxes([fakeImg(100, 50), fakeImg(50, 50)], widget, { size: [200, 300], imageRects }, 15);
            expect(mixed.map(b => b.box)).toEqual([
                { x: 2, y: 40 + 25 + 2, w: 96, h: 46 },
                { x: 102, y: 42, w: 96, h: 96 }
            ]);
        });

        it('skips images that are not loaded', () => {
            expect(previewImageBoxes([fakeImg(0, 0)], widget, { size: [200, 300] }, 15)).toEqual([]);
        });
    });

    describe('isSafeMediaSource', () => {
        const media = (src: string, crossOrigin?: string) => {
            const img = document.createElement('img');
            img.src = src;
            if (crossOrigin) img.crossOrigin = crossOrigin;
            return img;
        };

        it('accepts same-origin, blob and data sources', () => {
            expect(isSafeMediaSource(media('/view?filename=a.png&type=output'))).toBe(true);
            expect(isSafeMediaSource(media(`${location.origin}/view?filename=a.png`))).toBe(true);
            expect(isSafeMediaSource(media(`blob:${location.origin}/1234`))).toBe(true);
            expect(isSafeMediaSource(media('data:image/png;base64,AAAA'))).toBe(true);
        });

        it('rejects cross-origin sources unless requested with CORS', () => {
            expect(isSafeMediaSource(media('https://other.example/a.png'))).toBe(false);
            expect(isSafeMediaSource(media('https://other.example/a.png', 'anonymous'))).toBe(true);
        });

        it('rejects an element without a source', () => {
            expect(isSafeMediaSource(document.createElement('video'))).toBe(false);
        });
    });
});
