/**
 * game-over.js — the panel you get for dying.
 *
 * THE FLYING DUNGEON'S SCREEN, ported rather than reinvented: its three
 * photographed frames of crawling vermin, looping at ~9.5fps, with one word
 * revealed over them. There it reads TIME OVER; here it reads one of seven
 * hand-drawn phrases, picked at random.
 *
 * Read `flying-dungeon/src/game-over.js` before changing anything structural —
 * the frame walk, the reveal and the faux-bold stroke are all lifted from it,
 * and the two screens are meant to look like the same screen.
 *
 * ⚠️ THE WORD IS A DRAWING NOW. Asked for 2026-09-01, with a sheet of seven:
 * *"instead of the current PERDEU that you wrote, I want us to randomize for
 * each one of these words (each per row), the last row, is actually broken in
 * two rows, that is on purpose, the CAPO-TOU, ok? that is a single row."* The
 * pack is cut by `tools/build-gameover-words.py`, which is where the two-line
 * phrase is joined back into one frame. The typed word survives as the FALLBACK
 * -- a sheet that fails to load must cost the lettering's look, not the screen.
 *
 * STATELESS, EXCEPT FOR ONE INDEX, AND THAT EXCEPTION IS THE FEATURE. Nothing
 * here accumulates:
 * `draw` is handed the time since the panel appeared and derives the frame, the
 * fades and the word reveal from it. So there is no update() to keep in step
 * with the shell's clock, nothing to drift, and replaying it is passing 0
 * again. This game's shell already tracks `phaseT`, so it is a natural fit.
 *
 * ⚠️ WHICH IS EXACTLY WHY THE RANDOM PICK CANNOT LIVE IN `draw`. A choice made
 * from `t` is re-made every frame: the phrase would change 60 times a second and
 * read as a flicker of seven words rather than as one of them. It is not
 * derivable from the clock, so it is the one thing the panel remembers, set by
 * `roll()` when the shell enters the phase -- the same rule the impact bursts
 * follow, freeze the pick on the EVENT.
 *
 * ⚠️ THE THREE FRAMES ARE READ IN PLACE out of the other game's folder, like
 * the health bar and the gamepad map. They are also the same files this game's
 * title screen used to crawl on, before that became a photograph.
 *
 * ⚠️ THE FALLBACK WORD COMES FROM `RESULTS.LABELS.lost`, not from this file's
 * config, so PERDEU! is written once and the death card and this panel cannot
 * disagree. That is only reached when the picture pack is missing -- and note
 * that the card and the panel DO differ now, on purpose: the card still names
 * the run's result, and the panel is the joke about it.
 */
class GameOver {
  constructor(assets) {
    this.assets = assets;
    this.pick = 0;      // which phrase; see roll()
    /* THE SHUFFLE BAG. Indices still to be drawn this pass; see roll(). */
    this.bag = [];
    this.last = -1;     // what the player actually last saw, for the seam
  }

  /**
   * The lettering pack, or null if it is not loaded and the panel should set
   * type instead.
   */
  _pack() {
    const img = this.assets.getDrawable('goWords');
    const defs = this.assets.getJSON('goWords');
    return (img && defs && defs.frames && defs.frames.length) ? { img, defs } : null;
  }

