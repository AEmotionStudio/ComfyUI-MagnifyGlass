# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2024-12-31

### Added
- **Quick Toggle Button**: Integrated Magnify Glass toggle into the main ComfyUI toolbar (bottom-right).
- **Inspector Persistence**: Panel now remembers if it was open or closed when toggling the tool.
- **Glass Preview Toggle**: New specific toggle for the visual glass circle (allowing "Inspector Only" mode).
- **Smart Workflow Logic**: 
    - Auto-Pin Inspector (Unlocked Mode) when hiding Glass Preview.
    - Auto-Lock Inspector (Follow Mode) when showing Glass Preview.
- Professional SVG icons replacing emoji icons throughout the UI
- Full theme support for ComfyUI themes: Dark, Light, Solarized, Arc, Nord, GitHub
- External CSS stylesheet for easier customization
- Click event handlers for all floating control buttons
- Section expand/collapse functionality in info panel

### Improved
- **Drag Safety**: Dragging is now disabled when following the glass to prevent position fighting.
- **Visibility Interlocks**: 
    - "Unpin" button disabled when glass is hidden (prevents following invisible cursor).
    - "Hide Inspector" button disabled when glass is hidden (prevents hiding all UI).
- **Global Toggle**: The 'X' key/button now acts as a master switch, preserving your exact workspace state.

### Changed
- Migrated from inline CSS-in-JS to external `info-panel.css` file
- Improved theme detection using ComfyUI's `Comfy.ColorPalette` setting
- More professional appearance with custom SVG icon set

### Removed
- Vue.js dependency (reduces bundle size)
- Emoji icons (replaced with SVG for better scaling and consistency)
- Inline CSS injection (now uses external stylesheet)

### Fixed
- Button click handlers now properly attached to floating controls
- Theme switching now works across all 6 ComfyUI themes
- Removed stale build artifacts that caused module loading errors

## [1.4.0] - Previous Release

### Added
- TypeScript source code
- WebGL-based magnification
- Info panel with node, media, and inspector sections
- Floating control buttons
- Multiple glass shapes and positions

---

For more information, see the [README](README.md).
