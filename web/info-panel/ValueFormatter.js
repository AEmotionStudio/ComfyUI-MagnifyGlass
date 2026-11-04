function formatWidgetValue(value, precision) {
  if (value === null) return "null";
  if (value === void 0) return "undefined";
  if (typeof value === "number") {
    return precision === void 0 ? String(value) : value.toFixed(precision);
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return Array.isArray(value) ? `Array(${value.length})` : "Object";
    }
  }
  return String(value);
}
function isLongText(text) {
  return text.length > 200 || text.split("\n").length > 4;
}
export {
  formatWidgetValue,
  isLongText
};
