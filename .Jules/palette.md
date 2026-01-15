## 2025-01-13 - Accessible Custom Controls
**Learning:** This repo builds UI with vanilla `document.createElement`. Generic `div`s were used for interactive toggles, making them inaccessible to screen readers and keyboard users.
**Action:** When refactoring vanilla JS controls, manually add `role="switch"`, `tabIndex="0"`, `aria-checked`, and keyboard handlers (Enter/Space) to replicate native control behavior.
