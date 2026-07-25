/**
 * GameOver — the TIME OVER panel (PORTABLE CORE).
 *
 * Three photographed frames of the worms, looping, with "TIME OVER" revealed a
 * word at a time over the top. Tuned in tools/game-over-anim.html; the numbers
 * in CONFIG are that tool's config dump.
 *
 * STATELESS ON PURPOSE. Nothing here accumulates — `render` is handed the time
 * since the panel appeared and derives the frame and the word reveals from it.
 * So there is no start()/update() pair to keep in step with the shell's fade,
 * no clock to drift, and replaying it is just passing 0 again.
 *
 * The frames are pre-cropped to their shared band (3002x1687 ≈ 16:9) by
 * tools/build-game-over-frames.py, so the panel is simply stretched to fill the
 * canvas — no per-frame offsets, and the three stay pixel-aligned with each
 * other because they were cropped to one bbox.
 *
 * Dependencies injected (assets store + config). No DOM, no globals.
 */
class GameOver {
  constructor(assets, cfg) {
    this.assets = assets;
    this.cfg = cfg;
    this._loading = null;
  }

  // Loaded LAZILY — 1.5MB that isn't needed for two minutes shouldn't sit in
  // front of the player at boot. Safe to call more than once; the first call
  // owns the promise.
  load(onProgress) {
    if (this._loading) return this._loading;
    const c = this.cfg, base = c.ASSET_BASE + c.GAME_OVER_DIR;
    this._loading = Promise.all(c.GAME_OVER_FRAMES.map((f, i) =>
      this.assets.loadImage('gameover_' + i, base + f)
        .then(im => { if (onProgress) onProgress(); return im; })));
    return this._loading;
  }

  ready() {
    return this.cfg.GAME_OVER_FRAMES.every((_, i) => !!this.assets.getDrawable('gameover_' + i));
  }

  /* Panel-time at which the screen has finished arriving: the fade-in is done
     AND the last word is fully up, plus a beat to read it. The shell arms
     "press anything to start over" here, so this is what stops a key pressed
     during the fade — or held over from the last seconds of the run — from
     blowing straight past the screen the player is meant to see.

     Derived from the timings rather than being its own constant, so retiming
     the reveal moves the arming with it. */
  settledMs() {
    const c = this.cfg, T = c.overTitle || {};
    let words = 0;
    if (T.on !== false) words = (T.d1 || 0) + (T.d2 || 0) + (T.revealMs || 0);
    return Math.max(c.overFadeInMs || 0, words) + (c.overRestartArmMs || 0);
  }

  // Which frame is showing at panel-time t. Walks the per-frame holds rather
  // than dividing by a single rate, so one frame can be held longer than the
  // others (the classic 2-2-4) without the others shifting.
  frameAt(t) {
    const holds = this.cfg.overHoldsMs;
    let total = 0;
    for (const h of holds) total += Math.max(1, h);
    if (total <= 0) return 0;
    let tt = ((t % total) + total) % total;
    for (let i = 0; i < holds.length; i++) {
      const h = Math.max(1, holds[i]);
      if (tt < h) return i;
      tt -= h;
    }
    return holds.length - 1;
  }

  /**
   * @param t     ms since the panel appeared (drives the loop and the reveal)
   * @param alpha 0..1 fade-in of the whole panel, title included
   */
  render(ctx, W, H, t, alpha) {
    const a = Math.min(1, Math.max(0, alpha === undefined ? 1 : alpha));
    if (a <= 0) return;
    const img = this.assets.getDrawable('gameover_' + this.frameAt(t));

    ctx.save();
    ctx.globalAlpha = a;
    if (img) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      // The band IS the picture and it is already 16:9 — fill the canvas.
      ctx.drawImage(img, 0, 0, W, H);
    }
    this._title(ctx, W, H, t, a);
    ctx.restore();
  }

  /* "TIME OVER" — both words on ONE line, but revealed in order: TIME first,
     OVER after it. The full string is measured up front and each word keeps its
     final x, so nothing re-centres when OVER pops in.

     Everything is sized off the canvas height, so the layout holds at any
     resolution. Same open question as the HUD: Futura is not bundled, so most
     machines fall through the stack to a geometric stand-in. */
  _title(ctx, W, H, t, a) {
    const c = this.cfg, T = c.overTitle;
    if (!T || T.on === false) return;
    const size = H * T.sizePct / 100;
    if (size < 1) return;

    ctx.save();
    ctx.font = T.weight + ' ' + size.toFixed(1) + 'px ' + T.family;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    if ('letterSpacing' in ctx) ctx.letterSpacing = (size * T.lsPct / 100).toFixed(2) + 'px';

    const words = T.words;
    const widths = words.map(w => ctx.measureText(w).width);
    const gap = size * T.gapPct / 100;
    let total = gap * (words.length - 1);
    for (const w of widths) total += w;

    let x = W / 2 - total / 2 + T.offX;
    const y = H * T.yPct / 100 + T.offY;

    for (let i = 0; i < words.length; i++) {
      const delay = i === 0 ? T.d1 : T.d1 + T.d2;
      const since = t - delay;
      if (since >= 0) {
        // The word's own reveal, multiplied by the panel's fade so a word that
        // pops during the fade-in doesn't punch through it.
        ctx.globalAlpha = a * (T.revealMs > 0 ? Math.min(1, since / T.revealMs) : 1);
        ctx.lineJoin = 'round';
        if (T.outline > 0) {                       // outside, behind the fill
          ctx.lineWidth = size * (T.outline + T.fauxBold) / 100;
          ctx.strokeStyle = T.outlineColor;
          ctx.strokeText(words[i], x, y);
        }
        ctx.fillStyle = T.color;
        // Fatten the glyphs by stroking them in their own colour: Futura's real
        // Extra Bold cut only exists if the machine has it, and this makes the
        // fallback read heavy too.
        if (T.fauxBold > 0) {
          ctx.lineWidth = size * T.fauxBold / 100;
          ctx.strokeStyle = T.color;
          ctx.strokeText(words[i], x, y);
        }
        ctx.fillText(words[i], x, y);
      }
      x += widths[i] + gap;
    }
    ctx.restore();
  }
}
