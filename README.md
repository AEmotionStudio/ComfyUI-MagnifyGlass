<div align="center">

# ComfyUI-MagnifyGlass

[![ComfyUI](https://img.shields.io/badge/ComfyUI-Extension-green?style=for-the-badge)](https://github.com/comfyanonymous/ComfyUI)
[![Dependencies](https://img.shields.io/badge/dependencies-none-brightgreen?style=for-the-badge&color=blue)](package.json)
[![License](https://img.shields.io/badge/License-GPLv3-red?style=for-the-badge)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.5.0-orange?style=for-the-badge)](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/releases)
[![Downloads](https://img.shields.io/github/downloads/AEmotionStudio/ComfyUI-MagnifyGlass/total?style=for-the-badge&color=blueviolet)](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/releases)
![Visitor Count](https://visitor-badge.laobi.icu/badge?page_id=AEmotionStudio.ComfyUI-MagnifyGlass)
[![Clones](https://img.shields.io/badge/dynamic/json?color=success&label=Clone%20Count&query=count&url=https://raw.githubusercontent.com/AEmotionStudio/ComfyUI-MagnifyGlass/badges/git_clones.json&logo=github&style=for-the-badge)](https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/graphs/traffic)

**A powerful, customizable magnifying glass extension for ComfyUI.**  
*Inspect fine details in your generated images, node connections, and canvas with ease.*

[Features](#features) • [Installation](#installation) • [Usage](#usage) • [Configuration](#configuration) • [Changelog](CHANGELOG.md)

</div>

---

## 🚀 Latest Updates (v1.5.0)

I've completely overhauled the UI and workflow for a seamless experience. Major highlights include:

*   **Modernized UI**: Professional SVG icons and full support for all ComfyUI themes (Dark, Solarized, Nord, etc.).
*   **Smart Workflow**: The Inspector Panel now intelligently pins/unpins based on your usage, allowing for both "Follow Glass" and "Free Floating" modes.
*   **Quick Access**: New toolbar toggle for instant access.

> 📄 **See [CHANGELOG.md](CHANGELOG.md) for the complete version history and detailed patch notes.**

---

## ✨ Features

<div align="center">
  <img src="https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass/releases/download/assets-v1/magnify_glass_action.webp" width="800" alt="Magnify Glass Demo">
</div>

### 🔍 Magnifying Glass
*   **High Performance**: WebGL-powered rendering for smooth zooming.
*   **Smart Interactions**: Follows your cursor or stays fixed. Toggles transparently to let you click through to nodes.
*   **Customizable**: Adjust zoom level (up to 10x), size, border, and shape (Circle/Square).

### ℹ️ Inspector Panel
*   **Deep Analysis**: Hover over any node to see parameters (Seed, CFG, Steps), text content, and image details.
*   **Dockable Interface**: Pin the panel to the screen to keep it stable, or let it follow the glass.
*   **Inspector Tab**: Technical breakdown of coordinate space and scaling for power users.

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
| **`U`** | Pin/Unpin Inspector Panel |
| **`O`** | Reset Offsets |
| **Arrows** | Nudge Glass Position |

> **Pro Tip:** Toggle the **Glass Preview (`G`)** off to keep the Inspector Panel active but hide the magnifying preview.

---

## ⚙️ Configuration

Access settings via the ComfyUI Settings (⚙️) menu.

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

**Developed by [AEmotionStudio](https://aemotionstudio.org/)**

[![YouTube](https://img.shields.io/badge/YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://www.youtube.com/@aemotionstudio/videos)
[![Discord](https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/UzC9353mfp)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/aemotionstudio)

</div>
