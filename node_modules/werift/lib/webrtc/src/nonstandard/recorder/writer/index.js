"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaWriter = void 0;
class MediaWriter {
    constructor(path, options) {
        Object.defineProperty(this, "path", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: path
        });
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: options
        });
    }
    async start(tracks) { }
    async stop() { }
}
exports.MediaWriter = MediaWriter;
//# sourceMappingURL=index.js.map