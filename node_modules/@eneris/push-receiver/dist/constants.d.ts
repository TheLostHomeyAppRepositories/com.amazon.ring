export declare enum ProcessingState {
    MCS_VERSION_TAG_AND_SIZE = 0,
    MCS_TAG_AND_SIZE = 1,
    MCS_SIZE = 2,
    MCS_PROTO_BYTES = 3
}
export declare enum Variables {
    kVersionPacketLen = 1,
    kTagPacketLen = 1,
    kSizePacketLenMin = 1,
    kSizePacketLenMax = 5,
    kMCSVersion = 41
}
export declare enum MCSProtoTag {
    kHeartbeatPingTag = 0,
    kHeartbeatAckTag = 1,
    kLoginRequestTag = 2,
    kLoginResponseTag = 3,
    kCloseTag = 4,
    kMessageStanzaTag = 5,
    kPresenceStanzaTag = 6,
    kIqStanzaTag = 7,
    kDataMessageStanzaTag = 8,
    kBatchPresenceStanzaTag = 9,
    kStreamErrorStanzaTag = 10,
    kHttpRequestTag = 11,
    kHttpResponseTag = 12,
    kBindAccountRequestTag = 13,
    kBindAccountResponseTag = 14,
    kTalkMetadataTag = 15,
    kNumProtoTypes = 16
}
export declare enum GcmRequestConstants {
    kErrorPrefix = "Error=",
    kTokenPrefix = "token=",
    kDeviceRegistrationError = "PHONE_REGISTRATION_ERROR",
    kAuthenticationFailed = "AUTHENTICATION_FAILED",
    kInvalidSender = "INVALID_SENDER",
    kInvalidParameters = "INVALID_PARAMETERS",
    kInternalServerError = "InternalServerError",
    kQuotaExceeded = "QUOTA_EXCEEDED",
    kTooManyRegistrations = "TOO_MANY_REGISTRATIONS"
}
export declare enum GcmRequestStatus {
    SUCCESS = 0,// Registration completed successfully.
    INVALID_PARAMETERS = 1,// One of request paramteres was invalid.
    INVALID_SENDER = 2,// One of the provided senders was invalid.
    AUTHENTICATION_FAILED = 3,// Authentication failed.
    DEVICE_REGISTRATION_ERROR = 4,// Chrome is not properly registered.
    UNKNOWN_ERROR = 5,// Unknown error.
    URL_FETCHING_FAILED = 6,// URL fetching failed.
    HTTP_NOT_OK = 7,// HTTP status was not OK.
    NO_RESPONSE_BODY = 8,// No response body.
    REACHED_MAX_RETRIES = 9,// Reached maximum number of retries.
    RESPONSE_PARSING_FAILED = 10,// Registration response parsing failed.
    INTERNAL_SERVER_ERROR = 11,// Internal server error during request.
    QUOTA_EXCEEDED = 12,// Registration quota exceeded.
    TOO_MANY_REGISTRATIONS = 13,// Max registrations per device exceeded.
    STATUS_COUNT = 14
}
/**
 * enum values correspond to the type of device.
 * Used in the AndroidCheckinProto and Device proto.
 */
export declare enum DeviceType {
    /** DEVICE_ANDROID_OS - Android Device */
    DEVICE_ANDROID_OS = 1,
    /** DEVICE_IOS_OS - Apple IOS device */
    DEVICE_IOS_OS = 2,
    /** DEVICE_CHROME_BROWSER - Chrome browser - Not Chrome OS.  No hardware records. */
    DEVICE_CHROME_BROWSER = 3,
    /** DEVICE_CHROME_OS - Chrome OS */
    DEVICE_CHROME_OS = 4,
    UNRECOGNIZED = -1
}
/** Build characteristics unique to the Chrome browser, and Chrome OS */
export interface ChromeBuildProto {
    /** The platform of the device. */
    platform: ChromeBuildProtoPlatform;
    /** The Chrome instance's version. */
    chrome_version: string;
    /** The Channel (build type) of Chrome. */
    channel: ChromeBuildProtoChannel;
}
export declare enum ChromeBuildProtoPlatform {
    PLATFORM_WIN = 1,
    PLATFORM_MAC = 2,
    PLATFORM_LINUX = 3,
    PLATFORM_CROS = 4,
    PLATFORM_IOS = 5,
    /**
     * PLATFORM_ANDROID - Just a placeholder. Likely don't need it due to the presence of the
     * Android GCM on phone/tablet devices.
     */
    PLATFORM_ANDROID = 6,
    UNRECOGNIZED = -1
}
export declare enum ChromeBuildProtoChannel {
    CHANNEL_STABLE = 1,
    CHANNEL_BETA = 2,
    CHANNEL_DEV = 3,
    CHANNEL_CANARY = 4,
    /** CHANNEL_UNKNOWN - for tip of tree or custom builds */
    CHANNEL_UNKNOWN = 5,
    UNRECOGNIZED = -1
}
