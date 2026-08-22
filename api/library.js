// Shared cloud library in Vercel Blob. GET reads it; POST merges deltas into it.
// Backfill (scripts/backfill.mjs) writes library.json directly; this route lets the app read + sync edits.
import { list, put } from '@vercel/blob';
const LIB = 'library.json';

async function readLib() {
  try {
    const { blobs } = await list({ prefix: LIB });
    const b = blobs.find(x => x.pathname === LIB) || blobs[0];
    if (!b) return null;
    const r = await fetch(b.url, { cache: 'no-store' });
    return await r.json();
  } catch (e) { return null; }
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const lib = await readLib();
      res.status(200).json(lib || { over: {}, add: [], del: [] });
      return;
    }
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      let cur = body.replace ? { over: {}, add: [], del: [] } : (await readLib() || { over: {}, add: [], del: [] });
      cur.over = cur.over || {};
      if (body.over) for (const k in body.over) cur.over[k] = { ...(cur.over[k] || {}), ...body.over[k] };
      cur.add = cur.add || [];
      if (Array.isArray(body.add)) body.add.forEach(it => { if (!cur.add.some(x => x.id === it.id)) cur.add.push(it); });
      cur.del = Array.from(new Set([...(cur.del || []), ...(body.del || [])]));
      cur.updatedAt = Date.now();
      await put(LIB, JSON.stringify(cur), { access: 'public', addRandomSuffix: false, contentType: 'application/json' });
      res.status(200).json({ ok: true, updatedAt: cur.updatedAt });
      return;
    }
    res.status(405).json({ error: 'method' });
  } catch (e) {
    res.status(200).json({ error: String((e && e.message) || e) });
  }
}
