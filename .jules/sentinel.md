# Sentinel's Journal

## 2026-01-06 - Improper DOM Manipulation XSS
**Vulnerability:** Found multiple instances of `innerHTML` being used with unsanitized user inputs (Node titles, widget values) in `UIManager.ts`.
**Learning:** This project uses direct DOM manipulation without a framework, making XSS a primary risk. Developers were manually building HTML strings.
**Prevention:** Introduced `escapeHtml` utility. Any new code using `innerHTML` MUST sanitize inputs. Prefer `textContent` where possible, or use the `escapeHtml` helper.

## 2026-01-07 - Unvalidated Configuration Inputs
**Vulnerability:** `ConfigManager` loaded settings from user storage without validation, allowing invalid values (e.g., negative dimensions, non-hex colors) that could degrade stability or rendering.
**Learning:** Configuration data from local storage/user settings must be treated as untrusted input.
**Prevention:** Implemented strict input validation (clamping for numbers, regex for hex colors) in `ConfigManager.loadSettings`.

## 2026-01-08 - Mixed HTML Content Injection
**Vulnerability:** Identified a pattern in `SidebarSettings.ts` where dynamic content was mixed with static HTML in template literals assigned to `innerHTML` (e.g., `header.innerHTML = \`${Icons.chevronDown}<span>${title}</span>\``).
**Learning:** Even if variables (like `title`) are currently hardcoded, this pattern creates a latent XSS vulnerability if the variable source changes to user input. It is difficult to audit and verify safety without checking the data flow of every variable.
**Prevention:** Refactored to separate static HTML (Icons) from dynamic text. Use `innerHTML` only for trusted static assets (like SVG icons) and `textContent` or `document.createElement` for any variable content.
