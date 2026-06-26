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
exports.buildTokenPair = exports.generatePasswordResetToken = exports.hashToken = exports.comparePassword = exports.hashPassword = exports.generateTemporaryPassword = exports.generateRefreshToken = exports.generateAccessToken = void 0;
// src/modules/user/utility/token.utility.ts
const jwt = __importStar(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const ms_1 = __importDefault(require("ms"));
const app_config_1 = require("../../../shared/config/app.config");
const TEMP_PASSWORD_LOWER = 'abcdefghijkmnopqrstuvwxyz';
const TEMP_PASSWORD_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const TEMP_PASSWORD_DIGITS = '23456789';
const TEMP_PASSWORD_SPECIAL = '@$!%*?&';
const TEMP_PASSWORD_ALL = TEMP_PASSWORD_LOWER + TEMP_PASSWORD_UPPER + TEMP_PASSWORD_DIGITS + TEMP_PASSWORD_SPECIAL;
const randomChar = (chars) => chars[crypto_1.default.randomInt(chars.length)];
const shuffle = (chars) => {
    for (let i = chars.length - 1; i > 0; i -= 1) {
        const j = crypto_1.default.randomInt(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars;
};
const generateAccessToken = (payload) => {
    return jwt.sign(payload, app_config_1.config.jwt.secret, {
        expiresIn: app_config_1.config.jwt.expiresIn,
        algorithm: 'HS256',
    });
};
exports.generateAccessToken = generateAccessToken;
const generateRefreshToken = () => {
    const raw = crypto_1.default.randomBytes(64).toString('hex');
    const hash = crypto_1.default.createHash('sha256').update(raw).digest('hex');
    const expiresInMs = (0, ms_1.default)(app_config_1.config.jwt.refreshExpiresIn);
    const expiresAt = new Date(Date.now() + expiresInMs);
    return { raw, hash, expiresAt };
};
exports.generateRefreshToken = generateRefreshToken;
const generateTemporaryPassword = (length = 14) => {
    if (length < 8) {
        throw new Error('Temporary password length must be at least 8 characters');
    }
    const chars = [
        randomChar(TEMP_PASSWORD_LOWER),
        randomChar(TEMP_PASSWORD_UPPER),
        randomChar(TEMP_PASSWORD_DIGITS),
        randomChar(TEMP_PASSWORD_SPECIAL),
    ];
    while (chars.length < length) {
        chars.push(randomChar(TEMP_PASSWORD_ALL));
    }
    return shuffle(chars).join('');
};
exports.generateTemporaryPassword = generateTemporaryPassword;
const hashPassword = async (password) => {
    return bcryptjs_1.default.hash(password, 12);
};
exports.hashPassword = hashPassword;
const comparePassword = async (password, hash) => {
    return bcryptjs_1.default.compare(password, hash);
};
exports.comparePassword = comparePassword;
const hashToken = (token) => {
    return crypto_1.default.createHash('sha256').update(token).digest('hex');
};
exports.hashToken = hashToken;
const generatePasswordResetToken = () => {
    const raw = crypto_1.default.randomBytes(32).toString('hex');
    const hash = crypto_1.default.createHash('sha256').update(raw).digest('hex');
    const expiresAt = new Date(Date.now() + (0, ms_1.default)(app_config_1.config.passwordReset.tokenTtl));
    return { raw, hash, expiresAt };
};
exports.generatePasswordResetToken = generatePasswordResetToken;
const buildTokenPair = (accessToken, refreshToken) => ({
    accessToken,
    refreshToken,
    expiresIn: Math.floor((0, ms_1.default)(app_config_1.config.jwt.expiresIn) / 1000),
    tokenType: 'Bearer',
});
exports.buildTokenPair = buildTokenPair;
//# sourceMappingURL=token.utility.js.map