/**
 * pause.js — the word on the pause card.
 *
 * THE PAUSE CARD USED TO BE TYPE: `Hud.drawCard` washed the frozen frame and set
 * `CONFIG.PAUSE.LINES[0]` in 92px Futura, with `SABOROSA MODE ON` under it while
 * the cheat was on. It is a DRAWING now, asked for 2026-09-08 with two sheets:
 * six hand-lettered ways of saying the game is stopped -- PAUSA, PAROU, PARADO,
 * PARÔ!, ALTAS, TEMPO -- picked at random per pause, and a seventh frame,
 * `MODO SABOROSA LIGADO`, which replaces the typed cheat line.
 *
 * ⚠️ THE SUBTITLE IS NOT ONE OF THE SIX AND THE FILE ENFORCES THAT, not this
 * class: `tools/build-pause-words.py` writes the words to `frames` and the
 * caption to its own `sub` key. The bag is `frames.length` long, so a caption in
 * that list would eventually be drawn AS the pause word -- "MODO SABOROSA
 * LIGADO" alone in the middle of the screen, on a pause, with the cheat off.
 * Keeping the two roles apart in the JSON is what makes that impossible.
 *
 * ⚠️ AND THE CAPTION IS STILL DEV-ONLY, AND STILL HAS NO "OFF". Turning the mode
 * off says nothing, exactly as before -- *"remove the SABOROSA MODE OFF text,
 * don't ever make that appear"* (2026-09-04). **The absence of the line IS the
 * off state.** This being a picture now changes nothing about that.
 *
 * STATELESS, EXCEPT FOR ONE INDEX, AND THAT EXCEPTION IS THE FEATURE. Same shape
 * as `game-over.js` and for the same reason: the pause card is REDRAWN EVERY
 * FRAME (the world under it is drawn and not ticked, so the loop keeps going
 * round), and a pick made inside `draw` would be re-made 60 times a second --
 * six words flickering rather than one of them. `roll()` is called by the shell
 * on the frame the pause goes ON, and nowhere else.
 *
 * ⚠️ WHICH MEANS THE CHEAT TOGGLE MUST NOT RE-ROLL. Typing SABOROSA happens
 * while the card is already up; it flips `CONFIG.DEV.on` and the caption appears
 * under the word the player has been looking at. `roll()` is on the pause EDGE
 * for that reason, not on any state the unlock touches.
 *
 * THE TYPE PATH SURVIVES AS THE FALLBACK. `draw` returns false when the pack is
 * not loaded and `game.js` sets the old card instead, so a sheet that fails to
 * load costs the lettering's look and not the screen. Same rule as the game over
 * panel's PERDEU!.
 */
class Pause {
  constructor(assets) {
    this.assets = assets;
    this.pick = 0;      // which word; see roll()
    /* THE SHUFFLE BAG. Indices still to be drawn this pass; see roll(). */
    this.bag = [];
    this.last = -1;     // what the player actually last saw, for the seam
  }

  _cfg() { return CONFIG.PAUSE || {}; }

  /**
   * The lettering pack, or null if it is not loaded and the card should set type
   * instead. `sub` is allowed to be missing -- a pack without a caption still
   * draws every word, it just cannot say the cheat is on.
   */
  _pack() {
    const img = this.assets.getDrawable('pauseWords');
    const defs = this.assets.getJSON('pauseWords');
    return (img && defs && defs.frames && defs.frames.length) ? { img, defs } : null;
  }

