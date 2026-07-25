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

  /* --- Colour drain -------------------------------------------------------
     How grey the world is, 0..1, for a given GAME time (see gameClockRate —
     the picture drains on the clock the HUD counts, not on wall seconds).

     Held flat through drainStartMs, then eased in to drainMax by drainFullMs.
     Ease-in rather than linear so the early run stays colourful and the loss
     becomes obvious only once it matters; drainCurve 1 gives back linear. */
  drainAt(gameMs) {
    const c = this.cfg;
    if (!c.drainOn) return 0;
    // drainFullMs 0 means "end with the run", so the picture reaches full black
    // & white on the same frame the clock does — one number, not two to keep in
    // step.
    const end = c.drainFullMs || c.timeOverMs;
    const span = end - c.drainStartMs;
    if (span <= 0) return gameMs >= end ? c.drainMax : 0;
    const p = Math.min(1, Math.max(0, (gameMs - c.drainStartMs) / span));
    return c.drainMax * Math.pow(p, c.drainCurve);
  }

  // Is the 'saturation' blend mode available? Tested by setting it and reading
  // it back, ONCE. This matters: an unsupported mode silently falls back to
  // 'source-over', which would paint a flat grey slab over the picture instead
  // of desaturating it — a much worse failure than staying in colour.
  _canDesaturate(ctx) {
    if (this._blendOk === undefined) {
      const prev = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'saturation';
      this._blendOk = ctx.globalCompositeOperation === 'saturation';
      ctx.globalCompositeOperation = prev;
    }
    return this._blendOk;
  }

  // Grey (and dim) the frame just drawn. Filled over the FRAME's own rect, not
  // the canvas: the frame is larger than the canvas and the fill is clipped to
  // it anyway, so this covers the picture exactly and can't miss a sliver when
  // the film pass has the scene weaving.
  _drain(ctx, x, y, w, h, d) {
    const c = this.cfg;
    // 'saturation' keeps the backdrop's hue and luminosity and takes the
    // SOURCE's saturation — and a grey source has none, so the backdrop goes
    // greyscale with its brightness intact. globalAlpha then mixes that against
    // the original, which is the drain.
    if (this._canDesaturate(ctx)) {
      ctx.save();
      ctx.globalCompositeOperation = 'saturation';
      ctx.globalAlpha = d;
      ctx.fillStyle = '#808080';
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    }
    // Lightness goes with it. Plain source-over, so it still works (and still
    // reads as time passing) on a browser with no blend-mode support.
    const dark = (c.drainDarken || 0) * d;
    if (dark > 0) {
      ctx.save();
      ctx.globalAlpha = dark;
      ctx.fillStyle = '#000';
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    }
  }

  // Draw the frame 1:1 at (−camX, −camY): the canvas is a cropped window into
  // it, and the shell pans camX/camY with the plane to reveal the rest of the tray.
  // `drain` (0..1) greys it out — pass drainAt(clock.now()).
  render(ctx, camX, camY, drain) {
    const seq = this._sequence(), n = seq.length;
    const img = this.assets.getDrawable(seq[((this.cur % n) + n) % n].key);
    if (!img) return;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, -camX, -camY);
    const d = Math.min(1, Math.max(0, drain || 0));
    if (d > 0) this._drain(ctx, -camX, -camY, img.width, img.height, d);
  }
}
