/**
 * ComfyUI Type Definitions
 * 
 * Type definitions for ComfyUI's app, canvas, and graph APIs.
 * These types are based on the runtime behavior of ComfyUI.
 */

import type { InfoPanel } from '../info-panel/InfoPanel';

// ============================================================================
// ComfyUI App
// ============================================================================

export interface ComfyApp {
    graph: ComfyGraph;
    canvas: ComfyCanvas;
    ui: ComfyUI;
    extensionManager: ComfyExtensionManager;
    registerExtension(extension: ComfyExtension): void;
}

export interface ComfyExtension {
    name: string;
    setup?: () => Promise<void> | void;
    init?: () => Promise<void> | void;
    afterConfigureGraph?: () => Promise<void> | void;
    commands?: ComfyCommand[];
    keybindings?: ComfyKeybinding[];
    menuCommands?: ComfyMenuCommand[];
    settings?: ComfySetting[];
    bottomPanelTabs?: ComfyBottomPanelTab[];
    aboutPageBadges?: ComfyBadge[];
    getSelectionToolboxCommands?: (selectedItem: unknown) => string[];
}

export interface ComfyCommand {
    id: string;
    label?: string;
    icon?: string;
    function: () => void;
}

export interface ComfyKeybinding {
    combo: {
        key: string;
        alt?: boolean;
        ctrl?: boolean;
        shift?: boolean;
        meta?: boolean;
    };
    commandId: string;
}

export interface ComfyMenuCommand {
    path: string[];
    commands: string[];
}

export interface ComfySetting {
    id: string;
    name: string;
    type: 'text' | 'number' | 'slider' | 'combo' | 'color' | 'boolean';
    defaultValue: unknown;
    min?: number;
    max?: number;
    step?: number;
    options?: Array<{ value: unknown; text: string }>;
    tooltip?: string;
    onChange?: (value: unknown) => void;
}

export interface ComfyBottomPanelTab {
    id: string;
    title: string;
    type: 'custom';
    render: (el: HTMLElement) => void;
}

export interface ComfyBadge {
    label: string;
    url: string;
    icon: string;
}

// ============================================================================
// ComfyUI UI
// ============================================================================

export interface ComfyUI {
    settings: ComfySettings;
}

export interface ComfySettings {
    addSetting(setting: ComfySetting): void;
    getSettingValue(id: string): unknown;
    setSettingValue(id: string, value: unknown): void;
}

// ============================================================================
// ComfyUI Extension Manager
// ============================================================================

export interface ComfyExtensionManager {
    setting: {
        get(id: string): unknown;
        set(id: string, value: unknown): void;
    };
    toast: ComfyToast;
    dialog: ComfyDialog;
    registerSidebarTab(tab: ComfySidebarTab): void;
}

export interface ComfySidebarTab {
    id: string;
    icon: string;
    title: string;
    tooltip: string;
    type: 'custom';
    render: (el: HTMLElement) => void;
}

export interface ComfyToast {
    add(options: ComfyToastOptions): void;
    addAlert(message: string): void;
}

export interface ComfyToastOptions {
    severity: 'success' | 'info' | 'warn' | 'error';
    summary: string;
    detail: string;
    life?: number;
}

export interface ComfyDialog {
    prompt(options: { title: string; message: string }): Promise<string>;
    confirm(options: { title: string; message: string }): Promise<boolean>;
}

// ============================================================================
// ComfyUI Graph
// ============================================================================

export interface ComfyGraph {
    _nodes: ComfyNode[];
    /** The graph itself for the root graph; set on subgraphs */
    rootGraph: ComfyGraph;
    /** Subgraphs only */
    name?: string;
    getNodeById(id: number): ComfyNode | null;
    getNodeOnPos(x: number, y: number): ComfyNode | null;
    getGroupOnPos(x: number, y: number): { title: string } | undefined;
}

export interface ComfyNode {
    id: number;
    title: string;
    type: string;
    mode: number;
    pos: [number, number];
    size: [number, number];
    flags?: {
        collapsed?: boolean;
    };
    widgets?: ComfyWidget[];
    inputs?: ComfySlot[];
    outputs?: ComfySlot[];
    properties?: Record<string, unknown>;
    graph?: ComfyGraph;
    /** Subgraph nodes only */
    subgraph?: ComfyGraph;
    isSubgraphNode?(): boolean;
}