  /**
   * Choose the word. Called by the shell as the pause goes on, ONCE.
   *
   * ⚠️ SAMPLING WITHOUT REPLACEMENT, NOT INDEPENDENT DRAWS -- lifted whole from
   * `GameOver.roll()`, including the seam, because it is the same request:
   * *"pick them up without substitution and randomize again, once all are picked
   * up one time, restart the drawing possibilities."* A fresh `random()` every
   * pause is memoryless, and memoryless is not what a player experiences as
   * random: with six words an immediate repeat lands one pause in six, and PAUSA
   * twice running reads as the feature being broken -- the one outcome the
   * sheets exist to prevent. So the six are SHUFFLED INTO A BAG and drawn out
   * one at a time; the bag refills only once it is empty.
   *
   * ⚠️ AND THE SEAM BETWEEN TWO BAGS IS THE PART THAT IS EASY TO GET WRONG. The
   * plain algorithm can end one bag on a word and open the next on the same one
   * -- a repeat, on the one boundary the shuffle does not cover, arriving about
   * one refill in six. `last` is what was actually SHOWN, and a refill that
   * opens on it is nudged. Swapped with the END rather than re-shuffled, because
   * a re-shuffle can land on it again and a loop that retries is a loop that can
   * spin.
   *
   * ⚠️ A PAUSE IS FAR MORE FREQUENT THAN A DEATH, which is the one way this
   * differs from the game over panel in practice: a player will empty this bag
   * several times in a session and SEE the cycle. That is what was asked for --
   * all six before any repeats -- and it is why the seam matters more here than
   * there.
   *
   * ⚠️ THE BAG IS NOT PERSISTED. It lasts as long as the page; reloading starts
   * a fresh deck. The guarantee that matters is inside one sitting.
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
      if (n > 1 && this.bag[0] === this.last) {
        this.bag[0] = this.bag[n - 1]; this.bag[n - 1] = this.last;
      }
    }
    this.pick = this.bag.shift();
    this.last = this.pick;
  }

  /**
   * The card: the wash, the word, and the caption if the cheat is on. Returns
   * false if there is no pack, which is the caller's cue to set type instead.
   *
   * ⚠️ ONE SCALE FOR THE WHOLE PACK, AND IT IS MEASURED OVER THE WORDS ONLY.
   * `wRel` says how much of the canvas the widest WORD spans, and every other
   * frame -- the caption included -- is drawn at that same px-per-source ratio,
   * so the short words land short and the caption lands at the third of their
   * height it was drawn at. The widest frame in the file is the CAPTION (1238px
   * against TEMPO's 888), so measuring over everything would hand the card's
   * scale to a line that is usually not even on screen and shrink every word to
   * make room for it. Fitting each word to `wRel` in turn is the other obvious
   * implementation and it destroys the only thing the pack is doing.
   *
   * ⚠️ THE WORD DOES NOT MOVE WHEN THE CHEAT IS TOGGLED. The caption hangs off
   * the word's drawn BOTTOM rather than the block being re-centred, so typing
   * SABOROSA adds a line and shifts nothing -- and it hangs off the bottom
   * rather than sitting at a fixed y because PARÔ! is 365px tall against PAROU's
   * 266 (the circumflex and the exclamation's dot), so a fixed y would collide
   * with some picks and float under others.
   */
  draw(ctx) {
    const p = this._pack();
    if (!p) return false;
    const C = this._cfg();
    const W = CONFIG.GAME_W, H = CONFIG.GAME_H;
    const frames = p.defs.frames;
    const f = frames[this.pick % frames.length];

    // The widest WORD, off the pack itself -- six numbers, and reading them here
    // means the scale cannot fall out of step with a recut sheet.
    let maxW = 1;
    for (const q of frames) if (q.w > maxW) maxW = q.w;
    const k = W * (C.wRel || 0.44) / maxW;

    ctx.save();
    /* THE WASH, drawn here rather than borrowed from `Hud.drawCard`, because
       that call also sets the type this replaces. Same knob, same default. */
    ctx.fillStyle = 'rgba(0,0,0,' + (C.dimAlpha != null ? C.dimAlpha : 0.72) + ')';
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const cy = H * (C.yPct != null ? C.yPct : 47) / 100 + (C.offY || 0);
    const ax = f.ax != null ? f.ax : f.w / 2;
    const ay = f.ay != null ? f.ay : f.h / 2;
    ctx.drawImage(p.img, f.x, f.y, f.w, f.h,
                  W / 2 - ax * k + (C.offX || 0), cy - ay * k, f.w * k, f.h * k);

    /* THE CHEAT CAPTION. Read live, like every other gate on `DEV.on`, so the
       unlock typed at this very screen shows up on the next frame. */
    const sub = p.defs.sub;
    if (sub && CONFIG.DEV && CONFIG.DEV.on) {
      const sax = sub.ax != null ? sub.ax : sub.w / 2;
      const top = cy + (f.h - ay) * k + (C.subGapPx || 0);
      ctx.drawImage(p.img, sub.x, sub.y, sub.w, sub.h,
                    W / 2 - sax * k + (C.subOffX || 0), top + (C.subOffY || 0),
                    sub.w * k, sub.h * k);
    }
    ctx.restore();
    return true;
  }
}
