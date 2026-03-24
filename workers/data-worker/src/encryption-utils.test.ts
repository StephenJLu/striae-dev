import { describe, expect, it } from 'vitest';
import {
  base64UrlDecode,
  base64UrlEncode,
  decryptJsonFromStorage,
  encryptJsonForStorage
} from './encryption-utils';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    for (let j = 0; j < chunk.length; j += 1) {
      binary += String.fromCharCode(chunk[j]);
    }
  }

  return btoa(binary);
}

function toPem(base64Body: string, beginLabel: string, endLabel: string): string {
  const wrapped = base64Body.match(/.{1,64}/g)?.join('\n') ?? base64Body;
  return `${beginLabel}\n${wrapped}\n${endLabel}`;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function generateRsaPemPair(): Promise<{ publicKeyPem: string; privateKeyPem: string }> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['encrypt', 'decrypt']
  );

  const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  return {
    publicKeyPem: toPem(arrayBufferToBase64(spki), '-----BEGIN PUBLIC KEY-----', '-----END PUBLIC KEY-----'),
    privateKeyPem: toPem(arrayBufferToBase64(pkcs8), '-----BEGIN PRIVATE KEY-----', '-----END PRIVATE KEY-----')
  };
}

describe('encryption-utils', () => {
  it('encodes and decodes base64url values', () => {
    const input = new Uint8Array([0, 1, 2, 253, 254, 255]);
    const encoded = base64UrlEncode(input);
    const decoded = base64UrlDecode(encoded);

    expect(Array.from(decoded)).toEqual(Array.from(input));
  });

  it('encrypts and decrypts JSON for storage', async () => {
    const { publicKeyPem, privateKeyPem } = await generateRsaPemPair();
    const payload = JSON.stringify({
      userId: 'abc123',
      caseId: 'case-001',
      evidence: ['img-a', 'img-b']
    });

    const encrypted = await encryptJsonForStorage(payload, publicKeyPem, 'data-key-v1');

    expect(encrypted.envelope.algorithm).toBe('RSA-OAEP-AES-256-GCM');
    expect(encrypted.envelope.encryptionVersion).toBe('1.0');
    expect(encrypted.envelope.keyId).toBe('data-key-v1');
    expect(encrypted.envelope.dataIv.length).toBeGreaterThan(0);
    expect(encrypted.envelope.wrappedKey.length).toBeGreaterThan(0);
    expect(encrypted.ciphertext.byteLength).toBeGreaterThan(0);

    const decrypted = await decryptJsonFromStorage(
      toArrayBuffer(encrypted.ciphertext),
      encrypted.envelope,
      privateKeyPem
    );

    expect(decrypted).toBe(payload);
  });

  it('fails decryption with incorrect private key', async () => {
    const validKeys = await generateRsaPemPair();
    const wrongKeys = await generateRsaPemPair();

    const encrypted = await encryptJsonForStorage(
      JSON.stringify({ ok: true }),
      validKeys.publicKeyPem,
      'data-key-v1'
    );

    await expect(
      decryptJsonFromStorage(
        toArrayBuffer(encrypted.ciphertext),
        encrypted.envelope,
        wrongKeys.privateKeyPem
      )
    ).rejects.toThrow();
  });
});
