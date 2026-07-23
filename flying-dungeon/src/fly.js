/**
 * Fly — a single enemy insect (PORTABLE CORE, first pass).
 *
 * Lives in the tray's WORLD space (the larger plane the camera pans), so it
 * stays put in the dungeon while the player/camera moves — it is NOT glued to
 * the screen. Its X WRAPS at the world width: reach the far edge and it circles
 * back to the start, the same loop the tray makes around the fruit basket. For
 * now it cruises left (R-type style, entering from the right) drawing frame 0
 * of the sheet; the remaining frames are its burst/death animation for later.
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
  }

  update(dt, worldW, worldH) {
    const c = this.cfg, s = dt / 1000;

    // Erratic fly steering: every so often pick a new heading. X stays leftward
    // (varied speed) so it never backtracks; Y darts up or down.
    this.retarget -= s;
    if (this.retarget <= 0) {
      this.retarget = c.flyRetargetMin + Math.random() * (c.flyRetargetMax - c.flyRetargetMin);
      this.vx = -c.flySpeed * (0.45 + Math.random());          // -0.45x … -1.45x, always left
      // Commit to a real up/down dart (magnitude 0.55…1.0 of flyVSpeed).
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

    this.phase += s;
  }

  // camX/camY are the camera's world offset (as the background uses); worldW is
  // the wrap width, so we draw the fly on both sides of the seam seamlessly.
  render(ctx, camX, camY, worldW) {
    const img = this.assets.getDrawable('fly');
    if (!img) return;
    const c = this.cfg;
    const [rx, ry, rw, rh] = c.FLY_RECTS[0];          // frame 0 (live fly)
    const s = (c.GAME_H * c.flyScale) / rh;
    const dw = rw * s, dh = rh * s;
    const wob = Math.sin(this.phase * c.flyWobbleFreq) * c.flyWobbleAmp;
    const sy = this.y - camY + wob;

    ctx.imageSmoothingEnabled = true;
    const draw = (wx) => {
      ctx.save();
      ctx.translate(wx - camX, sy);
      ctx.rotate(this.angle);
      ctx.drawImage(img, rx, ry, rw, rh, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    };
    draw(this.x - worldW);   // wrapped copies (off-screen ones are no-ops)
    draw(this.x);
    draw(this.x + worldW);
  }
}
