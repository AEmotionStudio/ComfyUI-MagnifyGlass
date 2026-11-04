# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.15.0] - 2026-11-04

### Changed
- **Inspector look**: The panel, its toolbar and its menus follow your ComfyUI palette (any palette, light or dark) with a flat, denser layout. Text and Accent Color override the palette only when changed from their defaults. Max Height and Opacity now apply in every mode.
- **Header and navigation**: The header shows the node's title, `#id` and type, with Lock and Minimize (double-click the header to minimize). Below it: Back/Forward, Previous/Next in execution order, Centre on node, and a searchable **Go to node** picker (title, type or `#id`) that replaces the three node lists. A breadcrumb shows the subgraph path and group, with "Enter subgraph" for subgraph nodes. Every jump centres the canvas and locks the panel to the node.
- **Simpler modes**: The panel either follows the glass or floats. Dragging the header floats it, and its position and minimized state are kept per browser. A corner handle sets Width and Max Height. **Sticky** (S) keeps the last node, **Lock** keeps one node while you hover others, and the new **Follow Selection** setting shows the selected node.
- **Editing**: Widgets are editable while Sticky, Locked or following the selection; otherwise rows offer "Lock to edit". Number steps match the canvas (Shift ×10, Alt ×0.1), text commits on Enter or blur and Escape reverts, prompts get a multiline editor (Ctrl+Enter), and a drag is one undo step. Linked widgets are read-only.
- **Copy**: Every row can be copied, the header copies `Title #id`, and copying works on plain-http LAN addresses.
- **Toolbar**: A fixed set of grouped buttons; ones that can't act are disabled. All eight Controls Positions work, and the toolbar flips sides instead of covering the panel.
- **Hotkeys**: Panel keys act only while the glass is on and never with Ctrl or Meta. `*` and ←/→ act only while the panel is hovered or focused, so the arrow keys nudge the glass otherwise. Rebinding applies at once.
- Max Height now defaults to 600px.

### Fixed
- **Subgraphs**: The panel, picker, highlight and editing use the graph on screen, so they work inside subgraphs. Title bars and collapsed nodes are hit.
- **Widget edits** run the widget's callback, redraw the canvas and record undo. CLIPLoader's `type` widget shows again.
- Dropdowns no longer get orphaned or keep writing after the panel re-renders, and they can be filtered by typing.
- The panel re-renders only when the shown node changes, so hover, focus and text selection survive.
- Saved fonts no longer reset on reload, and High Contrast Text applies on load.
- Node modes read Mute and Bypass instead of Never and On Request.
- The pop-out editor keeps newlines, handles widget names with quotes, and Escape no longer closes the window.

### Removed
- The built-in panel themes and their palette detection.
- Hold (P); use Lock.
- Loading fonts from Google Fonts. Font Family uses fonts installed locally.
- The Inspector and Media sections, the Show Inspector Tab setting, the guessed Model/Image/Text rows, and the unused Animations setting.

---

## [1.14.0] - 2026-11-03

### Fixed
- **Images and videos in the glass**: Image previews, videos and animated images now show in the glass at their real position and size, at any canvas zoom and in both capture modes.
  - Image previews are drawn from the full-resolution image, so they stay sharp when magnified. Batches show as the frontend's grid, or as the selected image.
  - Videos and animated images (DOM widgets) are drawn into the glass every frame, so they play smoothly, show in the pop-out and take the Invert and Grayscale filters. HiDPI screens no longer misplace them.
  - Cross-origin media that would taint the canvas is skipped.
  - The glass keeps rendering without mouse movement, so latent previews and video update live.
