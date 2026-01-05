/**
 * ComfyUI MagnifyGlass - PopOutManager (TypeScript)
 * 
 * Manages pop-out tab functionality for multi-monitor viewing.
 * Uses BroadcastChannel API for efficient cross-tab communication.
 */

import { BROADCAST_CHANNEL_NAME } from '../shared/constants';
import { Logger } from '../shared/logger';

/**
 * Message types for BroadcastChannel communication
 */
interface PopOutMessage {
    type: 'frame' | 'config' | 'info' | 'close' | 'ping' | 'pong';
    data?: string | Partial<PopOutConfig> | PopOutInfo;
    timestamp?: number;
}

interface PopOutConfig {
    glassSize: number;
    borderColor: string;
    borderWidth: number;
    glassShape: string;
    theme?: string;
}

/**
 * Inspector info data structure for pop-out viewer
 */
interface PopOutInfo {
    hoveredNode?: {
        title: string;
        type: string;
        executionOrder?: number;
        category?: string;
        pythonModule?: string;
    };
    cursor?: {
        canvas?: { x: number; y: number };
    };
    canvas?: {
        scale: number;
    };
    magnifier?: {
        zoomFactor: number;
    };
    media?: {
        tagName: string;
        naturalSize?: string;
    };
}

/**
 * PopOutManager class.
 * Handles opening, closing, and syncing with an external browser tab.
 */
export class PopOutManager {
    private channel: BroadcastChannel | null = null;
    private isOpen: boolean = false;
    private popOutWindow: Window | null = null;
    public onStateChange: ((isOpen: boolean) => void) | null = null;
    private lastPongTime: number = 0;
    private pingInterval: number | null = null;
    private viewerUrl: string;
    private currentTheme: string = 'dark'; // Default theme

    /** Throttle frame sending to ~30fps */
    private lastFrameTime: number = 0;
    private readonly FRAME_INTERVAL = 33; // ~30fps

    /** Connection timeout (ms) */
    private readonly CONNECTION_TIMEOUT = 5000;

    constructor() {
        // Get the viewer URL relative to the extension
        // The viewer HTML will be in the web directory
        this.viewerUrl = this.getViewerUrl();
        this.initChannel();
    }

    /**
     * Get the URL for the pop-out viewer page.
     */
    private getViewerUrl(): string {
        // Cache-busting version - increment to force refresh
        const version = 'v16';

        // Find the extension's base URL from the loaded scripts
        const scripts = document.querySelectorAll('script[src*="magnify"]');
        Logger.debug(`[PopOut] Found ${scripts.length} magnify scripts`);

        if (scripts.length > 0) {
            const src = (scripts[0] as HTMLScriptElement).src;
            Logger.debug(`[PopOut] First script src: ${src}`);

            // src might be like: /extensions/comfyui-magnifyglass/magnify-glass/MagnifyGlass.js
            // We need to get to the web root: /extensions/comfyui-magnifyglass/
            const urlParts = src.split('/');
            // Find the extension folder (contains 'magnify' in name)
            let extensionIndex = -1;
            for (let i = 0; i < urlParts.length; i++) {
                if (urlParts[i].toLowerCase().includes('magnify')) {
                    extensionIndex = i;
                    break;
                }
            }
            if (extensionIndex >= 0) {
                const baseUrl = urlParts.slice(0, extensionIndex + 1).join('/');
                const viewerUrl = `${baseUrl}/popout-viewer.html?${version}`;
                Logger.debug(`[PopOut] Using viewer URL: ${viewerUrl}`);
                return viewerUrl;
            }
        }
        // Fallback: assume standard ComfyUI extension path
        const fallbackUrl = `/extensions/comfyui-magnifyglass/popout-viewer.html?${version}`;
        Logger.debug(`[PopOut] Using fallback URL: ${fallbackUrl}`);
        return fallbackUrl;
    }

    /**
     * Initialize the BroadcastChannel.
     */
    private initChannel(): void {
        try {
            this.channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
            this.channel.onmessage = (event: MessageEvent<PopOutMessage>) => {
                this.handleMessage(event.data);
            };
            Logger.debug('[PopOut] BroadcastChannel initialized');
            // Start pinging immediately to detect if viewer is already open (e.g. after reload)
            this.startPing();
        } catch (e) {
            Logger.error('[PopOut] Failed to create BroadcastChannel:', e);
        }
    }

