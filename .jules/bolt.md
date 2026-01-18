## 2024-05-23 - Loop Invariant Code Motion
**Learning:** Even simple arithmetic operations (`/`, `+`, `*`) and property accesses (`state.canvasScale`, `rect.width`) add up when performed inside nested loops running at 60 FPS (e.g., iterating over nodes and then widgets).
**Action:** Always check if variables calculated inside a loop depend on the loop iterator. If not, hoist them to the outer scope ("Redundant calculations in loops").

## 2024-05-23 - DOM Property Access in Loops
**Learning:** Accessing DOM properties like `canvas.width` or `element.style` inside a loop is much slower than accessing a local variable.
**Action:** Cache DOM properties into local variables before entering hot loops.
