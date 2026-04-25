import type { Env } from './types';

const JSON_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'Pragma': 'no-cache',
};

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

/**
 * ListsStore is a Durable Object that owns the authoritative copy of each named
 * list. Cloudflare guarantees a single global instance per DO ID, so all reads
 * and writes are handled by one actor. Combined with blockConcurrencyWhile,
 * this eliminates the read-modify-write race that exists when using KV directly.
 *
 * On first access the DO seeds its storage from the legacy KV namespace so that
 * existing list data is preserved without a separate migration step.
 */
export class ListsStore implements DurableObject {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  /**
   * Return the current entries from DO storage.
   * If DO storage has never been written, seeds from the KV namespace once.
   * Must always be called from within a blockConcurrencyWhile callback.
   */
  private async getEntries(key: string): Promise<string[]> {
    const stored = await this.state.storage.get<string>('list');
    if (stored === undefined) {
      // First-ever access for this DO instance: migrate from KV so no data is lost.
      const kvRaw = (await this.env.STRIAE_LISTS.get(key)) ?? '';
      const entries = kvRaw
        ? kvRaw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
        : [];
      await this.state.storage.put('list', entries.join(','));
      return entries;
    }
    return stored ? stored.split(',').filter(Boolean) : [];
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const key = url.searchParams.get('key');

    if (!key) {
      return jsonResponse({ error: 'Missing key parameter' }, 400);
    }

    // blockConcurrencyWhile ensures no other request can interleave between
    // the storage read and write, preventing lost-update races.
    return this.state.blockConcurrencyWhile(async () => {
      const entries = await this.getEntries(key);

      if (request.method === 'GET') {
        return jsonResponse({ list: entries.join(',') });
      }

      if (request.method === 'POST' || request.method === 'DELETE') {
        let body: { entry?: unknown };
        try {
          body = (await request.json()) as { entry?: unknown };
        } catch {
          return jsonResponse({ error: 'Invalid JSON body' }, 400);
        }

        const entry =
          typeof body.entry === 'string' ? body.entry.trim().toLowerCase() : '';
        if (!entry) {
          return jsonResponse({ error: 'Missing or empty entry' }, 400);
        }

        let updated: string[];
        if (request.method === 'POST') {
          updated = entries.includes(entry) ? entries : [...entries, entry];
        } else {
          updated = entries.filter(e => e !== entry);
        }

        await this.state.storage.put('list', updated.join(','));
        return jsonResponse({ ok: true });
      }

      return jsonResponse({ error: 'Method not allowed' }, 405);
    });
  }
}