- **Glass alignment**: Node text, titles and culling now use the frontend's `(pos + offset) * scale` placement, and Virtual Zoom zooms about the right point when the canvas is not at the page's top-left (for example with the left sidebar open).
- **Inspector panel toggle**: Turning off "Inspector panel" now removes the panel completely: its DOM, observers, timers, hotkeys (I, U, S, `*`) and the highlight border. Turning it back on rebuilds it without a reload. `G` still toggles the glass.
- **Sidebar defaults**: Sidebar controls fell back to values that differed from the registered defaults (Glass Size, Border Width, Border Color, Offset Step, Info Panel Opacity). They now share one set of defaults.
- **Reset All**: The sidebar and settings-dialog resets now write the same values. Reduce Motion resets to On, as on a fresh install.

### Added
- **Basic Nodes 2.0 (Vue nodes) support**: The glass captures directly and draws media from Vue nodes.
- **About in the sidebar**: Version, links to GitHub, issues, Discord, YouTube, Ko-fi and the studio website, and the studio's other packs. ComfyUI's Settings › About page shows a MagnifyGlass badge.

### Changed
- **Sidebar redesign**: Built on ComfyUI's palette tokens, so it follows light and dark themes, with native section buttons, the Inspector panel switch at the top, and Glass Toggle Key under Glass Hotkeys.

### Removed
- The per-frame HTML overlay copies of videos and the unused sidebar Inspector module.

### Known Issues
- With the Inspector panel off, "Move Glass Position" (drag-glass mode) is unavailable, as it lives on the panel's floating controls. Follow Cursor (`H`) and the arrow keys still move the glass.
- Not yet shown in the glass: previews promoted from subgraphs, DOM widgets hidden below the low-quality zoom threshold, and the clip paths of `DOMClippedNodes`. The full-resolution image also covers the grid's hover tint and the image navigation buttons.

---

## [1.13.1] - 2026-02-07

### Fixed
- **Ghost Interactions**: Fixed cursor actions (grab, text-input, pointer) persisting after hiding the info panel via the X key toggle.
  - `DragValueController.destroy()` now properly removes the `pointerdown` listener (previously used an unreferenced `.bind()` making removal impossible).
  - `UIManager.hide()` now calls `cleanupEditors()` to destroy all active drag controllers, editors, and inline controls.
  - Fixed CSS `display: flex !important` on `.persist-active` overriding inline `display: none`, keeping the panel fully interactive while visually hidden.
  - Added `pointer-events: none` safety net on panel and floating controls when hidden, with proper restoration on re-show.
- **Glass Drag Cursor Stuck**: Fixed the magnify glass drag corrupting LiteGraph canvas state, leaving the cursor permanently in grab/pan mode and all canvas clicks non-functional. Root cause: LiteGraph uses pointer events (`pointerdown`/`pointerup`) while our drag only intercepted mouse events. In Firefox and Brave, these are independent event types — the `pointerup` still reached LiteGraph, corrupting its `pointer_is_down` state. Fixed by switching glass drag to use pointer events with full propagation blocking, plus a direct `resetLiteGraphCanvasState()` safety net.

---

## [1.13.0] - 2026-01-19

### Changed
- Version number updated to 1.13.0

## [1.12.0] - 2026-01-18

### Added
- **Batch Image Grid**: Added grid layout support for batch images in the glass view, enabling proper visualization of image batches.
- **Inline Action Buttons**: Introduced inline action buttons in the inspector for quicker access to widget functions.
- **Popout Enhancements**:
  - **Widget Sync**: Edits made in the popout inspector now sync back to the main graph.
  - **New Themes**: Added support for additional themes in the popout viewer.
  - **Parameter Visibility**: Improved how parameters are displayed in the inspector.
  - **Inline Sliders**: Added inline slider support for number widgets.
- **Keyboard Accessibility**: Improved keyboard navigation for sidebar settings.

### Improved
- **Performance**: Optimized magnified view update loop to prevent layout thrashing.
- **Defaults**: Adjusted default glass Y offset for better initial positioning.

### Fixed
- **Security**: Eliminated XSS vector by enforcing strict type checking.
- **UI Stability**: Fixed menu toggle button persistence across re-renders.
- **Styling**: Corrected CSS order for `focus-visible` on select elements.
- **Popout**: Broadened action button detection logic.

