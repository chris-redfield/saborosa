/**
 * Flies — the vermin crossing the sky behind the fight.
 *
 * STILL LIFE's fly, borrowed. That game's src/fly.js is 430 lines because every
 * one of its flies is a TARGET (health, i-frames, knockback, a burst, a corpse
 * that lands on a pile) and a REWINDABLE one at that (a memory of every heading
 * it has flown, a snapshot of the instant it died). None of that exists here:
 * this game has no gun and no clock, so what was worth carrying across is the
 * STEERING, which is the part that makes a fly look like a fly.
 *
 * ⚠️ THEY ARE SCENERY. Nothing here touches the fight -- no hitbox, no z, no
 * shadow, no entry in the crowd, nothing in `stats`, and no way for the player
 * to reach them. They fly in the band ABOVE `beltTopY`, which is exactly the
 * part of the shot the belt never reaches, and `CONFIG.FLIES.bottomY` is kept
 * well clear of that line so one is never seen grazing the back wall.
 *
 * THE MOTION, in one paragraph: a fly holds a heading for a fraction of a
 * second and then picks another. The horizontal component is ALWAYS leftward
 * (re-rolled between 0.55x and 1.45x of `speed`), so it can never double back
 * -- the erratic part is the vertical dart, which flips sign freely. On top of
 * that sits a fast micro-buzz in y, and the sprite banks into whichever way it
 * is climbing or diving. It bounces off the top and bottom of its band.
 *
 * WORLD X, SCREEN Y. x is the same axis the fighters and the plate use, at
 * parallax 1.0, so a fly stays where it is in the street while the camera
 * travels past it. y is screen space, because the band is defined against the
 * canvas -- there is no "up" in world coords in this game, only `beltTopY`.
 *
 * RECYCLING RATHER THAN WRAPPING. Reach the left margin and a fly is moved to
 * just past the right one at a fresh height -- so they read as a procession
 * crossing the shot, always in the same direction, rather than as a few fixed
 * paths on a loop. The margins are wide enough that the swap is always
 * off-camera.
 *
 * ⚠️ `CONFIG.FLIES.count` IS A POPULATION, NOT A RATE. The recycle happens on
 * the same frame the fly leaves, so that many are in the band at ALL times and
 * no gap ever opens. Turning it down does not make flies rarer, it makes the
 * sky emptier by one; a real "one every N seconds" would need a fly to WAIT
 * off-camera before re-entering, and nothing here does that.
 */
class Flies {
  constructor(assets) {
    this.assets = assets;
    this.list = [];
    this.on = false;       // does the CURRENT room want them
  }

  cfg() { return CONFIG.FLIES || {}; }

  /**
   * Lay out a room's flies. `room` is a CONFIG.ROOMS entry; `camX` is where the
   * camera has just been put, which is what the initial spread is measured
   * against.
   *
   * ⚠️ THE SPREAD IS THE WHOLE ARRIVAL. Releasing them all from the right margin
   * makes them enter in file, which reads as a spawn; scattering them across the
   * view reads as a place that already had flies in it. The room starts with
   * them mid-crossing and nobody ever sees the first one arrive.
   */
  enterRoom(room, camX) {
    const c = this.cfg();
    this.list = [];
    this.on = !!(c.on && room && room.flies);
    if (!this.on) return;
    const x0 = camX || 0;
    for (let i = 0; i < (c.count || 0); i++) {
      /* Spread across the view plus one right margin, so one of them is
         typically just off-camera and due in. Evenly spaced with a jitter --
         flies at an exact fraction of the screen apart is a pattern the eye
         finds immediately. */
      const span = CONFIG.GAME_W + (c.marginPx || 0);
      const x = x0 - (c.marginPx || 0) + span * ((i + Math.random() * 0.8) / (c.count || 1));
      this.list.push(this._make(x));
    }
  }

  clear() { this.list = []; this.on = false; }

  /** One fly, at world x, with everything about it rolled fresh. */
  _make(x) {
    const c = this.cfg();
    const f = {
      x: x,
      y: this._rollY(),
      vx: 0, vy: 0,
      retarget: 0,
      angle: 0,
      // Desync the buzz per fly, or they all flutter in step.
      phase: Math.random() * Math.PI * 2,
      /* Size is rolled ONCE and kept. It is the only depth cue they have --
         there is no z up there and no parallax to separate them from the plate
         -- so without it they read as one sprite drawn twice. */
      size: (c.sizePx || 30) * (1 + (Math.random() * 2 - 1) * (c.sizeJitter || 0)),
    };
    this._retarget(f);
    return f;
  }

