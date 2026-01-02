/**
 * ComfyUI MagnifyGlass - Node Data Extractor
 * 
 * Utility functions for extracting specific information from nodes.
 * Extracted from UIManager.ts for better modularity.
 */

import { formatWidgetValue } from './ValueFormatter';
import type { NodeInfo } from '../types/comfyui';

/**
 * Interface for extracted parameter items.
 */
export interface ParameterItem {
    label: string;
    value: string;
}

/**
 * Get checkpoint/model info from a node.
 * @param nodeInfo - Node information object
 * @returns Model filename or null
 */
export function getCheckpointInfo(nodeInfo: NodeInfo): string | null {
    if (nodeInfo.type && (
        nodeInfo.type.includes('CheckpointLoader') ||
        nodeInfo.type.includes('LoadCheckpoint') ||
        nodeInfo.type.includes('ModelLoader') ||
        nodeInfo.type.includes('UNETLoader') ||
        nodeInfo.type.includes('VAELoader') ||
        nodeInfo.type.includes('LoraLoader')
    )) {
        if (nodeInfo.widgets && nodeInfo.widgets.length > 0) {
            for (const widget of nodeInfo.widgets) {
                if (widget.name && (
                    widget.name.toLowerCase().includes('model') ||
                    widget.name.toLowerCase().includes('checkpoint') ||
                    widget.name.toLowerCase().includes('ckpt') ||
                    widget.name.toLowerCase().includes('lora') ||
                    widget.name.toLowerCase().includes('vae') ||
                    widget.name.toLowerCase().includes('file')
                )) {
                    const value = String(widget.value);
                    const filename = value.split(/[\/\\]/).pop();
                    return filename || value;
                }
            }
        }
    }
    return null;
}

/**
 * Image info result type.
 */
export interface ImageInfoResult {
    width: string | number;
    height: string | number;
    src: string;
}

/**
 * Get image info from a node.
 * @param nodeInfo - Node information object
 * @returns Image info string, object, or null
 */
export function getImageInfo(nodeInfo: NodeInfo): string | ImageInfoResult | null {
    if (nodeInfo.type && (
        nodeInfo.type.includes('SaveImage') ||
        nodeInfo.type.includes('PreviewImage') ||
        nodeInfo.type.includes('VisionOutput') ||
        nodeInfo.type.includes('ImageOutput') ||
        nodeInfo.type.includes('LoadImage') ||
        nodeInfo.type.includes('Display')
    )) {
        if (nodeInfo.widgets) {
            for (const widget of nodeInfo.widgets) {
                if (widget.name && (
                    widget.name.toLowerCase().includes('image') ||
                    widget.name.toLowerCase().includes('filename') ||
                    widget.name.toLowerCase().includes('file')
                )) {
                    return String(widget.value);
                }
            }
        }

        if (nodeInfo.properties && (nodeInfo.properties as Record<string, unknown>).img) {
            const img = (nodeInfo.properties as Record<string, unknown>).img as Record<string, unknown>;
            return {
                width: (img.width as string | number) || 'unknown',
                height: (img.height as string | number) || 'unknown',
                src: img.src ? String(img.src).split(/[\/\\]/).pop() || 'Preview available' : 'Preview available'
            };
        }

        if (nodeInfo.outputs) {
            for (const output of nodeInfo.outputs) {
                if (output.links && output.links.length > 0) {
                    return 'Image connected to ' + output.links.length + ' node(s)';
                }
            }
        }

        return 'Image node';
    }
    return null;
}

/**
 * Get text box content from a node.
 * @param nodeInfo - Node information object
 * @returns Text content or null
 */
export function getTextBoxContent(nodeInfo: NodeInfo): string | null {
    if (nodeInfo.widgets && nodeInfo.widgets.length > 0) {
        if (nodeInfo.type && nodeInfo.type.includes('CLIPTextEncode')) {
            for (const widget of nodeInfo.widgets) {
                if (widget.name === 'text' && typeof widget.value === 'string') {
                    return widget.value;
                }
            }
        }

        for (const widget of nodeInfo.widgets) {
            if ((widget.name.toLowerCase().includes('prompt') ||
                widget.name.toLowerCase().includes('conditioning')) &&
                typeof widget.value === 'string' && widget.value.length > 0) {
                return widget.value;
            }
        }

        for (const widget of nodeInfo.widgets) {
            if ((widget.type === 'text' || widget.type === 'textarea' ||
                widget.type === 'string' || widget.name.toLowerCase().includes('text')) &&
                typeof widget.value === 'string' && widget.value.length > 0) {
                return widget.value;
            }
        }
    }
    return null;
}

