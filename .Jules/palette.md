## 2025-01-13 - Accessible Custom Controls
**Learning:** This repo builds UI with vanilla `document.createElement`. Generic `div`s were used for interactive toggles, making them inaccessible to screen readers and keyboard users.
**Action:** When refactoring vanilla JS controls, manually add `role="switch"`, `tabIndex="0"`, `aria-checked`, and keyboard handlers (Enter/Space) to replicate native control behavior.
## 2025-01-13 - State Sync Accessibility
**Learning:** When manually synchronizing state between multiple UI controls (e.g., two toggles for the same setting), visual updates (class manipulation) are insufficient. Accessible attributes like `aria-checked` must also be explicitly updated.
**Action:** Always verify that state synchronization logic updates both visual classes and ARIA attributes to ensure screen reader accuracy.
