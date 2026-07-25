/**
 * Plane — the player's aircraft (PORTABLE CORE).
 *
 * The 6 character frames are PITCH POSES, not a time loop: 1→3 dive, 4→6 climb,
 * frame 4 (index CH_REST) is level/rest. The pose ramps toward the held vertical
 * direction and eases back to rest — no idle animation. A gentle sine bob (same
 * as the loading letters) runs always. Holding fire loops a muzzle flash drawn
 * BEHIND the plane, nudged onto the nose and mirrored with the plane's facing.
 *
 * Screen position: X is pinned (horizontal input only turns/mirrors the plane
 * and drives the background); up/down slide Y.
 *
 * HEALTH IS THE CHARACTER'S FACE. There is no bar anywhere and there is not
 * going to be one: the player has planeHealth points and each one lost
 * DETERIORATES him a stage — he ages. The readout is the sprite, which is why
 * this lives in plane.js rather than in the HUD (and it had to: the HUD is
 * hidden in no-time mode, which is exactly when the boss fight happens).
 *
 * `wear` is a CONTINUOUS number rather than an integer counter, on purpose. A
 * hit adds exactly 1.0, which always crosses a stage boundary — so every hit is
 * guaranteed to change what the player looks like, which is the only feedback
 * there is — while leaving room for anything that ages him GRADUALLY to add a
 * fraction to the same number without a second resource to keep in step.
 *
 * ⚠️ The deteriorated sprite packs do not exist yet. planeWearSheets is the
 * switch: off, one pack is loaded and the stage shows through a ctx.filter
 * (planeWearFilter) as a stopgap; on, each stage loads its own pack and the
 * filter list should be emptied.
 *
 * Dependencies injected (assets store + config). No DOM, no globals.
 */
class Plane {
  constructor(assets, cfg) {
    this.assets = assets;
    this.cfg = cfg;
    this.charIdx = 0;
    this.pose = cfg.CH_REST;
    this.acc = 0;
    this.x = cfg.startX;
    this.y = cfg.startY;
    this.flip = false;       // art faces right natively; flip when going left
    this.gunOn = false;
    this.gunCur = 0;
    this.gunAcc = 0;
    // Stop-motion sampling: `x/y/pose` update every frame (smooth logic), but
    // everything DRAWN reads `disp`, refreshed only every steppedMs → the plane
    // hops at a low framerate like the background. `_clock` is the plane's own
    // animation time so the bob steps too.
    this._clock = 0;
    this._stepAcc = 0;

    // Entrance: the plane flies in from off the left edge, settles at startX,
    // holds a beat, and only then answers the controls. It is applied as a
    // DRAW-ONLY offset, not by moving this.x — the camera pans off displayX(),
    // so flying the entrance through x would drag the camera past its left
    // inset and expose the blank studio margin. The world stays framed; only
    // the sprite moves.
    this.entryT = 0;
    this.locked = !!cfg.planeEntry;

    // Ageing. See the header: 0 = as he started, planeHealth = dead, and the
    // integer part is which deteriorated pack he is drawn from.
    this.wear = 0;
    this.hurtT = 0;          // ms left of the i-frames, and of the blink
    // The death fall. <0 = not falling. `fallY` is a DRAW offset in px, like
    // every other offset on this sprite, so nothing downstream has to know the
    // plane is on its way out of the frame.
    this.fallT = -1;
    this.fallY = 0;
    this.fallVy = 0;
    this.fallRot = 0;

    this.disp = { x: this.x, y: this.y, pose: this.pose, t: 0, entryOff: this._entryOff() };
  }

  // True while the entrance is playing OR the plane is falling out of the sky —
  // the shell uses it to hold off firing and character-cycling too, not just
  // movement. Both are moments the player is not flying this thing, and putting
  // them behind one getter means every caller gets the second one for free.
  get controlLocked() { return this.locked || this.falling; }
  get falling() { return this.fallT >= 0; }

