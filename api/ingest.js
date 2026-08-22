// Vercel serverless function — fetch an Instagram reel, build a digest with Claude.
// Env vars (set in Vercel → Project → Settings → Environment Variables):
//   ANTHROPIC_API_KEY   (required for the digest)
//   APIFY_TOKEN         (required to read the reel's cover + caption)
//   ANTHROPIC_MODEL     (optional, default claude-haiku-4-5)
//   BLOB_READ_WRITE_TOKEN is provided automatically when you connect a Vercel Blob store.
import { put } from '@vercel/blob';

const ROOMS = ["entrance","living","mandir","dining","kitchen","bedrooms","kids","wardrobes","bathrooms","terrace","garden","pool","palette","walls","lighting","tiles","openings","furniture","structure","designers","notes","unsorted"];

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const url = body.url || '';
    const m = url.match(/instagram\.com\/(reel|p|tv)\/([A-Za-z0-9_\-]+)/);
    if (!m) { res.status(400).json({ error: 'not an instagram url' }); return; }
    const shortcode = m[2];

    // 1) reel data via Apify instagram-scraper
    let caption = '', displayUrl = '', video = null;
    if (process.env.APIFY_TOKEN) {
      try {
        const ar = await fetch(`https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${process.env.APIFY_TOKEN}`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ directUrls: [url], resultsType: 'details', resultsLimit: 1, addParentData: false })
        });
        const data = await ar.json();
        const it = Array.isArray(data) ? data[0] : (data && data.items && data.items[0]);
        if (it) { caption = it.caption || ''; displayUrl = it.displayUrl || (it.images && it.images[0]) || ''; video = it.videoUrl || null; }
      } catch (e) {}
    }

    // 2) rehost cover to Blob (durable) — else fall back to the raw IG url
    let thumb = displayUrl || null, imgB64 = null, mediaType = 'image/jpeg';
    if (displayUrl) {
      try {
        const ir = await fetch(displayUrl);
        const buf = Buffer.from(await ir.arrayBuffer());
        mediaType = (ir.headers.get('content-type') || 'image/jpeg').includes('png') ? 'image/png' : 'image/jpeg';
        imgB64 = buf.toString('base64');
        if (process.env.BLOB_READ_WRITE_TOKEN) {
          const up = await put(`reels/${shortcode}.jpg`, buf, { access: 'public', contentType: mediaType });
          thumb = up.url;
        }
      } catch (e) {}
    }

    // 3) Claude digest (vision on the cover + caption)
    let digest = {};
    if (process.env.ANTHROPIC_API_KEY) {
      const content = [];
      if (imgB64) content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: imgB64 } });
      content.push({ type: 'text', text:
`This is a home-design idea saved from Instagram. Caption: """${(caption || '').slice(0, 600)}"""
Reply with ONLY minified JSON, no prose, no code fences:
{"title":"max 4 words","room":one of ${JSON.stringify(ROOMS)},"summary":"max 18 words: what the design idea is + one notable detail","tags":["2-4 short tags"],"palette":["2-3 hex colours visible in the image"]}` });
      try {
        const cr = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5', max_tokens: 400, messages: [{ role: 'user', content }] })
        });
        const cj = await cr.json();
        let txt = (cj.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
        txt = txt.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
        try { digest = JSON.parse(txt); } catch (e) { digest = { summary: txt.slice(0, 160) }; }
      } catch (e) {}
    }

    res.status(200).json({
      shortcode, thumb, video,
      title: digest.title || '',
      room: ROOMS.includes(digest.room) ? digest.room : 'unsorted',
      summary: digest.summary || '',
      tags: Array.isArray(digest.tags) ? digest.tags.slice(0, 4) : [],
      palette: Array.isArray(digest.palette) ? digest.palette.slice(0, 3) : [],
      caption,
      note: (!process.env.APIFY_TOKEN || !process.env.ANTHROPIC_API_KEY) ? 'Missing API keys — set them in Vercel to enable digests.' : undefined
    });
  } catch (e) {
    res.status(200).json({ error: String((e && e.message) || e) });
  }
}
