/**
 * FlyBoss — the Mosca Boss (PORTABLE CORE).
 *
 * Turns up when the LAST FLY IS DEAD. Where the Time Boss is what abusing the
 * rewind earns you, this one is what clearing the room earns you: the swarm was
 * only ever three of them, and killing all three brings out the thing they came
 * from.
 *
 * THE SHEET IS A TURN, NOT A WALK CYCLE — the same shape the Time Boss's is, and
 * read the same way: 7 poses sweeping profile-left (0) through head-on (3) to
 * profile-right (6), with the widths giving it away (253px in profile, 176px
 * face-on, symmetric about the middle). So `facing` is a continuous 0..1 and the
 * pose is just that value quantised.
 *
 * ⚠️ BUT FACING IS *NOT* VELOCITY HERE. That coupling is the Time Boss's whole
 * character — he can only move as fast as he is turned — and it would be wrong
 * for a fly, which goes where it likes at whatever angle it likes. Here facing
 * is just where it is looking, and the entrance drives it explicitly.
 *
 * THE FLAP IS ACROSS FILES, not across the sheet: a pose holds its column while
 * the sheet underneath it cycles. Three were delivered; 01 and 03 are
 * byte-identical, so only two are loaded and MOSCA_CYCLE ([0,1,0]) reproduces the
 * delivered A-B-A exactly — including the double-length A at the loop seam.
 *
 * THE ENTRANCE IS A CUTSCENE, in three beats:
 *
 *   CHARGE  — in from off the RIGHT at the player's own height, straight across
 *             at full speed, and out the far side. It is aimed at where they
 *             were when it appeared and never corrects: this is a fly-past, not
 *             an attack.
 *   DESCEND — reappears at the TOP of the map, above the world entirely, and
 *             comes down the middle, turning to face the camera as it falls.
 *   STALK   — it reaches the centre of the map and comes straight for the player,
 *             with no pause: arriving IS the start of the fight. `arrived()`
 *             goes true, the shell puts the health bar up, it becomes shootable,
 *             and it starts hurting on contact.
 *
 * It cannot be hurt and cannot hurt anyone until it has arrived. Shooting a boss
 * whose bar is not up yet would be damage the player cannot see land, and being
 * killed by a cutscene is worse. All four hang off the one `arrived()`, so they
 * cannot come on at different moments.
 *
 * THE STALK IS THE ATTACK. It has no projectile and no special: it simply closes,
 * and touching it costs the player a third of their life. That only works
 * because flyBossStalkSpeed is about HALF the plane's own — it can always be
 * outrun, so contact is a mistake rather than an inevitability. See the config
 * note; that ratio is the whole difficulty of the fight.
 *
 * ⚠️ The charge is timed by DISTANCE TRAVELLED, not by testing its position
 * against the edge of the screen. The world wraps on X, so a position test would
 * have to be wrap-aware — and would still be wrong the moment the player moved
 * the camera mid-charge. Distance is neither.
 *
 * Dependencies injected (assets store + config). No DOM, no globals.
 */
class FlyBoss {
  /* `view` is the camera window at the moment it appears: {camX, camY, w, h}.
     The entrance is described in terms of the SCREEN ("in from the right", "out
     the other side"), so it genuinely needs to know where the screen is — but
     only once, here, and never again. */
  constructor(assets, cfg, view, target, worldW, worldH) {
    this.assets = assets;
    this.cfg = cfg;

    this.phase = 'charge';
    this.worldW = worldW;
    this.worldH = worldH;
    // In from off the right edge, at the player's own height — it comes for you
    // specifically, rather than crossing at some arbitrary altitude.
    this.x = view.camX + view.w + cfg.flyBossEnterMargin;
    this.y = target ? target.y : view.camY + view.h * 0.5;
    this.facing = 0;            // profile-left: it enters already flying left
    this.travelled = 0;
    // Far enough to cross the whole view and clear the far margin.
    this.chargeDist = view.w + cfg.flyBossEnterMargin * 2;

    this.bobPhase = Math.random() * Math.PI * 2;
    this.flapT = 0;

    this.state = 'alive';       // 'alive' → 'dying' (blast playing) → 'dead'
    this.hp = cfg.flyBossHealth;
    this.hurtT = 0;
    this.spasmT = -1;
    this.hitFx = null;
    this.boomT = Infinity;      // no arrival blast — it flies in, it doesn't pop
    this.boomX = 0;
    this.boomY = 0;
  }

