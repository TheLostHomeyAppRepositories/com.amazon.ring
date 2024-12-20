import type * as Types from './types';
export declare function installFCM(config: Types.ClientConfig): Promise<Types.InstallationData>;
export declare function registerFCM(gcmData: Types.GcmData, installation: Types.InstallationData, keys: Types.Keys, config: Types.ClientConfig): Promise<Types.FcmRegistrationResponse>;
export default function register(gcm: Types.GcmData, keys: Types.Keys, config: Types.ClientConfig): Promise<Types.FcmData>;
