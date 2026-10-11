/**
 * LIFEKIT mark rasteriser — zero dependencies, shared by every icon generator.
 *
 * The mark is the original LIFEKIT artwork: three ascending bars and a mint "life dot" on a
 * deep-navy tile, drawn with pure maths (no SVG parsing, no native image library) and encoded
 * as PNG with Node's built-in zlib. It lives in its own module so the web icons
 * (scripts/generate-icons.mjs) and the Android launcher icons
 * (scripts/android/generate-launcher-icons.mjs) are guaranteed to come from the same source
 * and can be unit tested directly.
 *
 * Design space: 512 × 512 units, scaled to whatever pixel size the caller asks for.
 */
import { deflateSync } from 'node:zlib';

/* ---------- geometry helpers ---------- */

function insideRoundedRect(x, y, r) {
  const { x: rx, y: ry, w, h, radius } = r;
  if (x < rx || y < ry || x > rx + w || y > ry + h) return false;
  const rad = Math.min(radius, w / 2, h / 2);
  const cx = Math.min(Math.max(x, rx + rad), rx + w - rad);
  const cy = Math.min(Math.max(y, ry + rad), ry + h - rad);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= rad * rad;
}

function insideCircle(x, y, c) {
  const dx = x - c.cx;
  const dy = y - c.cy;
  return dx * dx + dy * dy <= c.r * c.r;
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/* ---------- the mark, expressed in a 512x512 design space ---------- */

/**
 * Brand colours, so a generator never has to re-type a hex value by hand.
 * `tile` is the gradient's end colour — the same navy the Android adaptive icon and the
 * splash background use.
 */
export const MARK_COLORS = {
  tileFrom: '#12305b',
  tileTo: '#0b1f3a',
  barLight: '#ffffff',
  barAccent: '#2fe0a8',
};

/**
 * Layers in paint order for the given scale (1 = fills the 512 design space).
 * `tile: false` omits the navy tile and keeps only the bars and the dot, which is what an
 * Android adaptive icon foreground needs (the tile colour becomes the icon background).
 * `round: true` masks the tile to a circle instead of a rounded square.
 */
export function markLayers(scale = 1, { tile = true, round = false } = {}) {
  const s = (v) => 256 + (v - 256) * scale; // scale about the centre
  const bar = (x, y, w, h, color, opacity = 1) => ({
    test: (px, py) => insideRoundedRect(px, py, { x: s(x), y: s(y), w: w * scale, h: h * scale, radius: (w / 2) * scale }),
    color,
    opacity,
  });
  const layers = [];
  if (tile) {
    layers.push({
      test: round
        ? (px, py) => insideCircle(px, py, { cx: 256, cy: 256, r: 256 * scale })
        : (px, py) => insideRoundedRect(px, py, { x: 0, y: 0, w: 512, h: 512, radius: 112 }),
      gradient: { from: [18, 48, 91], to: [11, 31, 58], y0: 0, y1: 512 },
      opacity: 1,
    });
  }
  layers.push(
    bar(132, 292, 62, 96, [255, 255, 255], 0.92),
    bar(225, 232, 62, 156, [255, 255, 255]),
    bar(318, 160, 62, 228, [47, 224, 168]),
    {
      test: (px, py) => insideCircle(px, py, { cx: s(349), cy: s(112), r: 26 * scale }),
      color: [47, 224, 168],
      opacity: 1,
    }
  );
  return layers;
}

/**
 * Rasterise the mark to a raw RGBA buffer of `size` × `size` pixels.
 * 3×3 supersampling keeps edges smooth at the small sizes Android asks for.
 */
export function renderMark(size, { scale = 1, tile = true, round = false } = {}) {
  const layers = markLayers(scale, { tile, round });
  const SS = 3;
  const rgba = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = ((x + (sx + 0.5) / SS) / size) * 512;
          const py = ((y + (sy + 0.5) / SS) / size) * 512;
          let cr = 0;
          let cg = 0;
          let cb = 0;
          let ca = 0;
          for (const layer of layers) {
            if (!layer.test(px, py)) continue;
            let color = layer.color;
            if (layer.gradient) {
              const t = Math.min(Math.max((py - layer.gradient.y0) / (layer.gradient.y1 - layer.gradient.y0), 0), 1);
              color = mix(layer.gradient.from, layer.gradient.to, t);
            }
            const op = layer.opacity ?? 1;
            // source-over compositing of the layer onto the accumulated sample
            cr = color[0] * op + cr * (1 - op);
            cg = color[1] * op + cg * (1 - op);
            cb = color[2] * op + cb * (1 - op);
            ca = op + ca * (1 - op);
          }
          r += cr;
          g += cg;
          b += cb;
          a += ca;
        }
      }
      const n = SS * SS;
      const idx = (y * size + x) * 4;
      const alpha = a / n;
      // un-premultiply so semi-transparent pixels keep their colour
      rgba[idx] = Math.round(alpha > 0 ? r / n / alpha : 0);
      rgba[idx + 1] = Math.round(alpha > 0 ? g / n / alpha : 0);
      rgba[idx + 2] = Math.round(alpha > 0 ? b / n / alpha : 0);
      rgba[idx + 3] = Math.round(alpha * 255);
    }
  }
  return rgba;
}

/* ---------- minimal PNG writer (RGBA8, no palette, no interlacing) ---------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** Encode a square RGBA buffer as a PNG. */
export function encodePng(rgba, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter type 0 (None)
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
