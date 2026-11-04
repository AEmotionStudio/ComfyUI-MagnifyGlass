<div align="center">

# ComfyUI-MagnifyGlass

**A powerful, customizable magnifying glass extension for ComfyUI.**

[![ComfyUI](https://img.shields.io/badge/ComfyUI-Extension-green?style=for-the-badge)](https://github.com/comfyanonymous/ComfyUI)
[![Version](https://img.shields.io/badge/Version-1.15.0-orange?style=for-the-badge)](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/releases)
[![License](https://img.shields.io/badge/License-GPLv3-red?style=for-the-badge)](LICENSE)
[![Dependencies](https://img.shields.io/badge/dependencies-none-brightgreen?style=for-the-badge&color=blue)](package.json)

[![Downloads](https://img.shields.io/badge/dynamic/json?color=blueviolet&label=Downloads&query=downloads.smart_count&url=https://raw.githubusercontent.com/AEmotionStudio/ComfyUI-MagnifyGlass/refs/heads/badges/traffic_stats.json&style=for-the-badge&logo=github)](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/releases)
![Visitors](https://img.shields.io/badge/dynamic/json?color=blue&label=Visitors&query=views.uniques&url=https://raw.githubusercontent.com/AEmotionStudio/ComfyUI-MagnifyGlass/refs/heads/badges/traffic_stats.json&style=for-the-badge&logo=github)
[![Clones](https://img.shields.io/badge/dynamic/json?color=success&label=Clones&query=clones.uniques&url=https://raw.githubusercontent.com/AEmotionStudio/ComfyUI-MagnifyGlass/refs/heads/badges/traffic_stats.json&style=for-the-badge&logo=github)](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/graphs/traffic)

[![Last Commit](https://img.shields.io/github/last-commit/AEmotionStudio/ComfyUI-MagnifyGlass?style=for-the-badge&label=Last%20Update&color=orange)](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/commits)
[![Activity](https://img.shields.io/github/commit-activity/m/AEmotionStudio/ComfyUI-MagnifyGlass?style=for-the-badge&label=Activity&color=yellow)](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/commits)

![MagnifyGlass Intro](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/releases/download/assets-v2/MagnifyGlass_Intro_v2.webp)  
*Inspect fine details in your generated images, node connections, and canvas with ease.*

[Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [Configuration](#️-configuration) • [Known Issues](#-known-issues) • [Contributing](#-contributing) • [Changelog](CHANGELOG.md)

</div>

---

## 🚀 What's New in v1.15.0 (November 4, 2026)

**Inspector and Pop-Out Overhaul: New Look, Navigation and a Second-Monitor Viewer**

*   **🎨 Follows Your Palette**: The Inspector, its toolbar, its menus and the pop-out viewer use your ComfyUI palette, light or dark. The built-in themes are gone.
*   **🧭 Header and Go to Node**: Title, `#id` and type in the header, Back/Forward, Previous/Next in execution order, and a searchable node picker. Subgraph path and group show as a breadcrumb.
*   **📌 Simpler Modes**: Follow the glass or drag the header to float. **Sticky**, **Lock** and the new **Follow Selection** decide which node is shown. Hold is replaced by Lock.
*   **✏️ Reliable Editing**: Canvas-matching number steps, commit on Enter, revert on Escape, multiline prompts, undo, and subgraph support.
*   **🖥️ Pop-Out Viewer**: A popup window that keeps pace with the glass, with the Inspector's rows, navigation and editing, run progress and errors, output thumbnails, clickable input/output links, zoom, and Split, Glass, Info and Output views.

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
![Inspector Panel](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/releases/download/assets-v2/MagnifyGlass_InspectorPanel_v2.webp)

*   **Live Widgets**: Every widget of the hovered node, editable while Sticky, Locked or following the selection, with copy on every row.
*   **Navigation**: Go to any node by title, type or `#id`, step through execution order, and go Back/Forward through your jumps.
*   **Follows Your Palette**: Matches any ComfyUI palette. Follow the glass or drag the header to float and resize it.

</td>
</tr>
<tr>
<td width="50%">

### ⚙️ Sidebar Integration
![Sidebar Integration](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/releases/download/assets-v2/MagnifyGlass_Sidebar_v2.webp)

*   **Organized Settings**: Every glass, Inspector, hotkey and accessibility setting in one panel that follows your palette, with the Inspector panel switch at the top.
*   **Live Previews**: Changes apply instantly without needing to refresh.
*   **Quick Actions**: Open the pop-out viewer from the header, reset a section or everything, and find links and version info under About.

</td>
<td width="50%">

### 🖥️ Multi-Monitor Pop-Out
![Multi-Monitor Pop-Out](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/releases/download/assets-v2/MagnifyGlass_Popout_v2.webp)

*   **Detachable Viewer**: Open the glass in a popup window for a second monitor; it keeps updating while the glass is hidden and follows your palette.
*   **Inspector Sidebar**: The Inspector's rows, navigation and editing, plus the node's links, outputs and run progress, with the last error and its traceback.
*   **Controls**: Zoom, Lock, and Split, Glass, Info and Output views with a resizable frame and divider.

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
| **`G`** | Toggle Glass Preview (with the Inspector panel on, keeps the panel and hides the glass) |
| **`Shift+P`** | Open / Close the Pop-Out Viewer (popup window) |
| **`U`** | Inspector: Follow the Glass / Float |
| **`S`** | Inspector: Toggle Sticky |
| **`O`** | Reset Offsets |
| **`*`** | **Centre on Node** (centres the canvas and locks the Inspector to it) |
| **`Left/Right`** | Previous/Next node in execution order (while the Inspector is hovered or focused) |
| **`D`** | Force Direct Capture (Optional after v1.11.0 improvements) |
| **Arrows** | Nudge Glass Position (When not navigating nodes) |

In the pop-out viewer, outside text fields:

| Key | Action |
| :--- | :--- |
| **`Left/Right`** | Previous/Next node in execution order |
| **`L`** | Lock / Unlock the shown node |
| **`Ctrl+K`** | Go to node |
| **`Esc`** | Close the picker, or leave the Output view |
| **Mouse wheel** | Zoom (over the frame) |

> **Pro Tip:** Press **`G`** to hide the magnifying preview and keep only the Inspector Panel. For the glass alone, turn off **Inspector panel** in the sidebar.

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
| **Border Width** | `1px` | Width of the glass border. |
| **Border Color** | `#6B7280` | Color of the glass border. |
| **Show Border** | `On` | Toggle the glass border visibility. |
| **Follow Cursor** | `Off` | If On, glass moves with your mouse. |
| **Always Active** | `On` | Keep the glass visible after activation. |
| **Force Direct Capture**| `Off` | High-accuracy mode for low zoom levels. |
| **Show Mini Cursor** | `Off` | Displays a cursor preview inside the glass. |

> Image previews, videos and animated images show in the glass in both capture modes. In Nodes 2.0 (Vue nodes) mode the glass always uses Direct Capture and paints the nodes from the page, without their icons.

</details>

<details>
<summary><b>ℹ️ Information Panel</b></summary>

| Setting | Default | Description |
| :--- | :--- | :--- |
| **Inspector panel** | `On` | Off leaves only the glass: the panel, its hotkeys (`I`, `U`, `S`, `*`) and its highlight are removed. |
| **Sticky** | `Off` | Keep the last node shown when not hovering a node. |
| **Follow Selection** | `Off` | Show the selected node instead of the hovered one. |
| **Node Highlight** | `On` | Show high-contrast border around inspected node. |
| **Position** | `Bottom` | Position relative to the glass (Top/Bottom/Left/Right). |
| **Width** | `300px` | Width of the inspector panel. |
| **Max Height** | `600px` | Maximum height before the panel scrolls. |
| **Font Size** | `14px` | Size of the text in the inspector. |
| **Opacity** | `100%` | Background transparency of the panel. |
| **Font Family** | `System` | Font for the panel; only fonts installed locally are used. |
| **Text Color** | `#6B7280` | Overrides the palette's text color when changed from the default. |
| **Accent Color** | `#3B82F6` | Overrides the palette's accent color when changed from the default. |
| **Hover Controls** | `On` | Show floating quick-action buttons. |
| **Controls Position** | `Left` | Anchor point for the floating controls. |

> Drag the panel's header to float it, and its corner to set Width and Max Height. **Lock** in the header keeps one node shown while you hover others.
>
> **Move Glass Position** (drag-glass mode) is one of the panel's floating controls, so it is unavailable while the Inspector panel is off. Use Follow Cursor (`H`) or the arrow keys instead.

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
| **Reduce Motion** | `On` | Disable smooth animations for instant feedback. |

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