  // How deteriorated he is, as a sprite-pack / filter index: 0 while untouched,
  // then one per point lost. Clamped one short of planeHealth because the last
  // point is death, not another stage to be drawn in.
  stage() {
    return Math.max(0, Math.min(this.cfg.planeHealth - 1, Math.floor(this.wear)));
  }
  hp() { return Math.max(0, this.cfg.planeHealth - Math.floor(this.wear)); }
  isDead() { return this.wear >= this.cfg.planeHealth; }
  isHurt() { return this.hurtT > 0; }

  /* Took a hit. Returns false inside the i-frame window — the same rate limit
     everything damageable in this game needs, and it matters more here than
     anywhere: an orb resting on the plane for three frames would otherwise be
     the whole run.

     Nothing here is gated on the entrance: the shell does not let anything
     shoot at a plane that is still flying in. */
  hurt(amount) {
    if (this.hurtT > 0 || this.isDead()) return false;
    this.wear = Math.min(this.cfg.planeHealth, this.wear + (amount === undefined ? 1 : amount));
    this.hurtT = this.cfg.planeHurtMs;
    // The last one starts the fall. The i-frames and the blink are left running
    // on top of it on purpose: the player should see the hit land and THEN see
    // the plane go down, rather than the two being one indistinguishable event.
    if (this.isDead() && !this.falling) {
      this.fallT = 0;
      this.fallVy = this.cfg.planeFallVy0;
      this.fallY = 0;
      this.fallRot = 0;
    }
    return true;
  }

  /* Falls exactly the way a dead fly does — same `flyGravity`, reused rather
     than copied so the two cannot drift apart — after a small upward lurch that
     reads as losing lift.

     Runs on REAL time and outside the stop-motion sampler: the fall is a
     physical event, not part of the hopping animation, and quantising it to
     ~12fps would make it stutter down the screen. */
  _fall(dt) {
    const c = this.cfg, s = dt / 1000;
    this.fallT += dt;
    this.fallVy += c.flyGravity * s;
    this.fallY += this.fallVy * s;
    this.fallRot += c.planeFallSpin * s;
  }

  /* Has the wreck left the frame? The shell waits for this before starting the
     ending, so the panel never cuts in over a plane still on screen.

     Tested on the sprite's TOP edge clearing the bottom of the canvas, so it is
     the whole plane that has gone and not just its centre. planeFallMaxMs is a
     safety net for a mistuned gravity, not part of the timing. */
  fallDone(H) {
    if (!this.falling) return false;
    if (this.fallT >= this.cfg.planeFallMaxMs) return true;
    const m = this._metrics(H);
    if (!m) return true;
    const c = this.cfg;
    const top = (this.disp.y + (c.planeOffsetY || 0)) * H + m.bob + this.fallY - m.dh / 2;
    return top > H;
  }

  // Draw offset in screen fractions: starts at planeEntryFromX, eases to 0.
  // easeOutCubic so it arrives fast and decelerates into place rather than
  // sliding in at a constant crawl.
  _entryOff() {
    const c = this.cfg;
    if (!this.locked) return 0;
    const p = c.planeEntryMs > 0 ? Math.min(1, this.entryT / c.planeEntryMs) : 1;
    const ease = 1 - Math.pow(1 - p, 3);
    return c.planeEntryFromX * (1 - ease);
  }

  _snapshot() {
    const d = this.disp;
    d.x = this.x; d.y = this.y; d.pose = this.pose; d.t = this._clock;
    d.entryOff = this._entryOff();
  }
  displayX() { return this.disp.x; }   // camera reads these so world hops in sync
  displayY() { return this.disp.y; }

  // How many images load() will pull, so the shell's progress bar doesn't have
  // to know the naming scheme — or how many deterioration packs are switched on.
  static assetCount(cfg) {
    const packs = cfg.planeWearSheets ? cfg.planeHealth - 1 : 1;
    return cfg.CHARACTERS.length * cfg.CH_FRAMES * packs + cfg.GUN_FRAMES;
  }

