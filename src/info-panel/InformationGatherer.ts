/**
 * ComfyUI MagnifyGlass - Info Panel Information Gatherer (TypeScript)
 * 
 * Complete Information Gatherer extracted from magnify_info_panel.js
 * Responsible for collecting information about nodes, widgets, and canvas state.
 */

import type { ComfyApp, ComfyNode, ComfyWidget, GatheredInfo, NodeInfo, WidgetInfo, MediaInfo } from '../types/comfyui';

declare const app: ComfyApp;

/**
 * Information Gatherer class.
 * Collects information about the current state under the cursor.
 */
export class InformationGatherer {
    constructor() { }

    gatherInformation(): GatheredInfo {
        const magnifyGlass = window.comfyUIMagnifyGlass;
        if (!magnifyGlass) {
            return {
                timestamp: Date.now(),
                cursor: { screenX: 0, screenY: 0, canvasX: 0, canvasY: 0 },
                zoom: 1,
                nodeCount: 0,
                hoveredNode: null,
                hoveredWidget: null,
                mediaElement: null
            };
        }

        const info: GatheredInfo = {
            timestamp: Date.now(),
            cursor: {
                screenX: magnifyGlass.lastKnownMousePosition.x,
                screenY: magnifyGlass.lastKnownMousePosition.y,
                canvasX: magnifyGlass.state.x,
                canvasY: magnifyGlass.state.y
            },
            zoom: magnifyGlass.state.canvasScale,
            nodeCount: app.graph?._nodes?.length ?? 0,
            hoveredNode: null,
            hoveredWidget: null,
            mediaElement: null
        };

        if (magnifyGlass.isOverMedia && magnifyGlass.currentMediaElement) {
            info.mediaElement = this.getMediaInfo(magnifyGlass.currentMediaElement);
        }

        const nodeUnderCursor = this.getNodeUnderCursor();
        if (nodeUnderCursor) {
            info.hoveredNode = this.getDetailedNodeInfo(nodeUnderCursor.node, nodeUnderCursor.localPos);

            const widget = this.getWidgetUnderCursor(nodeUnderCursor.node, nodeUnderCursor.localPos);
            if (widget) {
                info.hoveredWidget = this.getWidgetInfo(widget);
            }
        }

        return info;
    }

    getNodeUnderCursor(): { node: ComfyNode, localPos: { x: number, y: number } } | null {
        const magnifyGlass = window.comfyUIMagnifyGlass;
        if (!app.graph || !app.canvas || !magnifyGlass) {
            return null;
        }

        try {
            // Try to get the node from ComfyUI's state
            if (app.canvas.node_over) {
                const node = app.canvas.node_over;
                if (node && node.pos && node.size) {
                    const canvasRect = app.canvas.canvas.getBoundingClientRect();
                    const mouseX = magnifyGlass.lastKnownMousePosition.x - canvasRect.left;
                    const mouseY = magnifyGlass.lastKnownMousePosition.y - canvasRect.top;

                    let graphPos: [number, number];
                    if (app.canvas.convertOffsetToCanvasPos) {
                        graphPos = app.canvas.convertOffsetToCanvasPos([mouseX, mouseY]);
                    } else {
                        const ds = app.canvas.ds || { scale: 1, offset: [0, 0] };
                        graphPos = [
                            (mouseX / ds.scale) - (ds.offset[0] / ds.scale),
                            (mouseY / ds.scale) - (ds.offset[1] / ds.scale)
                        ];
                    }

                    return {
                        node: node,
                        localPos: {
                            x: graphPos[0] - node.pos[0],
                            y: graphPos[1] - node.pos[1]
                        }
                    };
                }
            }

            // Fallback to manual detection
            const canvasRect = app.canvas.canvas.getBoundingClientRect();
            const mouseX = magnifyGlass.lastKnownMousePosition.x - canvasRect.left;
            const mouseY = magnifyGlass.lastKnownMousePosition.y - canvasRect.top;

            let graphPos: [number, number];
            if (app.canvas.convertOffsetToCanvasPos) {
                graphPos = app.canvas.convertOffsetToCanvasPos([mouseX, mouseY]);
            } else {
                const ds = app.canvas.ds || { scale: 1, offset: [0, 0] };
                graphPos = [
                    (mouseX / ds.scale) - (ds.offset[0] / ds.scale),
                    (mouseY / ds.scale) - (ds.offset[1] / ds.scale)
                ];
            }

            for (let i = app.graph._nodes.length - 1; i >= 0; i--) {
                const node = app.graph._nodes[i];
                if (!node.pos || !node.size || (node.flags && node.flags.collapsed)) continue;

                if (graphPos[0] >= node.pos[0] &&
                    graphPos[0] <= node.pos[0] + node.size[0] &&
                    graphPos[1] >= node.pos[1] &&
                    graphPos[1] <= node.pos[1] + node.size[1]) {

                    return {
                        node: node,
                        localPos: {
                            x: graphPos[0] - node.pos[0],
                            y: graphPos[1] - node.pos[1]
                        }
                    };
                }
            }
        } catch (err) {
            console.warn("Error in node detection:", err);
        }

        return null;
    }

