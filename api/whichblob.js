import { list } from '@vercel/blob';
export default async function handler(req, res) {
  const tok = process.env.BLOB_READ_WRITE_TOKEN || '';
  let files = [], err = null;
  try { const { blobs } = await list(); files = blobs.map(b => b.pathname); }
  catch (e) { err = String(e && e.message || e); }
  res.status(200).json({ tokenPrefix: tok.slice(0, 22), hasLibrary: files.includes('library.json'), files: files.slice(0, 10), err });
}
