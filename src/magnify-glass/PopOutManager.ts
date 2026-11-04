/**
 * ComfyUI MagnifyGlass - PopOutManager (TypeScript)
 * 
 * Manages pop-out tab functionality for multi-monitor viewing.
 * Uses BroadcastChannel API for efficient cross-tab communication.
 */

import { BROADCAST_CHANNEL_NAME } from '../shared/constants';
import { Logger } from '../shared/logger';
import { WidgetSyncManager } from '../info-panel/widget-editors/WidgetSyncManager';

/**
 * Widget edit command data from pop-out viewer
 */
interface WidgetEditData {
    nodeId: number;
    widgetName: string;
    value: unknown;
}

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
}

interface PopOutConfig extends PopOutStatus {
    theme: 'dark' | 'light';
}

/**
 * Inspector info data structure for pop-out viewer
 */
interface PopOutInfo {
    hoveredNode?: {
        title: string;
        type: string;
        id?: number;
        mode?: string | number;
        pos?: { x: number; y: number } | string;
        size?: { w: number; h: number } | string;
        executionOrder?: number;
        category?: string;
        pythonModule?: string;
        widgets?: any[];
        inputs?: any[];
        outputs?: any[];
        properties?: Record<string, unknown>;
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
}

/** Messages on the session's channel, in both directions */
type PopOutMessage =
    | { type: 'ping' }
    | { type: 'pong' }
    | { type: 'close' }
    | { type: 'visibility'; data: boolean }
    | { type: 'frame'; data: string }
    | { type: 'config'; data: PopOutConfig }
    | { type: 'info'; data?: PopOutInfo }
    | { type: 'nodes-list'; data: NodeListData }
    | { type: 'request-nodes'; data: NodeListData['sortBy'] }
    | { type: 'node-select'; data: number }
    | { type: 'zoom-node'; data: number }
    | { type: 'widget-edit'; data: WidgetEditData }
    | { type: 'button-click'; data: { nodeId: number; widgetName: string } };

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
    public onNodeSelect: ((nodeId: number) => void) | null = null;
    public onWidgetEdit: (() => void) | null = null;
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
                // Popout selected a node, notify main window
                if (this.onNodeSelect && typeof message.data === 'number') {
                    this.onNodeSelect(message.data);
                }
                break;
            case 'zoom-node':
                // Popout requested to zoom to a node
                if (typeof message.data === 'number') {
                    const app = (window as any).app;
                    const node = app.canvas?.graph?.getNodeById(message.data);
                    if (node) {
                        app.canvas.centerOnNode(node);
                    }
                }
                break;
            case 'widget-edit':
                // Popout is sending a widget value edit
                this.handleWidgetEdit(message.data);
                break;
            case 'button-click':
                // Popout is requesting a button widget callback invocation
                this.handleButtonClick(message.data);
                break;
        }
    }

    /**
     * Handle widget edit command from pop-out viewer.
     * Syncs the edit to the actual node widget on the canvas.
     */
    private handleWidgetEdit(editData: WidgetEditData): void {
        if (!editData || typeof editData.nodeId !== 'number' || !editData.widgetName) {
            Logger.warn('[PopOut] Invalid widget edit data:', editData);
            return;
        }

        const result = WidgetSyncManager.syncWidgetValue(
            editData.nodeId,
            editData.widgetName,
            editData.value
        );

        if (result.success) {
            Logger.debug(`[PopOut] Widget edit synced: ${editData.widgetName} = ${editData.value}`);
            // Notify listeners (InfoPanel) that a widget was edited, to force an immediate refresh
            if (this.onWidgetEdit) {
                this.onWidgetEdit();
            }
        } else {
            Logger.warn(`[PopOut] Widget edit failed: ${result.error}`);
        }
    }

    /**
     * Handle button click command from pop-out viewer.
     * Invokes the widget's callback function.
     */
    private handleButtonClick(buttonData: { nodeId: number; widgetName: string }): void {
        if (!buttonData || typeof buttonData.nodeId !== 'number' || !buttonData.widgetName) {
            Logger.warn('[PopOut] Invalid button click data:', buttonData);
            return;
        }

        const app = (window as any).app;
        const node = app?.canvas?.graph?.getNodeById(buttonData.nodeId);
        if (!node?.widgets) {
            Logger.warn(`[PopOut] Node ${buttonData.nodeId} not found or has no widgets`);
            return;
        }

        const widget = node.widgets.find((w: any) => w.name === buttonData.widgetName);
        if (widget && typeof widget.callback === 'function') {
            try {
                widget.callback(widget.value, app.canvas, node, [0, 0], null);
                Logger.debug(`[PopOut] Button ${buttonData.widgetName} clicked successfully`);
            } catch (error) {
                Logger.warn(`[PopOut] Button callback failed:`, error);
            }
        } else {
            Logger.warn(`[PopOut] Widget ${buttonData.widgetName} not found or has no callback`);
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
     * Send a frame to the pop-out viewer, unless it is hidden.
     * Throttled to ~30fps for performance.
     * @param canvas - The source canvas to send
     */
    sendFrame(canvas: HTMLCanvasElement): void {
        if (!this.isOpen || this.viewerHidden || !this.channel) return;

        // Throttle frame rate
        const now = Date.now();
        if (now - this.lastFrameTime < this.FRAME_INTERVAL) {
            return;
        }
        this.lastFrameTime = now;

        try {
            // Convert canvas to data URL (efficient for small canvases)
            this.sendMessage({ type: 'frame', data: canvas.toDataURL('image/png') });
        } catch (e) {
            Logger.error('[PopOut] Failed to send frame:', e);
        }
    }

    /**
     * Send the theme and the glass and Inspector state when they change.
     */
    private syncConfig(): void {
        // The viewer follows the palette's light or dark, which the frontend keeps as body.dark-theme
        const config: PopOutConfig = {
            theme: document.body.classList.contains('dark-theme') ? 'dark' : 'light',
            ...this.getStatus()
        };
        const json = JSON.stringify(config);
        if (json === this.sentConfig) return;
        this.sentConfig = json;
        this.sendMessage({ type: 'config', data: config });
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
                    id: info.hoveredNode.id,
                    mode: info.hoveredNode.mode,
                    executionOrder: info.hoveredNode.executionOrder,
                    category: info.hoveredNode.category ? String(info.hoveredNode.category) : undefined,
                    pythonModule: info.hoveredNode.pythonModule ? String(info.hoveredNode.pythonModule) : undefined,
                    // Map formatting or raw values
                    pos: info.hoveredNode.position && typeof info.hoveredNode.position === 'object'
                        ? { x: info.hoveredNode.position.x, y: info.hoveredNode.position.y }
                        : String(info.hoveredNode.position || ''),
                    size: info.hoveredNode.size && typeof info.hoveredNode.size === 'object'
                        ? { w: info.hoveredNode.size.width, h: info.hoveredNode.size.height }
                        : String(info.hoveredNode.size || ''),
                    widgets: this.extractSafeData(info.hoveredNode.widgets),
                    inputs: this.extractSafeData(info.hoveredNode.inputs),
                    outputs: this.extractSafeData(info.hoveredNode.outputs),
                    properties: this.sanitizeOptions(info.hoveredNode.properties) || {}
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

            return sanitized;
        } catch (e) {
            Logger.error('[PopOut] Failed to sanitize info:', e);
            return null;
        }
    }

    /**
     * Extract specific safe fields from node lists (widgets, inputs, outputs).
     * Removes functions like onFloatValueChange which cause cloning errors.
     */
    private extractSafeData(list: any[] | undefined): any[] {
        if (!list || !Array.isArray(list)) return [];
        return list.map(item => {
            if (!item || typeof item !== 'object') return {};

            // Only extract known safe identifiers and values
            const safeItem: any = {
                name: item.name,
                type: item.type,
                label: item.label
            };

            // Safely copy value if it's not a function
            if (item.value !== undefined && typeof item.value !== 'function') {
                safeItem.value = item.value;
            }

            // Handle widget options - preserve arrays for combo dropdowns
            if (item.options !== undefined) {
                if (Array.isArray(item.options)) {
                    // For combo widgets, options is an array of values - keep it as is
                    safeItem.options = item.options.filter(
                        (opt: any) => typeof opt !== 'function'
                    );
                } else if (typeof item.options === 'object' && item.options !== null) {
                    // Check for options.values (ComfyUI nested format for combo widgets)
                    if (Array.isArray(item.options.values)) {
                        safeItem.options = item.options.values.filter(
                            (opt: any) => typeof opt !== 'function'
                        );
                    } else {
                        // For other widgets, options is an object with config (min, max, step, etc)
                        safeItem.options = this.sanitizeOptions(item.options);
                    }
                }
            }

            return safeItem;
        });
    }

    /**
     * Shallow copy object removing functions.
     */
    private sanitizeOptions(options: any): any {
        if (!options || typeof options !== 'object') return {};
        const clean: any = {};
        for (const key in options) {
            const val = options[key];
            if (typeof val !== 'function' && !key.startsWith('_')) {
                // Determine if value is simple enough to copy
                if (typeof val === 'object' && val !== null) {
                    try {
                        // Simple check if it's a plain object/array without cycles
                        JSON.stringify(val);
                        clean[key] = val;
                    } catch (e) {
                        // Skip complex objects
                    }
                } else {
                    clean[key] = val;
                }
            }
        }
        return clean;
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
