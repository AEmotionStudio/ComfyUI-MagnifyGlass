class NodeSelector {
  /**
   * Get all nodes from the graph.
   */
  getAllNodes() {
    var _a, _b;
    return ((_b = (_a = app == null ? void 0 : app.canvas) == null ? void 0 : _a.graph) == null ? void 0 : _b._nodes) ?? [];
  }
  getEntries() {
    return this.getAllNodes().map((n) => ({
      id: n.id,
      title: n.title || "Untitled",
      type: n.type || "Unknown",
      order: n.order ?? -1
    }));
  }
  /**
   * Get nodes sorted by execution order.
   * Only includes nodes that have a valid execution order.
   */
  getNodesSortedByExecOrder() {
    return this.getEntries().filter((n) => n.order >= 0).sort((a, b) => a.order - b.order);
  }
  /**
   * Get a node by its ID.
   */
  getNodeById(id) {
    var _a, _b;
    return ((_b = (_a = app == null ? void 0 : app.canvas) == null ? void 0 : _a.graph) == null ? void 0 : _b.getNodeById(id)) ?? null;
  }
  /**
   * Nodes whose title or type contains the query (any case), or whose id it names as `#id` or plainly.
   * Sorted by execution order; nodes without one come last, by title.
   */
  search(query) {
    const q = query.trim().toLowerCase();
    const idQuery = q.startsWith("#") ? q.slice(1) : null;
    const rank = (n) => n.order < 0 ? Infinity : n.order;
    return this.getEntries().filter((n) => idQuery !== null ? !idQuery || String(n.id) === idQuery : n.title.toLowerCase().includes(q) || n.type.toLowerCase().includes(q) || String(n.id) === q).sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));
  }
}
export {
  NodeSelector
};
