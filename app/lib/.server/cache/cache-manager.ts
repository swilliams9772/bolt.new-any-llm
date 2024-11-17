import { createHash } from 'crypto';
import type { Message } from 'ai';

interface CacheEntry {
  response: string;
  timestamp: number;
  provider: string;
  model: string;
}

export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly TTL: number = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  private readonly SIMILARITY_THRESHOLD = 0.9;

  private generateHash(messages: Message[], provider: string, model: string): string {
    const content = messages.map(m => m.content).join('');
    return createHash('sha256')
      .update(`${content}${provider}${model}`)
      .digest('hex');
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.toLowerCase().split(/\s+/));
    const words2 = new Set(str2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  set(messages: Message[], response: string, provider: string, model: string): void {
    const hash = this.generateHash(messages, provider, model);
    this.cache.set(hash, {
      response,
      timestamp: Date.now(),
      provider,
      model
    });

    // Cleanup old entries
    this.cleanup();
  }

  get(messages: Message[], provider: string, model: string): string | null {
    const hash = this.generateHash(messages, provider, model);
    const exact = this.cache.get(hash);

    if (exact && Date.now() - exact.timestamp < this.TTL) {
      return exact.response;
    }

    // Check for similar prompts
    const userMessage = messages[messages.length - 1].content;
    for (const [otherHash, entry] of this.cache.entries()) {
      if (entry.provider === provider && 
          entry.model === model && 
          Date.now() - entry.timestamp < this.TTL) {
        
        const similarity = this.calculateSimilarity(userMessage, otherHash);
        if (similarity >= this.SIMILARITY_THRESHOLD) {
          return entry.response;
        }
      }
    }

    return null;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [hash, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.TTL) {
        this.cache.delete(hash);
      }
    }
  }
}

// Singleton instance
export const cacheManager = new CacheManager(); 