### Documentation
- **README**: Added "Click to watch on YouTube" hints and updated feature images.

## [1.11.0] - 2026-01-17

### Added
- **Direct Node Editing**: Major feature allowing users to modify node values directly from the Inspector Panel.
  - **Bi-directional Sync**: Changes in the inspector instantly update the node graph, and vice versa.
  - **Widget Support**: Full editing support for text inputs, number fields (with drag-to-adjust), booleans/toggles, and dropdowns/combos.
  - **Precision Control**: Fine-grained value adjustment without automatic step rounding constraints.
- **Hotkeys & Navigation**:
    - **`*`**: New global hotkey to instantly center the canvas on the currently inspected node.
    - **`ArrowLeft` / `ArrowRight`**: Navigate between nodes based on execution order directly from the inspector.
- **Keyboard Accessibility**: Full keyboard navigation (Arrows, Enter, Esc) and ARIA support for node selector dropdowns.

### Improved
- **Dropdown UX**:
  - Dropdowns now close automatically when clicking the canvas.
  - Prevented focus hijacking and race conditions for smoother interaction.
- **Performance**: Implemented DOM batching for HTML overlays, reducing layout thrashing and improving rendering speed.
- **Security**: Enforced `textContent` for sidebar titles to prevent XSS.

### Fixed
- **Virtual Zoom Alignment**: Fixed cursor drift when using zoom levels < 100% (Virtual Zoom), eliminating the need for manual "Direct Capture" toggling.
- **FPS Counter**: Resolved the issue causing the ComfyUI FPS counter to display inflated values (1000+ FPS) while the glass was active.
- **Event Leaks**: Fixed memory leaks caused by lingering event listeners on dropdowns.
- **Stale Overlays**: Fixed visual artifacts where stale overlays persisted during early rendering returns.
- **Drag Values**: Corrected logic in `DragValueController` for more reliable value updates.

---

## [1.10.1] - 2026-01-13

### Improved
- **Performance**: Significant optimization of mouse movement tracking using `requestAnimationFrame`, resulting in smoother operation and reduced CPU load.
- **Documentation**:
  - Added `CONTRIBUTING.md` to guide new contributors.
  - Added standard GitHub Issue Templates for bug reports and feature requests.
  - Updated README with a new high-quality YouTube demo video.

### Fixed
- **UI Layout**: Corrected the positioning of the toggle icon in the bottom toolbar.
- **Stability**: Fixed a startup error related to `Comfy.ColorPalette` detection.

---


## [1.10.0] - 2026-01-06

### Added
- **Popout Inspector Charts**: The popout inspector now properly renders charts and images (e.g., from Sigmas plotting nodes) instead of displaying escaped HTML.
- **Popout Viewer Enhancements**:
  - **Fullscreen & Fit Modes**: New controls to toggle fullscreen and fit-to-window scaling.
  - **Keep Alive**: Option to prevent the popout from disconnecting or closing automatically.
  - **Node Selection**: Full dropdown menu to search and select any node in the graph directly from the popout.
  - **Comprehensive Data**: Now displays Node ID, Mode, Position, and extended properties.
- **Copy to Clipboard**: Added copy buttons to all text fields in both the main inspector and popout inspector.
- **Focus Node**: Added a "Target" icon button to the Location row in both inspectors to instantly center the canvas on that node.
- **Node Navigation**:
  - **Smart Sorting**: Node dropdowns now support sorting by **Execution Order** or **Node ID**.
  - **Searchable Lists**: Quickly find nodes in complex workflows.
- **Hotkeys**:
  - **`S`**: Toggle "Sticky Info" (Persist Mode) on/off.
  - **`P`**: Toggle "Hold Info" (Pause/Play) to freeze the inspector updates.
  - Added hotkey hints to hover control tooltips.
- **Node Highlight Toggle**: Added a setting to enable/disable the blue border highlight around the inspected node.
- **Glass-less Operation**: The Info Panel can now continue to update and track nodes even when the Glass Preview is hidden (toggle with `G`).

