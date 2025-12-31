/**
 * ComfyUI MagnifyGlass - Info Panel Information Gatherer
 * 
 * Complete Information Gatherer extracted from magnify_info_panel.js
 * Responsible for collecting information about nodes, widgets, and canvas state.
 */

import { app } from "../../../../scripts/app.js";

/**
 * Information Gatherer class.
 * Collects information about the current state under the cursor.
 */
export class InformationGatherer {
    constructor() { }

    gatherInformation() {
        const magnifyGlass = window.comfyUIMagnifyGlass;
        if (!magnifyGlass) return {};

        const info = {
            timestamp: Date.now(),
            cursor: {
                canvas: { x: magnifyGlass.state.x, y: magnifyGlass.state.y },
                screen: {
                    x: magnifyGlass.lastKnownMousePosition.x,
                    y: magnifyGlass.lastKnownMousePosition.y
                }
            },
            canvas: {
                scale: magnifyGlass.state.canvasScale,
                offset: {
                    x: magnifyGlass.state.canvasOffsetX,
                    y: magnifyGlass.state.canvasOffsetY
                }
            },
            magnifier: {
                zoomFactor: magnifyGlass.config.zoomFactor,
                offsetX: magnifyGlass.config.offsetX,
                offsetY: magnifyGlass.config.offsetY,
                sourceRegion: {
                    x: magnifyGlass.state.sourceX,
                    y: magnifyGlass.state.sourceY,
                    width: magnifyGlass.state.sourceWidth,
                    height: magnifyGlass.state.sourceHeight
                }
            },
            hoveredNode: null,
            node: null,
            widget: null,
            connection: null,
            media: null
        };

        if (magnifyGlass.isOverMedia && magnifyGlass.currentMediaElement) {
            info.media = this.getMediaInfo(magnifyGlass.currentMediaElement);
        }

        const nodeUnderCursor = this.getNodeUnderCursor();
        if (nodeUnderCursor) {
            info.hoveredNode = this.getDetailedNodeInfo(nodeUnderCursor.node, nodeUnderCursor.localPos);
            info.node = this.getNodeInfo(nodeUnderCursor.node);

            const widget = this.getWidgetUnderCursor(nodeUnderCursor.node, nodeUnderCursor.localPos);
            if (widget) {
                info.widget = this.getWidgetInfo(widget);
            }
        }

        return info;
    }

    getNodeUnderCursor() {
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

                    let graphPos;
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

            let graphPos;
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
                if (!node.pos || !node.size || node.flags?.collapsed) continue;

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

    getDetailedNodeInfo(node, localPos) {
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
            hoverRegion: this.detectNodeRegion(localPos, node)
        };
    }

    getNodeInfo(node) {
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

    getWidgetUnderCursor(node, localPos) {
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

    getWidgetInfo(widget) {
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

    getMediaInfo(mediaElement) {
        const info = {
            tagName: mediaElement.tagName,
            src: mediaElement.src ? mediaElement.src.substring(mediaElement.src.lastIndexOf('/') + 1) : "No source"
        };

        if (mediaElement.tagName === 'IMG') {
            info.naturalSize = `${mediaElement.naturalWidth}×${mediaElement.naturalHeight}`;
            info.displaySize = `${Math.round(mediaElement.width)}×${Math.round(mediaElement.height)}`;
            info.complete = mediaElement.complete;
        } else if (mediaElement.tagName === 'VIDEO') {
            info.videoSize = `${mediaElement.videoWidth}×${mediaElement.videoHeight}`;
            info.duration = mediaElement.duration ? `${mediaElement.duration.toFixed(2)}s` : "Unknown";
            info.currentTime = `${mediaElement.currentTime.toFixed(2)}s`;
            info.paused = mediaElement.paused;
            info.readyState = mediaElement.readyState;
        }

        return info;
    }

    getNodeModeText(mode) {
        const modes = {
            0: "Always",
            1: "On Event",
            2: "Never",
            3: "On Trigger",
            4: "On Request"
        };
        return modes[mode] || `Mode ${mode}`;
    }

    detectNodeRegion(localPos, node) {
        const titleHeight = 30;
        const regions = [];

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

    formatValue(value) {
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
