/**
 * ComfyUI MagnifyGlass - PopOutManager (TypeScript)
 * 
 * Manages pop-out tab functionality for multi-monitor viewing.
 * Uses BroadcastChannel API for efficient cross-tab communication.
 */

import { BROADCAST_CHANNEL_NAME } from '../shared/constants';
import { Logger } from '../shared/logger';
import type { NodeListEntry } from '../info-panel/NodeSelector';
import type { SlotLinks } from '../info-panel/NodeDataExtractor';
import type { ComfyApp, ComfyGraph, ComfyNode } from '../types/comfyui';

declare const app: ComfyApp;

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

/** Inspector navigation the viewer may ask for, for the node it shows */
export type PanelAction = 'back' | 'forward' | 'prev-node' | 'next-node' | 'focus-node' | 'lock-node' | 'enter-subgraph';

/** Go to node picker results, with the query they answer */
interface NodeListData {
    query: string;
    nodes: NodeListEntry[];
}

export interface PopOutStatus {
    glass: 'on' | 'hidden' | 'off';
    inspector: boolean;
    reduceMotion: boolean;
    /** The glass zoom, in percent */
    zoom: number;
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
    /** Why the last queued prompt failed validation on this input */
    error?: string;
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
        executionId: string;
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
    /** The node's images as /view or blob URLs: its live previews while it runs, otherwise its last results */
    outputs: string[];
    /** The node's slots and the nodes they link to, which the viewer jumps to with node-select */
    links: { inputs: SlotLinks[]; outputs: SlotLinks[] };
}

/**
 * The queue and the prompt running, reduced from ComfyUI's execution events.
 * Nodes are named by execution id, as NodeInfo.executionId.
 */
export interface PopOutRun {
    /** Prompts waiting or running */
    queue: number;
    /** The running node, null between nodes and prompts */
    nodeId: string | null;
    title: string;
    value: number;
    max: number;
    /** The running prompt's nodes that came from the cache, or that ran */
    cached: string[];
    done: string[];
    /** The last prompt's error, until the next prompt starts */
    error: { nodeId: string; title: string; type: string; message: string; traceback: string } | null;
    /** Whether the workflow tab on screen is the one the ids belong to; another tab's nodes get no badges */
    here: boolean;
}

// The execution events the viewer shows, listened to while it is connected
const RUN_EVENTS = [
    'status', 'execution_start', 'executing', 'progress', 'progress_state', 'execution_cached',
    'executed', 'execution_success', 'execution_error', 'execution_interrupted'
];

/** Messages on the session's channel, in both directions */
type PopOutMessage =
    | { type: 'ping' }
    | { type: 'pong' }
    | { type: 'claim'; data: string }
    | { type: 'claimed'; data: string }
    | { type: 'close' }
    | { type: 'visibility'; data: boolean }
    | { type: 'zoom'; data: number }
    | { type: 'config'; data: PopOutConfig }
    | { type: 'info'; data: PopOutInfo }
    | { type: 'run'; data: PopOutRun }
    | { type: 'run-node-select'; data: string }
    | { type: 'nodes-list'; data: NodeListData }
    | { type: 'search-nodes'; data: string }
    | { type: 'node-select'; data: number }
    | { type: 'panel-action'; data: { name: PanelAction; nodeId: number | null } }
    | { type: 'widget-edit'; data: WidgetEditData }
    | { type: 'button-click'; data: WidgetRef }
    | { type: 'request-options'; data: WidgetRef }
    | { type: 'options'; data: WidgetRef & { options: unknown[] } };

const SESSION_KEY = 'magnifyglass-popout-session';

// Posted by the viewer to the window that opened it, with its session
const VIEWER_WINDOW_MESSAGE = 'magnifyglass-viewer-window';

/** The viewer's window; it draws the glass's frames itself once loaded */
type ViewerWindow = Window & { drawFrame?: (source: CanvasImageSource) => void };

/**
 * PopOutManager class.
 * Handles opening, closing, and syncing with the viewer window of this tab's session.
 */
