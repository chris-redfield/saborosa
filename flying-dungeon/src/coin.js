/**
 * Coin — a spinning time-coin drifting through the dungeon (PORTABLE CORE).
 *
 * Lives in the tray's WORLD space, exactly like Fly: it stays put in the dungeon
 * while the camera pans, and its X WRAPS at the world width so it circles the
 * basket rather than running out of map.
 *
 * Movement is deliberately NOT the fly's. It borrows the fly's X — a steady
 * leftward drift, entering from the right — but where a fly darts up and down
 * on its own erratic heading, a coin holds its world Y and only BOBS: the same
 * gentle sine the plane rides, amplitude relative to its own drawn size with a
 * pixel floor, so it reads as floating rather than flying. The bob is a DRAW
 * offset, not a change to `y`, so nothing downstream has to know about it.
 *
 * The art is a 22-frame full rotation on a uniform grid (see
 * tools/build-coin-frames.py): frame k is (k*COIN_CELL, 0, COIN_CELL, COIN_CELL),
 * no per-frame table. Two variants exist — an upright spin and a tilted one —
 * and a coin just holds the key of whichever it was given; they are the same
 * cell size, so the variant costs nothing but a different image.
 *
 * Frame phase and bob phase are both randomised per coin. Without that, every
 * coin on screen would flash its face at the same instant and the field would
 * pulse in unison.
 *
 * Dependencies injected (assets store + config). No DOM, no globals.
 */
class Coin {
  constructor(assets, cfg, x, y, variant) {
    this.assets = assets;
    this.cfg = cfg;
    this.x = x;                 // WORLD coords (same space as the tray)
    this.y = y;
    this.variant = variant;     // key into CONFIG.COIN_SHEETS ('01' | '02')
    // Steady, with a little spread so the field doesn't move as one rigid block.
    // Always leftward, like the flies.
    this.vx = -cfg.coinSpeed * (1 + (Math.random() * 2 - 1) * cfg.coinSpeedVar);
    this.frame = Math.floor(Math.random() * cfg.COIN_FRAMES);
    this.frameT = 0;            // ms accumulated on the current frame
    this.phase = Math.random() * Math.PI * 2;   // desync the bob per coin
  }

  update(dt, worldW) {
    const c = this.cfg;
    this.phase += dt / 1000;

    // Spin. A while-loop rather than an if, so a long frame advances the whole
    // way instead of dropping frames and stuttering the rotation.
    if (c.coinHoldMs > 0) {
      this.frameT += dt;
      while (this.frameT >= c.coinHoldMs) {
        this.frameT -= c.coinHoldMs;
        this.frame = (this.frame + 1) % c.COIN_FRAMES;
      }
    }

    this.x += this.vx * (dt / 1000);
    if (worldW > 0) this.x = ((this.x % worldW) + worldW) % worldW;
  }

  // The bob, in px. Same shape as the plane's: a fraction of the sprite's own
  // height, floored so it stays visible at small sizes. Amplitude is derived,
  // not stored, so resizing the coin rescales its bob for free.
  _bob() {
    const c = this.cfg;
    return Math.sin(this.phase * c.coinBobFreq)
         * Math.max(c.coinBobMin, c.coinSizePx * c.coinBobRel);
  }

  _screenY(camY) { return this.y - camY + this._bob(); }

  render(ctx, camX, camY, worldW) {
    const c = this.cfg;
    const sheet = this.assets.getDrawable('coin_' + this.variant);
    if (!sheet) return;

    const d = c.coinSizePx;                    // square: the cell is square
    const sx = (this.frame % c.COIN_FRAMES) * c.COIN_CELL;
    const sy = this._screenY(camY);

    ctx.imageSmoothingEnabled = true;
    // Three wrap copies, like the flies — a coin straddling the seam has to be
    // drawn on both sides of it. Off-screen copies are no-ops in the driver.
    // Positioned by translate with no rounding, the convention every other
    // entity here uses; rounding only some of them makes the world jitter
    // against itself as the camera scrolls sub-pixel.
    for (const wx of [this.x - worldW, this.x, this.x + worldW]) {
      ctx.save();
      ctx.translate(wx - camX, sy);
      ctx.drawImage(sheet, sx, 0, c.COIN_CELL, c.COIN_CELL, -d / 2, -d / 2, d, d);
      ctx.restore();
    }
  }
}
