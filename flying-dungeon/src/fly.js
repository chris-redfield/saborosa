/**
 * Fly — an enemy insect (PORTABLE CORE).
 *
 * Lives in the tray's WORLD space (the larger plane the camera pans), so it
 * stays put in the dungeon while the player/camera moves — it is NOT glued to
 * the screen. Its X WRAPS at the world width: reach the far edge and it circles
 * back to the start, the same loop the tray makes around the fruit basket.
 *
 * Movement is erratic like a real fly: always a net leftward drift (R-type
 * style, entering from the right) but re-picking a new heading every fraction
 * of a second, banking into its vertical turns, with a fast micro-buzz on top.
 *
 * It has HEALTH (flyHealth) and takes rayDamage per connected shot, so it soaks
 * several hits before dying. The shot is a hitscan beam re-tested EVERY FRAME
 * while fire is held, so damage has to be rate-limited or the whole health bar
 * would drain in as many frames (~50ms) and feel identical to a one-shot kill.
 * A hit therefore opens a flyHurtMs window during which the fly is immune,
 * blinks, and is shoved away from the gun — the i-frames, the feedback and the
 * knockback are all that one window.
 *
 * States: 'alive' → out of health → 'dying' → 'dead', removed for good (no
 * respawn). While 'dying' the sheet's frames 1-4 play the fly coming apart AND
 * the dead body drops away under gravity — overlapped, timed by flyCorpseLead.
 *
 * Dependencies injected (assets store + config). No DOM, no globals.
 */
class Fly {
  constructor(assets, cfg, x, y) {
    this.assets = assets;
    this.cfg = cfg;
    this.x = x;               // WORLD coords (same space as the tray)
    this.y = y;
    this.vx = -cfg.flySpeed;  // always leftward (net right-to-left)
    this.vy = 0;
    this.retarget = 0;        // countdown to the next heading change
    this.angle = 0;           // current frame tilt (rad), eases toward heading
    this.phase = Math.random() * Math.PI * 2;  // desync the buzz per fly
    this.state = 'alive';     // 'alive' | 'dying' | 'landed' | 'dead'
    this.restX = 0;           // WORLD coords of the resting body (see _land)
    this.restY = 0;
    this.restFrac = 0;        // where on the floor plane it's headed (sampled once)
    this.restRot = 0;         // resting angle (sampled once)
    this.hp = cfg.flyHealth;  // hits it can soak before bursting
    this.hurtT = 0;           // ms left of the hurt window (immune + blink + shove)
    this.hitFx = null;        // {x,y,t} — impact puff from a non-lethal hit
    this.frame = 0;           // index into FLY_RECTS (0 = live, 1-4 = burst)
    this.deathT = 0;          // ms since the hit
    this.corpseActive = false;
    this.corpseX = 0; this.corpseY = 0;
    this.corpseVx = 0; this.corpseVy = 0;
    this.deathVx = 0; this.deathVy = 0;   // velocity captured at the moment of the hit
  }

  isAlive()  { return this.state === 'alive'; }
  isDead()   { return this.state === 'dead'; }
  isLanded() { return this.state === 'landed'; }

  // The corpse has settled on the floor plane. Stays in WORLD space, so the
  // pile scrolls with the tray and stays put relative to the dungeon.
  _land(restY) {
    this.restX = this.corpseX;
    this.restY = restY;
    this.state = 'landed';
  }

  isHurt() { return this.hurtT > 0; }

  // A shot connected. Returns true if it actually landed — false while the fly
  // is inside its hurt window, which is what stops the every-frame beam from
  // stripping all its health at once. The last point of damage bursts it.
  hit(dmg) {
    if (this.state !== 'alive' || this.hurtT > 0) return false;
    this.hp -= (dmg === undefined ? 1 : dmg);
    if (this.hp <= 0) { this._burst(); return true; }
    this.hurtT = this.cfg.flyHurtMs;
    // Same burst frames the death plays, but smaller and quicker, and LEFT AT
    // the impact point rather than following the fly — a puff stuck to a fly
    // that's still flying reads as "it died and kept going".
    this.hitFx = { x: this.x, y: this.y, t: 0 };
    return true;
  }

