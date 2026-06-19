"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normaliseBackupCode = exports.generateBackupCodes = exports.generateEmailOtp = exports.decryptSecret = exports.encryptSecret = exports.verifyTotp = exports.buildTotpUri = exports.generateTotpSecret = exports.verifyScopedToken = exports.generateScopedToken = void 0;
// src/modules/user/utility/mfa.utility.ts
const crypto_1 = __importDefault(require("crypto"));
const jwt = __importStar(require("jsonwebtoken"));
const otplib_1 = require("otplib");
const app_config_1 = require("../../../shared/config/app.config");
const generateScopedToken = (sub, email, scope, expiresIn) => jwt.sign({ sub, email, scope }, app_config_1.config.jwt.secret, {
    expiresIn,
});
exports.generateScopedToken = generateScopedToken;
const verifyScopedToken = (token, expectedScope) => {
    const payload = jwt.verify(token, app_config_1.config.jwt.secret);
    if (payload.scope !== expectedScope) {
        throw new Error(`Invalid token scope: expected ${expectedScope}`);
    }
    return { sub: payload.sub, email: payload.email };
};
exports.verifyScopedToken = verifyScopedToken;
// ── TOTP (authenticator app) ──────────────────────────────────
const generateTotpSecret = () => (0, otplib_1.generateSecret)();
exports.generateTotpSecret = generateTotpSecret;
const buildTotpUri = (email, secret) => (0, otplib_1.generateURI)({
    strategy: 'totp',
    secret,
    label: email,
    issuer: app_config_1.config.mfa.issuer,
});
exports.buildTotpUri = buildTotpUri;
const verifyTotp = (token, secret) => {
    try {
        // ±30s tolerance (one time step either side) absorbs minor clock drift.
        const result = (0, otplib_1.verifySync)({ token: token.trim(), secret, epochTolerance: 30 });
        return Boolean(result?.valid);
    }
    catch {
        // otplib throws TokenLengthError / TokenFormatError for any token that isn't
        // exactly 6 digits (e.g. a backup code like "a1b2c-3d4e5"). Treat a malformed
        // token as "not a TOTP match" so verifyChallenge falls through to the
        // backup-code check instead of surfacing a 500.
        return false;
    }
};
exports.verifyTotp = verifyTotp;
// ── TOTP secret encryption at rest (AES-256-GCM) ──────────────
const ENC_KEY = crypto_1.default.scryptSync(app_config_1.config.mfa.encryptionKey || app_config_1.config.jwt.secret, 'iams-mfa-totp', 32);
const encryptSecret = (plain) => {
    const iv = crypto_1.default.randomBytes(12);
    const cipher = crypto_1.default.createCipheriv('aes-256-gcm', ENC_KEY, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':');
};
exports.encryptSecret = encryptSecret;
const decryptSecret = (encoded) => {
    const [ivB64, tagB64, dataB64] = encoded.split(':');
    if (!ivB64 || !tagB64 || !dataB64) {
        throw new Error('Malformed encrypted secret');
    }
    const decipher = crypto_1.default.createDecipheriv('aes-256-gcm', ENC_KEY, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const dec = Buffer.concat([
        decipher.update(Buffer.from(dataB64, 'base64')),
        decipher.final(),
    ]);
    return dec.toString('utf8');
};
exports.decryptSecret = decryptSecret;
// ── Email OTP ─────────────────────────────────────────────────
const generateEmailOtp = () => crypto_1.default.randomInt(0, 1_000_000).toString().padStart(6, '0');
exports.generateEmailOtp = generateEmailOtp;
// ── Backup recovery codes ─────────────────────────────────────
/** Produce N human-friendly single-use codes, e.g. "a1b2c-3d4e5". */
const generateBackupCodes = (count) => Array.from({ length: count }, () => {
    const raw = crypto_1.default.randomBytes(5).toString('hex'); // 10 hex chars
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
});
exports.generateBackupCodes = generateBackupCodes;
/** Normalise for comparison: strip separators, lowercase. */
const normaliseBackupCode = (code) => code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
exports.normaliseBackupCode = normaliseBackupCode;
//# sourceMappingURL=mfa.utility.js.map