/**
 * List of important parameter names for complex nodes.
 */
const COMPLEX_NODE_PARAMS = [
    'seed', 'steps', 'cfg', 'scale', 'sampler', 'scheduler',
    'positive', 'negative', 'width', 'height', 'denoise', 'strength',
    'noise', 'count', 'batch', 'size', 'phase', 'color', 'intensity',
    'control_after_generate', 'control', 'after', 'generate',
    'start_at_step', 'end_at_step', 'start', 'end',
    'return_with_leftover_noise', 'leftover', 'noise_return',
    'model', 'vae', 'clip', 'lora', 'checkpoint',
    'latent', 'image', 'mask', 'filename', 'directory',
    'prompt', 'conditioning', 'filename_prefix',
    'resolution', 'num_chunks', 'seconds', 'aspect_ratio',
    'style_type', 'background', 'n', 'human', 'raw', 'guidance',
    'skip_preprocessing', 'movement_amplitude', 'animation',
    'material_type', 'b1', 'b2', 's1', 's2', 'type', 'channel',
    'sigma', 'rho', 'alpha', 'base_shift', 'shift', 'stretch', 'terminal',
    'spacing', 'style', 'eta', 'norm_threshold', 'momentum',
    'hypernetwork_name', 'reuse_threshold', 'verbose', 'layers',
    'set_cond_area', 'audioui', 'camera_pose', 'fx', 'cx', 'fy', 'cy'
];

/**
 * Parameters for save nodes.
 */
const SAVE_NODE_PARAMS = [
    'filename_prefix', 'filename', 'directory', 'path',
    'format', 'quality', 'extension'
];

/**
 * Generic widget names to skip.
 */
const SKIP_WIDGET_NAMES = ['title', 'node', 'id', 'type', 'mode'];

/**
 * Check if a node type should show all widgets.
 * @param nodeType - The node type string
 * @returns True if all widgets should be shown
 */
function shouldShowAllWidgets(nodeType: string): boolean {
    const type = nodeType.toLowerCase();
    const isSaveNode = type.includes('save') &&
        !type.includes('checkpoint') &&
        !type.includes('model') &&
        !type.includes('preview');

    return (
        type.includes('ksampler') ||
        type.includes('sampler') ||
        type.includes('k_samplers') ||
        type.includes('checkpoint') ||
        type.includes('model') ||
        type.includes('lora') ||
        type.includes('controlnet') ||
        type.includes('advanced') ||
        type.includes('detailer') ||
        type.includes('inpaint') ||
        type.includes('upscale') ||
        type.includes('clip') ||
        type.includes('text') ||
        type.includes('encode')
    ) && !isSaveNode;
}

/**
 * Get important node parameters based on node type.
 * @param nodeInfo - Node information object
 * @returns Array of parameter items
 */
export function getImportantNodeParameters(nodeInfo: NodeInfo): ParameterItem[] {
    const parameters: ParameterItem[] = [];

    if (!nodeInfo.widgets || nodeInfo.widgets.length === 0) {
        return parameters;
    }

    const nodeType = nodeInfo.type || '';
    const typeLower = nodeType.toLowerCase();
    const isSaveNode = typeLower.includes('save') &&
        !typeLower.includes('checkpoint') &&
        !typeLower.includes('model') &&
        !typeLower.includes('preview');

    // For complex nodes, show ALL widgets
    if (nodeType && shouldShowAllWidgets(nodeType)) {
        for (const widget of nodeInfo.widgets) {
            if (widget.name && widget.name !== '') {
                const widgetName = widget.name.toLowerCase();
                if (!SKIP_WIDGET_NAMES.some(skip => widgetName.includes(skip))) {
                    parameters.push({
                        label: widget.name,
                        value: formatWidgetValue(widget.value)
                    });
                }
            }
        }
        return parameters;
    }

    // For other nodes, use filtered parameter lists
    const importantParams = isSaveNode ? SAVE_NODE_PARAMS : COMPLEX_NODE_PARAMS;

    for (const widget of nodeInfo.widgets) {
        const paramName = widget.name.toLowerCase();
        if (importantParams.some(param => paramName.includes(param))) {
            parameters.push({
                label: widget.name,
                value: formatWidgetValue(widget.value)
            });
        }
    }

    return parameters;
}
