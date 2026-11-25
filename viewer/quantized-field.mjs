// Presentation-only decoding; retained scientific arrays are never modified.
export function decodeQuantized(buffer, metadata) {
  const {scale, offset = 0, transform = 'linear', reference, invalid_code = 255} = metadata;
  if (!(scale > 0) || !Number.isFinite(scale) || !Number.isFinite(offset))
    throw new Error('Invalid quantization scale or offset');
  if (!['linear', 'log1p'].includes(transform) || (transform === 'log1p' && (!(reference > 0) || !Number.isFinite(reference))))
    throw new Error('Unsupported quantization transform');
  const codes = new Uint8Array(buffer), out = new Float32Array(codes.length);
  for (let i = 0; i < codes.length; i++) {
    const value = offset + codes[i] * scale;
    out[i] = codes[i] === invalid_code ? NaN : transform === 'log1p' ? reference * Math.expm1(value) : value;
  }
  return out;
}
