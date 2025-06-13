# ComfyUI-MagnifyGlass

![Version](https://img.shields.io/badge/version-1.4.0-blue.svg)
![ComfyUI](https://img.shields.io/badge/ComfyUI-compatible-green)
![License](https://img.shields.io/badge/license-GPL--3.0-brightgreen.svg)
![Dependencies](https://img.shields.io/badge/dependencies-none-brightgreen.svg)

**Enhance your ComfyUI workflow with a powerful and customizable magnifying glass!**

ComfyUI-MagnifyGlass adds an intuitive magnifying glass to your ComfyUI canvas, allowing you to zoom in on details with ease. Activate it with a simple key combination and customize its appearance and behavior to fit your needs.

> [!TIP]
> Perfect for inspecting fine details in your generated images, node connections, or any part of the ComfyUI canvas!

![Magnify Glass in Action Wepb](images/magnify_glass_action.webp)

## 🚀 Latest Updates

**6/12/25 (v1.3.0)**

- **Inspector Information Panel:** I've introduced a new dockable panel that provides real-time data about whatever you're hovering over on the canvas. It includes detailed node analysis, media information, and a technical "Inspector" tab. Check out the "Features" and "Configuration" sections below for more details!

![Inspector Usage Example Webp](images/inspector_preview_2.webp)

## ✨ Features

![Magnify Glass Settings Webp](images/magnify_glass_settings.png)

- **🔍 Smooth Zooming**: Magnify any part of the ComfyUI canvas with a configurable zoom factor.
- **🖱️ Cursor Interaction**:
    - **Follow Cursor**: Magnifier can follow your mouse movements.
    - **Fixed Position**: Alternatively, activate it at a specific spot.
    - **Precise Positioning**: Position the glass relative to the cursor (Top, Bottom, Left, Right, Corners).
- **🎨 Customizable Appearance**:
    - **Glass Size**: Adjust the diameter of the magnifying glass.
    - **Border Styling**: Enable/disable border, set custom border width and color.
    - **Glass Shape**: Choose between Circle, Square, or Rounded Square.
- **⌨️ Keyboard Controls**:
    - **Configurable Activation**: Set your preferred activation key (e.g., X, Z, M) with an optional Alt/Option modifier.
    - **Offset Adjustment**: Fine-tune the magnified view using arrow keys (Shift + Arrow for larger steps).
    - **Offset Reset**: Quickly reset the view offset with a configurable key (e.g., R, O) and optional Alt/Option modifier.
- **🛠️ WebGL Powered**: Efficient rendering using WebGL for smooth performance.
- **📝 Text Overlay**: Magnifies text within input widgets for better readability.
- **🐞 Debug Mode**: Optional debug overlay showing detailed information and a visualization of the source area.
- **⚙️ Settings Integration**: All options are configurable through the ComfyUI settings dialog.
- **💾 Persistent Offsets**: Manually adjusted offsets are saved and loaded across sessions.
- **🖼️ Texture Filtering**: Choose between Linear (smooth) and Nearest (pixelated) texture filtering for the magnified view.
- **🔒 Always Active Mode**: Toggle the magnifier to stay on/off without holding keys.
- **🔑 Toggle Follow Key**: Use a configurable key (default 'H') to toggle the 'Follow Cursor' behavior on the fly.
- **📊 Information Panel**: An optional, dockable panel that provides real-time data about the object you are hovering over.
    - **Node Analysis**: See detailed information about nodes, including title, type, important parameters (like seed, steps, CFG), and content from text boxes.
    - **Media Details**: Get information on images and other media.
    - **Inspector Tab**: A special tab showing technical details like cursor coordinates, canvas scale, and magnifier zoom level.
    - **Highly Customizable**: Pin, lock, and move the panel. Change its appearance, opacity, and more through settings.

![Always Active Mode in Action Webp](images/always_active_action.webp)
*(🔒 Always Active & 🔑 Toggle Follow Key Showcase: you can essentially set the glass preview where ever you want on the canvas and toggle it off and on.)*

## 📥 Installation

### Option 1: Using ComfyUI Manager

1.  Install [ComfyUI Manager](https://github.com/ltdrdata/ComfyUI-Manager) if you don't have it already.
2.  Open ComfyUI, go to the **Manager** tab.
3.  Click on **Install Custom Nodes**.
4.  Search for "**ComfyUI-MagnifyGlass**" and click **Install**.
5.  Restart ComfyUI.

### Option 2: Manual Installation

```bash
cd /path/to/ComfyUI/custom_nodes
git clone https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass.git
```

Restart ComfyUI after installation. No additional `pip install` steps are typically required for JavaScript-based extensions.

## 🚀 Usage

1.  **Activation**:
    - By default, press `X` to activate the magnifying glass. If "Always Active Mode" is enabled, this combination toggles the magnifier on or off.
    - The activation key and whether `Alt/Option` is required can be changed in the settings.
2.  **Using the Magnifier**:
    - While active, move your mouse over the ComfyUI canvas to see the magnified view.
    - If `Follow Cursor` is disabled, the magnifier will remain where it was activated.
3.  **Controls (while active)**:
    - **Arrow Keys**: Nudge the magnified view (adjusts `offsetX`/`offsetY`).
    - **Shift + Arrow Keys**: Nudge the magnified view by a larger step.
    - **Reset Key (default 'R')**: Resets `offsetX` and `offsetY` to zero. (Configurable, respects the global "Require Alt/Option Key" setting).
    - **Toggle Follow Key (default 'H')**: Toggles the `Follow Cursor` behavior on/off. (Configurable, respects the global "Require Alt/Option Key" setting).
4.  **Configuration**:
    - Access all settings by clicking the ⚙️ (Settings) icon in ComfyUI, then find the "🔍 Magnify Glass" section.

![Magnify Glass Usage Example Webp](images/magnify_glass_usage.webp)
*(🐞 Debug Mode & Arrow Keys Showcase: ⚠️ some flickering may occur with the VHS Combine Node Preview when moving the glass across the preview service while active.)*

## ⚙️ Configuration Options

All options are available in the ComfyUI settings dialog under the "🔍 Magnify Glass" section.

| Option                               | Description                                                                                               | Default Value    |
|--------------------------------------|-----------------------------------------------------------------------------------------------------------|------------------|
| **Zoom Factor**                      | Magnification level (e.g., 2.5 means 2.5x zoom).                                                          | `3`              |
| **Glass Size (px)**                  | Diameter of the magnifying glass in pixels.                                                               | `300`            |
| **Border Width (px)**                | Width of the border around the magnifying glass.                                                          | `2`              |
| **Border Color**                     | Color of the border around the magnifying glass.                                                          | `#ffffff`        |
| **Activation Key**                   | The key (case-insensitive) to hold down to activate the magnifier.                                        | `x`              |
| **Require Alt/Option Key**           | If Yes, Alt (Windows/Linux) or Option (Mac) must be held for activation and for reset.                 | `No (false)`     |
| **Follow Cursor Position**           | If Yes, the magnifier window moves with the cursor. If No, it stays where activated.                      | `Yes (true)`     |
| **Offset Adjust Step (Graph Units)** | How many graph units the view shifts when pressing arrow keys (Shift+Arrow = 5x).                         | `5`              |
| **Reset Offset Key**                 | The key to press to reset the view offset while active.                                                   | `o`              |
| **Debug Mode**                       | Show detailed logging and the debug visualization overlay.                                                | `Disabled (false)`|
| **Glass Position**                   | Position of the magnifying glass relative to the cursor.                                                  | `Bottom`         |
| **Shape**                            | Shape of the magnifying glass (Circle, Square, Rounded Square).                                           | `Rounded Square`         |
| **Show Border**                      | Enable or disable the border around the magnifying glass.                                                 | `Yes (true)`     |
| **Texture Filtering**                | Controls how the magnified image is scaled. Linear is smoother, Nearest is sharper/pixelated.             | `Linear`         |
| **Always Active Mode**               | If Yes, activating the magnifier keeps it on until activated again. If No, it deactivates on key release. | `Yes (true)`     |
| **Toggle Follow Key**                | The key to toggle 'Follow Cursor' behavior. Works with Alt/Option if 'Require Alt/Option Key' is Yes.   | `h`              |

### 📊 Information Panel Options

These settings control the behavior and appearance of the optional Info Panel.

| Option | Description | Default Value |
| --- | --- | --- |
| **Info Panel** | Enable or disable the professional information panel. | `Enabled` |
| **Info Panel Position** | Position of the info panel relative to the magnifying glass. | `Left` |
| **Info Panel Width** | Width of the information panel in pixels. | `320` |
| **Info Panel Opacity** | Opacity of the information panel background. | `0.95` |
| **Info Panel Max Height** | Maximum height of the information panel in pixels. | `500` |
| **Info Panel Theme** | Color theme for the information panel. | `Dark` |
| **Info Panel Animations**| Enable or disable animations for the info panel. | `Enabled` |
| **Show Inspector Tab** | Show or hide the Inspector tab with cursor and canvas information. | `Disabled` |
| **Info Panel Toggle Hotkey**| Key to toggle the info panel visibility while the magnifier is active. | `i` |
| **Preview Toggle Hotkey**| Key to toggle the magnifying glass preview visibility. | `g` |
| **Pin Panel Hotkey** | Key to use with Alt to pin the info panel at mouse location (e.g., Alt+P). | `p` |
| **Show Hover Controls**| Show or hide hovering UI controls above the info panel. | `Enabled` |
| **Controls Position** | Position of the floating control buttons relative to the info panel. | `bottom-centered` |

## ❓ Troubleshooting

-   **Magnifier not appearing**:
    -   Ensure you are pressing the correct activation key combination (check settings for current keys).
    -   Make sure ComfyUI has focus.
    -   Check the browser console (F12) for any errors related to "ComfyUI Magnifying Glass".
-   **Performance issues on very complex graphs**:
    -   While WebGL is used for efficiency, extremely complex scenes might still impact performance. Try reducing the `Glass Size` if issues occur.
-   **Text in widgets not sharp enough**:
    -   The HTML overlay feature aims to render text crisply. If you notice issues, ensure your browser zoom is at 100%.

## 🤝 Contributing

Contributions are welcome! Whether it's bug reports, feature suggestions, or pull requests, your help is appreciated.

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/AmazingFeature`).
3.  Make your changes.
4.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
5.  Push to the branch (`git push origin feature/AmazingFeature`).
6.  Open a Pull Request.

## 🙏 Acknowledgements

-   The ComfyUI team for creating such a flexible and powerful platform.
-   The LiteGraph.js library.
-   Users and contributors who provide feedback and suggestions.

## 🔗 Connect with Me (Developer)

- YouTube: [AEmotionStudio](https://www.youtube.com/@aemotionstudio/videos)
- GitHub: [AEmotionStudio](https://github.com/AEmotionStudio)
- Discord: [Join our community](https://discord.gg/UzC9353mfp)
- Website: [aemotionstudio.org](https://aemotionstudio.org/)

## ☕ Support

If you find ComfyUI-MagnifyGlass useful, consider supporting its development:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/aemotionstudio)

Your support helps me dedicate more time to maintaining and improving this project and others with new features, bug fixes, and better documentation.

### 💖 Additional Ways to Support

- ⭐ Star the repository
- 📢 Share it with others
- 🛠️ Contribute to its development

For business inquiries or professional support, please contact me through my [website](https://aemotionstudio.org/) or join my [Discord server](https://discord.gg/UzC9353mfp).

## 📜 License

This project is licensed under the **GNU General Public License v3.0**.
See the [LICENSE](LICENSE) file for details. 