  _rollY() {
    const c = this.cfg();
    const top = c.topY || 0, bot = c.bottomY || 0;
    return top + Math.random() * Math.max(0, bot - top);
  }

  /** Pick the next heading. x is always leftward; y is a free dart. */
  _retarget(f) {
    const c = this.cfg();
    const lo = c.retargetMin || 0.25, hi = c.retargetMax || 0.9;
    f.retarget = lo + Math.random() * Math.max(0, hi - lo);
    f.vx = -(c.speed || 120) * (0.55 + Math.random());       // -0.55x .. -1.55x
    f.vy = (Math.random() < 0.5 ? -1 : 1) * (c.vSpeed || 160) * (0.55 + 0.45 * Math.random());
  }

  update(dt, camX) {
    if (!this.on) return;
    const c = this.cfg();
    const margin = c.marginPx || 120;
    const top = c.topY || 0, bot = c.bottomY || 0;
    const maxTilt = (c.maxTilt || 0) * Math.PI / 180;

    for (const f of this.list) {
      f.phase += dt;
      f.retarget -= dt;
      if (f.retarget <= 0) this._retarget(f);

      f.x += f.vx * dt;
      f.y += f.vy * dt;

      // Bounce off the band. The band IS the request -- a fly that drifted out
      // of the top would be gone, one that drifted out of the bottom would be
      // in the fight.
      if (f.y < top)      { f.y = top; f.vy = Math.abs(f.vy); }
      else if (f.y > bot) { f.y = bot; f.vy = -Math.abs(f.vy); }

      /* Off the left edge: put it back at the right one, at a new height, with
         a new heading and a new buzz. Everything about it is re-rolled EXCEPT
         its size, which is what makes a given fly stay the same fly.

         ⚠️ THE TEST IS AGAINST THE SCREEN, NOT AGAINST A WORLD NUMBER. The
         camera travels several thousand px across the street, so a fixed world
         bound would recycle every fly at the same place in the level. */
      const sx = f.x - camX;
      if (sx < -margin) {
        f.x = camX + CONFIG.GAME_W + margin;
        f.y = this._rollY();
        f.phase = Math.random() * Math.PI * 2;
        this._retarget(f);
      } else if (sx > CONFIG.GAME_W + margin * 2) {
        /* THE OTHER WAY ROUND CAN HAPPEN TOO, and it is not a fly flying
           backwards -- it is the CAMERA moving left out from under one (the
           boss room pans both ways, and a future room might). Left alone the
           fly would sit off-camera for the rest of the level. Pulled back to
           the right margin, it simply crosses again. */
        f.x = camX + CONFIG.GAME_W + margin;
      }

      // Bank into the climb or the dive. Eased, so it rolls rather than snaps.
      const target = -Math.max(-1, Math.min(1, f.vy / ((c.vSpeed || 160) * 0.6))) * maxTilt;
      f.angle += (target - f.angle) * Math.min(1, dt * (c.tiltEase || 9));
    }
  }

  draw(ctx, camX) {
    if (!this.on || !this.list.length) return;
    const c = this.cfg();
    const img = this.assets.getDrawable('fly');
    const r = c.RECT;
    if (!img || !r) return;

    ctx.save();
    ctx.globalAlpha = c.alpha == null ? 1 : c.alpha;
    for (const f of this.list) {
      // Every frame is scaled off the source rect's HEIGHT, so `sizePx` is
      // literally the drawn height of the fly and the aspect follows the art.
      const s = f.size / r[3];
      const w = r[2] * s, h = r[3] * s;
      // The micro-buzz rides on top of the wander, in draw rather than in the
      // simulation: it is a jitter, not a heading, and folding it into y would
      // make the bounce test chatter at the edges of the band.
      const y = f.y + Math.sin(f.phase * (c.wobbleFreq || 13)) * (c.wobbleAmp || 0);
      ctx.save();
      ctx.translate(f.x - camX, y);
      if (f.angle) ctx.rotate(f.angle);
      ctx.drawImage(img, r[0], r[1], r[2], r[3], -w / 2, -h / 2, w, h);
      ctx.restore();
    }
    ctx.restore();
  }
}
