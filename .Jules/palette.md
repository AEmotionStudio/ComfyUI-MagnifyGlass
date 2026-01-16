## 2025-01-13 - Accessible Custom Controls
**Learning:** This repo builds UI with vanilla `document.createElement`. Generic `div`s were used for interactive toggles, making them inaccessible to screen readers and keyboard users.
**Action:** When refactoring vanilla JS controls, manually add `role="switch"`, `tabIndex="0"`, `aria-checked`, and keyboard handlers (Enter/Space) to replicate native control behavior.
## 2025-01-13 - State Sync Accessibility
**Learning:** When manually synchronizing state between multiple UI controls (e.g., two toggles for the same setting), visual updates (class manipulation) are insufficient. Accessible attributes like `aria-checked` must also be explicitly updated.
**Action:** Always verify that state synchronization logic updates both visual classes and ARIA attributes to ensure screen reader accuracy.
## 2025-01-13 - Keyboard Event Parity
**Learning:** Keyboard event handlers must replicate the exact bubbling behavior of click handlers. Specifically, if a click handler stops propagation, the keyboard handler (Enter/Space) must also call `stopPropagation()` to prevent the event from triggering parent listeners unintentionally.
**Action:** Always verify that keyboard interaction logic matches mouse interaction logic, including event propagation and default prevention.
## 2025-01-27 - Programmatic Label Association
**Learning:** Vanilla JS `createSlider`/`createSelect` helpers were creating detached `<label>` and `<input>` elements. Visual proximity is not enough for screen readers.
**Action:** When creating form controls in vanilla JS, always generate a unique ID and link the label using `htmlFor` (or `aria-labelledby`) to ensure an accessible name.
