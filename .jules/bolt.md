## 2024-05-23 - Layout Thrashing in Render Loops
**Learning:** Mixing DOM reads (like `getBoundingClientRect` or `getComputedStyle`) with DOM writes (like `appendChild` or `innerHTML = ''`) inside a loop causes "Layout Thrashing", forcing the browser to synchronously recalculate layout on every iteration. This is a massive performance bottleneck.
**Action:** Always separate read and write phases.
1. **Read Phase:** Collect all necessary measurements (rects, styles) and store them in a temporary structure (e.g., `RenderTask[]`).
2. **Write Phase:** Perform all DOM mutations in one go, ideally using a `DocumentFragment` to batch appends before inserting into the live DOM.
**Critical:** Ensure logic that depends on element type (like detecting videos to keep the animation loop alive) is preserved in the Read Phase.
