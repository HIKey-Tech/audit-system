"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashManifest = exports.canonicalManifest = exports.hashBuffer = void 0;
const crypto_1 = __importDefault(require("crypto"));
/** SHA-256 hex digest of arbitrary file bytes. */
const hashBuffer = (buffer) => crypto_1.default.createHash('sha256').update(buffer).digest('hex');
exports.hashBuffer = hashBuffer;
/**
 * Canonical JSON of the manifest with attachments sorted by documentId, so the
 * hash is stable regardless of attachment insertion order. This is what gets
 * hashed and stored — recomputing it later and comparing detects tampering.
 */
const canonicalManifest = (manifest) => {
    const ordered = {
        ...manifest,
        attachments: [...manifest.attachments].sort((a, b) => a.documentId.localeCompare(b.documentId)),
    };
    return JSON.stringify(ordered);
};
exports.canonicalManifest = canonicalManifest;
const hashManifest = (manifest) => crypto_1.default.createHash('sha256').update((0, exports.canonicalManifest)(manifest)).digest('hex');
exports.hashManifest = hashManifest;
//# sourceMappingURL=signature.utility.js.map