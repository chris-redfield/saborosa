/**
 * FruitSelect — the "SELECT FRUIT" board, ported from the main game's
 * src/screens/select.js (PORTABLE CORE).
 *
 * Same trick as the original, because it's what gives the board its look:
 * the art is a 3-frame idle loop that exists TWICE OVER, pixel-aligned — a GRAY
 * line-art base and a COLOURED twin. Both loops run all the time (that's the
 * MOVING effect: every fruit keeps jittering whether or not it's chosen), and
 * the SELECTION effect is drawing the coloured twin of the current frame
 * clipped to the panel under the cursor. So the highlighted fruit fills with
 * colour without ever falling out of step with its neighbours.
 *
 * Differences from the main game's version, and why:
 *   - no background of its own. There it scrolled the intro art underneath;
 *     here it's a window that opens over the intro panel already on screen.
 *   - no trailing fade-to-black. There it covered a synchronous stage load;
 *     here the intro just carries on rolling.
 *
 * update() returns the chosen index into CONFIG.CHARACTERS once the lock-in
 * beat has played out, else null.
 */
class FruitSelect {
  constructor(assets, cfg) {
    this.assets = assets;
    this.cfg = cfg;

    // Native size of the select art (all six frames share it — the build script
    // enforces that, or the two loops would drift inside the clip rect).
    this.IMG_W = 866;
    this.IMG_H = 682;

    // The art carries its own "SELECT FRUIT" title band across the top, but the
    // intro board underneath ALREADY says SELECT FRUIT — so it's cropped off at
    // draw time (selectCropTop). All six frames have a clean empty gutter at
    // rows 141-146 with the panels starting at 147, so the cut costs no art.
    // Cropping rather than re-exporting keeps the panel rects below in the
    // original coordinate space the main game's editor tuned them in.
    //
    // Two boxes, both in that original space, because they do different jobs:
    //   FIT    — what the scale is measured against. Deliberately still the
    //            FULL box (title included). If it shrank to match the crop, the
    //            same selectFill would silently blow the board up.
    //   CENTRE — what actually lands at the middle of the screen: the panels
    //            alone, since the title is no longer drawn.
    this.FIT = { w: 657, h: 474 };
    this.CENTRE = { x: 148, y: 147, w: 657, h: 392 };

    this.frame = 0;
    this.frameTimer = 0;

    this.cursor = 0;
    this.enterT = 0;
    this.confirming = false;
    this.confirmT = 0;
    this.picked = null;
    // True for one read after the player locks a fruit in. An EDGE the shell
    // consumes, not a state it inspects — this class is a portable core with no
    // globals, so it reports the moment and lets the shell decide what to do
    // with it. Same shape as Boss.takeThrow().
    this._confirmed = false;

    this._held = {};
  }

  get panels() { return this.cfg.SELECT_PANELS; }

  async load(onProgress) {
    const c = this.cfg, base = c.ASSET_BASE + 'select/', jobs = [];
    for (let i = 1; i <= 3; i++) {
      jobs.push(this.assets.loadImage('sel_gray_' + i, `${base}saborosa-select-gray-${i}.webp`)
        .then(() => onProgress && onProgress()));
      jobs.push(this.assets.loadImage('sel_color_' + i, `${base}saborosa-select-color-${i}.webp`)
        .then(() => onProgress && onProgress()));
    }
    await Promise.all(jobs);
  }

  // Rising-edge detector so a HELD key fires exactly once. The dungeon's Input
  // only exposes held flags, and the player is very likely still holding the
  // key that opened this board.
  _edge(name, down) {
    const was = this._held[name] || false;
    this._held[name] = down;
    return down && !was;
  }

