/**
 * Boss — the Time Boss, a furious alarm clock (PORTABLE CORE).
 *
 * Only shows up once the player has driven the run clock down to bossAtMs
 * (-2:00) by shooting coins, so it is the reward for abusing the rewind rather
 * than something the game hands out on a timer.
 *
 * THE SHEET IS A TURN, NOT A WALK CYCLE. Its 7 frames sweep from profile-left
 * (frame 0) through full-front (frame 3) to profile-right (frame 6) — the
 * widths give it away: 120px in profile, 269px face-on, symmetric about the
 * middle. So `facing` here is a CONTINUOUS 0..1 (0 = left, 1 = right) and the
 * frame is just that value quantised; the boss is never "playing an animation",
 * it is simply pointed somewhere.
 *
 * Movement falls out of the same value: velocity is bossSpeed × (facing×2−1),
 * so at either profile it travels at full speed and face-on it is STATIONARY.
 * That one coupling gives the whole behaviour for free:
 *
 *   IDLE     — faces the camera, and is therefore motionless. It just stands
 *              there, front-on, watching.
 *   ALERTED  — the player has come within bossSeeRange. From then on it turns
 *              to face whichever side the player is on, and because facing IS
 *              velocity, turning to look at you *is* setting off after you.
 *
 * So it decelerates as it swings through front-on, hangs there for the instant
 * it is square to the camera, and accelerates away the other way — with no
 * acceleration code anywhere.
 *
 * Being alerted LATCHES. Once it has seen the player it never goes back to
 * minding its own business, however far away they get; that is what makes it
 * stalking rather than a proximity trigger.
 *
 * The frames are hand-placed at irregular pitch and differing sizes, so they
 * are drawn from measured rects (BOSS_RECTS), centred horizontally and hung
 * from a COMMON TOP: every frame shares y=79 on the sheet, so top-alignment is
 * exact, and the 4px the front-facing frames gain is the stance widening at the
 * feet, which should hang downward rather than being centred away.
 *
 * Dependencies injected (assets store + config). No DOM, no globals.
 */
class Boss {
  constructor(assets, cfg, x, y) {
    this.assets = assets;
    this.cfg = cfg;
    this.x = x;                 // WORLD coords, like the flies and coins
    this.y = y;
    this.facing = 0.5;          // 0 = profile left · 0.5 = front · 1 = profile right
    this.alerted = false;       // has it seen the player? latches true
    this.phase = Math.random() * Math.PI * 2;
  }

  // −1 at profile-left, 0 front-on, +1 at profile-right — the signed fraction
  // of full speed it can manage while pointed the way it is pointed.
  _drive() { return this.facing * 2 - 1; }

  // Signed distance to a world X, taking the SHORT way round the wrap. Without
  // this a player just over the seam reads as most of a world away, and the
  // boss would turn and stalk off in the wrong direction.
  _dx(targetX, worldW) {
    let d = targetX - this.x;
    if (worldW > 0) {
      const half = worldW / 2;
      if (d > half) d -= worldW;
      else if (d < -half) d += worldW;
    }
    return d;
  }

  // `target` is the player's WORLD point, or null if there isn't one yet.
  update(dt, worldW, worldH, target) {
    const c = this.cfg, s = dt / 1000;
    this.phase += s;

    let dx = 0, dy = 0, dist = Infinity;
    if (target) {
      dx = this._dx(target.x, worldW);
      dy = target.y - this.y;
      dist = Math.hypot(dx, dy);
    }
    if (!this.alerted && dist <= c.bossSeeRange) this.alerted = true;

    // Front while it hasn't noticed anyone; locked onto the player's side once
    // it has. Eased at a rate that crosses the full profile-to-profile sweep in
    // bossTurnMs, so retiming the turn is one number and the speed ramp that
    // comes with it follows automatically.
    const want = !this.alerted ? 0.5 : (dx < 0 ? 0 : 1);
    if (c.bossTurnMs > 0) {
      const step = dt / c.bossTurnMs;
      this.facing = want > this.facing
        ? Math.min(want, this.facing + step)
        : Math.max(want, this.facing - step);
    } else {
      this.facing = want;
    }

    if (this.alerted) {
      // Horizontal pursuit is just the facing coupling doing its job. The
      // stand-off keeps it from walking THROUGH the player and flipping sides
      // every frame — without it, dx changes sign under the boss and it
      // shudders on the spot instead of looming.
      if (Math.abs(dx) > c.bossStopRange) this.x += c.bossSpeed * this._drive() * s;
      // Vertical runs at the SAME bossSpeed, deliberately sharing the one knob
      // rather than owning a second that could drift away from it. Not scaled
      // by _drive() though: the turn is a horizontal thing, so the boss keeps
      // closing on the player's altitude even while it is swinging through
      // front-on and going nowhere sideways.
      if (Math.abs(dy) > c.bossStopRange * 0.5) {
        this.y += (dy < 0 ? -1 : 1) * c.bossSpeed * s;
      }
      if (worldH > 0) {
        const lo = c.bossSizePx * 0.5;
        const hi = worldH * c.bossBandBottom;
        this.y = Math.max(lo, Math.min(hi, this.y));
      }
    }

    if (worldW > 0) this.x = ((this.x % worldW) + worldW) % worldW;
  }

  _bob() {
    const c = this.cfg;
    return Math.sin(this.phase * c.bossBobFreq)
         * Math.max(c.bossBobMin, c.bossSizePx * c.bossBobRel);
  }

  frame() {
    const n = this.cfg.BOSS_RECTS.length;
    return Math.max(0, Math.min(n - 1, Math.round(this.facing * (n - 1))));
  }

  render(ctx, camX, camY, worldW) {
    const c = this.cfg;
    const sheet = this.assets.getDrawable('boss');
    if (!sheet) return;
    const r = c.BOSS_RECTS[this.frame()];
    if (!r) return;

    // One scale for every frame, off the reference height, so the boss does not
    // pulse in size as it turns.
    const s = c.bossSizePx / c.BOSS_REF_H;
    const dw = r[2] * s, dh = r[3] * s;
    const sy = this.y - camY + this._bob();

    ctx.imageSmoothingEnabled = true;
    // Wrap copies, like everything else living in world space.
    for (const wx of [this.x - worldW, this.x, this.x + worldW]) {
      ctx.save();
      // Centred on X, hung from the common top on Y.
      ctx.translate(wx - camX, sy);
      ctx.drawImage(sheet, r[0], r[1], r[2], r[3],
                    -dw / 2, -c.bossSizePx / 2, dw, dh);
      ctx.restore();
    }
  }
}
