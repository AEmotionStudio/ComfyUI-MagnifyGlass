## 2024-05-23 - Throttling High-Frequency Events
**Learning:** High-frequency events like `mousemove` can cause performance issues if they trigger expensive DOM updates or calculations on every firing.
**Action:** Use `requestAnimationFrame` to throttle these updates to the screen refresh rate. Ensure that the event data (like coordinates) is captured synchronously in the event handler so that the rAF callback has access to the latest state.

## 2024-05-24 - Spatial Culling for LiteGraph Nodes
**Learning:** LiteGraph nodes expose `pos` and `size` properties in graph coordinates. Iterating over all nodes and accessing their DOM widgets (e.g., via `getBoundingClientRect`) causes massive layout thrashing and performance degradation when the graph is large.
**Action:** Always pre-calculate the visible graph area (converting screen/mouse coordinates to graph coordinates) and filter nodes using simple AABB overlap checks before accessing any DOM elements. This reduces O(N) DOM reads to O(K) where K is the number of visible nodes.
