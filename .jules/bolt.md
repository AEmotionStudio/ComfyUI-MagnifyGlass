## 2024-05-23 - Throttling High-Frequency Events
**Learning:** High-frequency events like `mousemove` can cause performance issues if they trigger expensive DOM updates or calculations on every firing.
**Action:** Use `requestAnimationFrame` to throttle these updates to the screen refresh rate. Ensure that the event data (like coordinates) is captured synchronously in the event handler so that the rAF callback has access to the latest state.
