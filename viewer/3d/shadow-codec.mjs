/** numpy.packbits along X, most significant bit first; padding is not a cell. */
export function unpackShadow(packed, width, height) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 ||
      !(packed instanceof Uint8Array) || packed.length !== Math.ceil(width / 8) * height)
    throw new Error('Invalid packed shadow grid');
  const out = new Uint8Array(width * height), stride = Math.ceil(width / 8);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) out[y * width + x] = (packed[y * stride + (x >> 3)] >> (7 - (x & 7))) & 1;
  return out;
}