export class PopOutManager {
    private channel: BroadcastChannel | null = null;
    private isOpen: boolean = false;
    private popOutWindow: ViewerWindow | null = null;
    public onStateChange: ((isOpen: boolean) => void) | null = null;
    // The Inspector owns the info and decides what the viewer may change
    public onNodeSelect: ((nodeId: number) => void) | null = null;
    public onWidgetEdit: ((data: WidgetEditData) => void) | null = null;
    public onButtonClick: ((data: WidgetRef) => void) | null = null;
    public onPanelAction: ((name: PanelAction, nodeId: number | null) => void) | null = null;
    public onRequestOptions: ((data: WidgetRef) => unknown[]) | null = null;
    public onSearchNodes: ((query: string) => NodeListData['nodes']) | null = null;
    private pingInterval: number | null = null;
    // Pings since the last pong
    private pendingPings: number = 0;
    // Closed from here: an announcing viewer waits until open() is called again
    private dismissed: boolean = false;
    private viewerHidden: boolean = false;
    private session: string = '';
    private viewerUrl: string = '';
    // Names this tab's claim on its session, which a tab already on it answers
    private readonly claimId = Math.random().toString(36).slice(2);
    // The config last sent to the viewer, null until it connects
    private sentConfig: string | null = null;
    private readonly onPageHide = () => {
        if (this.isOpen) this.sendMessage({ type: 'close' });
    };
    private run: PopOutRun = PopOutManager.idleRun(0);
    // The workflow tab on screen when the prompt started; the run's ids name other nodes in any other tab
    private runWorkflow: object | null = null;
    // Execution events can come many times a second; the viewer gets their result at most every 100 ms
    private runTimer: number | null = null;
    private readonly onRunEvent = (event: Event) => {
        this.reduceRun(event.type, (event as CustomEvent).detail);
        this.runTimer ??= window.setTimeout(() => {
            this.runTimer = null;
            this.sendRun();
        }, 100);
    };

    // The viewer announces its window to this tab's window, which opened it, so a reload here gets the handle back
    private readonly onViewerWindow = (event: MessageEvent) => {
        if (event.origin === location.origin && event.data?.type === VIEWER_WINDOW_MESSAGE && event.data.session === this.session) {
            this.popOutWindow = event.source as ViewerWindow;
        }
    };

    /** Unanswered pings, one a second, before the viewer counts as gone */
    private readonly PING_LIMIT = 5;

    constructor(
        private readonly getStatus: () => PopOutStatus,
        private readonly onConnect: () => void,
        private readonly onZoom: (zoom: number) => void
    ) {
        // sessionStorage survives a reload, so the viewer finds this tab again after F5
        this.useSession(sessionStorage.getItem(SESSION_KEY) ?? undefined);
        window.addEventListener('pagehide', this.onPageHide);
        window.addEventListener('message', this.onViewerWindow);
    }

    /**
     * Pair with the viewer of a session, a new one by default.
     */
    private useSession(session = Math.random().toString(36).slice(2)): void {
        this.session = session;
        sessionStorage.setItem(SESSION_KEY, session);
        this.viewerUrl = this.getViewerUrl();
    }