    /**
     * Handle incoming messages from the viewer tab.
     */
    private handleMessage(message: PopOutMessage): void {
        switch (message.type) {
            case 'pong':
                this.lastPongTime = Date.now();
                if (!this.isOpen) {
                    this.isOpen = true;
                    Logger.debug('[PopOut] Viewer tab connected');
                    if (this.onStateChange) this.onStateChange(true);
                    // Send current theme immediately upon connection
                    this.sendConfig({ theme: this.currentTheme });
                }
                break;
            case 'close':
                this.isOpen = false;
                this.popOutWindow = null;
                // Don't stop pinging, we might want to reconnect if user re-opens externally
                // or if we just want to keep checking. 
                // However, original logic stopped ping. Let's keep pinging to auto-detect return.
                // this.stopPing(); 
                Logger.debug('[PopOut] Viewer tab closed');
                if (this.onStateChange) this.onStateChange(false);
                break;
        }
    }

    /**
     * Open the pop-out viewer in a new tab.
     */
    open(): void {
        // If window exists and is open, focus it
        if (this.popOutWindow && !this.popOutWindow.closed) {
            this.popOutWindow.focus();
            return;
        }

        // Open new tab (or refocus existing if name matches)
        // Use a constant name to ensure singleton behavior across reloads
        this.popOutWindow = window.open(this.viewerUrl, 'MagnifyGlassPopout');

        if (!this.popOutWindow) {
            Logger.error('[PopOut] Failed to open new tab - popup may be blocked');
            return;
        }

        // Start pinging to detect when viewer is ready
        this.startPing();
        Logger.debug('[PopOut] Opening viewer tab...');
    }

    /**
     * Close the pop-out viewer tab.
     */
    close(): void {
        if (!this.isOpen && !this.popOutWindow) return;

        // update state immediately for instant UI feedback
        this.isOpen = false;
        if (this.onStateChange) this.onStateChange(false);
        this.stopPing();

        this.sendMessage({ type: 'close' });

        if (this.popOutWindow) {
            this.popOutWindow.close();
            this.popOutWindow = null;
        }

        Logger.debug('[PopOut] Sent close message to viewer');
    }

