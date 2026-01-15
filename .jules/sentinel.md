# Sentinel's Journal

## 2026-01-06 - Improper DOM Manipulation XSS
**Vulnerability:** Found multiple instances of `innerHTML` being used with unsanitized user inputs (Node titles, widget values) in `UIManager.ts`.
**Learning:** This project uses direct DOM manipulation without a framework, making XSS a primary risk. Developers were manually building HTML strings.
**Prevention:** Introduced `escapeHtml` utility. Any new code using `innerHTML` MUST sanitize inputs. Prefer `textContent` where possible, or use the `escapeHtml` helper.

## 2026-01-07 - Unvalidated Configuration Inputs
**Vulnerability:** `ConfigManager` loaded settings from user storage without validation, allowing invalid values (e.g., negative dimensions, non-hex colors) that could degrade stability or rendering.
**Learning:** Configuration data from local storage/user settings must be treated as untrusted input.
**Prevention:** Implemented strict input validation (clamping for numbers, regex for hex colors) in `ConfigManager.loadSettings`.
