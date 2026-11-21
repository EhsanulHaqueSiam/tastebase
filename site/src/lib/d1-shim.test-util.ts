// Tests only: an in-memory node:sqlite database behind the slice of the D1 API that auth-data.ts and better-auth use.
/// <reference types="node" />
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

export function memoryD1() {
  const db = new DatabaseSync(":memory:");
  const stmt = (sql: string, args: SQLInputValue[] = []) => ({
    bind: (...a: unknown[]) => stmt(sql, a as SQLInputValue[]),
    all: async () => ({ results: db.prepare(sql).all(...args), success: true, meta: {} }),
    raw: async () => {
      const s = db.prepare(sql);
      s.setReturnArrays(true);
      return s.all(...args);
    },
    first: async (col?: string) => {
      const row = db.prepare(sql).get(...args) as Record<string, unknown> | undefined;
      return row === undefined ? null : col ? row[col] : row;
    },
    run: async () => ({ results: [], success: true, meta: { changes: Number(db.prepare(sql).run(...args).changes) } }),
  });
  return {
    exec: (sql: string) => db.exec(sql),
    prepare: (sql: string) => stmt(sql),
    batch: async (ss: ReturnType<typeof stmt>[]) => {
      db.exec("BEGIN");
      try {
        const out = [];
        for (const s of ss) out.push(await s.all());
        db.exec("COMMIT");
        return out;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
