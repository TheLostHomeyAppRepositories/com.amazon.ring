/// <reference types="node" />
/// <reference types="node" />
import { ReadableStream, ReadableStreamController } from "stream/web";
import { RtpPacket } from "../../rtp/rtp";
import { RtpOutput } from "./rtpCallback";
export declare class RtpSourceStream {
    private options;
    readable: ReadableStream<RtpOutput>;
    write: (chunk: RtpOutput) => void;
    protected controller: ReadableStreamController<RtpOutput>;
    constructor(options?: {
        payloadType?: number;
        clearInvalidPTPacket?: boolean;
    });
    push: (packet: Buffer | RtpPacket) => void;
    stop(): void;
}
