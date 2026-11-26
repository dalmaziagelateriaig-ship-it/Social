import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * Minimal SQL access that works with a hosted Postgres (DATABASE_URL, e.g. Supabase)
 * or, when that is not set, an embedded Postgres saved in the data folder.
 */
export interface Sql {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  exec(text: string): Promise<void>;
}

async function connect(): Promise<Sql> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    // prepare: false keeps it compatible with Supabase's connection pooler.
    const client = postgres(url, { prepare: false, max: 5, idle_timeout: 20, onnotice: () => {} });
    return {
      query: async <T,>(text: string, params: unknown[] = []) =>
        (await client.unsafe(text, params as never[])) as unknown as T[],
      exec: async (text: string) => {
        await client.unsafe(text);
      },
    };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "pglite");
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  const db = await PGlite.create(dir);
  return {
    query: async <T,>(text: string, params: unknown[] = []) => (await db.query<T>(text, params)).rows,
    exec: async (text: string) => {
      await db.exec(text);
    },
  };
}

const globalForSql = globalThis as unknown as { __sql?: Promise<Sql> };

export function sql(): Promise<Sql> {
  globalForSql.__sql ??= connect().catch((e) => {
    globalForSql.__sql = undefined;
    throw e;
  });
  return globalForSql.__sql;
}