  // Has the entrance finished? EVERYTHING that makes it a boss hangs off this
  // single test — the health bar, being shootable, and hurting on contact — so
  // none of them can come on at a different moment from the others.
  arrived() { return this.phase === 'stalk'; }
  isShootable() { return this.state === 'alive' && this.arrived(); }
  isDead() { return this.state === 'dead'; }

  _booming() {
    return this.boomT < this.cfg.BOOM_RECTS.length * this.cfg.boomMs;
  }

  _bob() {
    const c = this.cfg;
    return Math.sin(this.bobPhase * c.flyBossBobFreq)
         * Math.max(c.flyBossBobMin, c.flyBossSizePx * c.flyBossBobRel);
  }

  // Ease `facing` toward a target at the rate that crosses the full
  // profile-to-profile sweep in flyBossTurnMs — same easing the Time Boss uses.
  _turnToward(want, dt) {
    const c = this.cfg;
    if (c.flyBossTurnMs <= 0) { this.facing = want; return; }
    const step = dt / c.flyBossTurnMs;
    this.facing = want > this.facing
      ? Math.min(want, this.facing + step)
      : Math.max(want, this.facing - step);
  }

  // Signed distance to a world X the SHORT way round the wrap. Without this a
  // player just over the seam reads as most of a world away, and it would set
  // off stalking in the wrong direction. Same guard the Time Boss needs.
  _dx(targetX, worldW) {
    let d = targetX - this.x;
    if (worldW > 0) {
      const half = worldW / 2;
      if (d > half) d -= worldW;
      else if (d < -half) d += worldW;
    }
    return d;
  }

  // `target` is the player's WORLD point, or null if there isn't one.
  update(dt, worldW, worldH, target) {
    const c = this.cfg, s = dt / 1000;
    this.worldW = worldW; this.worldH = worldH;
    this.bobPhase += s;
    this.flapT += dt;
    if (this._booming()) this.boomT += dt;

    if (this.state === 'dying') {
      if (!this._booming()) this.state = 'dead';
      return;
    }

    if (this.hurtT > 0) this.hurtT = Math.max(0, this.hurtT - dt);
    if (this.spasmT >= 0) {
      this.spasmT += dt;
      if (this.spasmT >= c.flyBossSpasmMs) this.spasmT = -1;
    }
    if (this.hitFx) {
      this.hitFx.t += dt;
      if (this.hitFx.t >= c.coinHitFxFrames * c.coinHitFxMs) this.hitFx = null;
    }

    if (this.phase === 'charge') {
      const d = c.flyBossChargeSpeed * s;
      this.x -= d;
      this.travelled += d;
      if (this.travelled >= this.chargeDist) {
        // Beat two. It is off-screen either way, so moving it to the top of the
        // map is a cut, not a teleport the player can see.
        this.phase = 'descend';
        this.x = worldW * c.flyBossHomeXRel;
        this.y = -c.flyBossSizePx;
      }
    } else if (this.phase === 'descend') {
      // Turning to face the camera as it falls, so it is already looking at the
      // player by the time it stops.
      this._turnToward(0.5, dt);
      const home = worldH * c.flyBossHomeYRel;
      this.y = Math.min(home, this.y + c.flyBossDescendSpeed * s);
      // No pause at the centre: reaching it IS the start of the fight.
      if (this.y >= home) { this.y = home; this.phase = 'stalk'; }
    } else if (target) {
      /* STALKING. Straight at the player on both axes at one speed — a fly has
         no reason to be quicker sideways than up.

         Facing is only where it is LOOKING (see the header — it is not velocity
         here), so it turns to the side the player is on while travelling
         whatever way it likes. It keeps closing through the turn.

         ⚠️ THE STEP IS CLAMPED TO THE DISTANCE REMAINING, and that is what
         replaces the Time Boss's stand-off. Without it the boss overshoots the
         player by a fraction of a frame, dx flips sign underneath it, and it
         shudders on the spot instead of looming. A stand-off would fix that too
         — but a stand-off would also hold it just clear of the player, and
         touching the player is this boss's entire attack. Clamping settles it
         ON them instead, and the plane's own i-frames rate-limit what that
         costs. */
      const dx = this._dx(target.x, worldW), dy = target.y - this.y;
      this._turnToward(dx < 0 ? 0 : 1, dt);
      const dist = Math.hypot(dx, dy);
      if (dist > 0.5) {
        const step = Math.min(c.flyBossStalkSpeed * s, dist);
        this.x += (dx / dist) * step;
        this.y += (dy / dist) * step;
      }
    }

    if (worldW > 0) this.x = ((this.x % worldW) + worldW) % worldW;
  }

