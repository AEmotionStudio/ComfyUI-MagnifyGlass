/**
 * ComfyUI MagnifyGlass - Sidebar Inspector Panel
 * 
 * Real-time inspector view for the sidebar.
 */

// @ts-ignore
import { app } from "/scripts/app.js";

/**
 * Icons for the inspector panel
 */
const Icons = {
    chevronDown: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
};

/**
 * Inspector state
 */
interface InspectorState {
    cursor: { x: number; y: number };
    canvasScale: number;
    hoveredNode: any | null;
}

let inspectorState: InspectorState = {
    cursor: { x: 0, y: 0 },
    canvasScale: 1,
    hoveredNode: null
};

let inspectorBody: HTMLElement | null = null;
let updateInterval: number | null = null;

/**
 * Format a number for display
 */
function formatNumber(value: number, decimals: number = 0): string {
    return value.toFixed(decimals);
}

/**
 * Get the currently hovered node from the graph
 */
function getHoveredNode(): any | null {
    try {
        const graph = app.graph;
        if (!graph || !graph.canvas) return null;

        const canvas = graph.canvas;
        const mousePos = canvas.graph_mouse;

        if (!mousePos) return null;

        // Find node at mouse position
        const nodes = graph._nodes;
        for (let i = nodes.length - 1; i >= 0; i--) {
            const node = nodes[i];
            if (node.pos && node.size) {
                const [x, y] = node.pos;
                const [w, h] = node.size;
                if (mousePos[0] >= x && mousePos[0] <= x + w &&
                    mousePos[1] >= y && mousePos[1] <= y + h) {
                    return node;
                }
            }
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Get canvas information
 */
function getCanvasInfo(): { scale: number; cursor: { x: number; y: number } } {
    try {
        const graph = app.graph;
        if (!graph || !graph.canvas) {
            return { scale: 1, cursor: { x: 0, y: 0 } };
        }

        const canvas = graph.canvas;
        const scale = canvas.ds?.scale || 1;
        const mousePos = canvas.graph_mouse || [0, 0];

        return {
            scale: scale * 100,
            cursor: { x: mousePos[0] || 0, y: mousePos[1] || 0 }
        };
    } catch {
        return { scale: 1, cursor: { x: 0, y: 0 } };
    }
}

/**
 * Create an inspector row
 */
function createRow(label: string, value: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'magnify-inspector-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'magnify-inspector-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = 'magnify-inspector-value';
    valueEl.textContent = value;
    valueEl.title = value;

    row.appendChild(labelEl);
    row.appendChild(valueEl);

    return row;
}

/**
 * Create a group with title
 */
function createGroup(title: string): HTMLElement {
    const group = document.createElement('div');
    group.className = 'magnify-inspector-group';

    const titleEl = document.createElement('div');
    titleEl.className = 'magnify-inspector-group-title';
    titleEl.textContent = title;

    group.appendChild(titleEl);

    return group;
}

/**
 * Update the inspector display
 */
function updateInspector(): void {
    if (!inspectorBody) return;

    const canvasInfo = getCanvasInfo();
    const hoveredNode = getHoveredNode();

    // Clear body
    inspectorBody.innerHTML = '';

    // Canvas info group
    const canvasGroup = createGroup('Canvas');
    canvasGroup.appendChild(createRow('Cursor', `(${formatNumber(canvasInfo.cursor.x)}, ${formatNumber(canvasInfo.cursor.y)})`));
    canvasGroup.appendChild(createRow('Scale', `${formatNumber(canvasInfo.scale, 1)}%`));
    inspectorBody.appendChild(canvasGroup);

    // MagnifyGlass info
    const magnifyGlass = window.comfyUIMagnifyGlass;
    if (magnifyGlass) {
        const glassGroup = createGroup('Magnify Glass');
        glassGroup.appendChild(createRow('Zoom', `${formatNumber((magnifyGlass.config?.zoomFactor || 1) * 100)}%`));
        glassGroup.appendChild(createRow('Active', magnifyGlass.state?.active ? 'Yes' : 'No'));
        inspectorBody.appendChild(glassGroup);
    }

    // Node info group
    if (hoveredNode) {
        const nodeGroup = createGroup('Hovered Node');

        // Node badge
        const badge = document.createElement('div');
        badge.className = 'magnify-node-badge';
        badge.textContent = hoveredNode.type || 'Unknown';
        nodeGroup.appendChild(badge);

        nodeGroup.appendChild(createRow('Title', hoveredNode.title || 'Untitled'));
        nodeGroup.appendChild(createRow('ID', String(hoveredNode.id)));

        // Position
        if (hoveredNode.pos) {
            nodeGroup.appendChild(createRow('Position', `(${formatNumber(hoveredNode.pos[0])}, ${formatNumber(hoveredNode.pos[1])})`));
        }

        // Size
        if (hoveredNode.size) {
            nodeGroup.appendChild(createRow('Size', `${formatNumber(hoveredNode.size[0])} × ${formatNumber(hoveredNode.size[1])}`));
        }

        // Widgets (first few)
        if (hoveredNode.widgets && hoveredNode.widgets.length > 0) {
            const widgetGroup = createGroup('Parameters');
            const widgetsToShow = hoveredNode.widgets.slice(0, 6);
            for (const widget of widgetsToShow) {
                if (widget.name && widget.value !== undefined) {
                    let value = String(widget.value);
                    if (value.length > 30) value = value.substring(0, 27) + '...';
                    widgetGroup.appendChild(createRow(widget.name, value));
                }
            }
            if (hoveredNode.widgets.length > 6) {
                const moreEl = document.createElement('div');
                moreEl.style.cssText = 'font-size: 11px; color: #666; padding: 4px 0;';
                moreEl.textContent = `+${hoveredNode.widgets.length - 6} more...`;
                widgetGroup.appendChild(moreEl);
            }
            inspectorBody.appendChild(widgetGroup);
        }

        inspectorBody.appendChild(nodeGroup);
    } else {
        // Empty state
        const empty = document.createElement('div');
        empty.className = 'magnify-inspector-empty';
        empty.textContent = 'Hover over a node to inspect';
        inspectorBody.appendChild(empty);
    }
}

/**
 * Render the inspector panel into the container
 */
export function renderInspectorPanel(container: HTMLElement): void {
    const section = document.createElement('div');
    section.className = 'magnify-sidebar-section';

    // Section header
    const header = document.createElement('div');
    header.className = 'magnify-sidebar-section-header';
    header.innerHTML = `${Icons.chevronDown}<span>Inspector</span>`;

    // Section body
    const body = document.createElement('div');
    body.className = 'magnify-sidebar-section-body magnify-inspector-section';
    inspectorBody = body;

    // Toggle collapse
    header.addEventListener('click', () => {
        header.classList.toggle('collapsed');
        body.classList.toggle('collapsed');
    });

    section.appendChild(header);
    section.appendChild(body);
    container.appendChild(section);

    // Initial update
    updateInspector();

    // Start update interval
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    updateInterval = window.setInterval(updateInspector, 100);
}

/**
 * Cleanup the inspector (call when sidebar is destroyed)
 */
export function cleanupInspector(): void {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
    inspectorBody = null;
}
