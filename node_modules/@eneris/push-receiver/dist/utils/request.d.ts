import type { ClientConfig } from '../types';
export default function requestWithRety(url: string, options?: globalThis.RequestInit, maxRetries?: number): Promise<Response>;
export declare const getEndpoint: (config: ClientConfig, baseUrl: string, path?: string) => string;
