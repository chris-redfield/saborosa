/**
 * Finale — what beating the Time Boss actually gives you (PORTABLE CORE).
 *
 * Not "the run carries on". The run is OVER: the player stops flying the plane
 * and watches. It is the only ending in the game that is a reward rather than a
 * failure, and the only one that is earned rather than arrived at.
 *
 *   1  He blows up, and TIME COMES BACK — the clock is scrubbed from bossAtMs
 *      (-2:00) to 0 over finaleClockMs, while the plane glides down to the
 *      middle of the screen and holds there, bobbing.
 *   2  THANK YOU FOR PLAYING fades up, holds, fades out.
 *   3  OBRIGADO fades up, holds, fades out. The plane bobs through both.
 *   4  The plane accelerates out to the right.
 *   5  The logo runs the Mosca Boss's entrance MIRRORED — a fast pass across
 *      the screen left-to-right, then in again from below and up to the middle,
 *      where it stays.
 *
 * ⚠️ THE BACKGROUND TRANSITION IS NOT A SEPARATE THING TO KEEP IN STEP. The
 * bleach is read from the clock, so scrubbing the clock IS the world washing
 * back from pure white to full colour, on exactly that curve. Accelerating the
 * one accelerates the other by construction; there is no second timeline that
 * could drift.
 *
 * ⚠️ THE CLOCK STAYS PAUSED THROUGHOUT and is written with seek(). Resuming it
 * would hand the run back to a time-over test that is now meaningless, and the
 * scrub has to be a position anyway — it is travelling 120 seconds of game time
 * in 5 seconds of real time, which no rate could express.
 *
 * EVERY BEAT IS A DURATION, never an absolute timestamp: `_marks()` sums them,
 * so retiming any one shifts everything after it instead of leaving a hole. The
 * same trick the intro's liftoff window uses.
 *
 * Dependencies injected (assets store + config). No DOM, no globals.
 */
class Finale {
  constructor(assets, cfg) {
    this.assets = assets;
    this.cfg = cfg;
    this.t = -1;              // <0 = not running
    this.fromX = 0;
    this.fromY = 0;
  }

  get running() { return this.t >= 0; }

  /* Begins the instant the Time Boss's death blast has burnt out. Captures
     where the plane WAS so the glide starts from wherever the player left it
     rather than snapping to a start position. */
  start(plane) {
    this.t = 0;
    this.fromX = plane ? plane.x : this.cfg.finalePlaneX;
    this.fromY = plane ? plane.y : this.cfg.finalePlaneY;
    if (plane) plane.setCinematic(true);
  }

  /* The timeline, as cumulative marks in ms. Derived every call rather than
     cached: it is a dozen additions, and caching it would be one more thing to
     invalidate if a duration is edited live. */
  _marks() {
    const c = this.cfg;
    const m = {};
    // The words wait for BOTH the clock and the plane, whichever is slower.
    m.settle = Math.max(c.finaleClockMs, c.finalePlaneMoveMs) + c.finaleSettleMs;
    m.thanksIn = m.settle;
    m.thanksHold = m.thanksIn + c.finaleFadeMs;
    m.thanksOut = m.thanksHold + c.finaleThanksHoldMs;
    m.obrigadoIn = m.thanksOut + c.finaleFadeMs + c.finaleGapMs;
    m.obrigadoHold = m.obrigadoIn + c.finaleFadeMs;
    m.obrigadoOut = m.obrigadoHold + c.finaleObrigadoHoldMs;
    m.exit = m.obrigadoOut + c.finaleFadeMs;
    m.logoPass = m.exit + c.finaleExitMs;
    m.logoRise = m.logoPass + c.finaleLogoPassMs;
    m.logoHome = m.logoRise + c.finaleLogoRiseMs;
    m.done = m.logoHome + c.finaleLogoHoldMs;
    return m;
  }

  // Has the whole thing played out? The shell arms "press anything" here — the
  // player must not be left on a logo with no way out.
  settled() { return this.running && this.t >= this._marks().done; }

  // Fade envelope: 0 before `inAt`, up over fadeMs, 1, down over fadeMs from
  // `outAt`, 0 after. One function for both cards.
  _fade(inAt, outAt) {
    const f = this.cfg.finaleFadeMs;
    const t = this.t;
    if (t < inAt) return 0;
    if (t < inAt + f) return f > 0 ? (t - inAt) / f : 1;
    if (t < outAt) return 1;
    if (t < outAt + f) return f > 0 ? 1 - (t - outAt) / f : 0;
    return 0;
  }

