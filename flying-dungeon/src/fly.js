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
 * States: 'alive' → shot → 'burst' (plays sheet frames 1-4, the fly coming
 * apart) → 'dead', removed for good (no respawn).
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
    this.state = 'alive';     // 'alive' | 'burst' | 'dead'
    this.frame = 0;           // index into FLY_RECTS (0 = live, 1-4 = burst)
    this.burstT = 0;
  }

  isAlive() { return this.state === 'alive'; }
  isDead()  { return this.state === 'dead'; }

  // A shot connected: play the burst frames from the sheet.
  hit() {
    if (this.state !== 'alive') return;
    this.state = 'burst';
    this.frame = 1;
    this.burstT = 0;
  }

  update(dt, worldW, worldH) {
    const c = this.cfg, s = dt / 1000;
    if (this.state === 'dead') return;
    this.phase += s;

    // Bursting: hold position and step through the death frames, then it's gone
    // for good (no respawn — kill them all and the dungeon stays clear).
    if (this.state === 'burst') {
      this.burstT += dt;
      while (this.burstT >= c.flyBurstMs) {
        this.burstT -= c.flyBurstMs;
        this.frame++;
        if (this.frame >= c.FLY_RECTS.length) { this.state = 'dead'; return; }
      }
      return;
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
    const img = this.assets.getDrawable('fly');
    if (!img) return;
    const c = this.cfg;
    const r = c.FLY_RECTS[this.frame] || c.FLY_RECTS[0];
    const s = this._scale();
    const dw = r[2] * s, dh = r[3] * s;
    const sy = this._screenY(camY);

    ctx.imageSmoothingEnabled = true;
    const draw = (wx) => {
      ctx.save();
      ctx.translate(wx - camX, sy);
      ctx.rotate(this.angle);
      ctx.drawImage(img, r[0], r[1], r[2], r[3], -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    };
    draw(this.x - worldW);   // wrapped copies (off-screen ones are no-ops)
    draw(this.x);
    draw(this.x + worldW);
  }
}