  // Health ran out: play the burst frames and drop the corpse (they overlap).
  _burst() {
    const c = this.cfg;
    // Draw both resting values ONCE, here — not per frame in render, which would
    // make the body jitter, and not per frame in update, which would waste work.
    //
    // Where on the plane it lands: uniform across the band, so the bodies scatter
    // over the plane's depth instead of lining up on one row.
    this.restFrac = c.corpsePlaneTop + Math.random() * (c.corpsePlaneBottom - c.corpsePlaneTop);
    // Resting angle: uniform in ±corpseTiltDeg.
    this.restRot = (Math.random() * 2 - 1) * c.corpseTiltDeg * Math.PI / 180;

    this.state = 'dying';
    this.frame = 1;
    this.deathT = 0;
    this.corpseActive = false;
    // Remember how it was flying so the body carries that momentum into its arc.
    this.deathVx = this.vx;
    this.deathVy = this.vy;
  }

  update(dt, worldW, worldH) {
    const c = this.cfg, s = dt / 1000;
    // Landed corpses are inert — nothing left to simulate, they just get drawn.
    if (this.state === 'dead' || this.state === 'landed') return;

    // Dying: the disintegration frames play from the hit, and the corpse drops
    // in `flyCorpseLead` ms before they finish — so the body is already falling
    // while the fly comes apart. Gone once it clears the bottom of the world.
    if (this.state === 'dying') {
      this.deathT += dt;
      this.frame = 1 + Math.floor(this.deathT / c.flyBurstMs);

      const burstTotal = (c.FLY_RECTS.length - 1) * c.flyBurstMs;
      const corpseStart = Math.max(0, burstTotal - c.flyCorpseLead);
      if (!this.corpseActive && this.deathT >= corpseStart) {
        this.corpseActive = true;
        this.corpseX = this.x; this.corpseY = this.y;
        // Ballistic: inherit the fly's heading so gravity bends it into an arc.
        // Otherwise start from rest and just drop straight down.
        this.corpseVx = c.corpseBallistic ? this.deathVx : 0;
        this.corpseVy = c.corpseBallistic ? this.deathVy : 0;
      }
      if (this.corpseActive) {
        // Ballistic arc: constant horizontal velocity + gravity on the vertical.
        // Four adds and two multiplies — no allocation, no trig.
        this.corpseVy += c.flyGravity * s;
        this.corpseX += this.corpseVx * s;
        this.corpseY += this.corpseVy * s;
        if (worldW > 0) this.corpseX = ((this.corpseX % worldW) + worldW) % worldW;

        // Settle onto the floor plane at the bottom of the map.
        if (worldH > 0 && this.corpseY >= this.restFrac * worldH) {
          // Never let a body that died BELOW its sampled line snap upward to
          // reach it — in that case it just rests where it fell, clamped to the
          // near edge of the plane.
          const restY = Math.max(this.restFrac * worldH,
            Math.min(this.corpseY, c.corpsePlaneBottom * worldH));
          this._land(restY);
        }
      }
      return;
    }

    this.phase += s;
    if (this.hurtT > 0) this.hurtT = Math.max(0, this.hurtT - dt);
    if (this.hitFx) {
      this.hitFx.t += dt;
      if (this.hitFx.t >= c.flyHitBurstFrames * c.flyHitBurstMs) this.hitFx = null;
    }

    // Erratic fly steering: every so often pick a new heading. X stays leftward
    // (varied speed) so it never backtracks; Y darts up or down.
    this.retarget -= s;
    if (this.retarget <= 0) {
      this.retarget = c.flyRetargetMin + Math.random() * (c.flyRetargetMax - c.flyRetargetMin);
      this.vx = -c.flySpeed * (0.45 + Math.random());          // -0.45x … -1.45x, always left
      const dir = Math.random() < 0.5 ? -1 : 1;
      this.vy = dir * c.flyVSpeed * (0.55 + 0.45 * Math.random());
    }

    // Knockback: a shove away from the gun (which fires rightward), decaying
    // linearly across the hurt window. Derived from hurtT rather than stored, so
    // it can never outlive the window or get out of step with the blink.
    const knock = this.hurtT > 0
      ? c.flyKnockback * (this.hurtT / Math.max(1, c.flyHurtMs))
      : 0;

    this.x += (this.vx + knock) * s;
    this.y += this.vy * s;

    // Wrap X (circle the dungeon); bounce off the world's top/bottom.
    if (worldW > 0) this.x = ((this.x % worldW) + worldW) % worldW;
    const m = 40;
    if (worldH > 0) {
      if (this.y < m) { this.y = m; this.vy = Math.abs(this.vy); }
      else if (this.y > worldH - m) { this.y = worldH - m; this.vy = -Math.abs(this.vy); }
    }

    // Tilt with the vertical heading: moving up → clockwise, down → CCW (canvas
    // rotate is clockwise for +angle). Eased so it banks smoothly, not snappy.
    const maxTilt = c.flyMaxTilt * Math.PI / 180;
    const targetAngle = -Math.max(-1, Math.min(1, this.vy / (c.flyVSpeed * 0.6))) * maxTilt;
    this.angle += (targetAngle - this.angle) * Math.min(1, s * c.flyTiltEase);
  }

