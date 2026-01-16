# PRD: Inspector Value Editing

**Feature Name:** Inspector Value Editing  
**Version:** 1.0  
**Author:** Æmotion Studio  
**Last Updated:** January 15, 2026  
**Status:** Draft  

---

## Executive Summary

This feature enables users to **edit node widget values and text content directly from the Inspector Panel**, eliminating the need to zoom into nodes or click through individual widgets on the canvas. When Sticky Info mode is active, users can click on any displayed value in the inspector to modify it inline, with changes immediately syncing to the corresponding node widget on the canvas.

---

## Problem Statement

Currently, the Inspector Panel in ComfyUI-MagnifyGlass is **read-only**—users can view node parameters, copy text values, and navigate to nodes, but cannot modify values without leaving the inspector to interact with the actual node on the canvas. This creates friction in workflows where users need to:

1. Frequently adjust parameters across multiple nodes
2. Work with complex workflows where nodes are zoomed out or overlapping
3. Edit prompt text in CLIPTextEncode nodes without hunting for the node
4. Make quick iterative changes during experimentation

---

## Goals & Success Metrics

### Goals
- Enable inline editing of **all widget types** from the Inspector Panel
- Provide **immediate visual feedback** with live sync to canvas nodes
- Maintain **constraint enforcement** (min/max/step, valid dropdown options)
- Support editing in both the **main Inspector Panel** and **Pop-Out Viewer**

### Success Metrics
- Users can edit any widget value without zooming to the node
- Edits are reflected on the canvas within 100ms of user interaction
- Zero invalid values can be committed (respecting widget constraints)
- Feature works seamlessly with Sticky Info mode

---

## User Stories

1. **As a user**, I want to click on a seed value in the inspector and type a new number, so I can quickly iterate without finding the KSampler node.

2. **As a user**, I want to select a different sampler from a dropdown in the inspector, so I can compare samplers without navigating the canvas.

3. **As a user**, I want to edit my positive prompt text directly in the inspector, so I can refine prompts while keeping the overall workflow visible.

4. **As a user**, I want my edits in the Pop-Out Viewer to sync to the main canvas, so I can work on a second monitor.

5. **As a user**, I want the inspector to prevent invalid inputs (like negative steps), so I don't accidentally break my workflow.

---

## Feature Specification

### Scope: Widget Types Supported

All widget types that are normally editable in ComfyUI nodes:

| Widget Type | Inspector Editor | Example Widgets |
|-------------|------------------|-----------------|
| **text** / **string** | Inline text input or expandable textarea | `text` (prompts), `filename_prefix` |
| **number** | Number input with step buttons | `seed`, `steps`, `cfg`, `width`, `height` |
| **slider** | Range slider with value display | `denoise`, `strength` |
| **combo** | Dropdown select | `sampler_name`, `scheduler`, `ckpt_name` |
| **boolean** | Toggle switch/checkbox | `add_noise`, `return_with_leftover_noise` |
| **INT** / **FLOAT** | Number input (like number) | Various numeric parameters |

### Interaction Model

#### Entry Point
- **No special "edit mode"**—values are always editable when Sticky Info is active
- Click directly on a value to begin editing
- Sticky Info ensures the panel doesn't disappear during editing

#### Edit Behavior by Widget Type

```
┌─────────────────────────────────────────────────────────────────────┐
│ Widget Type    │ Click Action        │ Editor Component             │
├─────────────────────────────────────────────────────────────────────┤
│ number/INT     │ Select value        │ <input type="number">        │
│ FLOAT          │ Select value        │ <input type="number" step>   │
│ text (short)   │ Inline edit         │ <input type="text">          │
│ text (long)    │ Expand textarea     │ <textarea> with resize       │
│ combo          │ Show dropdown       │ <select> or custom dropdown  │
│ boolean        │ Toggle immediately  │ <input type="checkbox">      │
│ slider         │ Show slider         │ <input type="range"> + value │
└─────────────────────────────────────────────────────────────────────┘
```

#### Live Sync Behavior
- Changes sync **immediately** as the user types/selects (live sync)
- For text fields: sync on every keystroke (debounced ~50-100ms)
- For number inputs: sync on value change
- For combos/booleans: sync immediately on selection/toggle

#### Constraint Enforcement
- **Numbers**: Respect `min`, `max`, and `step` values from widget
- **Combos**: Only show valid options from `widget.options`
- **Text**: No constraints (match node behavior)
- **Booleans**: Toggle between true/false only

### UI/UX Design

#### Visual States

