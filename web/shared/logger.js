const PREFIX = "[MagnifyGlass]";
function isDebugEnabled() {
  try {
    return localStorage.getItem("magnifyGlass.debug") === "true" || window.magnifyGlassDebug === true;
  } catch {
    return false;
  }
}
const Logger = {
  /**
   * Debug log - only shown when debug mode is enabled.
   * Use for verbose development logging.
   */
  debug: (...args) => {
    if (isDebugEnabled()) {
      console.log(PREFIX, ...args);
    }
  },
  /**
   * Info log - always shown.
   * Use for important initialization messages.
   */
  info: (...args) => {
    console.log(PREFIX, ...args);
  },
  /**
   * Warning log - always shown.
   * Use for non-critical issues.
   */
  warn: (...args) => {
    console.warn(PREFIX, ...args);
  },
  /**
   * Error log - always shown.
   * Use for critical errors.
   */
  error: (...args) => {
    console.error(PREFIX, ...args);
  }
};
export {
  Logger
};
//# sourceMappingURL=logger.js.map
