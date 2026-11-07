/**
 * Key/value storage. On Netlify this is Netlify Blobs (no extra account, no
 * setup). Off Netlify (local `npm run dev`) it's a folder of JSON files in
 * .data/, which is git-ignored. In a production build off Netlify the file
 * store only runs when MAGNET_LOCAL_STORE=1, so a misconfigured host fails
 * loudly instead of silently losing reports.
 */
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { getStore } from "@netlify/blobs";

export interface Entry<T> {
  data: T;
  etag: string;
}

export interface WriteOptions {
  onlyIfMatch?: string;
  onlyIfNew?: boolean;
}

export interface KV {
  get<T>(key: string): Promise<Entry<T> | null>;
  /** Returns false when a conditional write lost the race. */
  set(key: string, data: unknown, options?: WriteOptions): Promise<boolean>;
  list(prefix: string): Promise<string[]>;
  delete(key: string): Promise<void>;
}

const STORE_NAME = "magnet-engine";

function onNetlify(): boolean {
  return Boolean((globalThis as { netlifyBlobsContext?: unknown }).netlifyBlobsContext || process.env.NETLIFY_BLOBS_CONTEXT);
}

class BlobsKV implements KV {
  private store = getStore({ name: STORE_NAME, consistency: "strong" });

  async get<T>(key: string): Promise<Entry<T> | null> {
    const entry = await this.store.getWithMetadata(key, { type: "json" });
    if (!entry || entry.data === null) return null;
    return { data: entry.data as T, etag: entry.etag ?? "" };
  }

  async set(key: string, data: unknown, options: WriteOptions = {}): Promise<boolean> {
    const result = options.onlyIfMatch
      ? await this.store.setJSON(key, data, { onlyIfMatch: options.onlyIfMatch })
      : options.onlyIfNew
        ? await this.store.setJSON(key, data, { onlyIfNew: true })
        : await this.store.setJSON(key, data);
    return result.modified;
  }

  async list(prefix: string): Promise<string[]> {
    const { blobs } = await this.store.list({ prefix });
    return blobs.map((blob) => blob.key);
  }

  async delete(key: string): Promise<void> {
    await this.store.delete(key);
  }
}

/** Dev-only. One process, so an in-memory lock is enough to make writes atomic. */
class FileKV implements KV {
  // MAGNET_DATA_DIR lets tests use a throwaway folder.
  private dir = process.env.MAGNET_DATA_DIR || path.join(process.cwd(), ".data");
  private queue: Promise<unknown> = Promise.resolve();

  private file(key: string): string {
    return path.join(this.dir, `${encodeURIComponent(key)}.json`);
  }

  private locked<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  async get<T>(key: string): Promise<Entry<T> | null> {
    try {
      const raw = await readFile(this.file(key), "utf8");
      return { data: JSON.parse(raw) as T, etag: createHash("sha1").update(raw).digest("hex") };
    } catch {
      return null;
    }
  }

  set(key: string, data: unknown, options: WriteOptions = {}): Promise<boolean> {
    return this.locked(async () => {
      const current = await this.get(key);
      if (options.onlyIfNew && current) return false;
      if (options.onlyIfMatch && (!current || current.etag !== options.onlyIfMatch)) return false;
      await mkdir(this.dir, { recursive: true });
      const target = this.file(key);
      const temp = `${target}.${process.pid}.tmp`;
      await writeFile(temp, JSON.stringify(data), "utf8");
      await rename(temp, target);
      return true;
    });
  }

  async list(prefix: string): Promise<string[]> {
    try {
      const files = await readdir(this.dir);
      return files
        .filter((file) => file.endsWith(".json"))
        .map((file) => decodeURIComponent(file.slice(0, -5)))
        .filter((key) => key.startsWith(prefix))
        .sort();
    } catch {
      return [];
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.file(key), { force: true });
  }
}

let instance: KV | null = null;

export function kv(): KV {
  if (instance) return instance;
  if (onNetlify()) {
    instance = new BlobsKV();
  } else if (process.env.NODE_ENV !== "production" || process.env.MAGNET_LOCAL_STORE === "1") {
    instance = new FileKV();
  } else {
    throw new Error("storage_unavailable");
  }
  return instance;
}

/**
 * Read-modify-write with optimistic locking. `fn` returns the new value, or
 * undefined to leave the entry alone. Retries when another writer got there first.
 */
export async function mutate<T>(key: string, fn: (current: T | null) => T | undefined, attempts = 6): Promise<T | null> {
  const store = kv();
  for (let attempt = 0; attempt < attempts; attempt++) {
    const current = await store.get<T>(key);
    const next = fn(current ? current.data : null);
    if (next === undefined) return current ? current.data : null;
    const ok = current ? await store.set(key, next, { onlyIfMatch: current.etag }) : await store.set(key, next, { onlyIfNew: true });
    if (ok) return next;
    await new Promise((resolve) => setTimeout(resolve, 40 + Math.random() * 120));
  }
  throw new Error("store_conflict");
}
