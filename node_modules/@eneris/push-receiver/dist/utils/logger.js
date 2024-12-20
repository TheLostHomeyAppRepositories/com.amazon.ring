"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
let debugEnabled = false;
exports.default = {
    setDebug: (enabled) => {
        debugEnabled = Boolean(enabled);
    },
    log: (...args) => {
        console.log(...args);
    },
    debug: (...args) => {
        if (debugEnabled) {
            console.debug(...args);
        }
    },
    warn: (...args) => {
        console.warn(...args);
    },
    error: console.error,
};
//# sourceMappingURL=logger.js.map