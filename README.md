# Mission Dream Home — Sample Boards

Every idea from your *Mission dream home* WhatsApp chat, composed into **interior-designer sample boards** — one per room: hero + swatches + a palette pulled from the images + material tags. Shortlist what you love; hand the boards to the architect. Al Furjan aesthetic — sandstone, terracotta, kraft.

## Shared across all devices (fetch once, everyone sees it)
Digests + your edits live in a single **Vercel Blob** file, `library.json`. You backfill **once on your Mac**; your phone, Zimi's phone, and the architect all read the same library — no re-fetching, no re-spending.

- The app reads `/api/library` on load and merges it in.
- Any edit (shortlist, notes, room, added reel) syncs back to the library.
- Photo palettes + board layout work offline; the cloud just carries the digests + edits.

## One-time backfill on your Mac
Do this after the site is deployed and the keys + Blob store are set in Vercel.

```
vercel env pull .env.local      # pulls APIFY_TOKEN, ANTHROPIC_API_KEY, BLOB_READ_WRITE_TOKEN
npm install                     # installs @vercel/blob for the script
npm run backfill                # fetches all 84 reels → writes library.json to Blob
```
It's **resumable** — rerun anytime; it skips reels already done and only fetches new ones. When it finishes, reload the app on any device and every board is filled.

To enrich later reels you add from your phone, either add them in-app (auto-ingests) or rerun `npm run backfill` on the Mac.

## Deploy
```
git add . && git commit -m "sample boards + shared library" && git push
```
Vercel auto-deploys. Static frontend + two serverless functions (`/api/ingest`, `/api/library`); Vercel installs their deps automatically.

## Keys (Vercel → Settings → Environment Variables)
| Name | For |
|---|---|
| `ANTHROPIC_API_KEY` | digest: title, summary, room, material tags, reel palette |
| `APIFY_TOKEN` | reading each reel's cover + caption (apify.com → Settings → Integrations) |
| `ANTHROPIC_MODEL` *(optional)* | default `claude-haiku-4-5` |

Then Storage → **Create → Blob → Connect** (auto-adds `BLOB_READ_WRITE_TOKEN`). Redeploy so functions pick up the vars.

## Cost
Apify free tier (~$5/mo credit) + Haiku (fractions of a cent/reel) → backfilling all 84 costs pennies, once.

## What can't come from a reel
Product names, dimensions, prices, exact paint codes — only if in the caption. Everything else auto-fills; correct any field with a tap in an idea's detail.
