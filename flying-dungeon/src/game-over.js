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
   * @param titleKey  config key of a title OVERRIDE, or null for plain TIME OVER.
   *                  The coloured panel serves two endings — the clock running
   *                  out, and being knocked out of the sky by the Mosca Boss —
   *                  and the only difference between them is what it says.
   */
  /* JUST THE PICTURE — the crawling vermin, no lettering.

     Split out because the TITLE SCREEN borrows this backdrop and puts the logo
     where the words go. Sharing the draw rather than copying it means the two
     screens cannot end up on different frames of the same animation, or drift
     apart if the art is ever recut. */
  renderBackdrop(ctx, W, H, t, alpha) {
    const a = Math.min(1, Math.max(0, alpha === undefined ? 1 : alpha));
    if (a <= 0) return;
    const img = this.assets.getDrawable('gameover_' + this.frameAt(t));
    if (!img) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // The band IS the picture and it is already 16:9 — fill the canvas.
    ctx.drawImage(img, 0, 0, W, H);
    ctx.restore();
  }

  render(ctx, W, H, t, alpha, titleKey) {
    const a = Math.min(1, Math.max(0, alpha === undefined ? 1 : alpha));
    if (a <= 0) return;
    this.renderBackdrop(ctx, W, H, t, a);
    ctx.save();
    ctx.globalAlpha = a;
    this._title(ctx, W, H, t, a, this._titleFor(titleKey));
    ctx.restore();
  }

  /* The OTHER ending: killed by the Time Boss. No photograph, no worms — the
     screen is WHITE and the words read THE END.

     Named for the MODE it belongs to (a death that can only happen inside
     no-time mode), not for what it says — the words live in config and have
     already changed once.

     This is not a new screen so much as the old one with the picture taken away.
     The reveal goes through the SAME _title() with the same delays, and
     noTimeTitle is merged over overTitle so only the words, the colour and the
     weight differ — the font and every delay fall through, and retiming one
     ending retimes both.

     It fills the white itself rather than trusting the shell to have done it, so
     this is as self-contained as render() is. And white is the only right answer
     here: no-time mode has already bleached the world to pure white, so this is
     the picture finishing what it was doing rather than cutting to a new one. */
  renderNoTime(ctx, W, H, t, alpha) {
    const a = Math.min(1, Math.max(0, alpha === undefined ? 1 : alpha));
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);
    this._title(ctx, W, H, t, a, this._titleFor('noTimeTitle'));
    ctx.restore();
  }

  /* The lettering ON ITS OWN — no panel, no backdrop, just the words at the
     alpha you ask for. The finale uses this so its two cards are literally the
     same code as the end panels: same font, same weight, same colour, and any
     retune of overTitle reaches all of them.

     Its title configs switch the per-word reveal off (d1/d2/revealMs 0) and the
     caller drives the fade through `alpha` instead, which is why `t` can simply
     be 0 — there is nothing left for the reveal clock to do. */
  renderTitle(ctx, W, H, t, alpha, titleKey) {
    const a = Math.min(1, Math.max(0, alpha === undefined ? 1 : alpha));
    if (a <= 0) return;
    ctx.save();
    this._title(ctx, W, H, t || 0, a, this._titleFor(titleKey));
    ctx.restore();
  }

  /* overTitle with one of the ending overrides laid on top. Memoised — it is
     read every frame an ending is on screen — and it is a MERGE rather than a
     set of parallel blocks so the endings cannot drift apart: the font, the
     size, the spacing and the reveal delays all live in overTitle and every
     ending gets whatever that says.

     A null key is TIME OVER itself, which is the base rather than an override. */
  _titleFor(key) {
    if (!key) return this.cfg.overTitle;
    if (!this._merged) this._merged = {};
    if (!this._merged[key]) {
      this._merged[key] = Object.assign({}, this.cfg.overTitle, this.cfg[key] || {});
    }
    return this._merged[key];
  }

  /* Both words on ONE line, revealed in order — TIME then OVER, or NO then TIME.
     The full string is measured up front and each word keeps its final x, so
     nothing re-centres when the second word pops in.

     `T` is passed in rather than read from config so both endings run through
     exactly this code: whatever else the white ending is, the letters arrive
     the same way.

     Everything is sized off the canvas height, so the layout holds at any
     resolution. Same open question as the HUD: Futura is not bundled, so most
     machines fall through the stack to a geometric stand-in. */
  _title(ctx, W, H, t, a, T) {
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
