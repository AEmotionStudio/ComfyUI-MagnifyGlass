/**
 * ComfyUI MagnifyGlass - PopOutManager (TypeScript)
 * 
 * Manages pop-out tab functionality for multi-monitor viewing.
 * Uses BroadcastChannel API for efficient cross-tab communication.
 */

import { BROADCAST_CHANNEL_NAME } from '../shared/constants';
import { Logger } from '../shared/logger';

/**
 * A widget of a node, as the viewer names it in edits and requests
 */
export interface WidgetRef {
    nodeId: number;
    widgetName: string;
}

export interface WidgetEditData extends WidgetRef {
    value: unknown;
}

/** Inspector actions the viewer may ask for */
export type PanelAction = 'focus-node';

/**
 * Node list data sent to popout for dropdown
 */
interface NodeListData {
    nodes: { id: number; title: string; type: string; order?: number }[];
    sortBy: 'title' | 'execOrder' | 'id';
}

export interface PopOutStatus {
    glass: 'on' | 'hidden' | 'off';
    inspector: boolean;
    reduceMotion: boolean;
}

/**
 * ComfyUI's palette as the viewer needs it: the computed values of the allowlisted
 * properties ('' when unset), the light or dark scheme, and the UI font.
 */
interface PopOutPalette {
    scheme: 'dark' | 'light';
    fontFamily: string;
    fontSize: string;
    properties: Record<string, string>;
}

interface PopOutConfig extends PopOutStatus {
    palette: PopOutPalette;
}

// The palette tokens the viewer's --mg-* tokens are built on, and the Inspector's colour overrides
const PALETTE_PROPERTIES = [
    '--fg-color', '--comfy-menu-bg', '--comfy-menu-secondary-bg', '--comfy-input-bg', '--border-color',
    '--descrip-text', '--error-text', '--interface-stroke', '--secondary-background',
    '--secondary-background-hover', '--primary-background', '--border-default', '--base-background',
    '--mg-panel-fg', '--mg-panel-accent'
];

/**
 * A widget row as the Inspector computes it. Combo options are sent when an editor asks for them.
 */
export interface PopOutRow {
    label: string;
    widgetName?: string;
    widgetType?: string;
    /** Formatted for display */
    value: string;
    /** Primitive values only; an object value is shown but never edited */
    rawValue?: string | number | boolean | null;
    isEditable: boolean;
    isLinked: boolean;
    isActionable: boolean;
    constraints: { min?: number; max?: number; step?: number; round?: number; precision?: number };
}

/**
 * The shown node, how it came to be shown, and its rows, built by the Inspector.
 */
export interface PopOutInfo {
    node: {
        id: number;
        title: string;
        type: string;
        mode: string;
        execOrder?: number;
        graphPath: string[];
        group?: string;
        isSubgraph: boolean;
    } | null;
    nav: {
        source: 'hover' | 'locked' | 'sticky' | 'selection';
        locked: boolean;
        canBack: boolean;
        canForward: boolean;
        canEdit: boolean;
    };
    rows: PopOutRow[];
}

/** Messages on the session's channel, in both directions */
type PopOutMessage =
    | { type: 'ping' }
    | { type: 'pong' }
    | { type: 'close' }
    | { type: 'visibility'; data: boolean }
    | { type: 'frame'; data: Blob }
    | { type: 'config'; data: PopOutConfig }
    | { type: 'info'; data: PopOutInfo }
    | { type: 'nodes-list'; data: NodeListData }
    | { type: 'request-nodes'; data: NodeListData['sortBy'] }
    | { type: 'node-select'; data: number }
    | { type: 'panel-action'; data: { name: PanelAction; nodeId?: number } }
    | { type: 'widget-edit'; data: WidgetEditData }
    | { type: 'button-click'; data: WidgetRef }
    | { type: 'request-options'; data: WidgetRef }
    | { type: 'options'; data: WidgetRef & { options: unknown[] } };

const SESSION_KEY = 'magnifyglass-popout-session';

/**
 * PopOutManager class.
 * Handles opening, closing, and syncing with the viewer window of this tab's session.
 */
