export function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  const decoded = atob(normalized + padding);
  const bytes = new Uint8Array(decoded.length);

  for (let i = 0; i < decoded.length; i += 1) {
    bytes[i] = decoded.charCodeAt(i);
  }

  return bytes;
}

function parsePkcs8PrivateKey(privateKey: string): ArrayBuffer {
  const normalizedKey = privateKey
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\\n/g, '\n');

  const pemBody = normalizedKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');

  if (!pemBody) {
    throw new Error('Encryption private key is invalid');
  }

  const binary = atob(pemBody);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

/**
 * Import RSA private key from PKCS8 PEM format
 */
async function importRsaOaepPrivateKey(privateKeyPem: string): Promise<CryptoKey> {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    parsePkcs8PrivateKey(privateKeyPem),
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256'
    },
    false,
    ['decrypt']
  );

  return key;
}

/**
 * Decrypt AES key from RSA-OAEP wrapped form
 */
async function unwrapAesKey(
  wrappedKeyBase64: string,
  privateKeyPem: string
): Promise<CryptoKey> {
  const rsaPrivateKey = await importRsaOaepPrivateKey(privateKeyPem);
  const wrappedKeyBytes = base64UrlDecode(wrappedKeyBase64);

  const rawAesKey = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    rsaPrivateKey,
    wrappedKeyBytes as BufferSource
  );

  return crypto.subtle.importKey(
    'raw',
    rawAesKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
}

/**
 * Decrypt data file (plaintext JSON/CSV)
 */
export async function decryptExportData(
  encryptedDataBase64: string,
  wrappedKeyBase64: string,
  ivBase64: string,
  privateKeyPem: string
): Promise<string> {
  const aesKey = await unwrapAesKey(wrappedKeyBase64, privateKeyPem);
  const iv = base64UrlDecode(ivBase64);
  const ciphertext = base64UrlDecode(encryptedDataBase64);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    aesKey,
    ciphertext as BufferSource
  );

  return new TextDecoder().decode(plaintext);
}

/**
 * Decrypt a single image blob
 */
export async function decryptImageBlob(
  encryptedImageBase64: string,
  wrappedKeyBase64: string,
  ivBase64: string,
  privateKeyPem: string
): Promise<Blob> {
  const aesKey = await unwrapAesKey(wrappedKeyBase64, privateKeyPem);
  const iv = base64UrlDecode(ivBase64);
  const ciphertext = base64UrlDecode(encryptedImageBase64);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    aesKey,
    ciphertext as BufferSource
  );

  // Return as blob (caller can determine MIME type from context)
  return new Blob([plaintext]);
}
