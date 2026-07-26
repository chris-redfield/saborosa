/**
 * strike.js — one wave of the Time Boss's lightning (PORTABLE CORE).
 *
 * The boss describes the wave; the SHELL builds this, exactly as it builds the
 * orbs he throws and the coins the world is scattered with — so boss.js never
 * has to know this file exists. See Boss.takeStrike().
 *
 * A wave is N ARMS radiating from one point. Each arm is a whole bolt sprite
 * ROOTED at that point and running outward, rotated to its angle.
 *
 * ⚠️ AN ARM IS NOT A DIAMETER. The obvious reading of a full-width bolt is to
 * lay it across the origin with its middle in the middle, and it is wrong: a
 * bolt has a direction, so half of it then runs backwards and reads as
 * lightning arriving from off-screen and converging on him — the opposite of
 * him casting it. Four arms, each rooted, is what a cross is.
 *
 * ⚠️ THE ROOT IS THE SPRITE'S RIGHT EDGE, so every arm is drawn mirrored. This
 * cannot be derived from the art with any confidence — the ink-per-column
 * profile is thickest in the MIDDLE of the bolt and tapers both ways, and
 * reading the thinner right end as the tip gives you rays that meet tip-to-tip
 * in the centre. It was settled by looking at it in tools/boss-lightning.html.
 *
 * ⚠️ THE FRAMES ARE A LOOP, not a build-up. All four are distinct drawings of
 * the same bolt and they cycle for as long as the wave is on screen; the
 * growing branch count from 01 to 04 is the crackle, not a progression.
 *
 * COLLISION is a CHAIN OF SMALL BOXES along each arm rather than one rotated
 * rectangle. Everything else in this game collides with axis-aligned boxes
 * (see boxesOverlap in game.js) and a diagonal arm has no useful AABB — its
 * bounding box is a huge square covering everything between the arms as well
 * as the arm itself, which would hit a player standing in a gap. Small boxes
 * stepped along the arm approximate it at any angle, and reuse the one overlap
 * test the shell already has.
 *
 * Dependencies injected (assets store + config). No DOM, no globals.
 */
class Strike {
  constructor(assets, cfg, x, y, angles) {
    this.assets = assets;
    this.cfg = cfg;
    this.x = x;                 // WORLD coords — where the arms are rooted
    this.y = y;
    this.angles = angles || [];
    this.t = 0;
    // The crackle is seeded from the wave's own start rather than a shared
    // clock, so the two waves of one special do not open on the same frame.
    this.seed = Math.floor(Math.random() * cfg.BOSS_FIRE_SHEETS.length);
  }

  // Alive for exactly as long as it is drawn — the hitbox and the picture are
  // the same thing, which is the only way a player can be expected to read it.
  isDead() { return this.t >= this.cfg.bossSpecialHoldMs; }

  update(dt) { this.t += dt; }

  _frame() {
    const c = this.cfg, n = c.BOSS_FIRE_SHEETS.length;
    if (c.bossSpecialFrameMs <= 0) return 0;
    return (this.seed + Math.floor(this.t / c.bossSpecialFrameMs)) % n;
  }

  /* Screen-space boxes, one chain per arm per wrap copy.

     Boxes are spaced closer together than they are wide, so the chain overlaps
     itself and has no gaps a diagonal arm could slip a player through. */
  boxes(camX, camY, worldW) {
    const c = this.cfg;
    const th = c.bossSpecialHitPx;
    const len = c.bossSpecialArmPx;
    const step = th * 0.8;
    const n = Math.max(1, Math.ceil(len / step));
    const out = [];
    for (const off of [-worldW, 0, worldW]) {
      const ox = (this.x + off) - camX, oy = this.y - camY;
      for (const a of this.angles) {
        const rad = a * Math.PI / 180;
        const cx = Math.cos(rad), cy = Math.sin(rad);
        for (let i = 0; i <= n; i++) {
          const r = (i / n) * len;
          out.push({ x: ox + cx * r - th / 2, y: oy + cy * r - th / 2, w: th, h: th });
        }
      }
    }
    return out;
  }

  render(ctx, camX, camY, worldW) {
    const c = this.cfg;
    const sheet = this.assets.getDrawable('bossFire_' + this._frame());
    if (!sheet) return;
    // Scaled off the sheet's FULL width, not a measured box: the four frames'
    // own bounding boxes drift ~32px across and ~11px down, and honouring that
    // drift is what gives the bolt its instability. Re-centring them would
    // sand off the one thing that makes it look like lightning.
    const s = c.bossSpecialArmPx / sheet.width;
    const dw = sheet.width * s, dh = sheet.height * s;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    for (const off of [-worldW, 0, worldW]) {
      for (const a of this.angles) {
        ctx.save();
        ctx.translate((this.x + off) - camX, this.y - camY);
        ctx.rotate(a * Math.PI / 180);
        // Mirrored so the sprite's RIGHT edge lands on the origin: draw into
        // [-dw, 0] under a -1 x-scale and it occupies screen [0, dw] reversed.
        ctx.scale(-1, 1);
        ctx.drawImage(sheet, -dw, -dh / 2, dw, dh);
        ctx.restore();
      }
    }
    ctx.restore();
  }
}
