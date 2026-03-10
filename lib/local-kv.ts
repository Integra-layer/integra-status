// lib/local-kv.ts — File-based KV store (replaces @vercel/kv for EC2 deployment)
// Stores state in /tmp/integra-kv.json with TTL support for flap counters.

import { readFileSync, writeFileSync } from "fs";

const KV_PATH = "/tmp/integra-kv.json";

type KVEntry = {
  value: unknown;
  expiresAt?: number; // epoch ms, undefined = no expiry
};

type KVStore = Record<string, KVEntry>;

function load(): KVStore {
  try {
    return JSON.parse(readFileSync(KV_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function save(store: KVStore): void {
  writeFileSync(KV_PATH, JSON.stringify(store), "utf-8");
}

export const localKv = {
  async get<T = unknown>(key: string): Promise<T | null> {
    const store = load();
    const entry = store[key];
    if (!entry) return null;
    // Check TTL
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      delete store[key];
      save(store);
      return null;
    }
    return entry.value as T;
  },

  async set(
    key: string,
    value: unknown,
    opts?: { ex?: number },
  ): Promise<void> {
    const store = load();
    store[key] = {
      value,
      expiresAt: opts?.ex ? Date.now() + opts.ex * 1000 : undefined,
    };
    save(store);
  },

  async del(key: string): Promise<void> {
    const store = load();
    delete store[key];
    save(store);
  },

  async sadd(key: string, ...members: string[]): Promise<number> {
    const store = load();
    const entry = store[key];
    const current: string[] = Array.isArray(entry?.value)
      ? (entry.value as string[])
      : [];
    let added = 0;
    for (const m of members) {
      if (!current.includes(m)) {
        current.push(m);
        added++;
      }
    }
    store[key] = { value: current };
    save(store);
    return added;
  },

  async srem(key: string, ...members: string[]): Promise<number> {
    const store = load();
    const entry = store[key];
    if (!entry || !Array.isArray(entry.value)) return 0;
    const current = entry.value as string[];
    let removed = 0;
    for (const m of members) {
      const idx = current.indexOf(m);
      if (idx !== -1) {
        current.splice(idx, 1);
        removed++;
      }
    }
    store[key] = { value: current };
    save(store);
    return removed;
  },
};
