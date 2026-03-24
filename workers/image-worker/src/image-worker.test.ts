import { describe, expect, it } from 'vitest';
import worker from './image-worker';

type StoredObject = {
  body: Uint8Array;
  customMetadata?: Record<string, string>;
};

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

class InMemoryR2Bucket {
  private store = new Map<string, StoredObject>();

  async head(key: string): Promise<{ key: string; customMetadata?: Record<string, string> } | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    return {
      key,
      customMetadata: entry.customMetadata
    };
  }

  async get(key: string): Promise<{ key: string; customMetadata?: Record<string, string>; arrayBuffer: () => Promise<ArrayBuffer> } | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    return {
      key,
      customMetadata: entry.customMetadata,
      arrayBuffer: async () => toArrayBuffer(entry.body)
    };
  }

  async put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob,
    options?: { customMetadata?: Record<string, string> }
  ): Promise<{ key: string }> {
    let bytes: Uint8Array;

    if (value === null) {
      bytes = new Uint8Array(0);
    } else if (value instanceof ArrayBuffer) {
      bytes = new Uint8Array(value);
    } else if (ArrayBuffer.isView(value)) {
      bytes = new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
    } else if (typeof value === 'string') {
      bytes = new TextEncoder().encode(value);
    } else if (value instanceof Blob) {
      bytes = new Uint8Array(await value.arrayBuffer());
    } else {
      throw new Error('Unsupported put value type in test bucket');
    }

    this.store.set(key, {
      body: bytes,
      customMetadata: options?.customMetadata
    });

    return { key };
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  getRaw(key: string): StoredObject | undefined {
    return this.store.get(key);
  }
}

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

describe('image-worker', () => {
  it('rejects unauthorized requests', async () => {
    const bucket = new InMemoryR2Bucket();
    const keys = await generateRsaPemPair();

    const response = await worker.fetch(
      new Request('https://image-worker.local/some-id', { method: 'GET' }),
      {
        IMAGES_API_TOKEN: 'token',
        STRIAE_FILES: bucket as unknown as R2Bucket,
        DATA_AT_REST_ENCRYPTION_PUBLIC_KEY: keys.publicKeyPem,
        DATA_AT_REST_ENCRYPTION_PRIVATE_KEY: keys.privateKeyPem,
        DATA_AT_REST_ENCRYPTION_KEY_ID: 'img-key-v1'
      }
    );

    expect(response.status).toBe(403);
  });

  it('uploads, retrieves, and deletes encrypted file content', async () => {
    const bucket = new InMemoryR2Bucket();
    const keys = await generateRsaPemPair();

    const env = {
      IMAGES_API_TOKEN: 'token',
      STRIAE_FILES: bucket as unknown as R2Bucket,
      DATA_AT_REST_ENCRYPTION_PUBLIC_KEY: keys.publicKeyPem,
      DATA_AT_REST_ENCRYPTION_PRIVATE_KEY: keys.privateKeyPem,
      DATA_AT_REST_ENCRYPTION_KEY_ID: 'img-key-v1'
    };

    const originalBytes = new TextEncoder().encode('encrypted-worker-upload-test');
    const formData = new FormData();
    formData.set('file', new File([originalBytes], 'test.png', { type: 'image/png' }));

    const uploadResponse = await worker.fetch(
      new Request('https://image-worker.local/', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token'
        },
        body: formData
      }),
      env
    );

    expect(uploadResponse.status).toBe(200);
    const uploadPayload = await uploadResponse.json() as { result: { id: string }; success: boolean };
    expect(uploadPayload.success).toBe(true);
    expect(uploadPayload.result.id.length).toBeGreaterThan(0);

    const stored = bucket.getRaw(uploadPayload.result.id);
    expect(stored).toBeDefined();
    expect(stored?.customMetadata?.algorithm).toBe('RSA-OAEP-AES-256-GCM');
    expect(Array.from(stored?.body || [])).not.toEqual(Array.from(originalBytes));

    const getResponse = await worker.fetch(
      new Request(`https://image-worker.local/${encodeURIComponent(uploadPayload.result.id)}`, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer token'
        }
      }),
      env
    );

    expect(getResponse.status).toBe(200);
    expect(getResponse.headers.get('Content-Type')).toBe('image/png');
    const retrievedBytes = new Uint8Array(await getResponse.arrayBuffer());
    expect(Array.from(retrievedBytes)).toEqual(Array.from(originalBytes));

    const deleteResponse = await worker.fetch(
      new Request(`https://image-worker.local/${encodeURIComponent(uploadPayload.result.id)}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer token'
        }
      }),
      env
    );

    expect(deleteResponse.status).toBe(200);

    const missingResponse = await worker.fetch(
      new Request(`https://image-worker.local/${encodeURIComponent(uploadPayload.result.id)}`, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer token'
        }
      }),
      env
    );

    expect(missingResponse.status).toBe(404);
  });
});
