import * as fs from 'fs/promises';
import path from 'path';

// Fallback image constant
export const FALLBACK_IMAGE = '/images/noimage.webp';

// Allowed mime types and extensions map
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif'
]);
const ALLOWED_EXT = new Set(['jpg','jpeg','png','webp','avif']);

export interface UploadValidationOptions {
  maxBytes?: number; // default 2MB
  allowedMime?: Set<string>;
  allowedExt?: Set<string>;
}

export function slugify(str: string) {
  // Se eliminan los acentos ("decoración" -> "decoracion") antes de limpiar el resto de caracteres.
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

export async function ensureDir(rel: string) {
  const uploadDir = path.join(process.cwd(), 'public', rel);
  try { await fs.mkdir(uploadDir, { recursive: true }); } catch {}
  return uploadDir;
}

export interface SaveResult { relativePath: string; absolutePath: string; filename: string; }

export async function saveUploadedFile(
  file: File,
  baseRelDir: string,
  baseName: string,
  options: UploadValidationOptions = {}
): Promise<SaveResult> {
  const { maxBytes = 2 * 1024 * 1024, allowedMime = ALLOWED_MIME, allowedExt = ALLOWED_EXT } = options;
  if (file.size > maxBytes) throw new Error('FILE_TOO_LARGE');
  const mime = file.type || '';
  if (mime && !allowedMime.has(mime)) throw new Error('INVALID_MIME');
  const extRaw = file.name.includes('.') ? file.name.split('.').pop() || '' : '';
  const ext = extRaw.toLowerCase();
  if (!allowedExt.has(ext)) throw new Error('INVALID_EXT');
  const safeBase = slugify(baseName || (file.name.replace(/\.[^.]+$/, '')));
  const filename = `${Date.now()}-${safeBase}.${ext}`;
  const dir = await ensureDir(baseRelDir);
  const arrayBuffer = await file.arrayBuffer();
  const abs = path.join(dir, filename);
  await fs.writeFile(abs, Buffer.from(arrayBuffer));
  return { relativePath: `/${baseRelDir}/${filename}`.replace(/\\/g,'/'), absolutePath: abs, filename };
}

export async function deleteIfLocal(relativePath?: string | null) {
  if (!relativePath) return;
  if (relativePath === FALLBACK_IMAGE) return;
  // Only allow deletion inside public folder and not external URLs
  if (!relativePath.startsWith('/')) return;
  const abs = path.join(process.cwd(), 'public', relativePath.replace(/^\//,''));
  try { await fs.unlink(abs); } catch {}
}
