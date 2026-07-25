/**
 * Orb — what the Time Boss throws (PORTABLE CORE).
 *
 * The art is the ROOT game's ambient FX sphere: the spiky ink ball from the
 * assets-003 pack, the same five-frame animation that pops in around the player
 * over there. tools/build-orb-frames.py cuts it onto a uniform grid, so frame k
 * is (k*ORB_CELL, 0, ORB_CELL, ORB_CELL) and there is no per-frame table here.
 *
 * THE ANIMATION IS THE THROW. Those five frames grow — 132px to 216px — and
 * they are CENTRED in their cells, so an orb that starts on frame 0 inflates out
 * of nothing at the point it was released. That is why it is spawned close to
 * the boss rather than on top of the player: you see him produce it. Once it has
 * reached full size it drops into a two-frame breath instead of ping-ponging all
 * the way back down, because shrinking to frame 0 mid-flight reads as the orb
 * vanishing rather than pulsing.
 *
 * IT FLIES STRAIGHT, at wherever the player WAS when it left his hand. No
 * homing: it is dodgeable by moving, which is the whole point. Miss it and it
 * sails past and expires.
 *
 * A returning variant was built and taken out again — under half health a thrown
 * orb used to curve back like a boomerang (two constant accelerations, one back
 * along the throw and one across it, which is a parabola by definition). It did
 * not play well and is gone. If something like it is ever wanted again, that is
 * the shape it had: it needs no waypoints and no curve fitting, only the two
 * numbers. What survives of stage 2 is the boss himself speeding up.
 *
 * The hitbox is FIXED at a fraction of the drawn size, not the frame's own
 * silhouette — the coin's lesson: the art pulses, and a box that pulsed with it
 * would be dodging the player several times a second.
 *
 * Dependencies injected (assets store + config). No DOM, no globals.
 */
class Orb {
  // `dx,dy` is the throw direction (need not be normalised — it is here).
  constructor(assets, cfg, x, y, dx, dy) {
    this.assets = assets;
    this.cfg = cfg;
    this.x = x;                 // WORLD coords, like everything else out here
    this.y = y;
    const len = Math.hypot(dx, dy) || 1;
    this.vx = (dx / len) * cfg.orbSpeed;
    this.vy = (dy / len) * cfg.orbSpeed;

    this.animT = 0;
    this.lifeT = 0;
    this.dead = false;
  }

  isDead() { return this.dead; }
  kill() { this.dead = true; }

  update(dt, worldW, worldH) {
    const c = this.cfg, s = dt / 1000;
    this.animT += dt;
    this.lifeT += dt;

    this.x += this.vx * s;
    this.y += this.vy * s;
    if (worldW > 0) this.x = ((this.x % worldW) + worldW) % worldW;
    // X wraps, Y does not — an orb thrown at a steep angle would otherwise
    // spend its whole life miles above the tray, still being stepped and drawn.
    if (worldH > 0 && (this.y < -c.orbSizePx || this.y > worldH + c.orbSizePx))
      this.dead = true;
    if (this.lifeT >= c.orbLifeMs) this.dead = true;
  }

  /* Release, then breathe. The first pass through the frames is the orb
     inflating out of the boss's hand; after that it alternates between the last
     two rather than running back down to frame 0, which would read as the orb
     shrinking away to nothing halfway to the player. */
  frame() {
    const c = this.cfg, n = c.ORB_FRAMES;
    if (c.orbHoldMs <= 0) return n - 1;
    const i = Math.floor(this.animT / c.orbHoldMs);
    return i < n ? i : (n - 2) + (i % 2);
  }

  // Screen-space collision boxes, one per wrap copy so an orb on the seam still
  // connects. Fixed size — see the header.
  boxes(camX, camY, worldW) {
    if (this.dead) return [];
    const d = this.cfg.orbSizePx * this.cfg.orbHitScale;
    const sy = this.y - camY;
    const out = [];
    for (const off of [-worldW, 0, worldW])
      out.push({ x: (this.x + off) - camX - d / 2, y: sy - d / 2, w: d, h: d });
    return out;
  }

  render(ctx, camX, camY, worldW) {
    if (this.dead) return;
    const c = this.cfg;
    const sheet = this.assets.getDrawable('orb');
    if (!sheet) return;
    const d = c.orbSizePx;                    // the whole CELL, at a fixed size:
    const sx = this.frame() * c.ORB_CELL;     // the ring grows INSIDE it, so the
    const sy = this.y - camY;                 // inflation costs no arithmetic

    ctx.imageSmoothingEnabled = true;
    for (const off of [-worldW, 0, worldW]) {
      ctx.drawImage(sheet, sx, 0, c.ORB_CELL, c.ORB_CELL,
                    (this.x + off) - camX - d / 2, sy - d / 2, d, d);
    }
  }
}
