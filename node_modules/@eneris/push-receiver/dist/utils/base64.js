"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.escape = escape;
exports.toBase64 = toBase64;
function escape(value) {
    return value
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}
function toBase64(value) {
    return escape(value.toString('base64'));
}
//# sourceMappingURL=base64.js.map