    getDetailedNodeInfo(node: ComfyNode, localPos: { x: number, y: number }): NodeInfo {
        // Try to get author and category from node constructor or registered node types
        let author: string | undefined;
        let category: string | undefined;
        let executionOrder: number | undefined;
        let pythonModule: string | undefined;

        try {
            // Check for node.constructor.nodeData (ComfyUI stores metadata here)
            const nodeData = (node as any).constructor?.nodeData;
            if (nodeData) {
                pythonModule = nodeData.python_module;
                author = nodeData.author || pythonModule?.split('.')[0];
                category = nodeData.category;
            }

            // Try to get from LiteGraph registered node types
            if (!author && typeof LiteGraph !== 'undefined') {
                const nodeType = (LiteGraph as any).registered_node_types?.[node.type];
                if (nodeType) {
                    author = nodeType.nodeData?.author || nodeType.author;
                    category = nodeType.category || category;
                    if (!pythonModule && nodeType.nodeData?.python_module) {
                        pythonModule = nodeType.nodeData.python_module;
                    }
                }
            }

            // Execution order - try to get from node.order (set during graph execution)
            executionOrder = (node as any).order;
        } catch (e) {
            // Silently ignore errors accessing node metadata
        }

        return {
            id: node.id,
            title: node.title || "Untitled Node",
            type: node.type,
            mode: this.getNodeModeText(node.mode),
            position: {
                x: Math.round(node.pos[0]),
                y: Math.round(node.pos[1]),
                formatted: `(${Math.round(node.pos[0])}, ${Math.round(node.pos[1])})`
            },
            size: {
                width: Math.round(node.size[0]),
                height: Math.round(node.size[1]),
                formatted: `${Math.round(node.size[0])}×${Math.round(node.size[1])}`
            },
            localPosition: {
                x: Math.round(localPos.x),
                y: Math.round(localPos.y),
                formatted: `(${Math.round(localPos.x)}, ${Math.round(localPos.y)})`,
                percentage: {
                    x: ((localPos.x / node.size[0]) * 100).toFixed(1),
                    y: ((localPos.y / node.size[1]) * 100).toFixed(1)
                }
            },
            counts: {
                widgets: node.widgets ? node.widgets.length : 0,
                inputs: node.inputs ? node.inputs.length : 0,
                outputs: node.outputs ? node.outputs.length : 0,
                properties: node.properties ? Object.keys(node.properties).length : 0
            },
            widgets: node.widgets || [],
            inputs: node.inputs || [],
            outputs: node.outputs || [],
            properties: node.properties || {},
            hoverRegion: this.detectNodeRegion(localPos, node),
            executionOrder: executionOrder,
            author: author,
            category: category,
            pythonModule: pythonModule
        };
    }

    getNodeInfo(node: ComfyNode): NodeInfo {
        return {
            id: node.id,
            title: node.title || "Untitled",
            type: node.type,
            mode: node.mode,
            size: node.size ? `${Math.round(node.size[0])}×${Math.round(node.size[1])}` : "Unknown",
            position: node.pos ? `(${Math.round(node.pos[0])}, ${Math.round(node.pos[1])})` : "Unknown",
            widgets: node.widgets || [],
            inputs: node.inputs || [],
            outputs: node.outputs || [],
            properties: node.properties || {}
        };
    }

