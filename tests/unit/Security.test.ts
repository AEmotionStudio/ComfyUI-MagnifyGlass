import { describe, it, expect } from 'vitest';
import { Window } from 'happy-dom';
import { escapeHtml, sanitizeElement } from '../../src/shared/utils';
import { UIManager } from '../../src/info-panel/UIManager';
import { StateManager } from '../../src/info-panel/StateManager';

describe('Security', () => {
    describe('sanitizeElement', () => {
        it('should remove event handlers from an element', () => {
            const window = new Window();
            const document = window.document;
            const element = document.createElement('div');
            element.setAttribute('onclick', 'alert(1)');
            element.setAttribute('onerror', 'alert(1)');
            element.setAttribute('onload', 'alert(1)');
            element.setAttribute('class', 'safe');

            sanitizeElement(element as unknown as HTMLElement);

            expect(element.hasAttribute('onclick')).toBe(false);
            expect(element.hasAttribute('onerror')).toBe(false);
            expect(element.hasAttribute('onload')).toBe(false);
            expect(element.getAttribute('class')).toBe('safe');
        });

        it('should recursively remove event handlers from children', () => {
            const window = new Window();
            const document = window.document;
            const parent = document.createElement('div');
            const child = document.createElement('img');

            child.setAttribute('src', 'x');
            child.setAttribute('onerror', 'alert(1)');
            parent.appendChild(child);

            sanitizeElement(parent as unknown as HTMLElement);

            expect(child.hasAttribute('onerror')).toBe(false);
            expect(child.getAttribute('src')).toBe('x');
        });

        it('should remove javascript: URIs from dangerous attributes', () => {
            const window = new Window();
            const document = window.document;
            const link = document.createElement('a');
            const img = document.createElement('img');
            const form = document.createElement('form');

            link.setAttribute('href', 'javascript:alert(1)');
            img.setAttribute('src', 'javascript:alert(1)');
            form.setAttribute('action', 'javascript:alert(1)');
            form.setAttribute('formaction', 'javascript:alert(1)');

            sanitizeElement(link as unknown as HTMLElement);
            sanitizeElement(img as unknown as HTMLElement);
            sanitizeElement(form as unknown as HTMLElement);

            expect(link.hasAttribute('href')).toBe(false);
            expect(img.hasAttribute('src')).toBe(false);
            expect(form.hasAttribute('action')).toBe(false);
            expect(form.hasAttribute('formaction')).toBe(false);
        });

        it('should remove obscured javascript: URIs (whitespace bypass)', () => {
            const window = new Window();
            const document = window.document;
            const link = document.createElement('a');

            // Bypass attempts: tabs, newlines, spaces
            link.setAttribute('href', 'java\tscript:alert(1)');
            sanitizeElement(link as unknown as HTMLElement);
            expect(link.hasAttribute('href')).toBe(false);

            link.setAttribute('href', 'java\nscript:alert(1)');
            sanitizeElement(link as unknown as HTMLElement);
            expect(link.hasAttribute('href')).toBe(false);

            link.setAttribute('href', ' javascript:alert(1)');
            sanitizeElement(link as unknown as HTMLElement);
            expect(link.hasAttribute('href')).toBe(false);
        });

        it('should preserve safe URLs', () => {
            const window = new Window();
            const document = window.document;
            const link = document.createElement('a');

            link.setAttribute('href', 'https://example.com');
            sanitizeElement(link as unknown as HTMLElement);

            expect(link.getAttribute('href')).toBe('https://example.com');
        });

        it('should handle elements without attributes gracefully', () => {
             const window = new Window();
             const document = window.document;
             const element = document.createElement('div');

             // Should not throw
             sanitizeElement(element as unknown as HTMLElement);
             expect(true).toBe(true);
        });

        it('should handle null/undefined gracefully', () => {
            // Should not throw
            sanitizeElement(null as any);
            sanitizeElement(undefined as any);
            expect(true).toBe(true);
       });
    });

    describe('UIManager Rendering Logic', () => {
        it('should render widget values and their copy text as text', () => {
            (globalThis as any).app = { canvas: { graph: null } };
            document.head.innerHTML = '<style id="magnify-info-panel-styles-v2"></style>';
            const ui = new UIManager(new StateManager());
            const malicious = '<script>alert("xss")</script> \'quoted\'';

            ui.displayInfo({
                hoveredNode: {
                    id: 1, title: 'Node', type: 'KSampler', mode: 'Always', inputs: [], outputs: [], properties: {},
                    widgets: [{ name: '<img src=x onerror=alert(1)>', type: 'text', value: malicious }],
                    graphPath: [], group: null, isSubgraph: false
                }
            });

            const content = ui.elements.content!;
            expect(content.querySelector('script, img')).toBeNull();
            const row = content.querySelector('.info-row')!;
            expect(row.querySelector('.info-label')!.textContent).toBe('<img src=x onerror=alert(1)>');
            expect(row.querySelector('.info-value')!.textContent).toContain(malicious);
            expect((row.querySelector('.copy-btn') as HTMLElement).dataset.copyValue).toBe(malicious);
            ui.cleanup();
        });

        it('should render node names in the header as text', () => {
            (globalThis as any).app = { canvas: { graph: null } };
            document.head.innerHTML = '<style id="magnify-info-panel-styles-v2"></style>';
            const ui = new UIManager(new StateManager());

            ui.displayInfo({
                hoveredNode: {
                    id: 1, title: '<img src=x onerror=alert(1)>', type: '<script>alert(1)</script>',
                    mode: 'Always', widgets: [], inputs: [], outputs: [], properties: {},
                    graphPath: ['<b onclick=alert(1)>sub</b>'], group: '<a href="javascript:alert(1)">g</a>', isSubgraph: false
                }
            });

            const panel = ui.elements.panel!;
            expect(panel.querySelector('.header-identity span *, .panel-breadcrumb b, .panel-breadcrumb a')).toBeNull();
            expect(panel.querySelector('.header-title')!.textContent).toBe('<img src=x onerror=alert(1)>');
            expect(panel.querySelector('.header-badge')!.textContent).toBe('<script>alert(1)</script>');
            expect(panel.querySelector('.panel-breadcrumb')!.textContent).toContain('<b onclick=alert(1)>sub</b>');
            ui.cleanup();
        });
    });

    describe('Robustness', () => {
        it('should safely handle non-string inputs in escapeHtml', () => {
            expect(escapeHtml(123)).toBe('123');
            expect(escapeHtml(0)).toBe('0');
            expect(escapeHtml(true)).toBe('true');
            expect(escapeHtml(false)).toBe('false');
            expect(escapeHtml(null)).toBe('');
            expect(escapeHtml(undefined)).toBe('');

            // Object with toString
            const obj = { toString: () => '<script>' };
            expect(escapeHtml(obj)).toBe('&lt;script&gt;');
        });
    });
});
