import { TLSSocket } from 'tls';
import Emitter from './emitter';
import type { DataPacket } from './types';
interface ParserEvents {
    error: (err: Error) => void;
    message: (data: DataPacket) => void;
}
export default class Parser extends Emitter<ParserEvents> {
    #private;
    constructor(socket: TLSSocket);
    destroy(): void;
}
export {};
