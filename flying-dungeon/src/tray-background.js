/**
 * TrayBackground — the orbiting fruit-tray scenery (PORTABLE CORE).
 *
 * 16 camera angles, optionally interleaved with blurred (-B) transition frames
 * and each frame optionally doubled for a smoother cadence. It plays as a loop
 * whose DIRECTION couples to the player's horizontal intent:
 *   before the player engages → free-runs in the default order
 *   flying right → reverse order   ·   flying left → regular order   ·   idle → frozen
 * It never rests on a blurred frame (those are motion, not an angle).
 *
 * Dependencies are injected: an assets store (getDrawable + loadFrame) and a
 * config. No DOM, no globals — drop it into the main engine and feed it that
 * engine's assets + input.
 */
class TrayBackground {
  constructor(assets, cfg) {
    this.assets = assets;
    this.cfg = cfg;
    this.iw = cfg.FRAME_W;
    this.ih = cfg.FRAME_H;
    this.cur = 0;
    this.acc = 0;
    this.lastDir = 1;
    this._seq = null;
  }

  async load(onProgress) {
    const c = this.cfg, base = c.ASSET_BASE, jobs = [];
    for (let i = 0; i < c.FRAMES; i++) {
      const n = String(i + 1).padStart(2, '0');
      jobs.push(this.assets.loadFrame('tray_' + i,  `${base}saborosa-fundo-natureza-frame-${n}.webp`,   c.FRAME_W, c.FRAME_H, c.FRAME_CAP)
        .then(im => { if (im) { this.iw = im.width; this.ih = im.height; } onProgress && onProgress(); }));
      jobs.push(this.assets.loadFrame('trayB_' + i, `${base}saborosa-fundo-natureza-frame-${n}-B.webp`, c.FRAME_W, c.FRAME_H, c.FRAME_CAP)
        .then(() => { onProgress && onProgress(); }));
    }
    await Promise.all(jobs);
  }

  // Playback sequence, forward order: 1,(1-B),2,(2-B),… ; direction is applied
  // as a ±1 step at update time. Built once (config is fixed at runtime).
  _sequence() {
    if (this._seq) return this._seq;
    const c = this.cfg, seq = [], times = c.dupFrames ? 2 : 1;
    for (let i = 0; i < c.FRAMES; i++) {
      for (let t = 0; t < times; t++) seq.push({ key: 'tray_' + i, isBlur: false });
      if (c.withBlur) for (let t = 0; t < times; t++) seq.push({ key: 'trayB_' + i, isBlur: true });
    }
    return (this._seq = seq);
  }

  _dur(e) { return e.isBlur ? this.cfg.blurMs : this.cfg.frameMs; }

  // -1 reverse · +1 regular · 0 frozen.
  // For now the dungeon runs nonstop in the default order, independent of the
  // player (the flying-right/left → reverse/regular coupling is parked; restore
  // it here when we want the world to react to the plane again).
  _step(input) {
    return this.cfg.defaultReverse ? -1 : 1;
  }

  update(dt, input) {
    const seq = this._sequence(), n = seq.length;
    if (!n) return;
    const dir = this._step(input);
    if (dir !== 0) {
      this.lastDir = dir;
      this.acc += dt;
      let dur = this._dur(seq[((this.cur % n) + n) % n]), guard = 0;
      while (dur > 0 && this.acc >= dur && guard++ < 256) {
        this.acc -= dur; this.cur = ((this.cur + dir) % n + n) % n; dur = this._dur(seq[this.cur]);
      }
    } else {
      // Frozen: settle off any blur onto the nearest sharp in the last direction.
      this.acc = 0;
      this.cur = ((this.cur % n) + n) % n;
      let g = 0;
      while (seq[this.cur].isBlur && g++ < 4) this.cur = ((this.cur + this.lastDir) % n + n) % n;
    }
  }

  // World size = the frame's own (reduced) pixel size — larger than the canvas.
  worldWidth()  { return this.iw; }
  worldHeight() { return this.ih; }

  // Draw the frame 1:1 at (−camX, −camY): the canvas is a cropped window into
  // it, and the shell pans camX/camY with the plane to reveal the rest of the tray.
  render(ctx, camX, camY) {
    const seq = this._sequence(), n = seq.length;
    const img = this.assets.getDrawable(seq[((this.cur % n) + n) % n].key);
    if (!img) return;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, -camX, -camY);
  }
}
