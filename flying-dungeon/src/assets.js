/**
 * Assets — a tiny image store.
 *
 * Exposes `getDrawable(key)` on purpose: it's the SAME accessor name the main
 * Saborosa engine uses, so the portable Plane / TrayBackground classes read
 * identically here and there. When integrating, you delete this file and let
 * the main game's asset system answer `getDrawable` instead.
 */
class Assets {
  constructor() { this.store = {}; }

  getDrawable(key) { return this.store[key] || null; }

  // Load a normal (small) PNG as an <img>.
  loadImage(key, src) {
    return new Promise(res => {
      const i = new Image();
      i.onload  = () => { this.store[key] = i; res(i); };
      i.onerror = () => { res(null); };
      i.src = src;
    });
  }

  // Load a BIG frame: decode + downscale ONCE, off the main thread, to a small
  // ImageBitmap. Keeps VRAM low (16-32 huge textures would thrash older GPUs
  // and stall the loop). Falls back to a full-res <img> where unsupported.
  async loadFrame(key, src, nw, nh, cap) {
    try {
      if (typeof createImageBitmap !== 'function') throw 0;
      const blob = await (await fetch(src, { cache: 'force-cache' })).blob();
      const s = Math.min(1, cap / Math.max(nw, nh));
      const bmp = await createImageBitmap(blob, {
        resizeWidth:  Math.round(nw * s),
        resizeHeight: Math.round(nh * s),
        resizeQuality: 'high',
      });
      this.store[key] = bmp;
      return bmp;
    } catch (e) {
      return this.loadImage(key, src);
    }
  }
}