### Improved
- **Settings Organization**: Completely reorganized the settings menu into logical, numbered groups (Appearance, Behavior, Hotkeys, Info Panel, etc.) for better usability.
- **UI UX**:
  - Copy buttons now show a green checkmark feedback animation.
  - Popout inspector visual overhaul with gradient headers, card-based layout, and better typography.
  - "Type" info removed from main inspector to reduce clutter.
  - "Location" row moved to a more logical position in the popout inspector.

### Fixed
- **Popout Inspector**: Fixed data synchronization issues where some values weren't displaying correctly.
- **Code Duplication**: Removed duplicate rendering logic in `popout-viewer.html`.

---

## [1.9.0] - 2026-01-05

### Added
- **Visual Accessibility Suite**: Comprehensive set of features for improved visibility.
  - **Invert Colors**: Toggle to invert all colors in the magnified view.
  - **Grayscale Mode**: Option to remove color saturation.
  - **Reduce Motion**: Instantly disable smooth animations for snappier feedback.
  - **High Contrast Mode**: Boosts text contrast (yellow/white on dark).
  - **Text Enhancements**: Added Text Glow, Outline, Bold, and Font Scaling (100-200%).
  - **Node Title Emphasis**: Distinct styling for node headers.
- **Accessibility Settings Section**: Dedicated sidebar section with live toggles for all accessibility features.

### Improved
- **UI UX**: "Reset All" button now resets all settings including new accessibility options.
- **Sidebar Stability**: Fixed issue where sidebar would collapse/reset when changing settings.
- **Info Panel**: Eliminated layout shift/bounce when hovering.

### Fixed
- **Widget Visibility**: Fixed issue where some widgets (customtext, LoadImage) were hidden in Virtual Zoom.

---

## [1.8.0] - 2026-01-04

### Added
- **Native Canvas Text Rendering**: Replaced HTML overlay text with high-fidelity native canvas rendering.
  - Text now renders directly inside the magnified view with better alignment.
  - Added support for **word wrapping**, dark background containers, and system font styling.
  - Handles multi-line text and textareas correctly without floating or jitter using capture-time offsets.
- **Native Image & Video Previews**: Implemented custom rendering for node images and video widgets.
  - Fixes artifacts and missing content for standard ComfyUI `LoadImage`, `SaveImage`, and VHS video nodes during Virtual Zoom.
  - Ensures previews are visible and crisp even at low zoom levels.

### Improved
- **Rendering Performance**: Optimized the `OffscreenRenderer` pipeline.
  - "Direct Capture" mode is now used more intelligently to avoid expensive redraws when possible.
  - Removed duplicate HTML overlays for text and media, reducing DOM overhead and double-rendering.
- **Visual Stability**: Fixed "floating" text issues by correcting coordinate transforms between graph, screen, and canvas spaces.
- **Ghosting Fix**: Added logic to temporarily hide original node widgets during capture to prevent visual artifacts ("ghosting") in the glass preview.

### Fixed
- Fixed bounds checking to correctly render widgets that are partially visible at the edge of the glass.
- Fixed text positioning relative to nodes when panning or zooming the main canvas.

---

## [1.7.0] - 2026-01-03

### Added
- **Multi-Monitor Pop-Out Viewer**: Open the magnified view in a separate browser tab for dual-monitor workflows.
  - Professional dark-themed viewer with two-column layout
  - Real-time inspector sidebar showing node details, cursor position, and canvas scale
  - Pop-out button in hover controls + `Shift+P` keyboard shortcut
  - **Resizable canvas** with drag handle (size persists to localStorage)
  - FPS counter and resolution display in footer
  - Frame sync at 30fps using BroadcastChannel API
  - Connection status indicator with auto-reconnect
  - Keyboard hint (`Esc` to close) in header

### Improved
- **Data Serialization**: Fixed DataCloneError by sanitizing inspector info before BroadcastChannel transfer
- **Field Mapping**: Properly maps GatheredInfo format to PopOutInfo for the viewer

