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

    this.disp = { x: this.x, y: this.y, pose: this.pose, t: 0, entryOff: this._entryOff() };
  }

  // True while the entrance is playing — the shell uses it to hold off firing
  // and character-cycling too, not just movement.
  get controlLocked() { return this.locked; }

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

  async load(onProgress) {
    const c = this.cfg, base = c.ASSET_BASE + 'character-sheets/', jobs = [];
    for (const nm of c.CHARACTERS)
      for (let i = 0; i < c.CH_FRAMES; i++) {
        const n = String(i + 1).padStart(2, '0');
        jobs.push(this.assets.loadImage(`plane_${nm}_${i}`, `${base}saborosa-plane-${nm}-${n}.png`).then(() => onProgress && onProgress()));
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
    const f = this.assets.getDrawable(`plane_${this.characterName}_${this.disp.pose % c.CH_FRAMES}`);
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

  render(ctx, W, H) {
    const c = this.cfg;
    const m = this._metrics(H);
    if (!m) return;
    const f = m.f, dw = m.dw, dh = m.dh, bob = m.bob;

    ctx.save();
    // Both offsets are DRAW-only (entryOff slides it in from the left,
    // planeOffsetY lifts it in frame); neither touches displayX/displayY, so the
    // camera keeps its own framing.
    ctx.translate((this.disp.x + this.disp.entryOff) * W,
                  (this.disp.y + (c.planeOffsetY || 0)) * H + bob);
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