    /**
     * Toggle the pop-out state.
     */
    toggle(): void {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * Check if the pop-out tab is currently open.
     */
    isPopOutOpen(): boolean {
        return this.isOpen;
    }

    /**
     * Send a frame to the pop-out viewer.
     * Throttled to ~30fps for performance.
     * @param canvas - The source canvas to send
     */
    sendFrame(canvas: HTMLCanvasElement): void {
        if (!this.isOpen || !this.channel) return;

        // Throttle frame rate
        const now = Date.now();
        if (now - this.lastFrameTime < this.FRAME_INTERVAL) {
            return;
        }
        this.lastFrameTime = now;

        try {
            // Convert canvas to data URL (efficient for small canvases)
            const dataUrl = canvas.toDataURL('image/png');
            this.sendMessage({
                type: 'frame',
                data: dataUrl,
                timestamp: now
            });
        } catch (e) {
            Logger.error('[PopOut] Failed to send frame:', e);
        }
    }

    /**
     * Send configuration to the pop-out viewer.
     */
    /**
     * Send configuration to the pop-out viewer.
     */
    sendConfig(config: Partial<PopOutConfig>): void {
        if (!this.channel) return;

        // Merge with current theme if not provided
        const finalConfig = {
            theme: this.currentTheme,
            ...config
        };

        // Update local theme cache if provided in config
        if (config.theme) {
            this.currentTheme = config.theme;
        }

        this.sendMessage({
            type: 'config',
            data: finalConfig
        });
    }

    /**
     * Update the viewer theme.
     * @param theme - Theme name (e.g. 'dark', 'light')
     */
    updateTheme(theme: string): void {
        if (this.currentTheme === theme) return;

        this.currentTheme = theme;
        this.sendConfig({ theme });
        Logger.debug(`[PopOut] Theme updated to: ${theme}`);
    }

    /**
     * Send inspector info to the pop-out viewer.
     * @param info - Inspector panel information
     */
    sendInfo(info: PopOutInfo | null): void {
        if (!this.isOpen || !this.channel) return;

        // Sanitize the info object to remove non-serializable data
        const sanitizedInfo = this.sanitizeInfo(info);

        this.sendMessage({
            type: 'info',
            data: sanitizedInfo || undefined
        });
    }

    /**
     * Sanitize info object for BroadcastChannel transfer.
     * Removes functions, circular references, and non-serializable data.
     * Handles both GatheredInfo and PopOutInfo formats.
     */
    private sanitizeInfo(info: any): PopOutInfo | null {
        if (!info) return null;

        try {
            // Extract only the serializable parts we need
            const sanitized: PopOutInfo = {};

            // Handle hoveredNode
            if (info.hoveredNode) {
                sanitized.hoveredNode = {
                    title: String(info.hoveredNode.title || ''),
                    type: String(info.hoveredNode.type || ''),
                    executionOrder: info.hoveredNode.executionOrder,
                    category: info.hoveredNode.category ? String(info.hoveredNode.category) : undefined,
                    pythonModule: info.hoveredNode.pythonModule ? String(info.hoveredNode.pythonModule) : undefined
                };
            }

            // Handle cursor - map from GatheredInfo format (canvasX/canvasY)
            if (info.cursor) {
                sanitized.cursor = {
                    canvas: {
                        x: Number(info.cursor.canvasX || info.cursor.canvas?.x || 0),
                        y: Number(info.cursor.canvasY || info.cursor.canvas?.y || 0)
                    }
                };
            }

            // Handle canvas/zoom - map from GatheredInfo (zoom) to canvas.scale
            if (info.zoom !== undefined || info.canvas) {
                sanitized.canvas = {
                    scale: Number(info.zoom || info.canvas?.scale || 1)
                };
            }

            // Handle magnifier
            const magnifyGlass = (window as any).comfyUIMagnifyGlass;
            if (magnifyGlass?.config) {
                sanitized.magnifier = {
                    zoomFactor: Number(magnifyGlass.config.zoomFactor || 1)
                };
            }

            // Handle media - map from GatheredInfo mediaElement
            if (info.mediaElement || info.media) {
                const media = info.mediaElement || info.media;
                sanitized.media = {
                    tagName: String(media.tagName || media.type || ''),
                    naturalSize: media.naturalWidth && media.naturalHeight
                        ? `${media.naturalWidth}×${media.naturalHeight}`
                        : media.naturalSize
                };
            }

            return sanitized;
        } catch (e) {
            Logger.error('[PopOut] Failed to sanitize info:', e);
            return null;
        }
    }

    /**
     * Send a message through the BroadcastChannel.
     */
    private sendMessage(message: PopOutMessage): void {
        if (!this.channel) return;

        try {
            this.channel.postMessage(message);
        } catch (e) {
            Logger.error('[PopOut] Failed to send message:', e);
        }
    }

    /**
     * Start pinging to check connection.
     */
    private startPing(): void {
        // Define ping function
        const ping = () => {
            if (this.channel) {
                this.channel.postMessage({ type: 'ping', timestamp: Date.now() });
            }

            // Check for connection timeout
            if (this.isOpen && Date.now() - this.lastPongTime > this.CONNECTION_TIMEOUT) {
                Logger.debug('[PopOut] Connection timeout, marking as closed');
                this.isOpen = false;
                this.stopPing(); // Stop pinging if timeout occurs (assume truly gone)
                // Actually, if we want auto-reconnect, we should NOT stop pinging on timeout?
                // But timeout implies "It was open, but stopped responding".
                // If user closed it, we got 'close' message.
                // If it crashed, we get timeout.
                // If we stop pinging, we won't detect if it comes back?
                // But usually we want to stop to save resources.
                // Let's stick to original behavior for timeout: stop pinging.
                // But for 'close' message: keep pinging (handled in handleMessage).
                if (this.onStateChange) this.onStateChange(false);
            }
        };

        // Always send an immediate ping when startPing is called, 
        // to ensure responsiveness (e.g. when clicking Open button).
        ping();

        // If interval is already running, we don't need to start another one
        if (this.pingInterval) return;

        // Then ping every second
        this.pingInterval = window.setInterval(ping, 1000);
    }

    /**
     * Stop pinging.
     */
    private stopPing(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    /**
     * Cleanup resources.
     */
    cleanup(): void {
        this.close();
        this.stopPing();
        if (this.channel) {
            this.channel.close();
            this.channel = null;
        }
        Logger.debug('[PopOut] Cleaned up');
    }
}