    /**
     * Listen for this session's viewer, once ComfyUI is set up: a viewer left open over a reload announces itself at once.
     */
    listen(): void {
        this.initChannel();
        // A duplicated tab copies sessionStorage; the tab already on the session tells it to start its own
        this.sendMessage({ type: 'claim', data: this.claimId });
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
        // A viewer only announces itself until it is connected; requests from a disconnected one change nothing
        if (!this.isOpen && message.type !== 'pong' && message.type !== 'claim' && message.type !== 'claimed') return;
        switch (message.type) {
            case 'claim':
                this.sendMessage({ type: 'claimed', data: message.data });
                break;
            case 'claimed':
                if (message.data !== this.claimId) break;
                this.disconnect();
                this.channel?.close();
                this.useSession();
                this.initChannel();
                break;
            case 'pong':
                // A pong answers a ping, or announces a viewer that is waiting for this tab
                this.pendingPings = 0;
                if (!this.isOpen && !this.dismissed) {
                    this.isOpen = true;
                    this.viewerHidden = false;
                    this.sentConfig = null;
                    this.startPing();
                    // The events missed while disconnected are gone; the queue size is kept by ComfyUI
                    this.run = PopOutManager.idleRun(app.ui.lastQueueSize ?? 0);
                    this.runWorkflow = app.extensionManager.workflow.activeWorkflow;
                    this.sendRun();
                    for (const name of RUN_EVENTS) app.api.addEventListener(name, this.onRunEvent);
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
                // The render loop stops while nothing shows the glass
                if (!this.viewerHidden) this.onConnect();
                break;
            case 'zoom':
                this.onZoom(message.data);
                // The setting applies at once; the viewer need not wait for the next pong to show it
                this.syncConfig();
                break;
            case 'search-nodes':
                if (this.onSearchNodes) {
                    this.sendMessage({ type: 'nodes-list', data: { query: message.data, nodes: this.onSearchNodes(message.data) } });
                }
                break;
            case 'node-select':
                this.onNodeSelect?.(message.data);
                break;
            case 'run-node-select': {
                // Only a node of the graph on screen; its id means another node in any other graph
                const node = this.runNode(message.data);
                if (node && node.graph === app.canvas?.graph) this.onNodeSelect?.(node.id);
                break;
            }
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
        for (const name of RUN_EVENTS) app.api.removeEventListener(name, this.onRunEvent);
        if (this.runTimer !== null) {
            clearTimeout(this.runTimer);
            this.runTimer = null;
        }
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
     * Whether the viewer shows the glass's frames.
     */
    wantsFrames(): boolean {
        return this.isOpen && !this.viewerHidden;
    }

    /**
     * Draw the glass's frame into the viewer, unless it is hidden. The viewer is a same-origin
     * window, so the copy happens in this animation frame, with no encoding or messaging.
     * @param canvas - The glass canvas, just rendered
     */
    sendFrame(canvas: HTMLCanvasElement): void {
        if (this.wantsFrames()) this.popOutWindow?.drawFrame?.(canvas);
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
        // Switching workflow tabs changes the info; the badges follow with it
        if (this.runIsHere() !== this.run.here) this.sendRun();
        this.sendMessage({ type: 'info', data: info });
    }

    private sendRun(): void {
        this.run.here = this.runIsHere();
        this.sendMessage({ type: 'run', data: this.run });
    }

    private runIsHere(): boolean {
        return app.extensionManager.workflow.activeWorkflow === this.runWorkflow;
    }

    private static idleRun(queue: number): PopOutRun {
        return { queue, nodeId: null, title: '', value: 0, max: 0, cached: [], done: [], error: null, here: true };
    }

    /**
     * Apply one of ComfyUI's execution events to the run the viewer shows.
     */
    private reduceRun(type: string, detail: any): void {
        const run = this.run;
        switch (type) {
            case 'status':
                run.queue = detail?.exec_info.queue_remaining ?? 0;
                break;
            case 'execution_start':
                this.run = PopOutManager.idleRun(run.queue);
                this.runWorkflow = app.extensionManager.workflow.activeWorkflow;
                break;
            case 'executing':
                // The display id of the node starting; null when the prompt is done
                this.setRunNode(detail === null ? null : String(detail));
                break;
            case 'progress':
                run.value = detail.value;
                run.max = detail.max;
                break;
            case 'progress_state': {
                // Every node's state, keyed by execution id; the running node's progress, or the running node after a reconnect
                const nodes: Record<string, { state: string; value: number; max: number; display_node_id?: string; node_id: string }> = detail.nodes;
                const state = run.nodeId !== null ? nodes[run.nodeId] : Object.values(nodes).find(node => node.state === 'running');
                if (!state) break;
                if (run.nodeId === null) this.setRunNode(state.display_node_id || state.node_id);
                run.value = state.value;
                run.max = state.max;
                break;
            }
            case 'execution_cached':
                run.cached.push(...detail.nodes.map(String));
                break;
            case 'executed': {
                const id = String(detail.display_node || detail.node);
                if (!run.done.includes(id)) run.done.push(id);
                break;
            }
            case 'execution_error': {
                const nodeId = String(detail.node_id);
                run.error = {
                    nodeId,
                    title: this.runNode(nodeId)?.title ?? '',
                    type: detail.node_type,
                    message: detail.exception_message,
                    traceback: detail.traceback.join('')
                };
                this.setRunNode(null);
                break;
            }
            case 'execution_success':
                this.setRunNode(null);
                break;
            case 'execution_interrupted':
                // The node stopped part-way did not finish
                run.nodeId = null;
                this.setRunNode(null);
                break;
        }
    }

    /**
     * Start showing a node as running; the one running before is done.
     */
    private setRunNode(nodeId: string | null): void {
        const run = this.run;
        if (run.nodeId !== null && !run.done.includes(run.nodeId)) run.done.push(run.nodeId);
        run.nodeId = nodeId;
        run.title = nodeId === null ? '' : this.runNode(nodeId)?.title ?? '';
        run.value = 0;
        run.max = 0;
    }

    /**
     * The node an execution id names, found from the root graph through the subgraph nodes it is in.
     * None while another workflow tab is on screen than the one the prompt started in.
     */
    private runNode(executionId: string): ComfyNode | null {
        if (!this.runIsHere()) return null;
        let graph: ComfyGraph | undefined = app.graph;
        let node: ComfyNode | null = null;
        for (const id of executionId.split(':')) {
            node = graph?.getNodeById(Number(id)) ?? null;
            graph = node?.subgraph;
        }
        return node;
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
        window.removeEventListener('message', this.onViewerWindow);
        if (this.channel) {
            this.channel.close();
            this.channel = null;
        }
        Logger.debug('[PopOut] Cleaned up');
    }
}
