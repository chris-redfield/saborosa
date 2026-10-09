/**
 * the-end.js — THE END, the card after the tally.
 *
 * Asked for 2026-10-09: *"after the screen where the points are summed, when
 * the player presses any button, now instead of going back to the starting
 * screen, he should be presented to one of these screens. keep the current
 * screen background, bring the letters up, and swap them with one of the
 * images... and then if the player presses a button again, he goes back to the
 * starting screen, the one with the saborosa logo and the moving worms."*
 *
 * So it is a BEAT SPLICED INTO A DISMISSAL, not a new screen with a background
 * of its own:
 *
 *     ending photograph -> tally (points sum) -> [press] -> THE END -> [press] -> logo
 *
 * ⚠️ THE BACKGROUND IS THE ONE ALREADY THERE. `endingShown` keeps `render()`
 * drawing the ending photograph through the CLEAR phase, and this phase changes
 * nothing about that -- the card lands on the same picture the tally did.
 *
 * ⚠️ AND "BRING THE LETTERS UP" IS THE TALLY LEAVING, WHICH THIS CLASS ONLY
 * TIMES. `game.js` owns the board (it has `hud` and `stats`); this owns the
 * clock and the card, and hands out `liftPx()` and `tallyAlpha()` so the two
 * move on ONE clock. A second clock in game.js is how the card and the letters
 * would drift apart the first time either duration was retuned.
 *
 * ⚠️ THE TALLY'S ALPHA TAKES ITS BLACK VEIL WITH IT, and that is the whole
 * reason the ask works. `hud.drawResults` fades `rgba(0,0,0,0.78)` by the same
 * `alpha` as its text, so the letters going out UNCOVERS the photograph rather
 * than leaving a dark panel for the card to sit on.
 *
 * WHICH CARD: `good` is decided by the caller from the run's facts (both TIME
 * ATTACKs COMPLETO), never from anything in here.
 */
class TheEnd {
  constructor(assets) {
    this.assets = assets;
    this.t = 0;
    this.good = true;
  }

  _cfg() { return CONFIG.THE_END || {}; }

  /**
   * Is the screen switched on and does it have art?
   *
   * ⚠️ ASKED BEFORE THE DISMISSAL BRANCHES, so `on: false` or a missing card
   * puts the old behaviour back exactly -- the tally hands straight to the logo
   * and nothing in between has to be unwound.
   */
  static enabled() {
    const T = CONFIG.THE_END;
    return !!(T && T.on !== false && (T.GOOD || T.LESSER));
  }

  /** Begin. `good` picks the card and is the caller's verdict on the run. */
  reset(good) {
    this.t = 0;
    this.good = !!good;
  }

  update(dt) { this.t += dt * 1000; }

  /** The asset key for the card being shown. */
  key() { return this.good ? 'theEndGood' : 'theEndLesser'; }

  /**
   * How far the tally has travelled up, in px.
   *
   * ⚠️ EASED, AND THE EASE IS WHY IT READS AS A LIFT RATHER THAN A CUT. Same
   * cosine the credits roll and the title's drop use.
   */
  liftPx(H) {
    const c = this._cfg();
    const ms = Math.max(1, c.liftMs != null ? c.liftMs : 560);
    const p = Math.max(0, Math.min(1, this.t / ms));
    const e = 0.5 - 0.5 * Math.cos(Math.PI * p);
    return H * (c.liftRel != null ? c.liftRel : 0.62) * e;
  }

  /**
   * What is left of the tally.
   *
   * ⚠️ IT GOES OUT FASTER THAN IT TRAVELS (`liftFadeRel` of the lift), so the
   * letters are gone before they reach the top of the frame. Fading over the
   * whole journey means a board still faintly readable while the card is
   * arriving, which is two things asking to be read at once.
   */
  tallyAlpha() {
    const c = this._cfg();
    const ms = Math.max(1, c.liftMs != null ? c.liftMs : 560)
             * (c.liftFadeRel != null ? c.liftFadeRel : 0.65);
    return Math.max(0, 1 - this.t / ms);
  }

  /** Has the card been up long enough to answer a press? */
  armed() {
    const c = this._cfg();
    return this.t >= (c.pressDelayMs != null ? c.pressDelayMs : 700);
  }

  /**
   * The card.
   *
   * ⚠️ SIZED OFF ITS HEIGHT, NOT ITS WIDTH. Both cards are about 1.43:1 against
   * a 1.78:1 frame, so height is what runs out first; driving this from a width
   * would push the taller of the two off the top and bottom. The two masters are
   * also not the same shape (1.447 and 1.416), and `hRel` keeps them the same
   * HEIGHT on screen -- which is what reads as "the same card changed", where
   * matching their widths would make one visibly taller than the other.
   *
   * ⚠️ IT DOES NOT FILL THE FRAME, DELIBERATELY. At `hRel` 0.78 the ending
   * photograph still shows around it, which is what makes this a card laid on
   * the ending rather than a new screen -- *"keep the current screen
   * background"*.
   */
  draw(ctx, W, H) {
    const img = this.assets && this.assets.getDrawable(this.key());
    if (!img || !img.width) return;
    const c = this._cfg();
    const fadeMs = Math.max(1, c.fadeMs != null ? c.fadeMs : 420);
    const delay = c.fadeDelayMs != null ? c.fadeDelayMs : 240;
    const a = Math.max(0, Math.min(1, (this.t - delay) / fadeMs));
    if (a <= 0) return;
    const h = H * (c.hRel != null ? c.hRel : 0.78);
    const w = h * (img.width / img.height);
    const cx = W / 2;
    const cy = H * (c.yRel != null ? c.yRel : 0.5);
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
  }
}