### Fixed
- Fixed pop-out button placement (moved to hover controls from glass UI)
- Fixed type definitions for PopOutManager in MagnifyGlassInstance interface

---

## [1.6.0] - 2025-01-02

### Added
- **Dedicated Sidebar Panel**: All settings now accessible via a new sidebar tab in the ComfyUI sidebar, featuring organized sections for Magnify Glass, Info Panel, and Inspector settings.
- **Live Setting Previews**: Changes to settings like "Controls Position" now update in real-time without requiring a refresh.
- **Reset Buttons**: Individual and global reset options to restore default settings.
- **Hover Expand for Info Panel**: Panel now smoothly expands to show full content when hovered, and collapses when the mouse leaves.
- **Themed Floating Controls**: Hover controls now dynamically adopt the current ComfyUI theme colors, matching the main UI.
- **Pin State Persistence**: Inspector panel now correctly retains its manually pinned state when toggling the glass preview.
- **Shared Logger**: Internal logging system for cleaner console output with `[MagnifyGlass]` and `[InfoPanel]` prefixes.
- **Unit Tests**: Added Vitest-based testing framework with tests for `MagnifierState` and `ConfigManager`.

### Improved
- **Modularity**: Refactored codebase by extracting node data extraction logic into `InformationGatherer.ts` and restructuring settings management into a dedicated `shared/settings` directory.
- **Default Values**: Adjusted default glass Y-offset and UI padding for a more balanced layout out-of-the-box.
- **Code Quality**: Replaced `console.log` calls with structured `Logger.debug` calls throughout `UIManager`.

### Fixed
- **UI Padding**: Corrected padding and offset values for improved layout consistency.
- **Glass Y-Offset**: Fixed an issue where the glass Y-offset setting wasn't applying correctly.

---

## [1.5.0] - 2024-12-31

### Added
- **Quick Toggle Button**: Integrated Magnify Glass toggle into the main ComfyUI toolbar (bottom-right).
- **Inspector Persistence**: Panel now remembers if it was open or closed when toggling the tool.
- **Glass Preview Toggle**: New specific toggle for the visual glass circle (allowing "Inspector Only" mode).
- **Smart Workflow Logic**: 
    - Auto-Pin Inspector (Unlocked Mode) when hiding Glass Preview.
    - Auto-Lock Inspector (Follow Mode) when showing Glass Preview.
- Professional SVG icons replacing emoji icons throughout the UI.
- Full theme support for ComfyUI themes: Dark, Light, Solarized, Arc, Nord, GitHub.
- External CSS stylesheet for easier customization.
- Click event handlers for all floating control buttons.
- Section expand/collapse functionality in info panel.

### Improved
- **Drag Safety**: Dragging is now disabled when following the glass to prevent position fighting.
- **Visibility Interlocks**: 
    - "Unpin" button disabled when glass is hidden (prevents following invisible cursor).
    - "Hide Inspector" button disabled when glass is hidden (prevents hiding all UI).
- **Global Toggle**: The 'X' key/button now acts as a master switch, preserving your exact workspace state.

### Changed
- Migrated from inline CSS-in-JS to external `info-panel.css` file.
- Improved theme detection using ComfyUI's `Comfy.ColorPalette` setting.
- More professional appearance with custom SVG icon set.

### Removed
- Vue.js dependency (reduces bundle size).
- Emoji icons (replaced with SVG for better scaling and consistency).
- Inline CSS injection (now uses external stylesheet).

### Fixed
- Button click handlers now properly attached to floating controls.
- Theme switching now works across all 6 ComfyUI themes.
- Removed stale build artifacts that caused module loading errors.

---

## [1.4.0] - Previous Release

### Added
- TypeScript source code.
- WebGL-based magnification.
- Info panel with node, media, and inspector sections.
- Floating control buttons.
- Multiple glass shapes and positions.

---

For more information, see the [README](README.md).
