/**
 * ta-plane.js -- PORTED FROM STILL LIFE, `flying-dungeon/src/plane.js`.
 *
 * ⚠️ THIS IS A COPY, AND IT IS A COPY ON PURPOSE. The beat 'em up reads that
 * game's ASSETS in place (the health bar, the gamepad map, the game over
 * vermin) so the two can change together -- but its CODE cannot be read in
 * place: `index.html` builds its script tags from a bare `src/<name>.js` list
 * and `package.sh` copies `src/*.js`, so a file outside this folder would work
 * in dev and 404 in the built game. That failure has shipped here before.
 *
 * A LITERAL COPY BAR THE CLASS NAME AND THE ASSET PATH (see `load()`), and the
 * rest is worth keeping that way:
 * every one of these classes is CONFIG-INJECTED -- `constructor(assets, cfg)`,
 * zero references to a global CONFIG, zero to `window` or `document` (checked;
 * the greps that look like hits are all the word "window" in prose). That is
 * why the port was cheap, and it is what lets this file take TIME ATTACK's
 * config while Still Life's copy takes its own. **Do not reach for a global
 * CONFIG in here** -- that single line is what would end the arrangement.
 *
 * RENAMED `Plane` -> `TaPlane` because this game already has `Flies` (the
 * scenery swarm) and `FlyBoss` (NARUTÃO) in the same global namespace, and a
 * bare `Fly` beside `Flies` is a footgun for whoever reads it next. The prefix
 * says which game a class belongs to.
 *
 * To re-sync with Still Life: diff against the original, apply, rename.
 */
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
class TaPlane {
  constructor(assets, cfg) {
    this.assets = assets;
    this.cfg = cfg;
    /* ⚠️ IDENTITY, AND THE ONE FIELD `reset()` DOES NOT TOUCH. Which coconut is
       flying survives a re-entry -- it follows the player's pack and is set by
       the mode straight after. Everything else about the plane is FLIGHT state
       and is built below. */
    this.charIdx = 0;
    this.reset();
  }

  /**
   * Back to the state a brand-new plane is in -- **including a fresh entrance**.
   *
   * ⚠️ THE CONSTRUCTOR CALLS THIS RATHER THAN DUPLICATING IT, and that is the
   * whole point of it existing. Still Life has no such method because it
   * REBUILDS the plane on every restart (`plane = new Plane(...)`); this game
   * builds it once at boot and enters the mode many times in a session, so
   * "fresh entry" and "fresh plane" are two different events here and would
   * drift the first time a field was added to one and not the other. Written as
   * the constructor's own body so they cannot.
   *
   * ⚠️ WITHOUT IT THE FLY-IN PLAYED ONCE PER PAGE LOAD: `locked` is armed from
   * `cfg.planeEntry` here, the first entry spent it, and every entry after that
   * opened with the plane already parked at `startX`.
   */
  reset() {
    const cfg = this.cfg;
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
    // ms left of the FLINCH — a separate, much shorter clock from hurtT, and
    // deliberately so: see the config note. The blink reports a state, this
    // reports the moment of impact.
    this.shakeT = 0;
    // The death fall. <0 = not falling. `fallY` is a DRAW offset in px, like
    // every other offset on this sprite, so nothing downstream has to know the
    // plane is on its way out of the frame.
    this.fallT = -1;
    this.fallY = 0;
    this.fallVy = 0;
    this.fallRot = 0;
    // The finale drives the plane instead of the player. `cineOffX` is a
    // DRAW-only X offset in screen fractions — the same device the entrance
    // uses, and for the same reason: the camera pans off displayX(), so flying
    // the exit through `x` would drag the world past its inset.
    this.cine = false;
    this.cineOffX = 0;

    this.disp = { x: this.x, y: this.y, pose: this.pose, t: 0, entryOff: this._entryOff() };
  }