  /**
   * Choose the phrase. Called by the shell as the panel opens, ONCE.
   *
   * ⚠️ NOT IN `draw`, AND NOT DERIVED FROM `t`. See the header: a pick made from
   * the clock is re-made every frame. This is the panel's only state.
   *
   * ⚠️ SAMPLING WITHOUT REPLACEMENT, NOT INDEPENDENT DRAWS. Asked for
   * 2026-09-01: *"for the death messages, do not repeat the same twice, only
   * cycle repeat after all has been picked."* A fresh `random()` every time is
   * memoryless, and memoryless is not what a player experiences as random: with
   * seven phrases an immediate repeat lands one death in seven, and seeing
   * PERDEU! twice running reads as the feature being broken -- the one outcome
   * the sheet exists to prevent. So the seven are SHUFFLED INTO A BAG and drawn
   * out one at a time; the bag refills only once it is empty, which is what
   * guarantees all seven are seen before any is seen twice.
   *
   * ⚠️ AND THE SEAM BETWEEN TWO BAGS IS THE PART THAT IS EASY TO GET WRONG. The
   * plain algorithm can end one bag on a phrase and open the next on the same
   * one -- a repeat, on the one boundary the shuffle does not cover, arriving
   * about one refill in seven. `last` is what was actually SHOWN, and a refill
   * that opens on it is nudged. That is the difference between "no repeats
   * within a cycle" and what was asked for, which is no repeats at all.
   *
   * ⚠️ THE BAG IS NOT PERSISTED. It lasts as long as the page: quitting and
   * reloading starts a fresh deck. Making it survive a reload would mean
   * localStorage for a joke, and the guarantee that matters is inside one
   * sitting.
   */
  roll() {
    const p = this._pack();
    if (!p) { this.pick = 0; return; }
    const n = p.defs.frames.length;
    if (!this.bag.length) {
      for (let i = 0; i < n; i++) this.bag.push(i);
      // Fisher-Yates, so every ordering is equally likely.
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = this.bag[i]; this.bag[i] = this.bag[j]; this.bag[j] = t;
      }
      /* THE SEAM: a new bag must not open on the phrase the old one closed on.
         Swapped with the END rather than re-shuffled, because a re-shuffle can
         land on it again and a loop that retries is a loop that can spin. */
      if (n > 1 && this.bag[0] === this.last) {
        this.bag[0] = this.bag[n - 1]; this.bag[n - 1] = this.last;
      }
    }
    this.pick = this.bag.shift();
    this.last = this.pick;
  }

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
    // A picture is ONE word however many the artist wrote in it, so `d2` never
    // applies to it -- otherwise the press would arm 700ms late on every phrase.
    const n = this._pack() ? 1 : this._words().length;
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
   * The chosen phrase, as a picture. Returns false if there is no pack, which is
   * the caller's cue to set type instead.
   *
   * ⚠️ ONE SCALE FOR THE WHOLE PACK, TAKEN FROM THE WIDEST FRAME. `wRel` says
   * how much of the canvas `CAIU PRA FORA...` spans, and every other phrase is
   * drawn at that same ratio -- so the short ones land short, which is how the
   * artist drew them. Fitting each frame to `wRel` in turn would make VIIISH...
   * as wide as the longest sentence on the sheet and flatten the one difference
   * the pack is making. The standing rule for a pack in this project.
   *
   * ⚠️ PLACED BY THE FRAME'S OWN ANCHOR, which the cutter writes as the centre.
   * The words are centred on the screen, not standing on anything.
   *
   * ⚠️ IT RETURNS TRUE BEFORE `d1`, WHILE NOTHING IS DRAWN. The delay is not a
   * reason to fall through to the type -- doing that would set PERDEU! for a
   * second and then replace it with the picture.
   */
  _picture(ctx, W, H, t, a) {
    const p = this._pack();
    if (!p) return false;
    const T = this._cfg().title || {};
    const frames = p.defs.frames;
    const f = frames[this.pick % frames.length];
    const since = t - (T.d1 || 0);
    if (since < 0) return true;
    // The widest frame, off the pack itself -- seven numbers, and reading them
    // here means the scale cannot fall out of step with a recut sheet.
    let maxW = 1;
    for (const q of frames) if (q.w > maxW) maxW = q.w;
    const k = W * (T.wRel || 0.80) / maxW;
    const dw = f.w * k, dh = f.h * k;
    ctx.save();
    ctx.globalAlpha = a * (T.revealMs > 0 ? Math.min(1, since / T.revealMs) : 1);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(p.img, f.x, f.y, f.w, f.h,
                  W / 2 - (f.ax != null ? f.ax : f.w / 2) * k + (T.offX || 0),
                  H * (T.yPct || 50) / 100
                    - (f.ay != null ? f.ay : f.h / 2) * k + (T.offY || 0),
                  dw, dh);
    ctx.restore();
    return true;
  }

  /**
   * The lettering as TYPE -- the fallback, revealed a word at a time. Ported
   * whole.
   *
   * THE FAUX-BOLD STROKE IS NOT DECORATION: Futura's real Extra Bold cut only
   * exists on machines that happen to have Futura, and stroking the glyphs in
   * their OWN colour makes the fallback read heavy too. Same reason the title
   * screen does it.
   */
  _title(ctx, W, H, t, a) {
    if (this._picture(ctx, W, H, t, a)) return;
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
