"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignatureScheme = exports.CurveType = exports.NamedCurveAlgorithmList = exports.NamedCurveAlgorithm = exports.CipherSuiteList = exports.CipherSuite = exports.HashAlgorithm = exports.SignatureAlgorithm = void 0;
exports.SignatureAlgorithm = {
    rsa_1: 1,
    ecdsa_3: 3,
};
exports.HashAlgorithm = {
    sha256_4: 4,
};
exports.CipherSuite = {
    TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256_49195: 0xc02b,
    TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256_49199: 0xc02f, //49199
};
exports.CipherSuiteList = Object.values(exports.CipherSuite);
exports.NamedCurveAlgorithm = {
    x25519_29: 29,
    secp256r1_23: 23,
};
exports.NamedCurveAlgorithmList = Object.values(exports.NamedCurveAlgorithm);
exports.CurveType = { named_curve_3: 3 };
exports.SignatureScheme = {
    rsa_pkcs1_sha256: 0x0401,
    ecdsa_secp256r1_sha256: 0x0403,
};
//# sourceMappingURL=const.js.map