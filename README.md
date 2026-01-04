<div align="center">

# ComfyUI-MagnifyGlass

[![ComfyUI](https://img.shields.io/badge/ComfyUI-Extension-green?style=for-the-badge)](https://github.com/comfyanonymous/ComfyUI)
[![Version](https://img.shields.io/badge/Version-1.8.0-orange?style=for-the-badge)](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/releases)
[![License](https://img.shields.io/badge/License-GPLv3-red?style=for-the-badge)](LICENSE)
[![Dependencies](https://img.shields.io/badge/dependencies-none-brightgreen?style=for-the-badge&color=blue)](package.json)

[![Downloads](https://img.shields.io/badge/dynamic/json?color=blueviolet&label=Downloads&query=downloads.smart_count&url=https://raw.githubusercontent.com/AEmotionStudio/ComfyUI-MagnifyGlass/refs/heads/badges/traffic_stats.json&style=for-the-badge&logo=github)](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/releases)
![Visitors](https://img.shields.io/badge/dynamic/json?color=blue&label=Visitors&query=views.uniques&url=https://raw.githubusercontent.com/AEmotionStudio/ComfyUI-MagnifyGlass/refs/heads/badges/traffic_stats.json&style=for-the-badge&logo=github)
[![Clones](https://img.shields.io/badge/dynamic/json?color=success&label=Clones&query=clones.uniques&url=https://raw.githubusercontent.com/AEmotionStudio/ComfyUI-MagnifyGlass/refs/heads/badges/traffic_stats.json&style=for-the-badge&logo=github)](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/graphs/traffic)

[![Last Commit](https://img.shields.io/github/last-commit/AEmotionStudio/ComfyUI-MagnifyGlass?style=for-the-badge&label=Last%20Update&color=orange)](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/commits)
[![Activity](https://img.shields.io/github/commit-activity/m/AEmotionStudio/ComfyUI-MagnifyGlass?style=for-the-badge&label=Activity&color=yellow)](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/commits)

**A powerful, customizable magnifying glass extension for ComfyUI.**  
*Inspect fine details in your generated images, node connections, and canvas with ease.*

[Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [Configuration](#️-configuration) • [Changelog](CHANGELOG.md)

</div>

---

## 🚀 What's New in v1.8.0 (January 4, 2026)

This release brings a complete overhaul to the rendering engine for **native fidelity**:

*   **Native Text Rendering**: Widget text (prompts, values) now renders natively on the magnified canvas with sharper alignment.
*   **Video & Image Support**: Fixed artifacts for video nodes and image previews in "Virtual Zoom" mode.
*   **"Ghosting" Fix**: Eliminated visual glitches where original nodes would bleed through the magnified view.
*   **Performance Boost**: Smarter render pipeline reduces overhead and DOM usage.

> 📄 **See [CHANGELOG.md](CHANGELOG.md) for the complete version history.**

---

## ✨ Features

<div align="center">
  <img src="https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/releases/download/assets-v1/magnify_glass_action.webp" width="800" alt="Magnify Glass Demo">
</div>

### 🔍 Magnifying Glass
*   **WebGL-Powered**: Smooth, high-performance rendering at any zoom level.
*   **Smart Interactions**: Follows your cursor or stays fixed. Toggles transparently for click-through.
*   **Customizable**: Adjust zoom (up to 10x), size, border, and shape (Circle/Square/Rounded).

### ℹ️ Inspector Panel
*   **Deep Analysis**: View node parameters (Seed, CFG, Steps), text content, and image details on hover.
*   **Dockable Interface**: Pin the panel to keep it stable, or let it follow the glass.
*   **Themed**: Automatically matches any ComfyUI theme (Dark, Light, Solarized, Arc, Nord, GitHub).

### ⚙️ Sidebar Integration
*   **Organized Settings**: All Magnify Glass and Info Panel settings in one place.
*   **Live Previews**: Changes apply instantly without needing to refresh.
*   **Reset Options**: Quickly restore defaults with individual or global reset buttons.

### 🖥️ Multi-Monitor Pop-Out
*   **Detachable Viewer**: Open the magnified view in a separate browser tab.
*   **Inspector Sidebar**: Real-time node details, cursor position, and canvas scale.
*   **Resizable Canvas**: Drag to resize, size persists across sessions.

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
| **Arrows** | Nudge Glass Position |

> **Pro Tip:** Toggle the **Glass Preview (`G`)** off to keep the Inspector Panel active but hide the magnifying preview.

---

## ⚙️ Configuration

Access settings via the **new Sidebar Panel** or the ComfyUI Settings (⚙️) menu.

**Magnify Glass**
| Setting | Default | Description |
| :--- | :--- | :--- |
| **Zoom Factor** | `300` | Magnification level (300 = 3x). |
| **Glass Size** | `300px` | Diameter of the lens. |
| **Shape** | `Rounded` | Circle, Square, or Rounded Square. |
| **Activation Key** | `X` | Hotkey to toggle the tool. |

**Information Panel**
| Setting | Default | Description |
| :--- | :--- | :--- |
| **Theme** | `Auto` | Syncs with ComfyUI theme automatically. |
| **Opacity** | `100%` | Transparency of the panel background. |
| **Show Hover Controls** | `On` | Displays the quick-action toolbar on the panel. |
| **Controls Position** | `Top` | Position of hover controls (Top/Bottom). |

---

## 📝 License

This project is licensed under the [GPL-3.0](LICENSE) License - see the [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

Contributions are welcome! Please submit a Pull Request or open an Issue on GitHub.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---

<div align="center">

**Developed by [Æmotion Studio](https://aemotionstudio.org/)**

[![YouTube](https://img.shields.io/badge/YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://www.youtube.com/@aemotionstudio/videos)
[![Discord](https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/UzC9353mfp)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/aemotionstudio)

</div>