```
┌─────────────────────────────────────────────────────────────────────┐
│ STATE          │ APPEARANCE                                         │
├─────────────────────────────────────────────────────────────────────┤
│ Hover          │ Value gets subtle highlight/underline              │
│ Editing        │ Value transforms into appropriate input control    │
│ Syncing        │ Brief loading indicator (optional)                 │
│ Error          │ Red border on invalid input (prevented on commit)  │
│ Success        │ Value returns to display mode with new value       │
└─────────────────────────────────────────────────────────────────────┘
```

#### Text Editing (Prompts)

For long text content (like prompts in CLIPTextEncode):

```
┌─────────────────────────────────────────────────────────────────────┐
│ Text                                                                │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ masterpiece, best quality, 1girl, solo, long hair, blonde...   │ │
│ │                                                                 │ │
│ │ [Expandable textarea with drag-to-resize handle]               │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                              [Character count: 247] │
└─────────────────────────────────────────────────────────────────────┘
```

#### Number Editing (with constraints)

```
┌─────────────────────────────────────────────────────────────────────┐
│ steps          │ ◀ │ 20 │ ▶ │              min: 1, max: 150, step: 1│
│ cfg            │ ◀ │ 7.0 │ ▶ │             min: 0, max: 30, step: 0.5│
│ seed           │     1234567890      │ 🎲 (randomize button)        │
└─────────────────────────────────────────────────────────────────────┘
```

#### Combo Editing (dropdowns)

```
┌─────────────────────────────────────────────────────────────────────┐
│ sampler_name   │ euler_ancestral ▼                                  │
│                │ ┌─────────────────┐                                │
│                │ │ euler           │                                │
│                │ │ euler_ancestral │ ← selected                     │
│                │ │ heun            │                                │
│                │ │ dpm_2           │                                │
│                │ │ ...             │                                │
│                │ └─────────────────┘                                │
└─────────────────────────────────────────────────────────────────────┘
```

### Pop-Out Viewer Integration

The Pop-Out Viewer must support the same editing capabilities:

- All editable fields work identically to the main Inspector Panel
- Changes in Pop-Out sync to the main canvas immediately
- Communication via existing `popOutManager.sendInfo()` mechanism, extended for edit commands

---

## Technical Specification

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        INSPECTOR PANEL                              │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                  UIManager.ts                                │   │
│   │   - renderSections() → Now renders editable fields          │   │
│   │   - Creates WidgetEditor components per field               │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │              WidgetEditorFactory.ts [NEW]                   │   │
│   │   - createEditor(widget, nodeId) → HTMLElement              │   │
│   │   - Handles all widget types                                │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │              WidgetSyncManager.ts [NEW]                     │   │
│   │   - syncWidgetValue(nodeId, widgetName, value)              │   │
│   │   - Finds node → widget → updates value                     │   │
│   │   - Triggers canvas redraw                                  │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                    ComfyUI Canvas                           │   │
│   │   - Node widget value updated                               │   │
│   │   - Canvas redrawn automatically                            │   │
│   └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### New Files to Create

#### 1. `src/info-panel/widget-editors/WidgetEditorFactory.ts`

Factory class that creates the appropriate editor component for each widget type.

```typescript
// Key exports
export interface WidgetEditorConfig {
    nodeId: number;
    widgetName: string;
    widgetType: string;
    currentValue: unknown;
    options?: unknown;       // Combo options array
    min?: number;           // Number constraints
    max?: number;
    step?: number;
    onChange: (value: unknown) => void;
}

export class WidgetEditorFactory {
    static createEditor(config: WidgetEditorConfig): HTMLElement;
}
```

#### 2. `src/info-panel/widget-editors/editors/` (individual editor components)

- `TextEditor.ts` - Input/textarea for text widgets
- `NumberEditor.ts` - Number input with stepper buttons
- `ComboEditor.ts` - Dropdown for combo widgets
- `BooleanEditor.ts` - Toggle switch for booleans
- `SliderEditor.ts` - Range slider with value display

#### 3. `src/info-panel/WidgetSyncManager.ts`

Handles synchronization between inspector edits and canvas nodes.

```typescript
export class WidgetSyncManager {
    /**
     * Update a widget value on a node
     * @returns true if successful, false if widget not found
     */
    static syncWidgetValue(nodeId: number, widgetName: string, value: unknown): boolean;
    
    /**
     * Get widget constraints for validation
     */
    static getWidgetConstraints(nodeId: number, widgetName: string): WidgetConstraints | null;
    
    /**
     * Force canvas redraw after widget update
     */
    static triggerCanvasRedraw(): void;
}
```

### Files to Modify

#### 1. `src/info-panel/UIManager.ts`

**Changes:**
- Modify `renderSections()` to detect editable fields
- Integrate `WidgetEditorFactory` for editable parameters
- Add CSS classes for editable vs read-only states
- Handle focus management for inline editors

**Key additions to `renderSections()`:**