  update(dt, plane, clock) {
    if (!this.running) return;
    const c = this.cfg;
    this.t += dt;
    const m = this._marks();

    /* TIME COMES BACK. seek(), not resume(): 120 seconds of game time inside 5
       seconds of real time is a position, not a rate. The background follows
       for free — see the header. */
    if (clock) {
      const p = c.finaleClockMs > 0 ? Math.min(1, this.t / c.finaleClockMs) : 1;
      clock.seek(c.bossAtMs * (1 - p));
    }

    if (!plane) return;

    // The glide into position: easeOutCubic, so it arrives and settles rather
    // than stopping dead on the mark. Written straight into plane.x/y — and
    // deliberately so, because the camera pans off those, so the world drifts
    // into its final framing along with him. (The EXIT below cannot do that;
    // see the note there.)
    if (this.t <= m.exit) {
      const p = c.finalePlaneMoveMs > 0
        ? Math.min(1, this.t / c.finalePlaneMoveMs) : 1;
      const e = 1 - Math.pow(1 - p, 3);
      plane.x = this.fromX + (c.finalePlaneX - this.fromX) * e;
      plane.y = this.fromY + (c.finalePlaneY - this.fromY) * e;
      plane.cineOffX = 0;
    } else {
      /* THE EXIT. Quadratic, so it reads as building speed rather than sliding
         off at a crawl.

         ⚠️ A DRAW-ONLY offset, NOT plane.x — the same trap the entrance
         documents at the other end of the run. The camera pans off displayX(),
         so flying this through x would drag the world past its inset and expose
         the blank studio margin at the edge of the tray. */
      const p = c.finaleExitMs > 0
        ? Math.min(1, (this.t - m.exit) / c.finaleExitMs) : 1;
      plane.cineOffX = c.finaleExitX * p * p;
    }
  }

  /* The two cards. Drawn through GameOver so the lettering is literally the
     same code as the end panels — same font, same weight, same colour — with
     the reveal timings switched off in config and the fades driven by the alpha
     passed here instead. `t` is 0 because there is nothing left for the panel's
     own reveal clock to do. */
  renderTitles(ctx, W, H, gameOver) {
    if (!this.running || !gameOver) return;
    const m = this._marks();
    const a1 = this._fade(m.thanksIn, m.thanksOut);
    if (a1 > 0) gameOver.renderTitle(ctx, W, H, 0, a1, 'finaleThanksTitle');
    const a2 = this._fade(m.obrigadoIn, m.obrigadoOut);
    if (a2 > 0) gameOver.renderTitle(ctx, W, H, 0, a2, 'finaleObrigadoTitle');
  }

  /* The logo, running the Mosca Boss's entrance mirrored: a fast pass across
     the screen LEFT to RIGHT (the fly went right to left), then in again from
     off-frame and UP to the middle (the fly came down from the top).

     Screen space, not world space — nothing about an end card should scroll
     with a tray the player is no longer flying over. */
  renderLogo(ctx, W, H) {
    if (!this.running) return;
    const c = this.cfg, m = this._marks();
    if (this.t < m.logoPass) return;
    const img = this.assets.getDrawable('logo');
    if (!img) return;

    const dw = W * c.finaleLogoWRel;
    const dh = dw * (img.height / img.width);
    // Far enough out that it is fully clear of the frame at either end.
    const off = dw / 2 + 40;
    let x, y;

    if (this.t < m.logoRise) {
      // The pass: straight across at a constant speed, in from the left and out
      // the right, at the height it will end up at.
      const p = c.finaleLogoPassMs > 0 ? (this.t - m.logoPass) / c.finaleLogoPassMs : 1;
      x = -off + (W + off * 2) * Math.min(1, p);
      y = H / 2;
    } else {
      // The rise: back in from below, up to the middle, and it stays. Eased so
      // it comes to rest instead of stopping dead — this is the last thing on
      // screen and it should look placed, not dropped.
      const p = c.finaleLogoRiseMs > 0
        ? Math.min(1, (this.t - m.logoRise) / c.finaleLogoRiseMs) : 1;
      const e = 1 - Math.pow(1 - p, 3);
      x = W / 2;
      y = (H + dh) + (H / 2 - (H + dh)) * e;
    }

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, x - dw / 2, y - dh / 2, dw, dh);
    ctx.restore();
  }
}
