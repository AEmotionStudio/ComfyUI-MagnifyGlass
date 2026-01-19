import { escapeHtml } from "../shared/utils.js";
function formatValue(value, label) {
  if (value === null || value === void 0) return "";
  const str = String(value);
  if (label && (label.toLowerCase().includes("text") || label.toLowerCase().includes("prompt") || label.toLowerCase().includes("model") || label.toLowerCase().includes("file") || label.toLowerCase().includes("conditioning") || label.toLowerCase().includes("positive") || label.toLowerCase().includes("negative"))) {
    return escapeHtml(str);
  }
  return escapeHtml(str);
}
function getValueClass(value) {
  if (!value) return "";
  const str = String(value);
  const classes = [];
  if (str.length > 100) {
    classes.push("long-text");
  }
  return classes.join(" ");
}
function getValueAttributes(value) {
  if (!value) return "";
  const str = String(value);
  if (str.length > 500) {
    return `title="${escapeHtml(str)}"`;
  }
  return "";
}
function formatWidgetValue(value) {
  if (value === null) return "null";
  if (value === void 0) return "undefined";
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toString() : value.toFixed(3);
  }
  if (typeof value === "boolean") return value.toString();
  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }
  if (typeof value === "object") {
    return "Object";
  }
  return String(value);
}
export {
  formatValue,
  formatWidgetValue,
  getValueAttributes,
  getValueClass
};