  // True while the entrance is playing OR the plane is falling out of the sky —
  // the shell uses it to hold off firing and character-cycling too, not just
  // movement. Both are moments the player is not flying this thing, and putting
  // them behind one getter means every caller gets the second one for free.
  get controlLocked() { return this.locked || this.falling || this.cine; }
  get falling() { return this.fallT >= 0; }
  // Hand the plane to the finale. There is no way back: nothing after this
  // returns control to the player.
  setCinematic(on) { this.cine = !!on; }

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
    /* Restarted, not accumulated — and it is restarted on EVERY landed hit,
       including the half-point ones the flies deal and including the fatal one.
       A hit that took half a point still connected, and the flinch is what says
       so: without it a fly touch that does not cross a stage boundary would
       produce no feedback at all beyond the blink, and the player would have no
       way to tell a graze from nothing. */
    this.shakeT = this.cfg.planeShakeMs || 0;
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
    d.entryOff = this._entryOff() + this.cineOffX;
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
    /* ⚠️ THE ONE EDIT IN THIS PORT BESIDES THE CLASS NAME. Still Life hardcoded
       `character-sheets/` and `saborosa-plane-`; TIME ATTACK's planes are
       `batidao-plane-<name>-NN.png` in `time-attack/`, drawn by the artist to
       this exact spec (660x507, six pitch poses, same registration as
       `saborosa-plane-lemon-NN.png` -- verified by compositing the two sets).
       Renaming twelve of the artist's files to suit a hardcoded string was the
       other option and it is the worse one. Both defaults are Still Life's, so
       this file still behaves identically over there. */
    const c = this.cfg, jobs = [];
    const base = c.ASSET_BASE + (c.planeDir != null ? c.planeDir : 'character-sheets/');
    const pre  = c.planeFilePrefix != null ? c.planeFilePrefix : 'saborosa-plane-';
    // One pack per deterioration stage once the art exists; just the pristine
    // one until then (see planeWearSheets).
    const packs = c.planeWearSheets ? c.planeHealth - 1 : 1;
    for (let st = 0; st < packs; st++)
      for (const nm of c.CHARACTERS)
        for (let i = 0; i < c.CH_FRAMES; i++) {
          const n = String(i + 1).padStart(2, '0');
          const key = st > 0 ? `plane_${nm}_w${st}_${i}` : `plane_${nm}_${i}`;
          const file = st > 0 ? `${pre}${nm}-wear${st}-${n}.png`
                              : `${pre}${nm}-${n}.png`;
          jobs.push(this.assets.loadImage(key, base + file).then(() => onProgress && onProgress()));
        }
    for (let i = 0; i < c.GUN_FRAMES; i++) {
      const n = String(i + 1).padStart(2, '0');
      /* ⚠️ THE MUZZLE FLASH STAYS STILL LIFE'S, read in place out of that game's
         folder like the health bar and the gamepad map -- there is no TIME
         ATTACK fire art and the flash is welded to the nose by `gunAnchorX/Y`,
         measured against a 660x507 plane, which these planes are. */
      const gbase = (c.gunBase != null ? c.gunBase : base);
      jobs.push(this.assets.loadImage(`gun_${i}`, `${gbase}saborosa-plane-fire-${n}.png`).then(() => onProgress && onProgress()));
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
    // The flinch, the same way and for a second reason: at ~14Hz, quantising it
    // to the 12fps sprite step would alias it into a slow lurch. It is a
    // physical event, like the death fall, not part of the hopping animation.
    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt);
    if (this.falling) this._fall(dt);

    if (this.locked) {
      this.entryT += dt;
      if (this.entryT >= c.planeEntryMs + c.planeEntryHoldMs) this.locked = false;
    }

    /* Swallow the controls entirely whenever the player is not flying this
       thing — but keep the rest of update() running, so the bob and the
       stop-motion sampling carry on as normal.

       ⚠️ Keyed on controlLocked, NOT on `locked`. It used to test the entrance
       flag alone, which was right when the entrance was the only such moment;
       once dying and the finale joined it, that left a plane the player could
       still STEER while it was falling out of the sky, or while the ending was
       flying it. The shell was already gating firing on controlLocked, so the
       two were disagreeing about what "not in control" meant. */
    if (this.controlLocked) input = TaPlane.NO_INPUT;

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

