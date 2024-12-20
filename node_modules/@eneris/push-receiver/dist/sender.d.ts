import type * as Types from './types';
interface ServiceAccount {
    type: 'service_account';
    project_id: string;
    private_key_id: string;
    private_key: string;
    client_email: string;
    client_id: string;
    auth_uri: string;
    token_uri: string;
    auth_provider_x509_cert_url: string;
    client_x509_cert_url: string;
    universe_domain: string;
}
export default class PushSender {
    #private;
    constructor(serviceAccount: ServiceAccount);
    send(message: Types.MessageToSend, fcmToken: string): Promise<void>;
    testMessage(fcmToken: string): Promise<void>;
}
export {};
