"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkIn = checkIn;
const long_1 = __importDefault(require("long"));
const crypto_1 = require("crypto");
const request_1 = __importDefault(require("./utils/request"));
const timeout_1 = __importDefault(require("./utils/timeout"));
const protos_1 = __importDefault(require("./protos"));
const logger_1 = __importDefault(require("./utils/logger"));
const REGISTER_URL = 'https://android.clients.google.com/c2dm/register3';
const CHECKIN_URL = 'https://android.clients.google.com/checkin';
function parseLong(number, unsigned, radix) {
    return long_1.default.fromString(number.toString(), unsigned, radix);
}
exports.default = async (config) => {
    const options = await checkIn(config);
    const credentials = await doRegister(options, config);
    return credentials;
};
async function checkIn(config) {
    const body = await (await (0, request_1.default)(CHECKIN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-protobuf',
        },
        body: prepareCheckinBuffer(config),
    })).arrayBuffer();
    const AndroidCheckinResponse = protos_1.default.checkin_proto.AndroidCheckinResponse;
    const message = AndroidCheckinResponse.decode(new Uint8Array(body));
    const object = AndroidCheckinResponse.toObject(message, {
        longs: String,
        enums: String,
        bytes: String,
    });
    return {
        androidId: object.androidId,
        securityToken: object.securityToken,
    };
}
async function doRegister({ androidId, securityToken }, config) {
    const appId = `wp:${config.bundleId}#${(0, crypto_1.randomUUID)()}`;
    const body = (new URLSearchParams({
        app: 'org.chromium.linux',
        'X-subtype': appId,
        device: androidId,
        sender: config.vapidKey || 'BDOU99-h67HcA6JeFXHbSNMu7e2yNNu3RzoMj8TM4W88jITfq7ZmPvIM1Iv-4_l2LxQcYwhqby2xGpWwzjfAnG4',
    })).toString();
    const response = await postRegister({ androidId, securityToken, body });
    const token = response.split('=')[1];
    return {
        token,
        androidId,
        securityToken,
        appId,
    };
}
async function postRegister({ androidId, securityToken, body, retry = 0 }) {
    const response = await (await (0, request_1.default)(REGISTER_URL, {
        method: 'POST',
        headers: {
            Authorization: `AidLogin ${androidId}:${securityToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
    })).text();
    if (response.includes('Error')) {
        logger_1.default.warn(`Register request has failed with ${response}`);
        if (retry >= 5) {
            throw new Error('GCM register has failed');
        }
        logger_1.default.warn(`Retry... ${retry + 1}`);
        await (0, timeout_1.default)(1000);
        return postRegister({ androidId, securityToken, body, retry: retry + 1 });
    }
    return response;
}
function prepareCheckinBuffer(config) {
    const gcm = config.credentials?.gcm;
    const AndroidCheckinRequest = protos_1.default.checkin_proto.AndroidCheckinRequest;
    const payload = {
        accountCookie: [],
        checkin: {
            cellOperator: '', // Optional
            chromeBuild: {
                platform: config.chromePlatform || protos_1.default.checkin_proto.ChromeBuildProto.Platform.PLATFORM_MAC,
                chromeVersion: config.chromeVersion || '63.0.3234.0',
                channel: config.chromeChannel || protos_1.default.checkin_proto.ChromeBuildProto.Channel.CHANNEL_STABLE,
            },
            type: protos_1.default.checkin_proto.DeviceType.DEVICE_CHROME_BROWSER,
            lastCheckinMsec: parseLong(0n), // TODO
            roaming: '', // Optional
            simOperator: '', // Optional
            userNumber: 0, // Optional
        },
        desiredBuild: '', // Optional
        digest: '', // Optional
        fragment: 0,
        id: gcm?.androidId ? long_1.default.fromString(gcm.androidId) : undefined,
        locale: '', // Optional
        loggingId: parseLong(0n), // Optional
        macAddr: [],
        macAddrType: [],
        marketCheckin: '', // Optional
        otaCert: [],
        securityToken: gcm?.securityToken ? long_1.default.fromString(gcm?.securityToken, true) : undefined,
        timeZone: config.timeZone || 'Europe/Prague',
        userName: '', // Optional
        userSerialNumber: 0, // TODO
        version: 3, // TODO - ???
    };
    const errMsg = AndroidCheckinRequest.verify(payload);
    if (errMsg)
        throw Error(errMsg);
    const message = AndroidCheckinRequest.create(payload);
    return AndroidCheckinRequest.encode(message).finish();
}
//# sourceMappingURL=gcm.js.map