export interface ComfyWidget {
    name: string;
    type: string;
    value: unknown;
    options?: Record<string, unknown>;
    min?: number;
    max?: number;
    step?: number;
}

export interface ComfySlot {
    name: string;
    type: string;
    link?: number | null;
    links?: number[];
}

// ============================================================================
// ComfyUI Canvas
// ============================================================================

export interface ComfyCanvas {
    canvas: HTMLCanvasElement;
    graph: ComfyGraph | null;
    ds: {
        scale: number;
        offset: [number, number];
    };
    node_over: ComfyNode | null;
    /** True in pan mode: space held or the hand tool */
    read_only: boolean;
    selected_nodes: Record<string, ComfyNode>;
    convertOffsetToCanvasPos?(pos: [number, number]): [number, number];
    centerOnNode(node: ComfyNode): void;
    openSubgraph(subgraph: ComfyGraph, fromNode: ComfyNode): void;
}

// ============================================================================
// Global Window Extensions
// ============================================================================

declare global {
    interface Window {
        comfyUIMagnifyGlass?: MagnifyGlassInstance;
        comfyUIMagnifyGlassExtensions?: InfoPanel[];
        infoPanelManager?: InfoPanel;
    }

    var app: ComfyApp;
    /** package.json's version, set by vite at build time */
    const __MAGNIFY_VERSION__: string;
}

export interface MagnifyGlassInstance {
    state: MagnifyGlassState;
    config: MagnifyGlassConfig;
    ui: MagnifyGlassUI;
    renderer: MagnifyGlassRenderer | null;
    popOutManager?: {
        isPopOutOpen(): boolean;
        sendInfo(info: unknown): void;
        toggle(): void;
        onStateChange?: ((isOpen: boolean) => void) | null;
        onNodeSelect?: ((nodeId: number) => void) | null;
        onWidgetEdit?: (() => void) | null;
    };
    lastKnownMousePosition: { x: number; y: number };
    updateMagnifiedView(): void;
    applyUiChanges(): void;
    toggle(): void;
    resetOffsets(): void;
    setGlassPreviewActive(visible: boolean): void;
}

export interface MagnifyGlassState {
    active: boolean;
    x: number;
    y: number;
    sourceX: number;
    sourceY: number;
    sourceWidth: number;
    sourceHeight: number;
    canvasScale: number;
    canvasOffsetX: number;
    canvasOffsetY: number;
}

export interface MagnifyGlassConfig {
    zoomFactor: number;
    glassSize: number;
    borderColor: string;
    borderWidth: number;
    borderEnabled: boolean;
    activationKey: string;
    altRequired: boolean;
    followCursor: boolean;
    offsetStep: number;
    offsetX: number;
    offsetY: number;
    glassPosition: string;
    glassShape: string;
    resetKey: string;
    textureFiltering: string;
    alwaysActiveMode: boolean;
    toggleFollowCursorKey: string;
}

export interface MagnifyGlassUI {
    glassDiv: HTMLDivElement | null;
    show(): void;
    hide(): void;
    positionGlass(x: number, y: number): void;
}

export interface MagnifyGlassRenderer {
    updateTextureFiltering(filtering: string): void;
}

// ============================================================================
// Info Panel Types
// ============================================================================

/**
 * Information gathered about the current cursor position.
 * Returned by InformationGatherer.gatherInformation()
 */
export interface GatheredInfo {
    cursor: {
        canvasX: number;
        canvasY: number;
    };
    zoom: number;
    hoveredNode: NodeInfo | null;
}

/**
 * Detailed information about a node.
 * Structure matches InformationGatherer.getDetailedNodeInfo() output.
 */
export interface NodeInfo {
    id: number;
    title: string;
    type: string;
    mode: string;
    position: {
        x: number;
        y: number;
    };
    size: {
        width: number;
        height: number;
    };
    widgets: ComfyWidget[];
    inputs: ComfyInput[];
    outputs: ComfyOutput[];
    properties: Record<string, unknown>;
    executionOrder?: number;
    category?: string;
    pythonModule?: string;
    /** Names of the subgraphs from the root down to the node's graph */
    graphPath: string[];
    group?: string;
    isSubgraph: boolean;
}

export { };