  // Asset key for a pose at a deterioration stage. Stage 0 keeps the ORIGINAL
  // key exactly, so turning the wear packs on adds keys rather than renaming
  // any, and nothing that already reads `plane_x_0` has to change.
  _key(stage, pose) {
    const nm = this.characterName;
    return stage > 0 ? `plane_${nm}_w${stage}_${pose}` : `plane_${nm}_${pose}`;
  }

  async load(onProgress) {
    const c = this.cfg, base = c.ASSET_BASE + 'character-sheets/', jobs = [];
    // One pack per deterioration stage once the art exists; just the pristine
    // one until then (see planeWearSheets).
    const packs = c.planeWearSheets ? c.planeHealth - 1 : 1;
    for (let st = 0; st < packs; st++)
      for (const nm of c.CHARACTERS)
        for (let i = 0; i < c.CH_FRAMES; i++) {
          const n = String(i + 1).padStart(2, '0');
          const key = st > 0 ? `plane_${nm}_w${st}_${i}` : `plane_${nm}_${i}`;
          const file = st > 0 ? `saborosa-plane-${nm}-wear${st}-${n}.png`
                              : `saborosa-plane-${nm}-${n}.png`;
          jobs.push(this.assets.loadImage(key, base + file).then(() => onProgress && onProgress()));
        }
    for (let i = 0; i < c.GUN_FRAMES; i++) {
      const n = String(i + 1).padStart(2, '0');
      jobs.push(this.assets.loadImage(`gun_${i}`, `${base}saborosa-plane-fire-${n}.png`).then(() => onProgress && onProgress()));
    }
    await Promise.all(jobs);
  }

  get characterName() { return this.cfg.CHARACTERS[this.charIdx]; }
  cycleCharacter() { this.charIdx = (this.charIdx + 1) % this.cfg.CHARACTERS.length; }
  // Set by the intro's fruit select; ignored if the index is out of range so a
  // bad pick can never leave the plane with no sprite.
  setCharacter(i) {
    if (i >= 0 && i < this.cfg.CHARACTERS.length) this.charIdx = i;
  }

  update(dt, input) {
    const c = this.cfg;

    // The i-frames run on REAL time and are never stepped by the stop-motion
    // sampler: how long the player is invulnerable for should not depend on
    // what framerate the art happens to be hopping at.
    if (this.hurtT > 0) this.hurtT = Math.max(0, this.hurtT - dt);
    if (this.falling) this._fall(dt);

    // Flying in: swallow the controls entirely (a key held from the intro must
    // not steer or fire), but keep the rest of update running so the bob and the
    // stop-motion sampling carry on as normal.
    if (this.locked) {
      this.entryT += dt;
      if (this.entryT >= c.planeEntryMs + c.planeEntryHoldMs) this.locked = false;
      input = Plane.NO_INPUT;
    }

    // Pitch pose ramps toward the held vertical direction's extreme, back to rest.
    const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const target = dy > 0 ? 0 : dy < 0 ? c.CH_FRAMES - 1 : c.CH_REST;
    if (this.pose === target) { this.acc = 0; }
    else {
      this.acc += dt;
      while (c.tiltMs > 0 && this.acc >= c.tiltMs && this.pose !== target) {
        this.acc -= c.tiltMs; this.pose += (this.pose < target) ? 1 : -1;
      }
    }

    // Free movement on both axes. Like most plane shooters the craft always
    // faces right — moving left slides it back, it never mirrors (this.flip
    // stays false). Diagonals are normalised so they aren't faster.
    const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dx || dy) {
      const norm = (dx && dy) ? Math.SQRT1_2 : 1;
      const d = c.moveSpeed * norm * (dt / 1000);
      this.x = Math.min(1, Math.max(0, this.x + dx * d));
      this.y = Math.min(1, Math.max(0, this.y + dy * d));
    }

