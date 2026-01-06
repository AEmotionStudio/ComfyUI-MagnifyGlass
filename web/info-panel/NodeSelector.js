class NodeSelector {
  /**
   * Get all nodes from the graph.
   */
  getAllNodes() {
    var _a;
    return ((_a = app == null ? void 0 : app.graph) == null ? void 0 : _a._nodes) ?? [];
  }
  /**
   * Get nodes sorted alphabetically by title.
   */
  getNodesSortedByTitle() {
    return this.getAllNodes().map((n) => ({
      id: n.id,
      title: n.title || "Untitled",
      type: n.type || "Unknown"
    })).sort((a, b) => a.title.localeCompare(b.title));
  }
  /**
   * Get nodes sorted by execution order.
   * Only includes nodes that have a valid execution order.
   */
  getNodesSortedByExecOrder() {
    return this.getAllNodes().map((n) => ({
      id: n.id,
      title: n.title || "Untitled",
      type: n.type || "Unknown",
      order: n.order ?? -1
    })).filter((n) => n.order >= 0).sort((a, b) => a.order - b.order);
  }
  /**
   * Get nodes sorted by ID number (ascending).
   */
  getNodesSortedById() {
    return this.getAllNodes().map((n) => ({
      id: n.id,
      title: n.title || "Untitled",
      type: n.type || "Unknown"
    })).sort((a, b) => a.id - b.id);
  }
  /**
   * Get a node by its ID.
   */
  getNodeById(id) {
    var _a;
    return ((_a = app == null ? void 0 : app.graph) == null ? void 0 : _a.getNodeById(id)) ?? null;
  }
  /**
   * Search nodes by title (case-insensitive partial match).
   */
  searchByTitle(query) {
    const lowerQuery = query.toLowerCase();
    return this.getNodesSortedByTitle().filter((n) => n.title.toLowerCase().includes(lowerQuery));
  }
  /**
   * Get total node count.
   */
  getNodeCount() {
    return this.getAllNodes().length;
  }
}
export {
  NodeSelector
};
//# sourceMappingURL=NodeSelector.js.map