  /* A shot connected. Rejected inside the i-frame window — the rate limit that
     everything damageable here needs, because the beam is re-tested EVERY frame
     and an ungated bar drains in as many frames as it has points.

     `atY` is the world height the beam crossed it at, so the puff lands where
     the shot did rather than always in the middle of it. X stays on its centre;
     the puff belongs on the fly, not on its leading edge. */
  hit(dmg, atY) {
    if (!this.isShootable() || this.hurtT > 0) return false;
    this.hp -= (dmg === undefined ? 1 : dmg);
    if (this.hp <= 0) this._die();
    else {
      this.hurtT = this.cfg.flyBossHurtMs;
      this.spasmT = 0;
      this.hitFx = {
        x: this.x,
        y: (atY === undefined || atY === null) ? this.y + this._bob() : atY,
        t: 0,
      };
    }
    return true;
  }

  _die() {
    this.state = 'dying';
    this.hurtT = 0;
    this.spasmT = -1;
    this.hitFx = null;
    this.boomT = 0;
    this.boomX = this.x;
    this.boomY = this.y + this._bob();
  }

  // The jolt — the same damped oscillation the coin, the Time Boss and the HUD
  // timer use. Noise reads as a rendering fault; a decaying shake reads as a
  // flinch.
  _spasm() {
    const c = this.cfg;
    if (this.spasmT < 0 || c.flyBossSpasmMs <= 0) return null;
    const p = Math.min(1, this.spasmT / c.flyBossSpasmMs);
    const decay = 1 - p;
    const w = Math.sin(p * c.flyBossSpasmFreq) * decay;
    return {
      dx: w * c.flyBossSpasmAmp,
      dy: w * c.flyBossSpasmAmp * 0.4,
      k: 1 + c.flyBossSpasmScale * decay,
    };
  }

  pose() {
    const n = this.cfg.MOSCA_RECTS.length;
    return Math.max(0, Math.min(n - 1, Math.round(this.facing * (n - 1))));
  }

  // Which SHEET the flap is on. The pose picks the column; this picks the file.
  sheet() {
    const c = this.cfg, cyc = c.MOSCA_CYCLE;
    if (!cyc || !cyc.length || c.moscaFlapMs <= 0) return 0;
    return cyc[Math.floor(this.flapT / c.moscaFlapMs) % cyc.length];
  }