    // Machine gun: loop the flash frames while firing.
    this.gunOn = !!input.firing;
    if (this.gunOn) {
      this.gunAcc += dt;
      while (c.fireMs > 0 && this.gunAcc >= c.fireMs) { this.gunAcc -= c.fireMs; this.gunCur = (this.gunCur + 1) % c.GUN_FRAMES; }
    } else { this.gunCur = 0; this.gunAcc = 0; }

    // Stop-motion sampling: refresh what's drawn only every steppedMs (else the
    // logic runs smooth but nothing visually hops). Off → sample every frame.
    this._clock += dt / 1000;
    if (c.stepped) {
      this._stepAcc += dt;
      if (this._stepAcc >= c.steppedMs) {
        this._stepAcc %= c.steppedMs;   // keep phase, tolerate long frames
        this._snapshot();
      }
    } else {
      this._snapshot();
    }
  }

  // Current draw metrics (frame, scaled size, bob offset) — shared by render()
  // and muzzle() so the shot line always leaves the nose it's drawn at. All read
  // the STEPPED display state (disp), so everything visual hops in lockstep.
  _metrics(H) {
    const c = this.cfg;
    const pose = this.disp.pose % c.CH_FRAMES;
    // Falls back to the pristine pack whenever a deterioration pack is missing,
    // so a half-delivered set of art degrades to "he doesn't look older" rather
    // than to an invisible player.
    const f = this.assets.getDrawable(this._key(this.stage(), pose))
           || this.assets.getDrawable(this._key(0, pose));
    if (!f) return null;
    const s = (H * c.planeScale) / f.height;
    const dh = f.height * s;
    return { f, dw: f.width * s, dh, bob: Math.sin(this.disp.t * c.bobFreq) * Math.max(c.bobMin, dh * c.bobRel) };
  }

  // Screen-space point the machine gun fires from: the nose (the plane always
  // faces right), on the same vertical line the muzzle flash sits on.
  muzzle(W, H) {
    const m = this._metrics(H);
    if (!m) return null;
    const c = this.cfg;
    const k = c.planeScale / c.gunOffRefScale;
    const offY = ((this.disp.pose === c.CH_REST) ? c.gunOffY : 0) * k;
    // Same screen offsets the sprite is drawn with, so the shot line always
    // leaves the nose where the nose actually is.
    return { x: (this.disp.x + this.disp.entryOff) * W + m.dw / 2,
             y: (this.disp.y + (c.planeOffsetY || 0)) * H + m.bob - offY + c.rayOffsetY * k };
  }

  /* The plane's own collision box, in SCREEN space — which is where the plane
     lives (its x/y are canvas fractions and the camera pans off them), so
     anything in world space converts to here rather than the other way round.

     A fraction of the drawn sprite, because the art is a character sitting in an
     aircraft with a good deal of air around them; the full frame would have the
     player clipped by things that visibly missed. Centred exactly where render()
     puts the sprite, entrance offset and bob included, so it cannot come unstuck
     from what is on screen. */
  hitBox(W, H) {
    const c = this.cfg;
    const m = this._metrics(H);
    if (!m) return null;
    const w = m.dw * c.planeHitWRel, h = m.dh * c.planeHitHRel;
    return {
      x: (this.disp.x + this.disp.entryOff) * W - w / 2,
      y: (this.disp.y + (c.planeOffsetY || 0)) * H + m.bob + this.fallY - h / 2,
      w, h,
    };
  }

  /* How grey the plane is, 0..1, at a given GAME time. Mirrors the background's
     drainAt() but on its own curve and its own ceiling: the world goes all the
     way, the player only half, so it stays the thing the eye tracks even once
     everything around it has died.

     planeDrainFullMs 0 means "end with the run", same trick the background
     uses — one number rather than two kept in step by hand. */
  drainAt(gameMs) {
    const c = this.cfg;
    if (!c.planeDrainOn) return 0;
    const end = c.planeDrainFullMs || c.timeOverMs;
    const span = end - c.planeDrainStartMs;
    if (span <= 0) return gameMs >= end ? c.planeDrainMax : 0;
    const p = Math.min(1, Math.max(0, (gameMs - c.planeDrainStartMs) / span));
    return c.planeDrainMax * Math.pow(p, c.planeDrainCurve);
  }

  // `drain` (0..1) greys the plane AND its muzzle flash — pass drainAt(clock.now()).
  render(ctx, W, H, drain) {
    const c = this.cfg;
    const m = this._metrics(H);
    if (!m) return;
    const f = m.f, dw = m.dw, dh = m.dh, bob = m.bob;

    ctx.save();
    // Set on the state INSIDE this save, so it covers the flash and the plane
    // together — they are one object — and is undone by the restore below
    // without touching anything else on the canvas.
    //
    // The deterioration stage rides in the SAME filter string as the drain
    // rather than in a second pass: ctx.filter takes a list, so ageing and
    // greying compose for free and the plane is still only filtered once.
    // (When the deteriorated art lands, planeWearFilter empties and this term
    // simply becomes '' — nothing else here changes.)
    const d = Math.min(1, Math.max(0, drain || 0));
    const wear = (c.planeWearFilter && c.planeWearFilter[this.stage()]) || '';
    const fx = (d > 0 ? 'saturate(' + (1 - d).toFixed(3) + ') ' : '') + wear;
    if (fx.trim()) ctx.filter = fx.trim();

    // The i-frames, made visible. Blinks to a low alpha rather than to nothing:
    // the player must never lose track of their own plane, least of all in the
    // half-second after being hit. Runs off hurtT, so the blink lasts exactly as
    // long as the invulnerability it is reporting.
    if (this.hurtT > 0 && c.planeBlinkMs > 0
        && Math.floor(this.hurtT / c.planeBlinkMs) % 2 === 1) {
      ctx.globalAlpha *= 0.3;
    }
    // Both offsets are DRAW-only (entryOff slides it in from the left,
    // planeOffsetY lifts it in frame); neither touches displayX/displayY, so the
    // camera keeps its own framing.
    ctx.translate((this.disp.x + this.disp.entryOff) * W,
                  (this.disp.y + (c.planeOffsetY || 0)) * H + bob + this.fallY);
    // The tumble, about the sprite's own centre — which is where the translate
    // above already is, so it costs one call and nothing has to be re-anchored.
    if (this.fallRot) ctx.rotate(this.fallRot);
    if (this.flip) ctx.scale(-1, 1);
    ctx.imageSmoothingEnabled = true;

    // Flash first (behind the plane). Drawn in the plane's own box → inherits
    // flip+bob. Offsets were tuned at gunOffRefScale, so rescale them with
    // planeScale to stay glued to the nose at any size. The upward nudge only
    // aligns on the level pose; drop it when pitched.
    if (this.gunOn) {
      const g = this.assets.getDrawable(`gun_${this.gunCur % c.GUN_FRAMES}`);
      const k = c.planeScale / c.gunOffRefScale;
      const offX = c.gunOffX * k;
      const offY = ((this.disp.pose === c.CH_REST) ? c.gunOffY : 0) * k;
      // gunScale grows the flash about its MUZZLE (gunAnchor*), not about the
      // box centre. Solving "keep the anchor where it already was":
      //   left + fx·(dw·gs) = (left₁ + fx·dw)   →   shift = fx·dw·(1 − gs)
      // so at gs = 1 both terms vanish and this is the original draw exactly.
      // The point of anchoring here is that the flash cannot come unstuck from
      // the nose, and the shot line — which leaves that same muzzle — does not
      // have to be re-derived every time the flash is resized.
      const gs = c.gunScale || 1;
      const gx = -dw / 2 - offX + c.gunAnchorX * dw * (1 - gs);
      const gy = -dh / 2 - offY + c.gunAnchorY * dh * (1 - gs);
      if (g) ctx.drawImage(g, gx, gy, dw * gs, dh * gs);
    }
    ctx.drawImage(f, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }
}

// Frozen no-input, fed to update() while the entrance plays.
Plane.NO_INPUT = Object.freeze({
  left: false, right: false, up: false, down: false, firing: false,
});
