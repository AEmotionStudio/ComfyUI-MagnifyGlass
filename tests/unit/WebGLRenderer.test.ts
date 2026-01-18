import { describe, it, expect, afterEach, vi } from 'vitest';
import { WebGLRenderer } from '../../src/magnify-glass/WebGLRenderer';

describe('WebGLRenderer Security', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('should safely render error instructions without XSS', () => {
        // Mock dependencies
        const mockUi = { glassCanvas: null } as any;
        const mockConfig = {} as any;
        const mockState = {} as any;

        const renderer = new WebGLRenderer(mockConfig, mockState, mockUi);

        // Payload with XSS vector
        const maliciousInstruction = 'Failed <img src=x onerror=alert(1)>';

        renderer.showWebGLError(maliciousInstruction);

        const toast = document.getElementById('magnifyglass-webgl-error');
        expect(toast).toBeTruthy();

        // Check if the malicious instruction is rendered as text, not HTML
        // In the vulnerable version, this would be true:
        // expect(toast?.innerHTML).toContain('<img src=x onerror=alert(1)>');

        // In the fixed version, we expect:
        expect(toast?.textContent).toContain(maliciousInstruction);
        expect(toast?.innerHTML).not.toContain('<img src=x onerror=alert(1)>');
        expect(toast?.innerHTML).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('should have a working dismiss button using event listener', () => {
        const mockUi = { glassCanvas: null } as any;
        const renderer = new WebGLRenderer({} as any, {} as any, mockUi);

        renderer.showWebGLError('Test error');
        const toast = document.getElementById('magnifyglass-webgl-error');
        const button = toast?.querySelector('button');

        expect(button).toBeTruthy();

        // Verify inline handler is NOT present (CSP compliance)
        expect(button?.hasAttribute('onclick')).toBe(false);

        // Click to dismiss
        button?.click();

        // Verify toast is removed
        expect(document.getElementById('magnifyglass-webgl-error')).toBeNull();
    });
});
