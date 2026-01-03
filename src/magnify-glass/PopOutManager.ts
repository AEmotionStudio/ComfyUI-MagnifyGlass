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
    type: 'frame' | 'config' | 'close' | 'ping' | 'pong';
    data?: string | PopOutConfig;
    timestamp?: number;
}

interface PopOutConfig {
    glassSize: number;
    borderColor: string;
    borderWidth: number;
    glassShape: string;
}

/**
 * PopOutManager class.
 * Handles opening, closing, and syncing with an external browser tab.
 */
export class PopOutManager {
    private channel: BroadcastChannel | null = null;
    private isOpen: boolean = false;
    private lastPongTime: number = 0;
    private pingInterval: number | null = null;
    private viewerUrl: string;

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
        // Find the extension's base URL from the loaded scripts
        const scripts = document.querySelectorAll('script[src*="magnify"]');
        if (scripts.length > 0) {
            const src = (scripts[0] as HTMLScriptElement).src;
            const baseUrl = src.substring(0, src.lastIndexOf('/'));
            return `${baseUrl}/popout-viewer.html`;
        }
        // Fallback: assume standard ComfyUI extension path
        return '/extensions/comfyui-magnifyglass/popout-viewer.html';
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
                }
                break;
            case 'close':
                this.isOpen = false;
                this.stopPing();
                Logger.debug('[PopOut] Viewer tab closed');
                break;
        }
    }

    /**
     * Open the pop-out viewer in a new tab.
     */
    open(): void {
        if (this.isOpen) {
            Logger.debug('[PopOut] Tab already open');
            return;
        }

        // Open new tab
        const newTab = window.open(this.viewerUrl, '_blank');
        if (!newTab) {
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
        if (!this.isOpen) return;

        this.sendMessage({ type: 'close' });
        this.isOpen = false;
        this.stopPing();
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
    sendConfig(config: PopOutConfig): void {
        if (!this.channel) return;

        this.sendMessage({
            type: 'config',
            data: config
        });
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
        this.stopPing();
        this.pingInterval = setInterval(() => {
            this.sendMessage({ type: 'ping', timestamp: Date.now() });

            // Check for connection timeout
            if (this.isOpen && Date.now() - this.lastPongTime > this.CONNECTION_TIMEOUT) {
                Logger.debug('[PopOut] Connection timeout, marking as closed');
                this.isOpen = false;
                this.stopPing();
            }
        }, 1000);
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
