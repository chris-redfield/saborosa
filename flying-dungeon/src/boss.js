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
 * SHOOTABLE, and it shoots back. It takes bossHealth hits, each gated by an
 * i-frame window (bossHurtMs) — not optional, for the reason the coin's header
 * spells out: the beam is re-tested every frame, so an ungated bar drains in as
 * many frames as it has points. A connected hit jolts him and puffs at the
 * impact point; 0 HP erases him into the same explosion he arrived in.
 *
 * It throws ORBS (see orb.js) once alerted, and there are TWO STAGES:
 *
 *   STAGE 1 — as configured.
 *   STAGE 2 — under bossStage2At of his health he turns and travels
 *             bossStage2Speed faster. Thrown orbs used to come BACK here too;
 *             that boomerang did not play well and was removed. The throw itself
 *             is now the same in both stages.
 *
 * The boss does not construct orbs — takeThrow() hands the shell a description
 * of one and the shell builds it, the same way it builds the flies and coins.
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

    this.state = 'alive';       // 'alive' → 'dying' (blast playing) → 'dead'
    this.hp = cfg.bossHealth;
    this.hurtT = 0;             // ms left of the i-frame window
    this.spasmT = -1;           // ms into the jolt; <0 = not jolting
    this.hitFx = null;          // {x, y, t} — the fly's puff at the impact point
    // Throwing. Disarmed until he notices someone: -1 means "not counting".
    this.throwT = -1;

    /* THE SPECIAL. A small state machine of its own, on REAL time — the game
       clock is PAUSED for the whole of no-time mode, which is the only time
       this fight happens, so anything driven off it would never advance.

         null        stage 1: he does not have this yet
         'wait'      counting down to the next cast
         'telegraph' fists up, and the only warning the player gets
         'wave1'     the cross is out
         'gap'       between the two
         'wave2'     the X is out

       `specialT` is the countdown WITHIN the current phase, so one number
       serves all of them and there is no second clock to fall out of step. */
    this.specialPhase = null;
    this.specialT = 0;
    this._pendingStrike = null;   // the shell collects this via takeStrike()

    // Arrival blast — the same explosion a coin dies in, at the same rate
    // (boomMs belongs to the boom, not to the coin), just scaled to the boss.
    // Frozen at the SPAWN POINT rather than following: the boss walks out of
    // its own entrance, it does not drag it around.
    this.boomT = 0;
    this.boomX = x;
    this.boomY = y;
  }

  // Is the arrival blast still playing?
  _booming() {
    return this.boomT < this.cfg.BOOM_RECTS.length * this.cfg.boomMs;
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

  isShootable() { return this.state === 'alive'; }
  isDead() { return this.state === 'dead'; }   // shell drops it and wins the run

  /* Is he mid-special? Drives which SHEET he is drawn from — fists up from the
     moment the telegraph starts until the last wave clears, so the pose the
     player learns to fear is on screen for the whole of it and not just for
     the warning. */
  isCasting() {
    return this.specialPhase !== null && this.specialPhase !== 'wait';
  }

  /* One wave, once. The shell builds the Strike from this, the same way it
     builds an Orb from takeThrow() — so this file never has to know strike.js
     exists.

     The arms are rooted at his CENTRE including the bob, so the strike leaves
     him where he is actually drawn rather than where his logical y says. */
  takeStrike() {
    const s = this._pendingStrike;
    this._pendingStrike = null;
    return s;
  }

  // Roll the gap to the next cast. Salted per cast rather than fixed, so a
  // player cannot learn a metronome and simply be somewhere else on the beat.
  _rearmSpecial() {
    const c = this.cfg;
    const salt = (Math.random() * 2 - 1) * c.bossSpecialSaltMs;
    this.specialPhase = 'wait';
    this.specialT = Math.max(500, c.bossSpecialEveryMs + salt);
  }

  /* The special's clock. Real ms, and deliberately NOT gated on `alerted`:
     reaching stage 2 means the player has already put half his health into
     him, so there is nothing left to notice. */
  _updateSpecial(dt) {
    const c = this.cfg;
    if (this.state !== 'alive') return;

    // Stage 2 arrives the frame his health crosses bossStage2At, and the first
    // cast starts THEN — the special is how the fight announces it has changed,
    // so making the player wait 20 seconds for the first one would waste it.
    if (this.specialPhase === null) {
      if (this.stage() < 2 || this._booming()) return;
      this.specialPhase = 'telegraph';
      this.specialT = c.bossSpecialTelegraphMs;
      return;
    }

    this.specialT -= dt;
    if (this.specialT > 0) return;

    // Carry the overshoot into the next phase so a long frame cannot make the
    // whole sequence drift later and later.
    const over = -this.specialT;
    if (this.specialPhase === 'wait') {
      this.specialPhase = 'telegraph';
      this.specialT = c.bossSpecialTelegraphMs - over;
    } else if (this.specialPhase === 'telegraph') {
      this.specialPhase = 'wave1';
      this.specialT = c.bossSpecialHoldMs - over;
      this._fire(0);
    } else if (this.specialPhase === 'wave1') {
      this.specialPhase = 'gap';
      this.specialT = c.bossSpecialBetweenMs - over;
    } else if (this.specialPhase === 'gap') {
      this.specialPhase = 'wave2';
      this.specialT = c.bossSpecialHoldMs - over;
      this._fire(1);
    } else {
      this._rearmSpecial();
    }
  }

  _fire(waveIdx) {
    const c = this.cfg;
    const angles = c.bossSpecialWaves[waveIdx];
    if (!angles) return;
    this._pendingStrike = {
      x: this.x,
      y: this.y + this._bob(),
      angles: angles.slice(),
    };
  }

  /* 1 or 2. Derived from health rather than latched, so there is no stage flag
     to get out of step with the bar it is read from. Nothing here recovers
     health, so it cannot flap back either. */
  stage() {
    return this.hp <= this.cfg.bossHealth * this.cfg.bossStage2At ? 2 : 1;
  }

  // Everything the stage speeds up, in one place, so the turn and the travel
  // can never be wound up by different amounts (bossTurnMs also SETS the speed
  // ramp — see the header — so they have to move together).
  _rush() { return this.stage() === 2 ? this.cfg.bossStage2Speed : 1; }

  /* A shot connected. Returns false inside the i-frame window — that rejection
     IS the rate limit that stops the every-frame beam stripping the whole bar
     in bossHealth consecutive frames. */
  hit(dmg, atY) {
    if (this.state !== 'alive' || this.hurtT > 0) return false;
    /* ⚠️ BEING SHOT ALERTS HIM, and leaving this out made the fight a joke.
       bossSeeRange is 420 world px; the hitscan beam runs from the nose to the
       edge of the screen, which is over a thousand. So a player standing off
       could empty the whole bar into a boss that had not noticed them — and
       because FACING IS VELOCITY, an unalerted boss sits front-on and therefore
       perfectly still. A stationary target that never breaks your line and never
       throws anything is 100% beam uptime and no fight at all.

       Arming the first throw here as well as in update() is what stops him
       answering the opening shot instantly. */
    if (!this.alerted) {
      this.alerted = true;
      this.throwT = this.cfg.orbFirstMs;
    }
    this.hp -= (dmg === undefined ? 1 : dmg);
    if (this.hp <= 0) this._die();
    else {
      this.hurtT = this.cfg.bossHurtMs;
      this.spasmT = 0;
      /* ⚠️ Y ONLY. `atY` is the world height the beam actually crossed him at,
         handed in by the shell because only the shell knows where the shot was.
         He is 213px of hitbox tall, so a puff pinned to his centre showed the
         impact in one fixed place however high or low the player was aiming,
         which reads as decoration rather than as a hit.

         X stays on his CENTRE and is deliberately not taken from the shot. It
         was tried the other way — anchored to where the beam enters his box —
         and it is not wanted: the puff belongs on him, not on his leading edge.
         Falls back to his centre entirely if no height is given, so hit() still
         works for a caller with nothing to say about it.

         Pinned where it lands and not tracking him afterwards: he is about to
         flinch, and a puff dragged along with him would read as part of the boss
         instead of as the moment of impact. Same call the coin makes. */
      this.hitFx = {
        x: this.x,
        y: (atY === undefined || atY === null) ? this.y + this._bob() : atY,
        t: 0,
      };
    }
    return true;
  }

  /* Erased into the same explosion he arrived in — boomT is simply re-armed, so
     the entrance and the death are one piece of code and one rate. Re-anchored
     to where he is NOW, not to where he came in. */
  _die() {
    this.state = 'dying';
    this.hurtT = 0;
    this.spasmT = -1;
    this.hitFx = null;
    this.boomT = 0;
    this.boomX = this.x;
    this.boomY = this.y + this._bob();
  }

  /* The jolt: a decaying oscillation, not random jitter — noise reads as a
     rendering fault, a damped shake reads as a flinch. Same shape as the coin's
     and the HUD timer's, at a much smaller relative amplitude: a thing this
     size should barely move. Returns {dx, dy, k}. */
  _spasm() {
    const c = this.cfg;
    if (this.spasmT < 0 || c.bossSpasmMs <= 0) return null;
    const p = Math.min(1, this.spasmT / c.bossSpasmMs);
    const decay = 1 - p;
    const w = Math.sin(p * c.bossSpasmFreq) * decay;
    return {
      dx: w * c.bossSpasmAmp,
      dy: w * c.bossSpasmAmp * 0.4,   // mostly sideways: he was shot from the side
      k: 1 + c.bossSpasmScale * decay,
    };
  }

  /* Screen-space collision boxes, one per wrap copy. FIXED size, deliberately
     not the current frame's silhouette: the turn takes him from 120px in
     profile to 269px face-on, so a box that breathed with the animation would
     make him a harder target exactly as he set off after the player. The jolt is
     left out of it too — a hitbox that shook with the art would be dodging the
     shot that is hitting it. */
  boxes(camX, camY, worldW) {
    const c = this.cfg;
    if (this.state !== 'alive') return [];
    const w = c.bossSizePx * c.bossHitWRel, h = c.bossSizePx * c.bossHitHRel;
    const sy = this.y - camY + this._bob();
    const out = [];
    for (const off of [-worldW, 0, worldW])
      out.push({ x: (this.x + off) - camX - w / 2, y: sy - h / 2, w, h });
    return out;
  }

  /* Is there an orb to throw this frame? Returns a DESCRIPTION of one — the
     shell builds it, the same way it builds the flies and the coins, so this
     file stays free of orb.js.

     Aimed at where the player is at the instant of release and never corrected
     afterwards: the orb is dodgeable by moving, which is the whole fight. The
     throw direction is wrap-aware for the same reason the stalk is — a player
     just over the seam would otherwise be thrown at the long way round. */
  takeThrow(worldW, target) {
    const c = this.cfg;
    if (this.state !== 'alive' || !this.alerted || !target) return null;
    // Not while he is still arriving — a throw from inside his own fireball is
    // a hit nobody could have seen coming.
    if (this._booming() || this.throwT > 0) return null;
    this.throwT = c.orbEveryMs;

    const bob = this._bob();
    let dx = this._dx(target.x, worldW), dy = target.y - (this.y + bob);
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    // Released CLOSE TO HIM, along the throw. It inflates out of nothing there
    // (frame 0 is the smallest), so you see him produce it.
    const r = c.bossSizePx * c.orbSpawnRel;
    return {
      x: this.x + dx * r,
      y: this.y + bob + dy * r,
      dx, dy,
    };
  }

  // `target` is the player's WORLD point, or null if there isn't one yet.
  update(dt, worldW, worldH, target) {
    const c = this.cfg, s = dt / 1000;
    this.phase += s;
    if (this._booming()) this.boomT += dt;
    // Once the death blast has burnt out he is gone for good; the shell splices
    // him and hands the run its time back.
    if (this.state === 'dying') {
      if (!this._booming()) this.state = 'dead';
      return;
    }

    if (this.hurtT > 0) this.hurtT = Math.max(0, this.hurtT - dt);
    if (this.spasmT >= 0) {
      this.spasmT += dt;
      if (this.spasmT >= c.bossSpasmMs) this.spasmT = -1;
    }
    if (this.hitFx) {
      this.hitFx.t += dt;
      if (this.hitFx.t >= c.coinHitFxFrames * c.coinHitFxMs) this.hitFx = null;
    }

    let dx = 0, dy = 0, dist = Infinity;
    if (target) {
      dx = this._dx(target.x, worldW);
      dy = target.y - this.y;
      dist = Math.hypot(dx, dy);
    }
    if (!this.alerted && dist <= c.bossSeeRange) {
      this.alerted = true;
      // Arm the first throw with a grace beat, so noticing you and hitting you
      // are not the same instant.
      this.throwT = c.orbFirstMs;
    }
    if (this.throwT > 0) this.throwT = Math.max(0, this.throwT - dt);
    this._updateSpecial(dt);

    // Front while it hasn't noticed anyone; locked onto the player's side once
    // it has. Eased at a rate that crosses the full profile-to-profile sweep in
    // bossTurnMs, so retiming the turn is one number and the speed ramp that
    // comes with it follows automatically.
    const want = !this.alerted ? 0.5 : (dx < 0 ? 0 : 1);
    if (c.bossTurnMs > 0) {
      const step = dt * this._rush() / c.bossTurnMs;
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
      const speed = c.bossSpeed * this._rush();
      if (Math.abs(dx) > c.bossStopRange) this.x += speed * this._drive() * s;
      // Vertical runs at the SAME bossSpeed, deliberately sharing the one knob
      // rather than owning a second that could drift away from it. Not scaled
      // by _drive() though: the turn is a horizontal thing, so the boss keeps
      // closing on the player's altitude even while it is swinging through
      // front-on and going nowhere sideways.
      if (Math.abs(dy) > c.bossStopRange * 0.5) {
        this.y += (dy < 0 ? -1 : 1) * speed * s;
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
    if (this.state !== 'alive') return;         // gone the instant he dies
    // Fists up for the whole special. The golpe sheet is the SAME 7 poses, so
    // it swaps in against BOSS_RECTS with no second rect table and no change to
    // anything below — measured, its poses sit within a few px of the
    // originals and share the same top and heights.
    const sheet = this.assets.getDrawable(this.isCasting() ? 'bossGolpe' : 'boss');
    if (!sheet) return;
    const r = c.BOSS_RECTS[this.frame()];
    if (!r) return;

    // One scale for every frame, off the reference height, so the boss does not
    // pulse in size as it turns. The jolt's `k` rides on top of that, which is
    // why it multiplies here rather than being folded into bossSizePx.
    const j = this._spasm();
    const s = (c.bossSizePx / c.BOSS_REF_H) * (j ? j.k : 1);
    const dw = r[2] * s, dh = r[3] * s;
    const sy = this.y - camY + this._bob() + (j ? j.dy : 0);
    const jx = j ? j.dx : 0;

    ctx.imageSmoothingEnabled = true;
    // Wrap copies, like everything else living in world space.
    for (const wx of [this.x - worldW, this.x, this.x + worldW]) {
      ctx.save();
      // Centred on X, hung from the common top on Y.
      ctx.translate(wx - camX + jx, sy);
      ctx.drawImage(sheet, r[0], r[1], r[2], r[3],
                    -dw / 2, -c.bossSizePx / 2, dw, dh);
      ctx.restore();
    }
  }

  /* The impact puff for a non-lethal hit — literally the fly's burst frames
     (FLY_RECTS 1..4) at the fly's own rate, the same reach-across the coin
     makes, rather than a near-copy that could drift away from it. Scaled up to
     the boss but at the same px-per-source-px feel.

     Drawn with the boss rather than in the explosion pass: it is a hit ON him,
     so it belongs at his depth. */
  renderHitFx(ctx, camX, camY, worldW) {
    const c = this.cfg, fx = this.hitFx;
    if (!fx) return;
    const sheet = this.assets.getDrawable('fly');
    if (!sheet) return;
    const i = Math.min(c.coinHitFxFrames - 1, Math.floor(fx.t / c.coinHitFxMs));
    const r = c.FLY_RECTS[1 + i];               // 0 is the live fly; 1..4 burst
    if (!r) return;
    let widest = 1;
    for (let k = 1; k < c.FLY_RECTS.length; k++)
      if (c.FLY_RECTS[k][2] > widest) widest = c.FLY_RECTS[k][2];
    const s = (c.bossSizePx * c.bossHitFxSize) / widest;
    const dw = r[2] * s, dh = r[3] * s;

    ctx.imageSmoothingEnabled = true;
    for (const wx of [fx.x - worldW, fx.x, fx.x + worldW]) {
      ctx.drawImage(sheet, r[0], r[1], r[2], r[3],
                    wx - camX - dw / 2, fx.y - camY - dh / 2, dw, dh);
    }
  }

  /* The arrival blast, drawn in the same over-everything pass the coins' death
     explosions use — the shell calls this after the plane, so nothing can be in
     front of it. A no-op once it has played out.

     Identical logic to Coin's: one scale across all twelve frames, derived from
     the WIDEST so bossBoomSize means "how big the peak is", and the frames keep
     their relative sizes. */
  renderBurst(ctx, camX, camY, worldW) {
    if (!this._booming()) return;
    const c = this.cfg, rects = c.BOOM_RECTS;
    const r = rects[Math.min(rects.length - 1, Math.floor(this.boomT / c.boomMs))];
    if (!r) return;
    const sheet = this.assets.getDrawable('boom');
    if (!sheet) return;

    let widest = 1;
    for (const f of rects) if (f[2] > widest) widest = f[2];
    const s = (c.bossSizePx * c.bossBoomSize) / widest;
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