  // Overshoot ease (settles just past the target, then back) — the stamp bounce.
  _easeOutBack(p) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
  }

  // True once, on the frame the player locked a fruit in. Consumed, so one
  // choice cannot be handled twice.
  takeConfirmed() { const c = this._confirmed; this._confirmed = false; return c; }

  update(dt, input) {
    const c = this.cfg, s = dt / 1000;
    if (this.enterT < c.selectEnterMs) this.enterT += dt;

    // Lock-in beat: the board freezes, input is swallowed, and the pick is
    // withheld until the stamp has played.
    if (this.confirming) {
      this.confirmT += dt;
      // Keep every edge fresh so a held key doesn't re-fire the moment the
      // game takes over (it would read as "firing" on frame one).
      this._edge('left', input.left);
      this._edge('right', input.right);
      this._edge('confirm', input.firing);
      return this.confirmT >= c.selectConfirmMs ? this.picked : null;
    }

    this.frameTimer += dt;
    if (this.frameTimer >= c.selectFrameMs) {
      this.frameTimer -= c.selectFrameMs;
      this.frame = (this.frame + 1) % 3;
    }

    const n = this.panels.length;
    if (this._edge('left', input.left)) this.cursor = (this.cursor + n - 1) % n;
    if (this._edge('right', input.right)) this.cursor = (this.cursor + 1) % n;

    if (this._edge('confirm', input.firing)) {
      this.confirming = true;
      this.confirmT = 0;
      this.picked = this.panels[this.cursor].character;
      // Raised HERE, on the lock-in — not when update() finally hands the pick
      // back selectConfirmMs later. The stamp is the moment of choosing and is
      // what anything reacting to it should land on; the delay after it exists
      // so that beat can play, and a sound arriving at the end of it would be
      // scoring the wait rather than the choice.
      this._confirmed = true;
    }
    return null;
  }

  render(ctx, W, H) {
    const c = this.cfg;

    // Entrance: the board fades and scales in over the intro panel, reading as
    // a window opening in front of it.
    let alpha = 1, scale = 1;
    if (this.enterT < c.selectEnterMs) {
      const e = this.enterT / c.selectEnterMs;
      const ease = 1 - (1 - e) * (1 - e);       // easeOutQuad
      alpha = ease;
      scale = 0.94 + 0.06 * ease;
    }

    // Only the art BELOW the title band is drawn, so every blit takes a source
    // rect starting at cropTop and the whole board is one row shorter by that
    // much. Image point (px,py) therefore lands at (ox + px*s, oy + (py-crop)*s).
    const crop = c.selectCropTop || 0;
    const srcH = this.IMG_H - crop;

    // Scale off FIT (the full box) so selectFill keeps meaning what it meant
    // before the crop; position off CENTRE (the panels) so what's left is what
    // sits mid-screen. Solve ox/oy for that, then reuse the same transform for
    // the panel rects below.
    const s = Math.min((W * c.selectFill) / this.FIT.w, (H * c.selectFill) / this.FIT.h) * scale;
    const ctr = this.CENTRE;
    let ox = W / 2 - (ctr.x + ctr.w / 2) * s + (c.selectOffsetX || 0);
    let oy = H / 2 - (ctr.y + ctr.h / 2 - crop) * s + (c.selectOffsetY || 0);
    const dw = this.IMG_W * s, dh = srcH * s;

    // Confirm beat: the chosen fruit pops, the whole board shakes.
    const t = this.confirmT / 1000;
    let popK = 1;
    if (this.confirming) {
      const sp = Math.min(1, this.confirmT / c.selectStampMs);
      popK = 1 + 0.25 * (1 - this._easeOutBack(sp));       // 1.25 -> ~1.0 bounce
      const amp = c.selectShakeAmp * Math.max(0, 1 - this.confirmT / c.selectShakeMs);
      ox += Math.sin(t * 82) * amp;
      oy += Math.cos(t * 71) * amp;
    }

    ctx.save();
    ctx.globalAlpha = alpha;

    // The MOVING effect: every panel runs the idle loop, selected or not.
    const gray = this.assets.getDrawable('sel_gray_' + (this.frame + 1));
    if (gray) ctx.drawImage(gray, 0, crop, this.IMG_W, srcH, ox, oy, dw, dh);

    // The SELECTION effect: the coloured twin of the SAME frame, clipped to the
    // panel under the cursor. Clipping in screen space means the stamp swells
    // inside its frame without bleeding into its neighbours.
    const color = this.assets.getDrawable('sel_color_' + (this.frame + 1));
    const p = this.panels[this.cursor];
    if (color && p) {
      const r = p.rect;
      const px = ox + r.x * s, py = oy + (r.y - crop) * s, pw = r.w * s, ph = r.h * s;
      ctx.save();
      ctx.beginPath();
      ctx.rect(px, py, pw, ph);
      ctx.clip();
      if (popK !== 1) {
        const cx = px + pw / 2, cy = py + ph / 2;
        ctx.translate(cx, cy);
        ctx.scale(popK, popK);
        ctx.translate(-cx, -cy);
      }
      ctx.drawImage(color, 0, crop, this.IMG_W, srcH, ox, oy, dw, dh);
      ctx.restore();
    }

    ctx.restore();
  }
}
