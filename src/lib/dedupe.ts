// Detecção e limpeza de duplicados POR BASE (mesmo email repetido na mesma base).
// "Manter o mais recente" remove as cópias antigas (por criado_em), preservando a última.

import type { SupabaseClient } from '@supabase/supabase-js';

export type DupSource = 'framer' | 'rd_pipedrive' | 'webinar';

const SRC: Record<DupSource, { table: string; email: string; nome: string }> = {
  framer:       { table: 'leads_framer',       email: 'email',      nome: 'nome' },
  rd_pipedrive: { table: 'leads_rd_pipedrive', email: 'lead_email', nome: 'lead_nome' },
  webinar:      { table: 'leads_webinar',      email: 'email',      nome: 'nome' },
};
const LABEL: Record<DupSource, string> = { framer: 'LP Framer', rd_pipedrive: 'RD → Pipedrive', webinar: 'LP Webinar' };
const norm = (e: any) => (e ?? '').toString().trim().toLowerCase();

export interface DupCopy { id: number | string; criado_em: string | null; nome: string | null; email: string | null; }
export interface DupGroup {
  source: DupSource; source_label: string; key: string; count: number;
  copies: DupCopy[]; keep_id: number | string; remove_ids: (number | string)[];
}

export async function fetchDuplicates(db: SupabaseClient, opts: { source?: DupSource; email?: string } = {}): Promise<DupGroup[]> {
  const sources = opts.source ? [opts.source] : (Object.keys(SRC) as DupSource[]);
  const wanted = opts.email ? norm(opts.email) : null;
  const groups: DupGroup[] = [];
  for (const src of sources) {
    const c = SRC[src];
    const { data, error } = await db.from(c.table).select(`id,criado_em,${c.email},${c.nome}`).limit(20000);
    if (error || !data) continue;
    const byKey = new Map<string, DupCopy[]>();
    for (const row of data as any[]) {
      const key = norm(row[c.email]);
      if (!key) continue;
      if (wanted && key !== wanted) continue;
      const copy: DupCopy = { id: row.id, criado_em: row.criado_em ?? null, nome: row[c.nome] ?? null, email: row[c.email] ?? null };
      let arr = byKey.get(key); if (!arr) { arr = []; byKey.set(key, arr); } arr.push(copy);
    }
    for (const [key, copies] of byKey) {
      if (copies.length < 2) continue;
      const sorted = [...copies].sort((a, b) => (b.criado_em || '').localeCompare(a.criado_em || ''));
      groups.push({
        source: src, source_label: LABEL[src], key, count: copies.length,
        copies: sorted, keep_id: sorted[0].id, remove_ids: sorted.slice(1).map((x) => x.id),
      });
    }
  }
  groups.sort((a, b) => b.count - a.count);
  return groups;
}

export async function dedupe(
  db: SupabaseClient,
  opts: { source?: DupSource; email?: string; dryRun?: boolean } = {},
): Promise<{ groups: number; toRemove: number; removed: number; dryRun: boolean; errors: string[] }> {
  const groups = await fetchDuplicates(db, { source: opts.source, email: opts.email });
  const removeItems = groups.flatMap((g) => g.remove_ids.map((id) => ({ source: g.source, id })));
  if (opts.dryRun) return { groups: groups.length, toRemove: removeItems.length, removed: 0, dryRun: true, errors: [] };
  let removed = 0; const errors: string[] = [];
  for (const it of removeItems) {
    const { error } = await db.from(SRC[it.source].table).delete().eq('id', it.id);
    if (error) errors.push(`${it.source}:${it.id} → ${error.message}`); else removed++;
  }
  return { groups: groups.length, toRemove: removeItems.length, removed, dryRun: false, errors };
}
