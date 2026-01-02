/**
 * ComfyUI Type Definitions
 * 
 * Type definitions for ComfyUI's app, canvas, and graph APIs.
 * These types are based on the runtime behavior of ComfyUI.
 */

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
    getNodeById(id: number): ComfyNode | null;
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
    ds: {
        scale: number;
        offset: [number, number];
    };
    node_over: ComfyNode | null;
    convertOffsetToCanvasPos?(pos: [number, number]): [number, number];
}

// ============================================================================
// Global Window Extensions
// ============================================================================

declare global {
    interface Window {
        comfyUIMagnifyGlass?: MagnifyGlassInstance;
        magnifyGlass?: MagnifyGlassInstance; // Alias used by info panel controls
        comfyUIMagnifyGlassExtensions?: unknown[];
        infoPanelManager?: { uiManager?: { updateTheme: (theme: string) => void } };
    }

    var app: ComfyApp;
}

export interface MagnifyGlassInstance {
    state: MagnifyGlassState;
    config: MagnifyGlassConfig;
    ui: MagnifyGlassUI;
    renderer: MagnifyGlassRenderer | null;
    lastKnownMousePosition: { x: number; y: number };
    isOverMedia: boolean;
    currentMediaElement: HTMLImageElement | HTMLVideoElement | null;
    updateMagnifiedView(): void;
    applyUiChanges(): void;
    toggle(): void;
    resetOffsets(): void;
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
    debugMode: boolean;
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
    timestamp: number;
    cursor: {
        screenX: number;
        screenY: number;
        canvasX: number;
        canvasY: number;
    };
    zoom: number;
    nodeCount: number;
    hoveredNode: NodeInfo | null;
    hoveredWidget: WidgetInfo | null;
    mediaElement: MediaInfo | null;
}

/**
 * Detailed information about a node.
 * Structure matches InformationGatherer.getDetailedNodeInfo() output.
 */
export interface NodeInfo {
    id: number;
    title: string;
    type: string;
    mode: string | number;
    position: {
        x: number;
        y: number;
        formatted?: string;
    } | string;
    size: {
        width: number;
        height: number;
        formatted?: string;
    } | string;
    localPosition?: {
        x: number;
        y: number;
        formatted?: string;
        percentage?: { x: string; y: string };
    };
    counts?: {
        widgets: number;
        inputs: number;
        outputs: number;
        properties: number;
    };
    widgets: ComfyWidget[];
    inputs: ComfyInput[];
    outputs: ComfyOutput[];
    properties: Record<string, unknown>;
    hoverRegion?: string;
    executionOrder?: number;
    author?: string;
    category?: string;
    pythonModule?: string;
}

/**
 * Information about a widget.
 */
export interface WidgetInfo {
    name: string;
    type: string;
    value: string;
    options?: unknown;
    min?: number;
    max?: number;
    step?: number;
}

/**
 * Information about a media element (image or video).
 */
export interface MediaInfo {
    type: 'image' | 'video';
    tagName: string;
    src: string;
    naturalWidth: number;
    naturalHeight: number;
    displayWidth: number;
    displayHeight: number;
    aspectRatio: string;
    duration?: number;
    currentTime?: number;
}

/**
 * A section in the info panel display.
 */
export interface SectionData {
    id: string;
    title: string;
    icon: string;
    visible: boolean;
    expanded: boolean;
    content: ParameterItem[];
}

/**
 * A parameter item displayed in a section.
 */
export interface ParameterItem {
    label: string;
    value: unknown;
    formattedValue?: string;
    highlight?: boolean;
}

/**
 * Settings change tracking.
 */
export interface SettingsChange {
    old: unknown;
    new: unknown;
}

export { };

