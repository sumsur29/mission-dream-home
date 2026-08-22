// Local backfill: run on your Mac. Reads the reels from index.html, fetches each
// reel's cover + caption (Apify), writes a digest (Claude), and saves everything to
// Vercel Blob as library.json — which every device then reads. Resumable & idempotent.
//
//   1)  vercel env pull .env.local        (gets APIFY_TOKEN, ANTHROPIC_API_KEY, BLOB_READ_WRITE_TOKEN)
//   2)  npm install
//   3)  npm run backfill
import { list, put } from '@vercel/blob';
import fs from 'node:fs';

// load .env.local / .env
for (const f of ['.env.local', '.env']) {
  if (fs.existsSync(f)) fs.readFileSync(f, 'utf8').split('\n').forEach(l => {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
}
const { APIFY_TOKEN, ANTHROPIC_API_KEY, BLOB_READ_WRITE_TOKEN, ANTHROPIC_MODEL } = process.env;
if (!APIFY_TOKEN || !ANTHROPIC_API_KEY || !BLOB_READ_WRITE_TOKEN) {
  console.error('Missing env. Need APIFY_TOKEN, ANTHROPIC_API_KEY, BLOB_READ_WRITE_TOKEN.\nRun:  vercel env pull .env.local'); process.exit(1);
}
const ROOMS = ["entrance","living","mandir","dining","kitchen","bedrooms","kids","wardrobes","bathrooms","terrace","garden","pool","palette","walls","lighting","tiles","openings","furniture","structure","designers","notes","unsorted"];
const sleep = ms => new Promise(r => setTimeout(r, ms));

// read SEED out of index.html
const html = fs.readFileSync('index.html', 'utf8');
const s = html.indexOf('const SEED=') + 'const SEED='.length;
const e = html.indexOf('const SP=', s);
const SEED = JSON.parse(html.slice(s, e).trim().replace(/;\s*$/, ''));

// resume from existing library
let lib = { over: {}, add: [], del: [] };
try {
  const { blobs } = await list({ prefix: 'library.json', token: BLOB_READ_WRITE_TOKEN });
  const b = blobs.find(x => x.pathname === 'library.json');
  if (b) { lib = await (await fetch(b.url)).json(); console.log('Resuming existing library.'); }
} catch (e) {}
lib.over = lib.over || {};

const targets = SEED.filter(i => (i.kind === 'reel' || i.kind === 'post') && i.igId && !(lib.over[i.id] && lib.over[i.id].summary));
console.log(`Backfilling ${targets.length} reels (of ${SEED.length} items)…\n`);

let ok = 0, fail = 0;
for (let k = 0; k < targets.length; k++) {
  const it = targets[k];
  process.stdout.write(`[${k + 1}/${targets.length}] ${(it.caption || it.igId).slice(0, 32).padEnd(32)} … `);
  try {
    const dg = await ingest(it);
    lib.over[it.id] = { ...(lib.over[it.id] || {}), thumb: dg.thumb || null, summary: dg.summary || '', tags: dg.tags || [], palette: dg.palette || [], caption: it.caption || dg.title || '' };
    ok++; console.log(dg.summary ? 'ok ✦' : (dg.thumb ? 'cover only' : 'thin'));
  } catch (err) { fail++; console.log('skip (' + ((err && err.message) || err) + ')'); }
  if (k % 5 === 0 || k === targets.length - 1) await save();
  await sleep(300);
}
await save();
console.log(`\nDone. ${ok} enriched, ${fail} skipped. library.json written to Blob — reload the app on any device.`);

async function save() { lib.updatedAt = Date.now(); await put('library.json', JSON.stringify(lib), { access: 'public', addRandomSuffix: false, contentType: 'application/json', token: BLOB_READ_WRITE_TOKEN }); }

async function ingest(it) {
  const shortcode = it.igId;
  const ar = await fetch(`https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ directUrls: [it.url], resultsType: 'details', resultsLimit: 1, addParentData: false })
  });
  const data = await ar.json();
  const d = Array.isArray(data) ? data[0] : (data && data.items && data.items[0]);
  const caption = (d && d.caption) || '';
  const displayUrl = (d && (d.displayUrl || (d.images && d.images[0]))) || '';
  let thumb = displayUrl || null, imgB64 = null, mt = 'image/jpeg';
  if (displayUrl) {
    const ir = await fetch(displayUrl); const buf = Buffer.from(await ir.arrayBuffer());
    mt = (ir.headers.get('content-type') || 'image/jpeg').includes('png') ? 'image/png' : 'image/jpeg';
    imgB64 = buf.toString('base64');
    const up = await put(`reels/${shortcode}.jpg`, buf, { access: 'public', addRandomSuffix: false, contentType: mt, token: BLOB_READ_WRITE_TOKEN });
    thumb = up.url;
  }
  let digest = {};
  const content = [];
  if (imgB64) content.push({ type: 'image', source: { type: 'base64', media_type: mt, data: imgB64 } });
  content.push({ type: 'text', text:
`Home-design idea saved from Instagram. Caption: """${caption.slice(0, 600)}"""
Reply with ONLY minified JSON, no prose, no code fences:
{"title":"max 4 words","room":one of ${JSON.stringify(ROOMS)},"summary":"max 18 words: the design idea + one notable detail","tags":["2-4 short tags"],"palette":["2-3 hex colours visible in the image"]}` });
  const cr = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: ANTHROPIC_MODEL || 'claude-haiku-4-5', max_tokens: 400, messages: [{ role: 'user', content }] })
  });
  const cj = await cr.json();
  let txt = (cj.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { digest = JSON.parse(txt); } catch (e) { digest = { summary: txt.slice(0, 160) }; }
  return { thumb, title: digest.title || '', summary: digest.summary || '', tags: Array.isArray(digest.tags) ? digest.tags.slice(0, 4) : [], palette: Array.isArray(digest.palette) ? digest.palette.slice(0, 3) : [] };
}