```typescript
// In section.content.map() for node parameters:
if (isEditableWidget(item)) {
    return this.renderEditableField(item, nodeId);
} else {
    return this.renderReadOnlyField(item);
}
```

#### 2. `src/info-panel/NodeDataExtractor.ts`

**Changes:**
- Include widget metadata (min, max, step, options) in extracted parameters
- Add `isEditable` flag to parameter items
- Pass through `widgetName` for sync operations

**Modified `ParameterItem` interface:**

```typescript
export interface ParameterItem {
    label: string;
    value: string;
    widgetName?: string;      // Original widget name for syncing
    widgetType?: string;      // Widget type (number, combo, text, etc.)
    isEditable?: boolean;     // Whether this can be edited
    constraints?: {           // Widget constraints
        min?: number;
        max?: number;
        step?: number;
        options?: unknown[];  // For combo widgets
    };
}
```

#### 3. `src/info-panel/InformationGatherer.ts`

**Changes:**
- Pass widget constraints through to NodeInfo
- Include original widget reference for editing

#### 4. `src/types/comfyui.d.ts`

**Changes:**
- Add `callback` property to `ComfyWidget` interface (for triggering widget callbacks)
- Add constraint types

#### 5. `css/info-panel.css` (or equivalent)

**Changes:**
- Add styles for editable fields
- Hover/focus states for editors
- Textarea expansion animation
- Dropdown styling matching ComfyUI theme

### Widget Value Sync Implementation

```typescript
// WidgetSyncManager.ts core logic

static syncWidgetValue(nodeId: number, widgetName: string, value: unknown): boolean {
    const app = (window as any).app;
    const node = app.graph.getNodeById(nodeId);
    
    if (!node || !node.widgets) return false;
    
    const widget = node.widgets.find((w: any) => w.name === widgetName);
    if (!widget) return false;
    
    // Update widget value
    widget.value = value;
    
    // Trigger widget callback if it exists (some widgets need this)
    if (typeof widget.callback === 'function') {
        widget.callback(value, app.canvas, node, [0, 0], null);
    }
    
    // Mark node as dirty to trigger redraw
    node.setDirtyCanvas(true, true);
    
    // Force canvas redraw
    app.canvas.setDirty(true, true);
    
    return true;
}
```

### Pop-Out Viewer Integration

#### Communication Protocol

Extend existing `popOutManager` to handle edit commands:

```typescript
// In popout window → main window
interface PopOutEditCommand {
    type: 'widget_edit';
    nodeId: number;
    widgetName: string;
    value: unknown;
}

// Main window receives and applies edit
window.addEventListener('message', (event) => {
    if (event.data.type === 'widget_edit') {
        WidgetSyncManager.syncWidgetValue(
            event.data.nodeId,
            event.data.widgetName,
            event.data.value
        );
    }
});
```

---

## Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| Node deleted while editing | Detect node absence, show toast, close editor |
| Widget removed by custom node logic | Validate widget exists before sync |
| Invalid number (out of bounds) | Clamp to min/max, show feedback |
| Empty required text field | Allow (match node behavior) |
| Combo option no longer valid | Fallback to first option or current |
| Pop-out window closed during edit | Edits in main window still work |
| Rapid successive edits | Debounce sync calls (50-100ms) |

---

## Implementation Phases

### Phase 1: Core Infrastructure
- [ ] Create `WidgetSyncManager` with basic sync logic
- [ ] Create `WidgetEditorFactory` skeleton
- [ ] Modify `NodeDataExtractor` to include widget metadata
- [ ] Add basic CSS for editable fields

### Phase 2: Editor Components
- [ ] Implement `NumberEditor` (most common)
- [ ] Implement `TextEditor` (short text + expandable)
- [ ] Implement `ComboEditor` (dropdowns)
- [ ] Implement `BooleanEditor` (toggle)
- [ ] Implement `SliderEditor`

### Phase 3: UIManager Integration
- [ ] Modify `renderSections()` for editable rendering
- [ ] Add focus management
- [ ] Handle escape to cancel / enter to confirm

### Phase 4: Pop-Out Viewer
- [ ] Extend `popOutManager` message protocol
- [ ] Mirror editor components in popout HTML
- [ ] Test cross-window sync

### Phase 5: Polish & Testing
- [ ] Theme compatibility (all ComfyUI themes)
- [ ] Keyboard navigation (tab between fields)
- [ ] Performance optimization (large workflows)
- [ ] Accessibility (ARIA labels)

---

## File Structure After Implementation

