/**
 * Real WebCrypto API utilities for DocVault Zero-Trust operations.
 * Operates entirely client-side using hardware-accelerated SubtleCrypto.
 */

/**
 * Computes a genuine SHA-256 cryptographic digest of a File or ArrayBuffer.
 */
export async function computeSha256(data: File | ArrayBuffer | string): Promise<string> {
  let buffer: ArrayBuffer;

  if (typeof data === 'string') {
    buffer = new TextEncoder().encode(data).buffer;
  } else if (data instanceof File) {
    buffer = await data.arrayBuffer();
  } else {
    buffer = data;
  }

  const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates an ephemeral cryptographic AES-GCM (256-bit) Data Encryption Key (DEK).
 */
export async function generateAesKey(): Promise<{ key: CryptoKey; rawHex: string }> {
  const key = await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );

  const exported = await window.crypto.subtle.exportKey('raw', key);
  const rawHex = Array.from(new Uint8Array(exported))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return { key, rawHex };
}

/**
 * Encrypts a text or binary payload using AES-GCM with a random 96-bit initialization vector (IV).
 */
export async function encryptPayloadWithAesGcm(
  data: string,
  key: CryptoKey
): Promise<{ cipherHex: string; ivHex: string }> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(data);

  const cipherBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encoded
  );

  const cipherHex = Array.from(new Uint8Array(cipherBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const ivHex = Array.from(iv)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return { cipherHex, ivHex };
}
