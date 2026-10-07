import { type AnyColumn, ilike, or, type SQL, sql } from 'drizzle-orm';

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/**
 * Search condition and relevance for tables with a `search_vector` column and
 * a trigram-indexed name: stemmed full-text matches, typo-tolerant name
 * matches, and plain substring matches.
 */
export function textSearch(
  columns: { vector: AnyColumn; name: AnyColumn; also?: AnyColumn[] },
  q: string,
): { where: SQL; rank: SQL<number> } {
  const query = sql`websearch_to_tsquery('english', ${q})`;
  const pattern = `%${escapeLike(q)}%`;
  const where = or(
    sql`${columns.vector} @@ ${query}`,
    sql`${columns.name} % ${q}`,
    ilike(columns.name, pattern),
    ...(columns.also ?? []).map((column) => ilike(column, pattern)),
  )!;
  const rank = sql<number>`greatest(ts_rank(${columns.vector}, ${query}), similarity(${columns.name}, ${q}))`;
  return { where, rank };
}

/** Case-insensitive "array column contains value". */
export function arrayContainsIgnoreCase(column: AnyColumn, value: string): SQL {
  return sql`EXISTS (SELECT 1 FROM unnest(${column}) AS item WHERE lower(item) = lower(${value}))`;
}
