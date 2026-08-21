export async function toWebp(png, { quality = 90 } = {}) {
  try {
    const { default: sharp } = await import('sharp');
    const bytes = await sharp(png).webp({ quality }).toBuffer();
    if (bytes.length >= png.length) return { bytes: png, ext: 'png', converted: false };
    return { bytes, ext: 'webp', converted: true };
  } catch {
    return { bytes: png, ext: 'png', converted: false };
  }
}
