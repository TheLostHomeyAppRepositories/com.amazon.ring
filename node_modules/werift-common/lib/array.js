"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deepMerge = void 0;
const mergeWith_1 = __importDefault(require("lodash/mergeWith"));
const deepMerge = (dst, src) => (0, mergeWith_1.default)(dst, src, (obj, src) => {
    if (!(src == undefined)) {
        return src;
    }
    return obj;
});
exports.deepMerge = deepMerge;
//# sourceMappingURL=array.js.map