    getWidgetUnderCursor(node: ComfyNode, localPos: { x: number, y: number }): ComfyWidget | null {
        if (!node.widgets || !node.widgets.length) return null;

        const titleHeight = 30;
        let currentY = titleHeight;

        for (const widget of node.widgets) {
            const widgetHeight = 25;

            if (localPos.y >= currentY && localPos.y <= currentY + widgetHeight) {
                return widget;
            }

            currentY += widgetHeight + 5;
        }

        return null;
    }

    getWidgetInfo(widget: ComfyWidget): WidgetInfo {
        return {
            name: widget.name,
            type: widget.type,
            value: this.formatValue(widget.value),
            options: widget.options || null,
            min: widget.min,
            max: widget.max,
            step: widget.step
        };
    }

    getMediaInfo(mediaElement: HTMLImageElement | HTMLVideoElement): MediaInfo {
        const info: MediaInfo = {
            type: mediaElement instanceof HTMLImageElement ? 'image' : 'video',
            tagName: mediaElement.tagName,
            src: mediaElement.src ? mediaElement.src.substring(mediaElement.src.lastIndexOf('/') + 1) : 'No source',
            naturalWidth: 0,
            naturalHeight: 0,
            displayWidth: 0,
            displayHeight: 0,
            aspectRatio: ''
        };

        if (mediaElement instanceof HTMLImageElement) {
            info.naturalWidth = mediaElement.naturalWidth;
            info.naturalHeight = mediaElement.naturalHeight;
            info.displayWidth = Math.round(mediaElement.width);
            info.displayHeight = Math.round(mediaElement.height);
            if (mediaElement.naturalWidth && mediaElement.naturalHeight) {
                info.aspectRatio = (mediaElement.naturalWidth / mediaElement.naturalHeight).toFixed(2);
            }
        } else if (mediaElement instanceof HTMLVideoElement) {
            info.naturalWidth = mediaElement.videoWidth;
            info.naturalHeight = mediaElement.videoHeight;
            info.displayWidth = Math.round(mediaElement.width);
            info.displayHeight = Math.round(mediaElement.height);
            info.duration = mediaElement.duration;
            info.currentTime = mediaElement.currentTime;
            if (mediaElement.videoWidth && mediaElement.videoHeight) {
                info.aspectRatio = (mediaElement.videoWidth / mediaElement.videoHeight).toFixed(2);
            }
        }

        return info;
    }

    getNodeModeText(mode: number): string {
        const modes: { [key: number]: string } = {
            0: 'Always',
            1: 'On Event',
            2: 'Never',
            3: 'On Trigger',
            4: 'On Request'
        };
        return modes[mode] || `Mode ${mode}`;
    }

    detectNodeRegion(localPos: { x: number, y: number }, node: ComfyNode): string {
        const titleHeight = 30;
        const regions: string[] = [];

        if (localPos.y <= titleHeight) {
            regions.push("Title Bar");
        }

        if (localPos.x <= 10) {
            regions.push("Left Edge");
        } else if (localPos.x >= node.size[0] - 10) {
            regions.push("Right Edge");
        }

        if (localPos.y <= 10) {
            regions.push("Top Edge");
        } else if (localPos.y >= node.size[1] - 10) {
            regions.push("Bottom Edge");
        }

        if (regions.length === 0) {
            if (localPos.y > titleHeight) {
                regions.push("Content Area");
            }
        }

        if (localPos.x <= 20 && localPos.y > titleHeight) {
            regions.push("Input Area");
        } else if (localPos.x >= node.size[0] - 20 && localPos.y > titleHeight) {
            regions.push("Output Area");
        }

        return regions.length > 0 ? regions.join(", ") : "Unknown";
    }

    formatValue(value: unknown): string {
        if (value === null) return "null";
        if (value === undefined) return "undefined";
        if (typeof value === "string") {
            return value; // Show full text without truncation
        }
        if (typeof value === "number") {
            return Number.isInteger(value) ? value.toString() : value.toFixed(3);
        }
        if (typeof value === "boolean") return value.toString();
        if (Array.isArray(value)) {
            return `Array(${value.length})`;
        }
        if (typeof value === "object") {
            return "Object";
        }
        return String(value);
    }
}
