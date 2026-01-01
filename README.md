# ComfyUI-MagnifyGlass

![Version](https://img.shields.io/badge/version-1.5.0-blue.svg)
![ComfyUI](https://img.shields.io/badge/ComfyUI-compatible-green)
![License](https://img.shields.io/badge/license-GPL--3.0-brightgreen.svg)
![Dependencies](https://img.shields.io/badge/dependencies-none-brightgreen.svg)

A powerful, customizable magnifying glass extension for ComfyUI. Inspect fine details in your generated images, node connections, and canvas with ease.

> [!TIP]
> Perfect for inspecting fine details in your generated images, node connections, or any part of the ComfyUI canvas.

![Magnify Glass in Action](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/releases/download/assets-v1/magnify_glass_action.webp)

---

## Recent Updates

### v1.5.0 — December 2024

**UI Modernization & Theme Support**
- Professional SVG icons replacing emojis throughout the UI
- Full theme support for all 6 ComfyUI themes (Dark, Light, Solarized, Arc, Nord, GitHub)
- External CSS stylesheet (`info-panel.css`) for easier customization
- Improved button click handling for all floating controls

**TypeScript Migration & Architecture**
- Migrated entire codebase from JavaScript to TypeScript
- Removed Vue.js dependency for reduced bundle size
- Vite-based build system with proper module bundling
- Enhanced type safety and modular class architecture

### v1.4.5 — August 2024

**Smart Input Detection & UI Improvements**
- Hotkeys now detect when you're typing in input fields and won't activate
- Pin button properly toggles between unlocked and locked states
- 'U' key unlocks panel to mouse location without requiring Alt
- Updated default border colors to gray (#6b7280) for better UI integration
- Customizable info panel text and accent colors with smart defaults
- Automatic theme synchronization with ComfyUI frontend
- Percentage-based controls for opacity (10-100%) and zoom factor (100-1000%)
- Reset key ('O') now properly resets both panels to default positions

### v1.3.0 — June 2024

**Inspector Information Panel**
- New dockable panel providing real-time data about hovered canvas elements
- Detailed node analysis, media information, and technical Inspector tab
- Highly customizable: pin, lock, move, and style the panel

---

## Features

### Magnifying Glass

![Magnify Glass Settings](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/releases/download/assets-v1/magnify_glass_settings.png)

- **Smooth Zooming** — Magnify any part of the canvas with configurable zoom factor
- **Cursor Interaction** — Follow cursor or activate at fixed position
- **Customizable Appearance** — Adjust size, border, color, and shape (Circle, Square, Rounded Square)
- **Keyboard Controls** — Configurable activation key with optional Alt modifier
- **WebGL Powered** — Efficient rendering for smooth performance
- **Text Overlay** — Magnifies text within input widgets for better readability
- **Texture Filtering** — Linear (smooth) or Nearest (pixelated) rendering
- **Always Active Mode** — Toggle magnifier to stay on without holding keys

### Information Panel

![Inspector Preview](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/releases/download/assets-v1/inspector_preview_2.webp)

- **Node Analysis** — View title, type, parameters (seed, steps, CFG), and text box content
- **Media Details** — Information on images and other media elements
- **Inspector Tab** — Technical details: cursor coordinates, canvas scale, zoom level
- **Dockable & Customizable** — Pin, lock, move, and style the panel to your preference

![Always Active Mode](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/releases/download/assets-v1/always_active_action.webp)
*Always Active & Toggle Follow Key: Position the glass preview anywhere on the canvas.*

---

## Installation

### Option 1: ComfyUI Manager (Recommended)

1. Install [ComfyUI Manager](https://github.com/ltdrdata/ComfyUI-Manager) if not already installed
2. Open ComfyUI and navigate to the **Manager** tab
3. Click **Install Custom Nodes**
4. Search for "**ComfyUI-MagnifyGlass**" and click **Install**
5. Restart ComfyUI

### Option 2: Manual Installation

```bash
cd /path/to/ComfyUI/custom_nodes
git clone https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass.git
```

Restart ComfyUI after installation. No additional dependencies required.

---

## Usage

### Activation

- Press `X` to activate the magnifying glass (default key)
- In Always Active Mode, this toggles the magnifier on/off
- Activation key and Alt requirement are configurable in settings

### Controls

| Key | Action |
|-----|--------|
| `X` | Activate/toggle magnifier |
| Arrow Keys | Nudge magnified view |
| Shift + Arrow Keys | Larger nudge step |
| `O` | Reset offset to zero |
| `H` | Toggle Follow Cursor |
| `I` | Toggle Info Panel |
| `G` | Toggle Glass Preview |
| `U` | Unlock panel to mouse location |

### Configuration

Access settings via the gear icon (⚙️) in ComfyUI, then find the "Magnify Glass" section.

![Usage Example](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/releases/download/assets-v1/magnify_glass_usage.webp)
*Debug Mode & Arrow Keys: Some flickering may occur with VHS Combine Node Preview.*

---

## Configuration Reference

### Magnify Glass Settings

| Option | Description | Default |
|--------|-------------|---------|
| Zoom Factor | Magnification level (e.g., 300 = 3x zoom) | `300` |
| Glass Size | Diameter in pixels | `300` |
| Border Width | Border thickness in pixels | `1` |
| Border Color | Border color | `#6b7280` |
| Activation Key | Key to activate magnifier | `x` |
| Require Alt/Option | Require modifier key | `No` |
| Follow Cursor | Magnifier follows mouse | `No` |
| Offset Step | Arrow key adjustment step | `5` |
| Reset Key | Key to reset offset | `o` |
| Debug Mode | Show debug overlay | `No` |
| Glass Position | Position relative to cursor | `Bottom` |
| Shape | Circle, Square, or Rounded Square | `Rounded Square` |
| Show Border | Display border | `Yes` |
| Texture Filtering | Linear or Nearest | `Linear` |
| Always Active Mode | Stay on until toggled | `Yes` |
| Toggle Follow Key | Key to toggle follow mode | `h` |

### Information Panel Settings

| Option | Description | Default |
|--------|-------------|---------|
| Info Panel | Enable/disable panel | `Enabled` |
| Position | Relative to magnifying glass | `Left` |
| Width | Panel width in pixels | `320` |
| Opacity | Background opacity (10-100%) | `100` |
| Max Height | Maximum height in pixels | `500` |
| Theme | Color theme | `Automatic` |
| Animations | Enable animations | `Disabled` |
| Show Inspector Tab | Show technical details tab | `Disabled` |
| Toggle Hotkey | Key to toggle panel | `i` |
| Preview Toggle | Key to toggle glass preview | `g` |
| Pin Hotkey | Key to pin panel at mouse | `u` |
| Show Hover Controls | Show floating controls | `Enabled` |
| Controls Position | Floating controls position | `bottom-centered` |

---

## Troubleshooting

**Magnifier not appearing**
- Verify you're pressing the correct activation key (check settings)
- Open browser console (F12) and look for errors mentioning "ComfyUI Magnifying Glass"

**Performance issues**
- WebGL is used for efficiency, but complex scenes may impact performance
- Try reducing Glass Size if issues occur

**Text not sharp**
- Ensure browser zoom is at 100%

---

## Contributing

Contributions are welcome. Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

### Development Setup

This project uses TypeScript. To build from source:

```bash
cd ComfyUI-MagnifyGlass
pnpm install
pnpm build
```

---

## Acknowledgements

- The ComfyUI team for creating a flexible and powerful platform
- The LiteGraph.js library
- Users and contributors who provide feedback and suggestions

---

## Connect

- **YouTube**: [AEmotionStudio](https://www.youtube.com/@aemotionstudio/videos)
- **GitHub**: [AEmotionStudio](https://github.com/AEmotionStudio)
- **Discord**: [Join our community](https://discord.gg/UzC9353mfp)
- **Website**: [aemotionstudio.org](https://aemotionstudio.org/)

---

## Support

If you find ComfyUI-MagnifyGlass useful, consider supporting its development:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/aemotionstudio)

**Other ways to support:**
- Star the repository
- Share it with others
- Contribute to development

For business inquiries or professional support, contact via [website](https://aemotionstudio.org/) or [Discord](https://discord.gg/UzC9353mfp).

---

## License

This project is licensed under the **GNU General Public License v3.0**.
See the [LICENSE](LICENSE) file for details.
