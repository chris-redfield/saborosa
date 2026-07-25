/**
 * Liftoff — the chosen plane taking off across the countdown (PORTABLE CORE).
 *
 * Plays over the last stretch of the intro (STOP DECAY · 3 · 2 · 1 · GO!),
 * treating the gridded cloth at the bottom of the board as the runway. It runs
 * off ONE normalised clock spanning that whole stretch, and the Intro derives
 * that stretch's length from the board beats — so retiming the countdown
 * retimes the takeoff with it, rather than leaving the plane airborne early or
 * still rolling at GO!.
 *
 * Three phases along that clock:
 *   rev   — parked, engine shaking, nose level          (over STOP DECAY)
 *   roll  — accelerating down the runway, still level   (over 3 · 2 · 1)
 *   climb — nose ramps to the top pitch pose, wheels leave, exits top-right (GO!)
 *
 * The sprite frames are 660x507 with the art floating inside them, so drawing
 * at the frame's corner would leave the plane hovering above the ground. FOOT
 * holds where the art's belly and centre actually sit inside each pitch pose —
 * measured off the sheets, and IDENTICAL across all three characters, since the
 * packs are registered to each other.
 *
 * Dependencies injected (assets store + config). No DOM, no globals.
 */
class Liftoff {
  constructor(assets, cfg) {
    this.assets = assets;
    this.cfg = cfg;
    this.charIdx = 0;
    this.t = 0;              // ms into the takeoff
    this.totalMs = 1;        // set by the Intro from the board beats
    this.running = false;

    // Per pitch pose: [centre-x, belly-y] as fractions of the sprite FRAME.
    // Poses 0-2 dive, 3 is level/rest, 4-5 climb.
    this.FOOT = [
      [0.457, 0.775], [0.453, 0.755], [0.449, 0.744],
      [0.434, 0.734], [0.442, 0.781], [0.447, 0.761],
    ];

    // Stop-motion sampling, same as the plane in-game: the maths runs smooth
    // but what's DRAWN only refreshes every steppedMs, so the takeoff hops at
    // the same low framerate as everything else and doesn't glide out of style.
    this._stepAcc = 0;
    this.disp = { p: 0, pose: cfg.CH_REST, shake: 0 };
  }

  // Make sure the picked character's frames are in the store. plane.load() is
  // usually done by now, but it's racing the 32 huge tray frames — this removes
  // the race so the runway is never empty. Same keys, so it's a no-op refetch
  // that the browser cache answers.
  prepare(charIdx) {
    this.charIdx = charIdx | 0;
    const c = this.cfg, nm = c.CHARACTERS[this.charIdx];
    if (!nm) return Promise.resolve();
    const base = c.ASSET_BASE + 'character-sheets/', jobs = [];
    for (let i = 0; i < c.CH_FRAMES; i++) {
      if (this.assets.getDrawable(`plane_${nm}_${i}`)) continue;
      const n = String(i + 1).padStart(2, '0');
      jobs.push(this.assets.loadImage(`plane_${nm}_${i}`, `${base}saborosa-plane-${nm}-${n}.png`));
    }
    return Promise.all(jobs);
  }

  // totalMs is the countdown window the Intro derives from its beats. liftSpeed
  // compresses the TAKEOFF inside that window without touching the countdown:
  // at 1.1 the plane plays 10% quicker and is simply gone for the last stretch,
  // rather than the 3-2-1 being sped up to match.
  start(totalMs) {
    const rate = this.cfg.liftSpeed || 1;
    this.totalMs = Math.max(1, totalMs / rate);
    this.t = 0;
    this.running = true;
    this._stepAcc = 0;
    this._snapshot();
  }

  _snapshot() {
    const c = this.cfg, p = Math.min(1, this.t / this.totalMs);
    const d = this.disp;
    d.p = p;
    // Nose comes up only once the climb starts; level for the whole roll.
    if (p < c.liftRotateAt) d.pose = c.CH_REST;
    else {
      const q = (p - c.liftRotateAt) / Math.max(1e-6, 1 - c.liftRotateAt);
      const top = c.CH_FRAMES - 1;
      d.pose = Math.min(top, Math.round(c.CH_REST + (top - c.CH_REST) * Math.min(1, q * 2)));
    }
    // Engine shake only while it's sitting still with the brakes on.
    d.shake = p < c.liftRevUntil ? Math.sin(this.t / 1000 * c.liftRevFreq) * c.liftRevAmp : 0;
  }

  update(dt) {
    if (!this.running) return;
    this.t = Math.min(this.totalMs, this.t + dt);
    const c = this.cfg;
    if (c.stepped) {
      this._stepAcc += dt;
      if (this._stepAcc >= c.steppedMs) { this._stepAcc %= c.steppedMs; this._snapshot(); }
    } else {
      this._snapshot();
    }
  }

  // Where the plane's art centre / belly should be, in screen fractions.
  _place() {
    const c = this.cfg, p = this.disp.p;

    // X: the takeoff roll. Blend of constant speed and acceleration — it starts
    // OFF the left edge, so it has to already be moving when it enters frame,
    // but must still be visibly gaining speed by the time it rotates.
    let x = c.liftStartX;
    if (p > c.liftRevUntil) {
      const q = (p - c.liftRevUntil) / Math.max(1e-6, 1 - c.liftRevUntil);
      const k = c.liftRollBlend === undefined ? 0 : c.liftRollBlend;
      x = c.liftStartX + (c.liftExitX - c.liftStartX) * (k * q + (1 - k) * q * q);
    }

    // Y: glued to the runway until rotation, then climbing away — also
    // quadratic, so it unsticks gently instead of jumping.
    let y = c.liftGroundY;
    if (p > c.liftRotateAt) {
      const q = (p - c.liftRotateAt) / Math.max(1e-6, 1 - c.liftRotateAt);
      y = c.liftGroundY + (c.liftExitY - c.liftGroundY) * q * q;
    }
    return { x, y };
  }

  render(ctx, W, H) {
    if (!this.running) return;
    const c = this.cfg;
    const nm = c.CHARACTERS[this.charIdx];
    const pose = this.disp.pose % c.CH_FRAMES;
    const f = this.assets.getDrawable(`plane_${nm}_${pose}`);
    if (!f) return;                       // sheets not in yet — draw nothing

    const s = (H * c.liftScale) / f.height;
    const dw = f.width * s, dh = f.height * s;
    const anchor = this.FOOT[pose] || this.FOOT[c.CH_REST];
    const at = this._place();

    // Anchor the ART (not the frame) to the runway point.
    const dx = at.x * W - anchor[0] * dw;
    const dy = at.y * H - anchor[1] * dh + this.disp.shake;

    ctx.drawImage(f, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
  }
}
