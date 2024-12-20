"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushSender = exports.PushReceiver = void 0;
const client_1 = __importDefault(require("./client"));
exports.PushReceiver = client_1.default;
const sender_1 = __importDefault(require("./sender"));
exports.PushSender = sender_1.default;
exports.default = client_1.default;
//# sourceMappingURL=index.js.map