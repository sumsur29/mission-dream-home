# Mission Dream Home — Sample Boards

Every idea from your *Mission dream home* WhatsApp chat, composed into **interior-designer sample boards** — one per room. Each board = a **hero shot + swatches + a palette pulled from the images + material tags**. Shortlist what you love; hand the boards to the architect.

Design language: Al Furjan — sandstone, terracotta, kraft boards, masking-tape labels.

## What fills automatically
- **Hero + palette** — every room with a villa photo (or any image) gets a hero and a real, pixel-extracted **paint-chip strip** (hex codes), computed in the browser. No keys, works offline.
- **Swatches** — the room's other ideas. Reels show as tiles and become real cover thumbnails once digested.
- **Title / room / summary / material tags / reel palette** — from the digest (Claude) when you run it.

## Backfill the 117 reels (one pass)
Menu (⋯) → **Fetch digests for all reels**. It runs each reel through `/api/ingest` (Apify cover+caption → Claude digest → palette + tags), with a progress bar, and fills every board. You can also fetch per-room (the **Fetch** button on an empty palette) or per-reel (in an idea's detail).

## Deploy
```
cd mission-dream-home
git init && git add . && git commit -m "sample boards" && git branch -M main
gh repo create sumsur29/mission-dream-home --public --source=. --remote=origin --push
vercel && vercel --prod
```
Static frontend + one serverless function; Vercel installs the function deps automatically.

## Keys (Vercel → Settings → Environment Variables)
| Name | For |
|---|---|
| `ANTHROPIC_API_KEY` | the digest: title, summary, room, material tags, reel palette |
| `APIFY_TOKEN` | reading each reel's cover + caption |
| `ANTHROPIC_MODEL` *(optional)* | default `claude-haiku-4-5`; bump for richer digests |

Then connect a **Blob store** (Storage → Create → Blob) so covers are rehosted durably, and redeploy. Photo palettes and the whole board layout work even before any keys — the digest just enriches the reels.

## What can't come from a reel (stays manual)
Product names, dimensions, prices, exact paint codes — only if written in the caption. Everything else auto-fills; you correct any field with a tap in an idea's detail.

## Also
- ♥ shortlist → the ♥ view composes your favourites as boards, print-ready.
- Search, per-room reassignment, notes, export (JSON), reset.
- Installed to home screen it's a **share target** — share a reel and it's ingested into the Inbox.