export class PopOutManager {
    private channel: BroadcastChannel | null = null;
    private isOpen: boolean = false;
    private popOutWindow: Window | null = null;
    public onStateChange: ((isOpen: boolean) => void) | null = null;
    // The Inspector owns the info and decides what the viewer may change
    public onNodeSelect: ((nodeId: number) => void) | null = null;
    public onWidgetEdit: ((data: WidgetEditData) => void) | null = null;
    public onButtonClick: ((data: WidgetRef) => void) | null = null;
    public onPanelAction: ((name: PanelAction, nodeId?: number) => void) | null = null;
    public onRequestOptions: ((data: WidgetRef) => unknown[]) | null = null;
    private pingInterval: number | null = null;
    // Pings since the last pong
    private pendingPings: number = 0;
    // Closed from here: an announcing viewer waits until open() is called again
    private dismissed: boolean = false;
    private viewerHidden: boolean = false;
    private session: string;
    private viewerUrl: string;
    // The config last sent to the viewer, null until it connects
    private sentConfig: string | null = null;
    private readonly onPageHide = () => {
        if (this.isOpen) this.sendMessage({ type: 'close' });
    };

    /** Throttle frame sending to ~30fps */
    private lastFrameTime: number = 0;
    private readonly FRAME_INTERVAL = 33; // ~30fps
    /** One frame is encoded at a time; a slow encode drops frames instead of queueing them */
    private frameInFlight: boolean = false;

    /** Unanswered pings, one a second, before the viewer counts as gone */
    private readonly PING_LIMIT = 5;

    constructor(private readonly getStatus: () => PopOutStatus, private readonly onConnect: () => void) {
        // sessionStorage survives a reload, so the viewer finds this tab again after F5
        this.session = sessionStorage.getItem(SESSION_KEY) ?? Math.random().toString(36).slice(2);
        sessionStorage.setItem(SESSION_KEY, this.session);
        this.viewerUrl = this.getViewerUrl();
        this.initChannel();
        window.addEventListener('pagehide', this.onPageHide);
    }

    /**
     * Get the URL for the pop-out viewer page, which sits at the web root next to this module's folder.
     */
    private getViewerUrl(): string {
        const url = new URL(/* @vite-ignore */ '../popout-viewer.html', import.meta.url);
        url.searchParams.set('v', __MAGNIFY_VERSION__);
        url.searchParams.set('session', this.session);
        return url.href;
    }

    /**
     * Open this session's BroadcastChannel; other ComfyUI tabs have their own.
     */
    private initChannel(): void {
        try {
            this.channel = new BroadcastChannel(`${BROADCAST_CHANNEL_NAME}:${this.session}`);
            this.channel.onmessage = (event: MessageEvent<PopOutMessage>) => {
                this.handleMessage(event.data);
            };
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
                // A pong answers a ping, or announces a viewer that is waiting for this tab
                this.pendingPings = 0;
                if (!this.isOpen && !this.dismissed) {
                    this.isOpen = true;
                    this.viewerHidden = false;
                    this.sentConfig = null;
                    this.startPing();
                    if (this.onStateChange) this.onStateChange(true);
                    this.onConnect();
                }
                if (this.isOpen) this.syncConfig();
                break;
            case 'close':
                // The viewer window closed or reloaded; a reloaded one announces itself again
                this.disconnect();
                break;
            case 'visibility':
                this.viewerHidden = message.data;
                break;
            case 'request-nodes':
                // Popout is requesting the node list for dropdown
                this.handleNodeListRequest(message.data);
                break;
            case 'node-select':
                this.onNodeSelect?.(message.data);
                break;
            case 'panel-action':
                this.onPanelAction?.(message.data.name, message.data.nodeId);
                break;
            case 'widget-edit':
                this.onWidgetEdit?.(message.data);
                break;
            case 'button-click':
                this.onButtonClick?.(message.data);
                break;
            case 'request-options':
                if (this.onRequestOptions) {
                    this.sendMessage({ type: 'options', data: { ...message.data, options: this.onRequestOptions(message.data) } });
                }
                break;
        }
    }

    /**
     * Open the pop-out viewer in a popup window.
     */
    open(): void {
        this.dismissed = false;

        if (this.isOpen) {
            this.popOutWindow?.focus();
            return;
        }

        // A named popup window: a tab would hide ComfyUI and pause its render loop.
        // Opening it moves a viewer from another tab to this session, or reloads a disconnected one.
        this.popOutWindow = window.open(this.viewerUrl, 'MagnifyGlassPopout', 'popup,width=1100,height=720');

        if (!this.popOutWindow) {
            Logger.error('[PopOut] Failed to open the viewer - popup may be blocked');
        }
    }

    /**
     * Close the pop-out viewer tab.
     */
    close(): void {
        // A window this tab is not connected to may now belong to another tab's session
        if (!this.isOpen) return;

        this.dismissed = true;
        this.sendMessage({ type: 'close' });
        // Without a handle, e.g. after a reload, the viewer stays and waits for open()
        this.popOutWindow?.close();
        this.popOutWindow = null;
        this.disconnect();
    }

