# Sentinel's Journal

## 2026-01-06 - Improper DOM Manipulation XSS
**Vulnerability:** Found multiple instances of `innerHTML` being used with unsanitized user inputs (Node titles, widget values) in `UIManager.ts`.
**Learning:** This project uses direct DOM manipulation without a framework, making XSS a primary risk. Developers were manually building HTML strings.
**Prevention:** Introduced `escapeHtml` utility. Any new code using `innerHTML` MUST sanitize inputs. Prefer `textContent` where possible, or use the `escapeHtml` helper.
