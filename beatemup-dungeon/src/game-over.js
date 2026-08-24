/**
 * game-over.js — the panel you get for dying.
 *
 * THE FLYING DUNGEON'S SCREEN, ported rather than reinvented: its three
 * photographed frames of crawling vermin, looping at ~9.5fps, with one word
 * revealed over them. There it reads TIME OVER; here it reads PERDEU!
 *
 * Read `flying-dungeon/src/game-over.js` before changing anything structural —
 * the frame walk, the reveal and the faux-bold stroke are all lifted from it,
 * and the two screens are meant to look like the same screen.
 *
 * STATELESS, AND THAT IS THE PORT'S BEST IDEA. Nothing here accumulates:
 * `draw` is handed the time since the panel appeared and derives the frame, the
 * fades and the word reveal from it. So there is no update() to keep in step
 * with the shell's clock, nothing to drift, and replaying it is passing 0
 * again. This game's shell already tracks `phaseT`, so it is a natural fit.
 *
 * ⚠️ THE THREE FRAMES ARE READ IN PLACE out of the other game's folder, like
 * the health bar and the gamepad map. They are also the same files this game's
 * title screen used to crawl on, before that became a photograph.
 *
 * ⚠️ THE WORD COMES FROM `RESULTS.LABELS.lost`, not from this file's config, so
 * PERDEU! is written once and the death card and this panel cannot disagree.
 */
class GameOver {
  constructor(assets) { this.assets = assets; }

  _cfg() { return CONFIG.GAME_OVER || {}; }

  ready() {
    const n = (CONFIG.VERMIN_FRAMES || []).length;
    for (let i = 0; i < n; i++) if (!this.assets.getDrawable('vermin' + i)) return false;
    return n > 0;
  }

  /** The words, from the one place the game spells them. */
  _words() {
    const T = this._cfg().title || {};
    if (T.words && T.words.length) return T.words;
    const L = (CONFIG.RESULTS && CONFIG.RESULTS.LABELS) || {};
    return [L.lost || 'PERDEU!'];
  }

  /**
   * Which frame is showing at panel-time `t` ms.
   *
   * Walks the per-frame holds rather than dividing by one rate, so a frame can
   * be held longer than the others (the classic 2-2-4) without shifting the
   * rest. Straight from the other game.
   */
  _frameAt(t) {
    const holds = this._cfg().holdsMs || [105, 105, 105];
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
   * Panel-time in ms at which a press should start counting.
   *
   * ⚠️ DERIVED FROM THE REVEAL RATHER THAN BEING ITS OWN CONSTANT, so retiming
   * the word moves the arming with it. A press accepted before the word is up
   * lets a key still held from the last seconds of the run blow straight past
   * the screen the player is meant to read.
   */
  armedAtMs() {
    const c = this._cfg(), T = c.title || {};
    const n = this._words().length;
    let words = T.d1 || 0;
    if (n > 1) words += T.d2 || 0;
    words += T.revealMs || 0;
    return (c.holdMs || 0) + Math.max(c.fadeInMs || 0, words) + (c.armMs || 0);
  }

  /**
   * How opaque the black over the FIGHT is at panel-time `t`.
   *
   * The panel does not cross-fade from the fight -- it dips to black, holds
   * there, and then the picture arrives. The hold is what makes it read as a
   * cut rather than as a glitch.
   */
  worldVeil(t) {
    const c = this._cfg();
    return Math.min(1, Math.max(0, t / Math.max(1, c.fadeOutMs || 900)));
  }

  /** True once the fight should stop being drawn at all. */
  covered(t) { return t >= (this._cfg().fadeOutMs || 900); }

  /**
   * The panel itself. `t` is ms since the panel's own clock started -- which is
   * AFTER the fade-out, so 0 here is the top of the black hold.
   */
  draw(ctx, W, H, t) {
    const c = this._cfg();
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // The picture comes up after the hold.
    const since = t - (c.holdMs || 0);
    const a = since <= 0 ? 0
      : Math.min(1, since / Math.max(1, c.fadeInMs || 900));
    if (a > 0) {
      this.renderBackdrop(ctx, W, H, t, a);
      this._title(ctx, W, H, since, a);
    }
    ctx.restore();
  }

  /**
   * THE CRAWL ON ITS OWN, without the word over it.
   *
   * ⚠️ SPLIT OUT BECAUSE THE LOGO SCREEN BORROWS IT -- the game opens and closes
   * on the same three photographs. Sharing the draw rather than copying it means
   * the two screens cannot end up on different frames of the same animation, or
   * drift apart if the art is ever recut. That is Still Life's arrangement and
   * its reasoning, and this is the same split it made.
   */
  renderBackdrop(ctx, W, H, t, alpha) {
    const a = Math.min(1, Math.max(0, alpha === undefined ? 1 : alpha));
    if (a <= 0) return;
    const img = this.assets.getDrawable('vermin' + this._frameAt(t));
    if (!img) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // The band IS the picture and it is already 16:9 — fill the canvas.
    ctx.drawImage(img, 0, 0, W, H);
    ctx.restore();
  }

  /**
   * The lettering, revealed a word at a time. Ported whole.
   *
   * THE FAUX-BOLD STROKE IS NOT DECORATION: Futura's real Extra Bold cut only
   * exists on machines that happen to have Futura, and stroking the glyphs in
   * their OWN colour makes the fallback read heavy too. Same reason the title
   * screen does it.
   */
  _title(ctx, W, H, t, a) {
    const T = this._cfg().title || {};
    const size = H * (T.sizePct || 20) / 100;
    if (size < 1) return;
    const words = this._words();

    ctx.save();
    ctx.font = (T.weight || 900) + ' ' + size.toFixed(1) + 'px '
             + (CONFIG.TITLE_FONT || CONFIG.hudFont);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    if ('letterSpacing' in ctx) {
      ctx.letterSpacing = (size * (T.lsPct || 0) / 100).toFixed(2) + 'px';
    }

    const widths = words.map(w => ctx.measureText(w).width);
    const gap = size * (T.gapPct || 0) / 100;
    let total = gap * (words.length - 1);
    for (const w of widths) total += w;

    let x = W / 2 - total / 2 + (T.offX || 0);
    const y = H * (T.yPct || 50) / 100 + (T.offY || 0);

    for (let i = 0; i < words.length; i++) {
      const delay = i === 0 ? (T.d1 || 0) : (T.d1 || 0) + (T.d2 || 0);
      const since = t - delay;
      if (since >= 0) {
        // The word's own reveal, multiplied by the panel's fade so a word that
        // pops during the fade-in cannot punch through it.
        ctx.globalAlpha = a * (T.revealMs > 0 ? Math.min(1, since / T.revealMs) : 1);
        ctx.lineJoin = 'round';
        ctx.fillStyle = T.color || CONFIG.hudColor;
        if (T.fauxBold > 0) {
          ctx.lineWidth = size * T.fauxBold / 100;
          ctx.strokeStyle = T.color || CONFIG.hudColor;
          ctx.strokeText(words[i], x, y);
        }
        ctx.fillText(words[i], x, y);
      }
      x += widths[i] + gap;
    }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.restore();
  }
}
