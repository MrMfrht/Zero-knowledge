import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'crypto';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * IndexerClient with 30-second response caching.
 *
 * Reporting queries change slowly and are called repeatedly during a demo.
 * Cache hits eliminate redundant network calls to the indexer.
 */
@Injectable()
export class IndexerClient {
  private readonly url = process.env.INDEXER_URL ?? 'https://indexer.preview.midnight.network/api/v4/graphql';
  private readonly cache = new Map<string, CacheEntry<any>>();
  private readonly cacheTtlMs = 30 * 1000; // 30 seconds

  /**
   * Generate a cache key from query + variables.
   * Deterministic hash so the same query always uses the same cache slot.
   */
  private getCacheKey(query: string, variables?: Record<string, unknown>): string {
    const input = JSON.stringify({ query, variables });
    return createHash('sha256').update(input).digest('hex').slice(0, 16);
  }

  /**
   * Check if a cache entry exists and is still valid.
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    const age = Date.now() - entry.timestamp;
    if (age > this.cacheTtlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  /**
   * Store a value in cache with current timestamp.
   */
  private setInCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  async query<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const cacheKey = this.getCacheKey(query, variables);
    
    // Check cache first
    const cached = this.getFromCache<T>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query, variables }),
      });
      if (!res.ok) {
        throw new ServiceUnavailableException(`Indexer returned ${res.status}`);
      }
      const body = (await res.json()) as { data?: T; errors?: unknown[] };
      if (body.errors?.length) {
        throw new ServiceUnavailableException('Indexer query failed');
      }
      if (!body.data) {
        throw new ServiceUnavailableException('Indexer returned no data');
      }
      
      // Cache successful response
      this.setInCache(cacheKey, body.data);
      return body.data;
    } catch (err: any) {
      if (err instanceof ServiceUnavailableException) throw err;
      throw new ServiceUnavailableException(`Indexer unavailable: ${err?.message || 'network error'}`);
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: '{ __typename }' }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
