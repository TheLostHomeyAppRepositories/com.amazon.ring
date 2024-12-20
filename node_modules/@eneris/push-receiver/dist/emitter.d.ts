export type Unsubscribe = CallableFunction;
interface EmitterEvents {
}
export default class ClassWithEmitter<EventMap extends EmitterEvents> {
    #private;
    on<K extends keyof EventMap>(eventName: K, listener: EventMap[K]): Unsubscribe;
    emit<K extends keyof EventMap>(eventName: K, ...args: Parameters<EventMap[K]>): void;
}
export {};
