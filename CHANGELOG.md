# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