    /**
     * Mark the viewer as gone. It announces itself again while it is alive.
     */
    private disconnect(): void {
        this.stopPing();
        if (!this.isOpen) return;
        this.isOpen = false;
        if (this.onStateChange) this.onStateChange(false);
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
     * Send a frame to the pop-out viewer as a PNG Blob, unless it is hidden.
     * Throttled to ~30fps for performance.
     * @param canvas - The source canvas to send
     */
    sendFrame(canvas: HTMLCanvasElement): void {
        if (!this.isOpen || this.viewerHidden || this.frameInFlight || !this.channel) return;

        // Throttle frame rate
        const now = Date.now();
        if (now - this.lastFrameTime < this.FRAME_INTERVAL) {
            return;
        }
        this.lastFrameTime = now;

        // The WebGL canvas keeps its drawing buffer, so encoding after this frame is safe
        this.frameInFlight = true;
        canvas.toBlob((blob) => {
            this.frameInFlight = false;
            if (blob && this.isOpen) this.sendMessage({ type: 'frame', data: blob });
        }, 'image/png');
    }

    /**
     * Send the palette and the glass and Inspector state when they change.
     */
    private syncConfig(): void {
        // Computed values resolve the palette's var() chains, which the viewer cannot see
        const style = getComputedStyle(document.body);
        const config: PopOutConfig = {
            ...this.getStatus(),
            palette: {
                scheme: document.body.classList.contains('dark-theme') ? 'dark' : 'light',
                fontFamily: style.fontFamily,
                fontSize: style.fontSize,
                properties: Object.fromEntries(PALETTE_PROPERTIES.map(name => [name, style.getPropertyValue(name).trim()]))
            }
        };
        const json = JSON.stringify(config);
        if (json === this.sentConfig) return;
        this.sentConfig = json;
        this.sendMessage({ type: 'config', data: config });
    }

    /**
     * Send the Inspector's info to the pop-out viewer.
     */
    sendInfo(info: PopOutInfo): void {
        if (!this.isOpen) return;
        this.sendMessage({ type: 'info', data: info });
    }

    /**
     * Handle node list request from popout viewer.
     * Fetches nodes from canvas and sends them to the popout.
     */
    private handleNodeListRequest(sortBy: 'title' | 'execOrder' | 'id'): void {
        if (!this.channel) return;

        try {
            // Access nodes from ComfyUI's app object
            const app = (window as any).app;
            const nodes = app?.canvas?.graph?._nodes || [];

            let nodeList: { id: number; title: string; type: string; order?: number }[];

            if (sortBy === 'execOrder') {
                nodeList = nodes
                    .map((n: any) => ({
                        id: n.id,
                        title: n.title || 'Untitled',
                        type: n.type || 'Unknown',
                        order: n.order ?? -1
                    }))
                    .filter((n: any) => n.order >= 0)
                    .sort((a: any, b: any) => a.order - b.order);
            } else if (sortBy === 'id') {
                nodeList = nodes
                    .map((n: any) => ({
                        id: n.id,
                        title: n.title || 'Untitled',
                        type: n.type || 'Unknown'
                    }))
                    .sort((a: any, b: any) => a.id - b.id);
            } else {
                nodeList = nodes
                    .map((n: any) => ({
                        id: n.id,
                        title: n.title || 'Untitled',
                        type: n.type || 'Unknown'
                    }))
                    .sort((a: any, b: any) => a.title.localeCompare(b.title));
            }

            this.sendMessage({
                type: 'nodes-list',
                data: { nodes: nodeList, sortBy }
            });

            Logger.debug(`[PopOut] Sent ${nodeList.length} nodes to viewer (sorted by ${sortBy})`);
        } catch (e) {
            Logger.error('[PopOut] Failed to get node list:', e);
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
     * Ping the viewer once a second while it is connected.
     */
    private startPing(): void {
        const ping = () => {
            // Count unanswered pings rather than time, so a throttled ComfyUI tab that pings late keeps its viewer
            if (++this.pendingPings > this.PING_LIMIT) {
                Logger.debug('[PopOut] Connection timeout, marking as closed');
                this.disconnect();
                return;
            }
            this.sendMessage({ type: 'ping' });
        };

        this.stopPing();
        this.pendingPings = 0;
        ping();
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
        window.removeEventListener('pagehide', this.onPageHide);
        if (this.channel) {
            this.channel.close();
            this.channel = null;
        }
        Logger.debug('[PopOut] Cleaned up');
    }
}