  // Every frame is scaled by the SAME factor (derived from frame 0) so the
  // burst frames — drawn larger on the sheet — visibly expand as it comes apart.
  _scale() { return (this.cfg.GAME_H * this.cfg.flyScale) / this.cfg.FLY_RECTS[0][3]; }

  _screenY(camY) {
    const c = this.cfg;
    return this.y - camY + Math.sin(this.phase * c.flyWobbleFreq) * c.flyWobbleAmp;
  }

  // Screen-space collision boxes — one per wrap copy, so a fly straddling the
  // seam is still hittable. Sized from the live frame, shrunk by flyHitScale.
  boxes(camX, camY, worldW) {
    const c = this.cfg, r = c.FLY_RECTS[0], s = this._scale();
    const bw = r[2] * s * c.flyHitScale, bh = r[3] * s * c.flyHitScale;
    const sy = this._screenY(camY);
    const out = [];
    for (const off of [-worldW, 0, worldW]) {
      out.push({ x: (this.x + off) - camX - bw / 2, y: sy - bh / 2, w: bw, h: bh });
    }
    return out;
  }

  render(ctx, camX, camY, worldW) {
    if (this.state === 'dead') return;
    const c = this.cfg, s = this._scale();
    ctx.imageSmoothingEnabled = true;

    // Draw one sprite at world x `wxWorld`, across all three wrap copies
    // (off-screen ones are no-ops).
    const blit = (img, r, wxWorld, sy, angle, k) => {
      const m = k === undefined ? 1 : k;      // extra scale, for the impact puff
      const dw = r[2] * s * m, dh = r[3] * s * m;
      for (const wx of [wxWorld - worldW, wxWorld, wxWorld + worldW]) {
        ctx.save();
        ctx.translate(wx - camX, sy);
        if (angle) ctx.rotate(angle);
        ctx.drawImage(img, r[0], r[1], r[2], r[3], -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
      }
    };

    // Landed: a world-space body on the floor plane. Full camera offset and wrap
    // copies like anything else in the world — the pile belongs to the dungeon,
    // not the viewport. Same size wherever on the plane it lies (no perspective
    // shrink at the far edge); only the angle varies.
    if (this.state === 'landed') {
      const dead = this.assets.getDrawable('flyDead');
      if (dead) blit(dead, c.FLY_DEAD_RECT, this.restX, this.restY - camY, this.restRot);
      return;
    }

    if (this.state === 'alive') {
      const img = this.assets.getDrawable('fly');
      if (img) {
        // Blink through the hurt window so a non-lethal hit still reads as a
        // hit. Alpha rather than skipping the draw — a fly that vanishes for a
        // few frames looks like a glitch, one that flickers looks damaged.
        const blink = this.hurtT > 0
          && Math.floor(this.hurtT / c.flyHurtBlinkMs) % 2 === 0;
        if (blink) ctx.globalAlpha = c.flyHurtAlpha;
        blit(img, c.FLY_RECTS[0], this.x, this._screenY(camY), this.angle);
        if (blink) ctx.globalAlpha = 1;
      }
      this._blitHitFx(ctx, blit, camY);      // puff sits on top of the fly
      return;
    }

    // Dying: the burst and the arcing corpse can be on screen at the same time.
    const sheet = this.assets.getDrawable('fly');
    if (sheet && this.frame < c.FLY_RECTS.length) {
      blit(sheet, c.FLY_RECTS[this.frame], this.x, this._screenY(camY), this.angle);
    }
    const dead = this.assets.getDrawable('flyDead');
    if (dead && this.corpseActive) {
      // Corpse follows its own arc: no buzz, no bank.
      blit(dead, c.FLY_DEAD_RECT, this.corpseX, this.corpseY - camY, 0);
    }
  }

  // The impact puff: the death burst played verbatim — same frames, size and
  // rate — but pinned to where the shot connected rather than travelling with
  // the fly. No fade: the death burst doesn't fade either, it just ends.
  _blitHitFx(ctx, blit, camY) {
    const c = this.cfg, fx = this.hitFx;
    if (!fx) return;
    const sheet = this.assets.getDrawable('fly');
    if (!sheet) return;
    const i = Math.min(c.flyHitBurstFrames - 1, Math.floor(fx.t / c.flyHitBurstMs));
    const r = c.FLY_RECTS[1 + i];
    if (!r) return;
    blit(sheet, r, fx.x, fx.y - camY, 0, c.flyHitBurstScale);
  }
}
