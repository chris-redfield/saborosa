/**
 * logo.js — the screen before the screen.
 *
 * The crawling vermin with the SABOROSA logo over them, and then it hands to
 * the BATIDÃO DE CÔCO title. Two front screens: the label, then the name.
 *
 * ⚠️ THIS SCREEN EXISTED, WAS DELETED, AND CAME BACK. It WAS the title screen
 * until 2026-08-21, when a photograph of a wall and hand-set type replaced it;
 * on 2026-08-22 it was asked for again, in FRONT of that photograph rather than
 * instead of it. Nothing was recovered from the old code -- there was nothing
 * to recover, because it was six lines of draw call. What made it cheap to
 * bring back is that neither of its assets was ever removed: the three frames
 * are the ones the game over panel runs on, and the logo has sat unused in the
 * other game's folder the whole time.
 *
 * ⚠️ IT ADDS NO NEW BYTES BUT ONE 30KB FILE. The vermin frames were already in
 * the build and already loaded -- this draws the SAME three, through
 * `GameOver.renderBackdrop`, so the two screens cannot end up on different
 * frames of one animation or drift apart if the art is ever recut. Still Life
 * makes exactly this split for exactly this reason; see its game-over.js.
 *
 * ⚠️ IT AUTO-ADVANCES, AND THE TITLE AFTER IT DOES NOT. That asymmetry is the
 * point of having two screens rather than two things to dismiss: this one is a
 * label being shown to you and it leaves on its own; the next one is where the
 * game waits for you. Making both wait would mean two presses to reach a game
 * that used to take one. `holdMs` 0 turns the auto-advance off if that is ever
 * wanted.
 *
 * A SIBLING OF title.js AND ending.js, on purpose: same shape, same contract --
 * it owns its clock, it draws itself, and it hands back a single boolean when
 * the shell should move on. The shell has no business knowing how long a logo
 * is looked at.
 */
class Logo {
  constructor(assets, gameOver) {
    this.assets = assets;
    /* Borrowed for its backdrop crawl, not for its panel. See the header. */
    this.gameOver = gameOver;
    this.reset();
  }

  reset() {
    this.t = 0;          // ms on screen
    this.out = -1;       /* -1 until it starts leaving, then the fade-out clock.
                            IT DOUBLES AS THE "already going" FLAG, exactly as
                            it does on the title screen: a press during the fade
                            must not restart it, and a separate boolean would be
                            a second thing to keep in step with this one. */
    this.done = false;
  }

  _cfg() { return CONFIG.LOGO || {}; }

  /** Every frame it is up. Returns true on the frame the shell should move on. */
  update(dt, input) {
    const c = this._cfg();
    this.t += dt * 1000;

    if (this.out >= 0) {
      this.out += dt * 1000;
      if (this.out >= (c.fadeOutMs || 600)) { this.done = true; return true; }
      return false;
    }

    /* ⚠️ A PRESS IS NOT ACCEPTED IMMEDIATELY, and this is the one screen in the
       game that arms one. Everywhere else a press is taken from the first frame
       on the argument that anyone who has seen a screen once must be able to
       leave it at once -- but this is the FIRST screen of the session, and a
       key still down from launching the game (or a pad's resting axis read as a
       press) would blow through it before it had drawn twice. `armMs` is short
       enough that it never reads as an unresponsive screen. */
    const armed = this.t >= (c.armMs != null ? c.armMs : 250);
    if (armed && input && input.takeAnyPress()) { this.out = 0; return false; }

    // ...and it leaves on its own if nobody does anything. 0 = wait forever.
    const hold = c.holdMs != null ? c.holdMs : 3000;
    if (hold > 0 && this.t >= hold) this.out = 0;
    return false;
  }

  draw(ctx, W, H) {
    const c = this._cfg();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    /* THE CRAWL, on this screen's own clock -- which is what makes the vermin
       arrive mid-stride rather than restarting their cycle when the panel that
       shares them comes up later in the run. */
    if (this.gameOver) this.gameOver.renderBackdrop(ctx, W, H, this.t, 1);

    const img = this.assets.getDrawable('logo');
    if (img) {
      /* WIDTH-DRIVEN, HEIGHT FOLLOWS. The logo is 705x166 and the canvas is
         1280x720; sizing it off the height would make a wide, short image
         enormous the moment either number moved. */
      const dw = W * (c.wRel || 0.52);
      const dh = dw * (img.height / img.width);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, W / 2 - dw / 2,
                    H * (c.yRel != null ? c.yRel : 0.5) - dh / 2, dw, dh);
      ctx.restore();
    }

    /* UP OUT OF BLACK on the way in, and back down on the way out. The fade-in
       matters more here than anywhere else in the game: this is the first thing
       drawn after the loading bar, and cutting to a full-brightness photograph
       from black reads as the page having jumped. */
    const fin = c.fadeInMs || 0;
    if (fin > 0 && this.t < fin) this._veil(ctx, W, H, 1 - this.t / fin);
    if (this.out >= 0) {
      const ms = c.fadeOutMs || 600;
      this._veil(ctx, W, H, ms > 0 ? Math.min(1, this.out / ms) : 1);
    }
  }

  _veil(ctx, W, H, a) {
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, a);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}
