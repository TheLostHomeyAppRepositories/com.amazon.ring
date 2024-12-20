"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const protobufjs_1 = __importDefault(require("protobufjs"));
const logger_1 = __importDefault(require("./utils/logger"));
const protos_1 = __importDefault(require("./protos"));
const constants_1 = require("./constants");
const emitter_1 = __importDefault(require("./emitter"));
class Parser extends emitter_1.default {
    #socket;
    #state = constants_1.ProcessingState.MCS_VERSION_TAG_AND_SIZE;
    #data = Buffer.alloc(0);
    #messageTag = 0;
    #messageSize = 0;
    #handshakeComplete = false;
    #isWaitingForData = true;
    constructor(socket) {
        super();
        this.#socket = socket;
        this.#socket.on('data', this.#handleData);
    }
    destroy() {
        this.#isWaitingForData = false;
        this.#socket.removeListener('data', this.#handleData);
    }
    #emitError(error) {
        this.destroy();
        this.emit('error', error);
    }
    #handleData = (buffer) => {
        logger_1.default.debug(`Got data: ${buffer.length}`);
        this.#data = Buffer.concat([this.#data, buffer]);
        if (this.#isWaitingForData) {
            this.#isWaitingForData = false;
            this.#waitForData();
        }
    };
    #waitForData() {
        logger_1.default.debug(`waitForData state: ${this.#state}`);
        let minBytesNeeded = 0;
        switch (this.#state) {
            case constants_1.ProcessingState.MCS_VERSION_TAG_AND_SIZE:
                minBytesNeeded += constants_1.Variables.kVersionPacketLen;
            // eslint-disable-next-line no-fallthrough
            case constants_1.ProcessingState.MCS_TAG_AND_SIZE:
                minBytesNeeded += constants_1.Variables.kTagPacketLen;
            // eslint-disable-next-line no-fallthrough
            case constants_1.ProcessingState.MCS_SIZE:
                minBytesNeeded += constants_1.Variables.kSizePacketLenMin;
                break;
            case constants_1.ProcessingState.MCS_PROTO_BYTES:
                minBytesNeeded = this.#messageSize;
                break;
            default:
                this.#emitError(new Error(`Unexpected state: ${this.#state}`));
                return;
        }
        if (this.#data.length < minBytesNeeded) {
            logger_1.default.debug(`Waiting for ${minBytesNeeded - this.#data.length} more bytes. Got ${this.#data.length}`);
            this.#isWaitingForData = true;
            return;
        }
        logger_1.default.debug(`Processing MCS data: state == ${this.#state}`);
        switch (this.#state) {
            case constants_1.ProcessingState.MCS_VERSION_TAG_AND_SIZE:
                this.#handleGotVersion();
                this.#handleGotMessageTag();
                this.#handleGotMessageSize();
                break;
            case constants_1.ProcessingState.MCS_TAG_AND_SIZE:
                this.#handleGotMessageTag();
                this.#handleGotMessageSize();
                break;
            case constants_1.ProcessingState.MCS_SIZE:
                this.#handleGotMessageSize();
                break;
            case constants_1.ProcessingState.MCS_PROTO_BYTES:
                this.#handleGotMessageBytes();
                break;
            default:
                this.#emitError(new Error(`Unexpected state: ${this.#state}`));
                return;
        }
    }
    #handleGotVersion() {
        const version = this.#data.readInt8(0);
        this.#data = this.#data.slice(1);
        logger_1.default.debug(`VERSION IS ${version}`);
        if (version < constants_1.Variables.kMCSVersion && version !== 38) {
            this.#emitError(new Error(`Got wrong version: ${version}`));
            return;
        }
    }
    #handleGotMessageTag() {
        this.#messageTag = this.#data.readInt8(0);
        this.#data = this.#data.slice(1);
        logger_1.default.debug(`RECEIVED PROTO OF TYPE ${this.#messageTag}`);
    }
    #handleGotMessageSize() {
        let incompleteSizePacket = false;
        const reader = new protobufjs_1.default.BufferReader(this.#data);
        try {
            this.#messageSize = reader.int32();
        }
        catch (error) {
            if (error.message.startsWith('index out of range:')) {
                incompleteSizePacket = true;
            }
            else {
                this.#emitError(error);
                return;
            }
        }
        // TODO(ibash) in chromium code there is an extra check here of:
        // if prev_byte_count >= kSizePacketLenMax then something else went wrong
        // NOTE(ibash) I could only test this case by manually cutting the buffer
        // above to be mid-packet like: new ProtobufJS.BufferReader(this.#data.slice(0, 1))
        if (incompleteSizePacket) {
            this.#state = constants_1.ProcessingState.MCS_SIZE;
            this.#waitForData();
            return;
        }
        this.#data = this.#data.slice(reader.pos);
        logger_1.default.debug(`Proto size: ${this.#messageSize}`);
        if (this.#messageSize > 0) {
            this.#state = constants_1.ProcessingState.MCS_PROTO_BYTES;
            this.#waitForData();
        }
        else {
            this.#handleGotMessageBytes();
        }
    }
    #handleGotMessageBytes() {
        const protobuf = this.#buildProtobufFromTag(this.#messageTag);
        if (!protobuf) {
            this.#emitError(new Error('Unknown tag'));
            return;
        }
        // Messages with no content are valid just use the default protobuf for
        // that tag.
        if (this.#messageSize === 0) {
            this.emit('message', { tag: this.#messageTag, object: {} });
            this.#getNextMessage();
            return;
        }
        if (this.#data.length < this.#messageSize) {
            // Continue reading data.
            logger_1.default.debug(`Continuing data read. Buffer size is ${this.#data.length}, expecting ${this.#messageSize}`);
            this.#state = constants_1.ProcessingState.MCS_PROTO_BYTES;
            this.#waitForData();
            return;
        }
        const buffer = this.#data.slice(0, this.#messageSize);
        const message = protobuf.decode(buffer);
        this.#data = this.#data.slice(this.#messageSize);
        const object = protobuf.toObject(message, {
            longs: String,
            enums: String,
            bytes: Buffer,
        });
        this.emit('message', { tag: this.#messageTag, object: object });
        if (this.#messageTag === constants_1.MCSProtoTag.kLoginResponseTag) {
            if (this.#handshakeComplete) {
                logger_1.default.error('Unexpected login response');
            }
            else {
                this.#handshakeComplete = true;
                logger_1.default.debug('GCM Handshake complete.');
            }
        }
        this.#getNextMessage();
    }
    #getNextMessage() {
        this.#messageTag = 0;
        this.#messageSize = 0;
        this.#state = constants_1.ProcessingState.MCS_TAG_AND_SIZE;
        this.#waitForData();
    }
    #buildProtobufFromTag(tag) {
        switch (tag) {
            case constants_1.MCSProtoTag.kHeartbeatPingTag: return protos_1.default.mcs_proto.HeartbeatPing;
            case constants_1.MCSProtoTag.kHeartbeatAckTag: return protos_1.default.mcs_proto.HeartbeatAck;
            case constants_1.MCSProtoTag.kLoginRequestTag: return protos_1.default.mcs_proto.LoginRequest;
            case constants_1.MCSProtoTag.kLoginResponseTag: return protos_1.default.mcs_proto.LoginResponse;
            case constants_1.MCSProtoTag.kCloseTag: return protos_1.default.mcs_proto.Close;
            case constants_1.MCSProtoTag.kIqStanzaTag: return protos_1.default.mcs_proto.IqStanza;
            case constants_1.MCSProtoTag.kDataMessageStanzaTag: return protos_1.default.mcs_proto.DataMessageStanza;
            case constants_1.MCSProtoTag.kStreamErrorStanzaTag: return protos_1.default.mcs_proto.StreamErrorStanza;
            default:
                return null;
        }
    }
}
exports.default = Parser;
//# sourceMappingURL=parser.js.map