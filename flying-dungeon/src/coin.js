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
 * SHOOTABLE. A coin soaks coinHealth hits, and each connected hit throws it
 * into reverse for coinHurtMs: it travels BACKWARDS at the speed it was
 * drifting, its spin runs backwards with it, and it jolts. So holding fire
 * walks a coin back up the screen against its own drift.
 *
 * As with the fly, the shot is a hitscan beam re-tested EVERY FRAME while fire
 * is held, so damage MUST be rate-limited or six hit points would drain in six
 * frames (~100ms) and read exactly like a one-shot. coinHurtMs is that limit,
 * and it doubles as the reverse window and the spasm window — so the i-frames
 * are always exactly as long as the feedback showing them.
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
    this.hp = cfg.coinHealth;
    this.hurtT = 0;             // ms left of the hurt window: immune + reversed
    this.spasmT = -1;           // ms into the jolt; <0 = not jolting
    this.state = 'alive';       // 'alive' → 'boom' → 'dead' (spliced by the shell)
    this.boomT = 0;             // ms into the explosion
    this.boomX = 0;             // where it died, frozen — the blast doesn't
    this.boomY = 0;             // inherit the drift or keep bobbing
    this.hitFx = null;          // {x, y, t} — impact puff from a non-lethal hit
  }

  isShootable() { return this.state === 'alive'; }
  isHurt() { return this.hurtT > 0; }
  isDead() { return this.state === 'dead'; }   // shell drops it from the list

  // A shot connected. Returns false while the coin is inside its hurt window —
  // that rejection IS the rate limit that stops the every-frame beam stripping
  // the whole health bar at once.
  hit(dmg) {
    if (this.state !== 'alive' || this.hurtT > 0) return false;
    this.hp -= (dmg === undefined ? 1 : dmg);
    if (this.hp <= 0) this._explode();
    else {
      this.hurtT = this.cfg.coinHurtMs;
      this.spasmT = 0;
      // Pinned to where the shot connected, NOT to the coin — the coin is about
      // to be shoved backwards, and a puff dragged along with it would read as
      // part of the coin rather than as the moment of impact.
      this.hitFx = { x: this.x, y: this.y + this._bob(), t: 0 };
    }
    return true;
  }

  // Out of health: the coin is gone THIS INSTANT and the blast plays where it
  // was. Position and bob are frozen here rather than read live, so the
  // explosion stays put in the world instead of drifting and bobbing along the
  // path a coin that no longer exists would have taken.
  _explode() {
    this.state = 'boom';
    this.boomT = 0;
    this.boomX = this.x;
    this.boomY = this.y + this._bob();
    this.hurtT = 0;
    this.spasmT = -1;
    this.hitFx = null;          // the explosion supersedes the last hit's puff
  }

  update(dt, worldW) {
    const c = this.cfg;

    // Exploding: the coin itself is already gone, so nothing else is simulated.
    if (this.state === 'boom') {
      this.boomT += dt;
      if (this.boomT >= c.BOOM_RECTS.length * c.boomMs) this.state = 'dead';
      return;
    }
    if (this.state === 'dead') return;

    this.phase += dt / 1000;
    if (this.hurtT > 0) this.hurtT = Math.max(0, this.hurtT - dt);
    if (this.hitFx) {
      this.hitFx.t += dt;
      if (this.hitFx.t >= c.coinHitFxFrames * c.coinHitFxMs) this.hitFx = null;
    }
    if (this.spasmT >= 0) {
      this.spasmT += dt;
      if (this.spasmT >= c.coinSpasmMs) this.spasmT = -1;
    }

    // Knocked back: everything about the coin runs backwards for the window.
    // Derived from hurtT rather than stored as its own flag, so the reversal
    // can't outlive the window or drift out of step with the jolt.
    const back = this.hurtT > 0;

    // Spin. A while-loop rather than an if, so a long frame advances the whole
    // way instead of dropping frames and stuttering the rotation. The +N before
    // the modulo keeps it positive when stepping backwards.
    if (c.coinHoldMs > 0) {
      this.frameT += dt;
      const n = c.COIN_FRAMES;
      while (this.frameT >= c.coinHoldMs) {
        this.frameT -= c.coinHoldMs;
        this.frame = (this.frame + (back ? -1 : 1) + n) % n;
      }
    }

    // Same speed, opposite direction — not a separate knockback velocity, so a
    // coin being pushed back always exactly undoes its own drift.
    this.x += (back ? -this.vx : this.vx) * (dt / 1000);
    if (worldW > 0) this.x = ((this.x % worldW) + worldW) % worldW;
  }

  /* The jolt. A decaying oscillation rather than random jitter: noise reads as
     a rendering fault, a damped shake reads as a flinch. Runs on the same clock
     as the hurt window, and is a touch shorter than it so each hit's jolt gets
     to finish before the next shot can land.

     Returns {dx, dy, k}: an offset in screen px and a size multiplier. */
  _spasm() {
    const c = this.cfg;
    if (this.spasmT < 0 || c.coinSpasmMs <= 0) return null;
    const p = Math.min(1, this.spasmT / c.coinSpasmMs);
    const decay = 1 - p;
    const w = Math.sin(p * c.coinSpasmFreq) * decay;
    return {
      dx: w * c.coinSpasmAmp,
      dy: w * c.coinSpasmAmp * 0.4,   // mostly sideways: it was hit from the side
      k: 1 + c.coinSpasmScale * decay,
    };
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

  /* Screen-space collision boxes — one per wrap copy, so a coin straddling the
     seam is still hittable.

     A FIXED box, not the frame's own silhouette: the coin is 76px face-on but
     only ~15px edge-on, and a hitbox that collapsed with it would make a
     spinning coin flicker in and out of being shootable twice per rotation.
     The jolt is deliberately left out of it too — a hitbox that shook with the
     art would be dodging the shot that's hitting it. */
  boxes(camX, camY, worldW) {
    const c = this.cfg;
    if (this.state !== 'alive') return [];
    const s = c.coinSizePx * c.coinHitScale;
    const sy = this._screenY(camY);
    const out = [];
    for (const off of [-worldW, 0, worldW]) {
      out.push({ x: (this.x + off) - camX - s / 2, y: sy - s / 2, w: s, h: s });
    }
    return out;
  }

  render(ctx, camX, camY, worldW) {
    const c = this.cfg;
    if (this.state !== 'alive') return;         // gone the instant it dies
    const sheet = this.assets.getDrawable('coin_' + this.variant);
    if (!sheet) return;

    const j = this._spasm();
    const d = c.coinSizePx * (j ? j.k : 1);    // square: the cell is square
    const sx = (this.frame % c.COIN_FRAMES) * c.COIN_CELL;
    const sy = this._screenY(camY) + (j ? j.dy : 0);
    const jx = j ? j.dx : 0;

    ctx.imageSmoothingEnabled = true;
    // Three wrap copies, like the flies — a coin straddling the seam has to be
    // drawn on both sides of it. Off-screen copies are no-ops in the driver.
    // Positioned by translate with no rounding, the convention every other
    // entity here uses; rounding only some of them makes the world jitter
    // against itself as the camera scrolls sub-pixel.
    for (const wx of [this.x - worldW, this.x, this.x + worldW]) {
      ctx.save();
      ctx.translate(wx - camX + jx, sy);
      ctx.drawImage(sheet, sx, 0, c.COIN_CELL, c.COIN_CELL, -d / 2, -d / 2, d, d);
      ctx.restore();
    }
  }

  /* Both hit effects, drawn in their OWN pass — the shell calls this after the
     flies and the plane, so neither is ever occluded by something flying in
     front of it. A no-op for a coin that is neither exploding nor freshly hit. */
  renderBurst(ctx, camX, camY, worldW) {
    this._blitHitFx(ctx, camX, camY, worldW);
    this._blitBoom(ctx, camX, camY, worldW);
  }

  // Blit one sprite at a frozen WORLD point, across all three wrap copies.
  // `size` is the drawn width of the sheet's WIDEST frame in the set, which is
  // what the two coin*Size knobs are expressed in.
  _blit(ctx, sheet, r, wx0, wy, camX, camY, worldW, s) {
    const dw = r[2] * s, dh = r[3] * s;
    ctx.imageSmoothingEnabled = true;
    for (const wx of [wx0 - worldW, wx0, wx0 + worldW]) {
      ctx.save();
      ctx.translate(wx - camX, wy - camY);
      ctx.drawImage(sheet, r[0], r[1], r[2], r[3], -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    }
  }

  static _widest(rects) {
    let w = 1;
    for (const f of rects) if (f[2] > w) w = f[2];
    return w;
  }

  /* The impact puff: the fly's burst frames, played verbatim at the point the
     shot connected. Reaching into the FLY sheet is deliberate — this is meant
     to be the very same effect a non-lethal hit puts on a fly, so it shares its
     art and its rate rather than owning a near-copy that could drift from it. */
  _blitHitFx(ctx, camX, camY, worldW) {
    const c = this.cfg, fx = this.hitFx;
    if (!fx) return;
    const sheet = this.assets.getDrawable('fly');
    if (!sheet) return;
    const i = Math.min(c.coinHitFxFrames - 1, Math.floor(fx.t / c.coinHitFxMs));
    const r = c.FLY_RECTS[1 + i];               // 0 is the live fly; 1..4 burst
    if (!r) return;
    const s = (c.coinSizePx * c.coinHitFxSize) / Coin._widest(c.FLY_RECTS.slice(1));
    this._blit(ctx, sheet, r, fx.x, fx.y, camX, camY, worldW, s);
  }

  /* The death explosion. One scale for all twelve frames, so they keep their
     relative sizes and the animation still grows and fades; derived from the
     WIDEST frame so coinBoomSize means "how big the peak is", which is the
     thing you actually want to dial. With the full frame set the FIRST frame is
     the smallest, so anchoring on it would blow the blast up. */
  _blitBoom(ctx, camX, camY, worldW) {
    if (this.state !== 'boom') return;
    const c = this.cfg, rects = c.BOOM_RECTS;
    const r = rects[Math.min(rects.length - 1, Math.floor(this.boomT / c.boomMs))];
    if (!r) return;
    const sheet = this.assets.getDrawable('boom');
    if (!sheet) return;
    const s = (c.coinSizePx * c.coinBoomSize) / Coin._widest(rects);
    this._blit(ctx, sheet, r, this.boomX, this.boomY, camX, camY, worldW, s);
  }
}