  /* The flinch offset, in canvas px. A damped oscillation: it starts at full
     amplitude on the frame of the hit and rings out over planeShakeMs.

     The decay is SQUARED rather than linear so the shake is nearly over by the
     half-way point — the violence belongs at the moment of contact, and a
     linear fade spends the second half of its life as a gentle drift that reads
     as the plane being unsteady rather than as having been hit.

     ⚠️ NOT part of _metrics(). Everything in there is shared with muzzle(), and
     the whole point of this offset is that it moves the picture and nothing
     else — not the muzzle, not the hitbox, not the camera. Kept separate so it
     cannot leak into them by someone later adding it "for consistency". */
  _shake() {
    const c = this.cfg;
    if (this.shakeT <= 0 || !c.planeShakeMs || !c.planeShakeAmp) return null;
    const t = (c.planeShakeMs - this.shakeT) / 1000;   // seconds since impact
    const decay = this.shakeT / c.planeShakeMs;        // 1 at the hit → 0 at the end
    const a = c.planeShakeAmp * decay * decay;
    const w = c.planeShakeFreq;
    return {
      x: a * Math.sin(w * t),
      // Different rate and an offset phase, so the two axes trace a small
      // erratic figure instead of sliding up and down a single diagonal.
      y: a * c.planeShakeYRel * Math.sin(w * c.planeShakeYFreqRel * t + 1.1),
    };
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
    /* Same screen offsets the sprite is drawn with, so the shot line always
       leaves the nose where the nose actually is.

       ⚠️ AND `dw / 2` IS NOT THE NOSE -- it is the right edge of the FRAME BOX,
       which is a third of the way past him. Measured off the art: every plane
       frame is 660x507 with the ink ending at x=423..442, so **218-237px of
       every frame is empty margin on the right** and the beam was starting
       about 96 screen px in front of the propeller. *"there is a gap right in
       front of the player."* `rayMuzzleXRel` is where the ink actually ends as
       a fraction of the frame width; 0.5 is the box centre.
       ⚠️ UNSET FALLS BACK TO 1 -- the old box-edge behaviour -- so a missing
       knob cannot silently move the gun. */
    const noseRel = (c.rayMuzzleXRel != null ? c.rayMuzzleXRel : 1) - 0.5;
    return { x: (this.disp.x + this.disp.entryOff) * W + m.dw * noseRel,
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
    /* ⚠️ CLAMPED TO THE LAST ENTRY, WHICH IS A DELIBERATE DIVERGENCE FROM
       STILL LIFE -- its version indexes straight in. It can afford to: it has
       `planeHealth: 3` and exactly three filters, written together. Here the
       two are independent knobs, and raising health to 4 made `stage()` reach
       an index past the end; `undefined || ''` is NO FILTER, so the plane
       looked REPAIRED at one hit from death. **A missing array entry failing
       into "no effect" is the same silent, permissive failure as a missing
       object property** -- it does not throw, it just quietly says nothing is
       wrong. Clamping makes the worst tint stick instead, so health and this
       array can never again disagree in a way that reads as a bug. */
    const wf = c.planeWearFilter;
    const wear = (wf && wf.length ? wf[Math.min(this.stage(), wf.length - 1)] : '') || '';
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
    // Every offset here is DRAW-only (entryOff slides it in from the left,
    // planeOffsetY lifts it in frame, the flinch rattles it); none of them
    // touches displayX/displayY, so the camera keeps its own framing — and none
    // touches hitBox() or muzzle() either.
    //
    // The shake is added to the translate rather than drawn separately so it
    // carries the MUZZLE FLASH with it: the flash is drawn inside this same
    // transform, and a plane that rattled while its gun flash stayed put would
    // come apart on every hit.
    const sh = this._shake();
    ctx.translate((this.disp.x + this.disp.entryOff) * W + (sh ? sh.x : 0),
                  (this.disp.y + (c.planeOffsetY || 0)) * H + bob + this.fallY
                    + (sh ? sh.y : 0));
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
TaPlane.NO_INPUT = Object.freeze({
  left: false, right: false, up: false, down: false, firing: false,
});