```
src/info-panel/
├── widget-editors/
│   ├── WidgetEditorFactory.ts      [NEW]
│   ├── WidgetSyncManager.ts        [NEW]
│   ├── editors/
│   │   ├── BaseEditor.ts           [NEW]
│   │   ├── TextEditor.ts           [NEW]
│   │   ├── NumberEditor.ts         [NEW]
│   │   ├── ComboEditor.ts          [NEW]
│   │   ├── BooleanEditor.ts        [NEW]
│   │   └── SliderEditor.ts         [NEW]
│   └── index.ts                    [NEW]
├── CanvasHighlighter.ts
├── EventManager.ts
├── InfoPanel.ts
├── InformationGatherer.ts          [MODIFIED]
├── NodeDataExtractor.ts            [MODIFIED]
├── NodeSelector.ts
├── PositionManager.ts
├── StateManager.ts
├── UIManager.ts                    [MODIFIED]
├── ValueFormatter.ts
└── index.ts
```

---

## Testing Strategy

### Unit Tests
- `WidgetSyncManager.syncWidgetValue()` correctly updates nodes
- `WidgetEditorFactory` creates correct editor types
- Constraint validation works for all widget types

### Integration Tests
- Edit a number → verify node widget value changed
- Edit a combo → verify dropdown selection applied
- Edit text → verify prompt updated in CLIPTextEncode
- Pop-out edit → verify main canvas receives update

### Manual Testing Checklist
- [ ] KSampler: Edit seed, steps, cfg, sampler, scheduler
- [ ] CLIPTextEncode: Edit positive/negative prompts
- [ ] CheckpointLoader: Change model via dropdown
- [ ] LoadImage: Verify read-only fields stay read-only
- [ ] Test with Sticky Info enabled and disabled
- [ ] Test in Pop-Out Viewer
- [ ] Test theme compatibility (Dark, Light, Nord, etc.)

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Widget callbacks break | Medium | High | Wrap callback in try/catch, fallback to direct value set |
| Custom node widgets unsupported | High | Medium | Gracefully fallback to read-only for unknown types |
| Performance with many editable fields | Low | Medium | Lazy-load editors, virtualize long lists |
| Theme CSS conflicts | Medium | Low | Use scoped class names, CSS variables |

---

## Dependencies

- **No external dependencies** required
- Uses existing ComfyUI APIs (`app.graph`, `node.widgets`)
- Uses existing project infrastructure (TypeScript, Vite build)

---

## Future Enhancements (Out of Scope for v1.0)

- [ ] Undo/Redo integration with ComfyUI history
- [ ] Batch editing (change same param across multiple nodes)
- [ ] Favorites/pinned parameters
- [ ] Node title editing from inspector
- [ ] Parameter presets/snapshots
- [ ] Keyboard shortcuts for common actions (randomize seed, etc.)

---

## Appendix A: Existing Codebase Reference

### Key Files for Handoff

| File | Purpose | Relevance |
|------|---------|-----------|
| [UIManager.ts](file:///home/heartfire/ComfyUI/custom_nodes/comfyui-magnifyglass/src/info-panel/UIManager.ts) | Renders inspector UI, handles sections | Main integration point |
| [NodeDataExtractor.ts](file:///home/heartfire/ComfyUI/custom_nodes/comfyui-magnifyglass/src/info-panel/NodeDataExtractor.ts) | Extracts widget data from nodes | Needs widget metadata additions |
| [InformationGatherer.ts](file:///home/heartfire/ComfyUI/custom_nodes/comfyui-magnifyglass/src/info-panel/InformationGatherer.ts) | Gathers node/widget info under cursor | Widget constraints source |
| [comfyui.d.ts](file:///home/heartfire/ComfyUI/custom_nodes/comfyui-magnifyglass/src/types/comfyui.d.ts) | Type definitions | Extend for editing APIs |
| [StateManager.ts](file:///home/heartfire/ComfyUI/custom_nodes/comfyui-magnifyglass/src/info-panel/StateManager.ts) | Panel state management | Sticky Info detection |

### ComfyUI Widget Structure

```typescript
// Typical widget object from node.widgets
{
    name: "steps",
    type: "number",
    value: 20,
    options: {
        min: 1,
        max: 10000,
        step: 1,
        precision: 0
    },
    callback: (v, canvas, node, pos, event) => { ... }
}
```

### Sticky Info Setting

```typescript
// Check if Sticky Info is enabled
const isSticky = stateManager.state.settings["🔍MagnifyGlass.InfoPanelPersist"];
```

---

## Appendix B: Changelog Template

```markdown
## v1.11.0 (TBD)

**🎛️ Inspector Value Editing**

*   **Direct Editing**: Click any parameter value in the Inspector Panel to edit it inline.
*   **Supported Types**: Numbers, text, dropdowns, toggles, and sliders—all editable without zooming.
*   **Live Sync**: Changes apply instantly to nodes on the canvas.
*   **Pop-Out Support**: Edit values from the detached viewer window.
*   **Smart Constraints**: Respects min/max/step values and dropdown options from each widget.
```

---

*End of PRD*
