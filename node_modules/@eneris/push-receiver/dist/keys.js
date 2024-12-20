"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = createKeys;
const crypto_1 = __importDefault(require("crypto"));
const base64_1 = require("./utils/base64");
function createKeys() {
    return new Promise((resolve, reject) => {
        const dh = crypto_1.default.createECDH('prime256v1');
        dh.generateKeys();
        crypto_1.default.randomBytes(16, (err, buf) => {
            if (err) {
                return reject(err);
            }
            return resolve({
                privateKey: (0, base64_1.escape)(dh.getPrivateKey('base64')),
                publicKey: (0, base64_1.escape)(dh.getPublicKey('base64')),
                authSecret: (0, base64_1.escape)(buf.toString('base64')),
            });
        });
    });
}
//# sourceMappingURL=keys.js.map