  /* Screen-space collision boxes, one per wrap copy. FIXED size rather than the
     current pose's silhouette, the same call the coin and the Time Boss make:
     the turn takes it from 253px in profile to 176px head-on, and a box that
     breathed with the animation would make it a harder target for no reason the
     player could see. Empty until it has arrived — the entrance is untouchable. */
  boxes(camX, camY, worldW) {
    const c = this.cfg;
    if (!this.isShootable()) return [];
    const w = c.flyBossSizePx * c.flyBossHitWRel;
    const h = c.flyBossSizePx * c.flyBossHitHRel;
    const sy = this.y - camY + this._bob();
    const out = [];
    for (const off of [-worldW, 0, worldW])
      out.push({ x: (this.x + off) - camX - w / 2, y: sy - h / 2, w, h });
    return out;
  }

  render(ctx, camX, camY, worldW) {
    const c = this.cfg;
    if (this.state !== 'alive') return;        // gone the instant it dies
    const sheet = this.assets.getDrawable('mosca_' + this.sheet());
    if (!sheet) return;
    const r = c.MOSCA_RECTS[this.pose()];
    if (!r) return;

    // One scale for every pose, off the shared reference height, so it does not
    // pulse in size as it turns. The jolt's `k` rides on top.
    const j = this._spasm();
    const s = (c.flyBossSizePx / c.MOSCA_REF_H) * (j ? j.k : 1);
    const dw = r[2] * s, dh = r[3] * s;
    const sy = this.y - camY + this._bob() + (j ? j.dy : 0);
    const jx = j ? j.dx : 0;

    ctx.imageSmoothingEnabled = true;
    for (const wx of [this.x - worldW, this.x, this.x + worldW]) {
      ctx.save();
      // Centred both ways: every pose shares one y band on the sheet, so there
      // is no per-pose offset to respect and nothing gains height as it turns.
      ctx.translate(wx - camX + jx, sy);
      ctx.drawImage(sheet, r[0], r[1], r[2], r[3], -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    }
  }

  // The fly's own burst frames as an impact puff — the same reach-across the
  // coin and the Time Boss make, which is doubly apt here.
  renderHitFx(ctx, camX, camY, worldW) {
    const c = this.cfg, fx = this.hitFx;
    if (!fx) return;
    const sheet = this.assets.getDrawable('fly');
    if (!sheet) return;
    const i = Math.min(c.coinHitFxFrames - 1, Math.floor(fx.t / c.coinHitFxMs));
    const r = c.FLY_RECTS[1 + i];              // 0 is the live fly; 1..4 burst
    if (!r) return;
    let widest = 1;
    for (let k = 1; k < c.FLY_RECTS.length; k++)
      if (c.FLY_RECTS[k][2] > widest) widest = c.FLY_RECTS[k][2];
    const s = (c.flyBossSizePx * c.flyBossHitFxSize) / widest;
    const dw = r[2] * s, dh = r[3] * s;

    ctx.imageSmoothingEnabled = true;
    for (const wx of [fx.x - worldW, fx.x, fx.x + worldW])
      ctx.drawImage(sheet, r[0], r[1], r[2], r[3],
                    wx - camX - dw / 2, fx.y - camY - dh / 2, dw, dh);
  }

  // The death blast, in the shell's over-everything pass. Same twelve frames and
  // same boomMs the coins and the Time Boss use — the rate belongs to the
  // explosion, not to whatever exploded. Frozen where it died.
  renderBurst(ctx, camX, camY, worldW) {
    if (!this._booming()) return;
    const c = this.cfg, rects = c.BOOM_RECTS;
    const r = rects[Math.min(rects.length - 1, Math.floor(this.boomT / c.boomMs))];
    if (!r) return;
    const sheet = this.assets.getDrawable('boom');
    if (!sheet) return;

    let widest = 1;
    for (const f of rects) if (f[2] > widest) widest = f[2];
    const s = (c.flyBossSizePx * c.flyBossBoomSize) / widest;
    const dw = r[2] * s, dh = r[3] * s;

    ctx.imageSmoothingEnabled = true;
    for (const wx of [this.boomX - worldW, this.boomX, this.boomX + worldW]) {
      ctx.save();
      ctx.translate(wx - camX, this.boomY - camY);
      ctx.drawImage(sheet, r[0], r[1], r[2], r[3], -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    }
  }
}
