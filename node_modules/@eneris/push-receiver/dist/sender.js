"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const request_1 = __importDefault(require("./utils/request"));
const FCM_API = 'https://fcm.googleapis.com/v1/projects/';
const GOOGLE_TOKEN_AUDIENCE = 'https://accounts.google.com/o/oauth2/token';
const GOOGLE_AUTH_TOKEN_HOST = 'accounts.google.com';
const GOOGLE_AUTH_TOKEN_PATH = '/o/oauth2/token';
const ONE_HOUR_IN_SECONDS = 60 * 60;
const JWT_ALGORITHM = 'RS256';
class PushSender {
    #projectId;
    #privateKey;
    #clientEmail;
    #accessToken;
    constructor(serviceAccount) {
        this.#projectId = serviceAccount.project_id;
        this.#privateKey = serviceAccount.private_key;
        this.#clientEmail = serviceAccount.client_email;
    }
    #createAuthJwt() {
        const claims = {
            scope: [
                'https://www.googleapis.com/auth/cloud-platform',
                'https://www.googleapis.com/auth/firebase.database',
                'https://www.googleapis.com/auth/firebase.messaging',
                'https://www.googleapis.com/auth/identitytoolkit',
                'https://www.googleapis.com/auth/userinfo.email',
            ].join(' '),
        };
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const jwt = require('jsonwebtoken');
        // This method is actually synchronous so we can capture and return the buffer.
        return jwt.sign(claims, this.#privateKey, {
            audience: GOOGLE_TOKEN_AUDIENCE,
            expiresIn: ONE_HOUR_IN_SECONDS,
            issuer: this.#clientEmail,
            algorithm: JWT_ALGORITHM,
        });
    }
    async #getAccessToken() {
        if (this.#accessToken && this.#accessToken.generated_at + this.#accessToken.expires_in > new Date().getTime())
            return this.#accessToken;
        const token = this.#createAuthJwt();
        const res = await (0, request_1.default)(`https://${GOOGLE_AUTH_TOKEN_HOST}${GOOGLE_AUTH_TOKEN_PATH}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + token,
        });
        const { access_token, expires_in } = await res.json();
        this.#accessToken = {
            access_token,
            expires_in,
            generated_at: new Date().getTime()
        };
        return this.#accessToken;
    }
    async send(message, fcmToken) {
        const serverAuthToken = await this.#getAccessToken();
        return (0, request_1.default)(`${FCM_API}${this.#projectId}/messages:send`, {
            method: 'POST',
            body: JSON.stringify({
                message: {
                    notification: message,
                    token: fcmToken
                }
            }),
            headers: new Headers({
                'Content-Type': 'application/json',
                Authorization: `Bearer ${serverAuthToken.access_token}`
            })
        }).then(async (response) => {
            const data = await response.json();
            if (data.failure) {
                throw new Error(JSON.stringify(data));
            }
        }).catch(console.error);
    }
    testMessage(fcmToken) {
        return this.send({
            body: "PushReceiver test message",
            title: "testMessage",
        }, fcmToken);
    }
}
exports.default = PushSender;
//# sourceMappingURL=sender.js.map