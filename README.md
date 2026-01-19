<div align="center">

# ComfyUI-MagnifyGlass

**A powerful, customizable magnifying glass extension for ComfyUI.**

[![ComfyUI](https://img.shields.io/badge/ComfyUI-Extension-green?style=for-the-badge)](https://github.com/comfyanonymous/ComfyUI)
[![Version](https://img.shields.io/badge/Version-1.13.0-orange?style=for-the-badge)](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/releases)
[![License](https://img.shields.io/badge/License-GPLv3-red?style=for-the-badge)](LICENSE)
[![Dependencies](https://img.shields.io/badge/dependencies-none-brightgreen?style=for-the-badge&color=blue)](package.json)

[![Downloads](https://img.shields.io/badge/dynamic/json?color=blueviolet&label=Downloads&query=downloads.smart_count&url=https://raw.githubusercontent.com/AEmotionStudio/ComfyUI-MagnifyGlass/refs/heads/badges/traffic_stats.json&style=for-the-badge&logo=github)](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/releases)
![Visitors](https://img.shields.io/badge/dynamic/json?color=blue&label=Visitors&query=views.uniques&url=https://raw.githubusercontent.com/AEmotionStudio/ComfyUI-MagnifyGlass/refs/heads/badges/traffic_stats.json&style=for-the-badge&logo=github)
[![Clones](https://img.shields.io/badge/dynamic/json?color=success&label=Clones&query=clones.uniques&url=https://raw.githubusercontent.com/AEmotionStudio/ComfyUI-MagnifyGlass/refs/heads/badges/traffic_stats.json&style=for-the-badge&logo=github)](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/graphs/traffic)

[![Last Commit](https://img.shields.io/github/last-commit/AEmotionStudio/ComfyUI-MagnifyGlass?style=for-the-badge&label=Last%20Update&color=orange)](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/commits)
[![Activity](https://img.shields.io/github/commit-activity/m/AEmotionStudio/ComfyUI-MagnifyGlass?style=for-the-badge&label=Activity&color=yellow)](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/commits)

![MagnifyGlass Intro](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/releases/download/assets-v1/MagnifyGlass_Intro_v1.webp)  
*Inspect fine details in your generated images, node connections, and canvas with ease.*

[Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [Configuration](#️-configuration) • [Known Issues](#-known-issues) • [Contributing](#-contributing) • [Changelog](CHANGELOG.md)

</div>

---

## 🚀 What's New in v1.13.0 (January 19, 2026)

**Direct Node Editing & Performance Optimization**

*   **✏️ Direct Node Editing**: Modify node values (text, numbers, toggles, combos) directly from the Inspector Panel without leaving your spot.
*   **⚡ Performance Boost**: Batched DOM operations for HTML overlays significantly reduce layout thrashing.
*   **⌨️ Accessibility & UX**: 
    *   Full keyboard navigation (Arrows/Enter/Esc) for node selector dropdowns.
    *   Dropdowns now intelligently close when clicking the canvas.
*   **🛡️ Security Hardening**: Improved XSS protection in sidebar rendering.

> 📄 **See [CHANGELOG.md](CHANGELOG.md) for the complete version history.**

---

[<img src="https://img.youtube.com/vi/aUz5kbJDs0I/maxresdefault.jpg" width="100%">](https://youtu.be/aUz5kbJDs0I)

<p align="center"><i>NotebookLM Overview: Exploring the features and updates of the ComfyUI-MagnifyGlass extension. (Click to watch on YouTube)</i></p>

## ✨ Features

<table>
<tr>
<td width="50%">

### 🔍 Magnifying Glass
![Magnifying Glass](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/releases/download/assets-v1/MagnifyGlass_GlassPreview_v1.webp)

*   **WebGL-Powered**: Smooth, high-performance rendering at any zoom level.
*   **Smart Interactions**: Follows your cursor or stays fixed. Toggles transparently for click-through.
*   **Customizable**: Adjust zoom (up to 10x), size, border, and shape (Circle/Square/Rounded).

</td>
<td width="50%">

### ℹ️ Inspector Panel
![Inspector Panel](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/releases/download/assets-v1/MagnifyGlass_InspectorPanel_v1.webp)

*   **Deep Analysis**: View node parameters (Seed, CFG, Steps), text content, and image details on hover.
*   **Dockable Interface**: Pin the panel to keep it stable, or let it follow the glass.
*   **Themed**: Automatically matches any ComfyUI theme (Dark, Light, Solarized, Arc, Nord, GitHub).

</td>
</tr>
<tr>
<td width="50%">

### ⚙️ Sidebar Integration
![Sidebar Integration](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/releases/download/assets-v1/MagnifyGlass_Sidebar_v1.webp)

*   **Organized Settings**: All Magnify Glass and Info Panel settings in one place.
*   **Live Previews**: Changes apply instantly without needing to refresh.
*   **Reset Options**: Quickly restore defaults with individual or global reset buttons.

</td>
<td width="50%">

### 🖥️ Multi-Monitor Pop-Out
![Multi-Monitor Pop-Out](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/releases/download/assets-v1/MagnifyGlass_Popout_v1.webp)

*   **Detachable Viewer**: Open the magnified view in a separate browser tab.
*   **Inspector Sidebar**: Real-time node details, cursor position, and canvas scale.
*   **Resizable Canvas**: Drag to resize, size persists across sessions.

</td>
</tr>
<tr>
<td width="50%">

### ♿ Accessibility Suite
![Accessibility Suite](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/releases/download/assets-v1/MagnifyGlass_Access_v1.webp)

*   **Visual Modes**: Toggle **Invert Colors** or **Grayscale** for high-contrast viewing.
*   **Reduce Motion**: Disable smooth animations for instant feedback.
*   **Text Enhancements**: Scaling, Bold, Glow, and Outline options for maximum legibility.

</td>
<td width="50%">

<!-- Empty cell for layout balance or future feature -->

</td>
</tr>
</table>

---

## 📦 Installation

### Option 1: ComfyUI Manager (Recommended)
1.  Open **ComfyUI Manager**.
2.  Search for **`ComfyUI-MagnifyGlass`**.
3.  Click **Install**.

### Option 2: Manual Install
```bash
cd /path/to/ComfyUI/custom_nodes
git clone https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass.git
```

---

## 🎮 Usage

| Key | Action |
| :--- | :--- |
| **`X`** | **Activate / Toggle Tool** (Master Switch) |
| **`H`** | Toggle Follow Cursor Mode |
| **`I`** | Toggle Inspector Panel Visibility |
| **`G`** | Toggle Glass Preview (Enters "Inspector Only" Mode) |
| **`Shift+P`** | Open Pop-Out Viewer in New Tab |
| **`U`** | Pin/Unpin Inspector Panel |
| **`O`** | Reset Offsets |
| **`*`** | **Focus Current Node** (Center canvas on inspected node) |
| **`Left/Right`** | Navigate Previous/Next node in execution order |
| **`D`** | Force Direct Capture (Optional after v1.11.0 improvements) |
| **Arrows** | Nudge Glass Position (When not navigating nodes) |

> **Pro Tip:** Toggle the **Glass Preview (`G`)** off to keep the Inspector Panel active but hide the magnifying preview.

---

## ⚙️ Configuration

Access settings via the **new Sidebar Panel** or the ComfyUI Settings (⚙️) menu.

<details>
<summary><b>🔍 Magnify Glass</b></summary>

| Setting | Default | Description |
| :--- | :--- | :--- |
| **Zoom Factor** | `300%` | Magnification level (100% - 1000%). |
| **Glass Size** | `300px` | Diameter/Size of the lens (50px - 500px). |
| **Shape** | `Rounded Square` | Circle, Square, or Rounded Square. |
| **Position** | `Top-Right` | Offset position relative to cursor. |
| **Filtering** | `Linear` | Texture filtering: Linear (smooth) or Nearest (pixelated). |
| **Border Width** | `2px` | Width of the glass border. |
| **Border Color** | `#FFFFFF` | Color of the glass border. |
| **Show Border** | `On` | Toggle the glass border visibility. |
| **Follow Cursor** | `Off` | If On, glass moves with your mouse. |
| **Always Active** | `On` | Keep the glass visible after activation. |
| **Force Direct Capture**| `Off` | High-accuracy mode for low zoom levels. |
| **Show Mini Cursor** | `Off` | Displays a cursor preview inside the glass. |

</details>

<details>
<summary><b>ℹ️ Information Panel</b></summary>

| Setting | Default | Description |
| :--- | :--- | :--- |
| **Enable Panel** | `On` | Toggle the visibility of the node inspector. |
| **Persist Info** | `Off` | Keep last node info visible when not hovering a node. |
| **Node Highlight** | `On` | Show high-contrast border around inspected node. |
| **Position** | `Bottom` | Position relative to the glass (Top/Bottom/Left/Right). |
| **Width** | `300px` | Width of the inspector panel. |
| **Max Height** | `300px` | Maximum vertical size before scrolling. |
| **Font Size** | `14px` | Size of the text in the inspector. |
| **Opacity** | `100%` | Background transparency of the panel. |
| **Font Family** | `System` | Custom font selection for the panel. |
| **Text Color** | `#6B7280` | Custom text color for node data. |
| **Accent Color** | `#3B82F6` | Color for headers and highlights. |
| **Hover Controls** | `On` | Show floating quick-action buttons. |
| **Controls Position** | `Left` | Anchor point for the floating controls. |

</details>

<details>
<summary><b>♿ Accessibility</b></summary>

| Setting | Default | Description |
| :--- | :--- | :--- |
| **Enable Accessibility** | `Off` | Enable accessibility enhancements for the glass preview. |
| **High Contrast** | `Off` | Boost text contrast with bright colors. |
| **Text Glow** | `Off` | Add a glow effect behind text for better visibility. |
| **Glow Color** | `#FFFF00` | Customizable color for the text glow. |
| **Glow Intensity** | `5px` | Blur radius/intensity of the text glow. |
| **Font Scale** | `100%` | Increase text size within the glass view (up to 200%). |
| **Bold Text** | `Off` | Force bold text weight for improved legibility. |
| **Text Outline** | `Off` | Add a high-contrast outline around text. |
| **Outline Color** | `#000000` | Customizable color for the text outline. |
| **Node Emphasis** | `Off` | Apply extra styling/weight to node titles. |
| **Invert Colors** | `Off` | Invert all colors in the glass view. |
| **Grayscale Mode** | `Off` | Remove all color saturation from the view. |
| **Reduce Motion** | `Off` | Disable smooth animations for instant feedback. |

</details>

---

## 🐛 Known Issues

*   **FPS Counter Visual Bug**: While the magnifying glass is active, the ComfyUI FPS counter may display inflated values (often reaching the ~10,000 FPS limit). This is a visual display issue only and does not appear to affect actual performance.

---

## 🤝 Contributing

Contributions are welcome! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to get started. Whether it's bug reports, feature suggestions, or pull requests, your help is appreciated.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---

## 📝 License

This project is licensed under the [GPL-3.0](LICENSE) License - see the [LICENSE](LICENSE) file for details.

---



<div align="center">

**Developed by [Æmotion Studio](https://aemotionstudio.org/)**

[![YouTube](https://img.shields.io/badge/YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://www.youtube.com/@aemotionstudio/videos)
[![Discord](https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/UzC9353mfp)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/aemotionstudio)

</div>

---

<div align="center">

## 📺 STOP SQUINTING!

**Are YOU tired of tiny nodes? Do messy workflows make you want to SCREAM? 😱**
**Get ComfyUI-MagnifyGlass TODAY!**
*It ZOOMS! It INSPECTS! It POPS OUT!* ⚡️🔍

[<img src="https://img.youtube.com/vi/2qOlO-QPZ4o/maxresdefault.jpg" width="100%">](https://youtu.be/2qOlO-QPZ4o)

<p align="center"><i>(Click to watch on YouTube)</i></p>

</div>
