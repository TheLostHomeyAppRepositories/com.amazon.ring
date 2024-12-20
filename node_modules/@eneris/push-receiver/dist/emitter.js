"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_events_1 = require("node:events");
class ClassWithEmitter {
    #emitter = new node_events_1.EventEmitter();
    on(eventName, listener) {
        const handler = (...args) => {
            try {
                return listener(...args);
            }
            catch (err) {
                console.error(err);
            }
        };
        this.#emitter.on(eventName, handler);
        return () => this.#emitter.off(eventName, handler);
    }
    // @ts-expect-error - no reason TODO: Fixme
    emit(eventName, ...args) {
        this.#emitter.emit(eventName, ...args);
    }
}
exports.default = ClassWithEmitter;
//# sourceMappingURL=emitter.js.map