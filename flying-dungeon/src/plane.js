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
  }

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

  update(dt, input) {
    const c = this.cfg;

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
  }

  // Current draw metrics (frame, scaled size, bob offset) — shared by render()
  // and muzzle() so the shot line always leaves the nose it's drawn at.
  _metrics(H) {
    const c = this.cfg;
    const f = this.assets.getDrawable(`plane_${this.characterName}_${this.pose % c.CH_FRAMES}`);
    if (!f) return null;
    const s = (H * c.planeScale) / f.height;
    const dh = f.height * s;
    const t = performance.now() / 1000;
    return { f, dw: f.width * s, dh, bob: Math.sin(t * c.bobFreq) * Math.max(c.bobMin, dh * c.bobRel) };
  }

  // Screen-space point the machine gun fires from: the nose (the plane always
  // faces right), on the same vertical line the muzzle flash sits on.
  muzzle(W, H) {
    const m = this._metrics(H);
    if (!m) return null;
    const c = this.cfg;
    const k = c.planeScale / c.gunOffRefScale;
    const offY = ((this.pose === c.CH_REST) ? c.gunOffY : 0) * k;
    return { x: this.x * W + m.dw / 2, y: this.y * H + m.bob - offY + c.rayOffsetY };
  }

  render(ctx, W, H) {
    const c = this.cfg;
    const m = this._metrics(H);
    if (!m) return;
    const f = m.f, dw = m.dw, dh = m.dh, bob = m.bob;

    ctx.save();
    ctx.translate(this.x * W, this.y * H + bob);
    if (this.flip) ctx.scale(-1, 1);
    ctx.imageSmoothingEnabled = true;

    // Flash first (behind the plane). Same box as the plane → inherits flip+bob.
    // Offsets were tuned at gunOffRefScale, so rescale them with planeScale to
    // stay glued to the nose at any size. The upward nudge only aligns on the
    // level pose; drop it when pitched.
    if (this.gunOn) {
      const g = this.assets.getDrawable(`gun_${this.gunCur % c.GUN_FRAMES}`);
      const k = c.planeScale / c.gunOffRefScale;
      const offX = c.gunOffX * k;
      const offY = ((this.pose === c.CH_REST) ? c.gunOffY : 0) * k;
      if (g) ctx.drawImage(g, -dw / 2 - offX, -dh / 2 - offY, dw, dh);
    }
    ctx.drawImage(f, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }
}
