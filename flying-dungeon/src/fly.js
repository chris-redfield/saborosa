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
 * States: 'alive' → shot → 'dying' → 'dead', removed for good (no respawn).
 * While 'dying' the sheet's frames 1-4 play the fly coming apart AND the dead
 * body drops away under gravity — the two overlap, timed by flyCorpseLead.
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
    this.state = 'alive';     // 'alive' | 'dying' | 'dead'
    this.frame = 0;           // index into FLY_RECTS (0 = live, 1-4 = burst)
    this.deathT = 0;          // ms since the hit
    this.corpseActive = false;
    this.corpseX = 0; this.corpseY = 0;
    this.corpseVx = 0; this.corpseVy = 0;
    this.deathVx = 0; this.deathVy = 0;   // velocity captured at the moment of the hit
  }

  isAlive() { return this.state === 'alive'; }
  isDead()  { return this.state === 'dead'; }

  // A shot connected: play the burst frames and drop the corpse (they overlap).
  hit() {
    if (this.state !== 'alive') return;
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
    if (this.state === 'dead') return;

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
        if (worldH > 0 && this.corpseY > worldH + 120) this.state = 'dead';
      }
      return;
    }

    this.phase += s;

    // Erratic fly steering: every so often pick a new heading. X stays leftward
    // (varied speed) so it never backtracks; Y darts up or down.
    this.retarget -= s;
    if (this.retarget <= 0) {
      this.retarget = c.flyRetargetMin + Math.random() * (c.flyRetargetMax - c.flyRetargetMin);
      this.vx = -c.flySpeed * (0.45 + Math.random());          // -0.45x … -1.45x, always left
      const dir = Math.random() < 0.5 ? -1 : 1;
      this.vy = dir * c.flyVSpeed * (0.55 + 0.45 * Math.random());
    }

    this.x += this.vx * s;
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
    const blit = (img, r, wxWorld, sy, angle) => {
      const dw = r[2] * s, dh = r[3] * s;
      for (const wx of [wxWorld - worldW, wxWorld, wxWorld + worldW]) {
        ctx.save();
        ctx.translate(wx - camX, sy);
        if (angle) ctx.rotate(angle);
        ctx.drawImage(img, r[0], r[1], r[2], r[3], -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
      }
    };

    if (this.state === 'alive') {
      const img = this.assets.getDrawable('fly');
      if (img) blit(img, c.FLY_RECTS[0], this.x, this._screenY(camY), this.angle);
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
}
