import 'dotenv/config';
import { fileURLToPath } from 'url';
import { db } from '../database/db.js';
import { decryptDocument, encryptDocument, rewrapDocumentKey } from './crypto.js';

const rows = db.prepare('SELECT * FROM document_blobs ORDER BY document_id').all() as any[];
const legacyRows = rows.filter((row) => !row.wrapped_key);
if (legacyRows.length && !process.env.DOCVAULT_ENCRYPTION_KEY) {
  throw new Error('Set DOCVAULT_ENCRYPTION_KEY to the legacy key before migrating v1 document blobs.');
}

let migrated = 0;
let rewrapped = 0;
for (const row of rows) {
  if (!row.wrapped_key) {
    const encrypted = encryptDocument(decryptDocument(row));
    db.prepare(`UPDATE document_blobs SET iv=?,ciphertext=?,auth_tag=?,wrapped_key=?,key_iv=?,key_auth_tag=?,encryption_version=?,key_version=? WHERE document_id=?`)
      .run(encrypted.iv, encrypted.ciphertext, encrypted.authTag, encrypted.wrappedKey, encrypted.keyIv,
        encrypted.keyAuthTag, encrypted.encryptionVersion, encrypted.keyVersion, row.document_id);
    migrated += 1;
  } else if (row.key_version !== (process.env.DOCVAULT_MASTER_KEY_VERSION || 'v1')) {
    const wrapped = rewrapDocumentKey(row);
    db.prepare('UPDATE document_blobs SET wrapped_key=?,key_iv=?,key_auth_tag=?,key_version=? WHERE document_id=?')
      .run(wrapped.wrappedKey, wrapped.keyIv, wrapped.keyAuthTag, wrapped.keyVersion, row.document_id);
    rewrapped += 1;
  }
}

console.log(`Encryption migration complete: ${migrated} legacy blobs migrated, ${rewrapped} document keys rewrapped.`);

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) db.close();
