import 'dotenv/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const configuredKey = process.env.DOCVAULT_MASTER_KEY;
if (!configuredKey || !/^[0-9a-fA-F]{64}$/.test(configuredKey)) {
  throw new Error('DOCVAULT_MASTER_KEY must be set to a 32-byte key encoded as 64 hexadecimal characters.');
}

const masterKey = Buffer.from(configuredKey, 'hex');
const activeKeyVersion = process.env.DOCVAULT_MASTER_KEY_VERSION || 'v1';
let configuredKeyring: Record<string, string> = {};
try {
  configuredKeyring = JSON.parse(process.env.DOCVAULT_MASTER_KEYRING || '{}');
} catch {
  throw new Error('DOCVAULT_MASTER_KEYRING must be valid JSON when configured.');
}
configuredKeyring[activeKeyVersion] = configuredKey;

function masterKeyFor(version: string): Buffer {
  const value = configuredKeyring[version];
  if (!value || !/^[0-9a-fA-F]{64}$/.test(value)) throw new Error(`Master key version ${version} is not available in DOCVAULT_MASTER_KEYRING.`);
  return Buffer.from(value, 'hex');
}

export interface EncryptedDocument {
  iv: Buffer;
  ciphertext: Buffer;
  authTag: Buffer;
  wrappedKey: Buffer;
  keyIv: Buffer;
  keyAuthTag: Buffer;
  encryptionVersion: number;
  keyVersion: string;
}

export function encryptDocument(plaintext: Buffer): EncryptedDocument {
  const documentKey = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', documentKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const keyIv = randomBytes(12);
  const keyCipher = createCipheriv('aes-256-gcm', masterKey, keyIv);
  const wrappedKey = Buffer.concat([keyCipher.update(documentKey), keyCipher.final()]);

  return { iv, ciphertext, authTag, wrappedKey, keyIv, keyAuthTag: keyCipher.getAuthTag(), encryptionVersion: 2, keyVersion: activeKeyVersion };
}

export function decryptDocument(blob: {
  iv: Buffer; ciphertext: Buffer; auth_tag?: Buffer | null; wrapped_key?: Buffer | null;
  key_iv?: Buffer | null; key_auth_tag?: Buffer | null; encryption_version?: number | null; key_version?: string | null;
}): Buffer {
  if (blob.wrapped_key && blob.key_iv && blob.key_auth_tag && blob.auth_tag) {
    const keyDecipher = createDecipheriv('aes-256-gcm', masterKeyFor(blob.key_version || 'v1'), Buffer.from(blob.key_iv));
    keyDecipher.setAuthTag(Buffer.from(blob.key_auth_tag));
    const documentKey = Buffer.concat([keyDecipher.update(Buffer.from(blob.wrapped_key)), keyDecipher.final()]);
    const decipher = createDecipheriv('aes-256-gcm', documentKey, Buffer.from(blob.iv));
    decipher.setAuthTag(Buffer.from(blob.auth_tag));
    return Buffer.concat([decipher.update(Buffer.from(blob.ciphertext)), decipher.final()]);
  }

  // Transitional reader for blobs encrypted by the previous application version.
  const legacySecret = process.env.DOCVAULT_ENCRYPTION_KEY;
  if (!legacySecret) throw new Error('This legacy document requires DOCVAULT_ENCRYPTION_KEY before it can be migrated or read.');
  const legacyKey = createHash('sha256').update(legacySecret).digest();
  const stored = Buffer.from(blob.ciphertext);
  if (stored.length < 16) throw new Error('Legacy encrypted document is incomplete.');
  const decipher = createDecipheriv('aes-256-gcm', legacyKey, Buffer.from(blob.iv));
  decipher.setAuthTag(stored.subarray(stored.length - 16));
  return Buffer.concat([decipher.update(stored.subarray(0, -16)), decipher.final()]);
}

export function rewrapDocumentKey(blob: {
  wrapped_key: Buffer; key_iv: Buffer; key_auth_tag: Buffer; key_version?: string | null;
}) {
  const oldDecipher = createDecipheriv('aes-256-gcm', masterKeyFor(blob.key_version || 'v1'), Buffer.from(blob.key_iv));
  oldDecipher.setAuthTag(Buffer.from(blob.key_auth_tag));
  const documentKey = Buffer.concat([oldDecipher.update(Buffer.from(blob.wrapped_key)), oldDecipher.final()]);
  const keyIv = randomBytes(12);
  const keyCipher = createCipheriv('aes-256-gcm', masterKey, keyIv);
  const wrappedKey = Buffer.concat([keyCipher.update(documentKey), keyCipher.final()]);
  return { wrappedKey, keyIv, keyAuthTag: keyCipher.getAuthTag(), keyVersion: activeKeyVersion };
}
