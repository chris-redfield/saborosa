/**
 * Intro — the storyboard title sequence (PORTABLE CORE).
 *
 * Two kinds of transition between panels, because the boards were drawn that way:
 *
 *   CUT  — the next panel appears IN FRONT of the current one, same position,
 *          camera still. This is most of them: the picture doesn't change, only
 *          what's printed over it (STILL LIFE, SELECT FRUIT, 3, 2, 1, GO!).
 *   ROLL — the camera rolls DOWN to the next panel, which sits one screen lower
 *          in the strip. This is the actual camera move, and only happens where
 *          the shot genuinely changes (panel 3->4, 6->7).
 *
 * So the panels don't stack 12-high: they stack by STATION. Every panel reached
 * by a cut shares its predecessor's station, giving three screens of strip —
 *   station 0: panels 0,1,2   station 1: panels 3,4,5   station 2: panels 6..11
 * — and the camera only ever moves down, never in X.
 *
 * Which panels the camera rolls to is data: CONFIG.introRollBefore.
 *
 * Dependencies are injected (assets store + config), same as Plane /
 * TrayBackground, so this drops into the main engine unchanged.
 */
class Intro {
  constructor(assets, cfg) {
    this.assets = assets;
    this.cfg = cfg;
    this.n = cfg.INTRO_FRAMES;

    // Panel -> its Y in the strip. A panel listed in introRollBefore opens a new
    // station further down; every other panel cuts in over its predecessor.
    //
    // How far down is NOT a whole screen. The rolling boards overlap — they're
    // crops of one taller scene — so the station drops by only the unshared
    // part (introRollPx), which is what makes the join invisible. Panels with no
    // measured offset fall back to a full screen.
    this._rollTo = new Set(cfg.introRollBefore || []);
    this.stationY = [];
    let y = 0;
    for (let i = 0; i < this.n; i++) {
      if (i > 0 && this._rollTo.has(i)) y += this._rollDist(i);
      this.stationY.push(y);
    }

    this.i = 0;              // panel on screen
    this.mode = 'hold';      // 'hold' → ('roll') → … → 'out'
    this.t = 0;              // ms elapsed in the current mode
    this.elapsed = 0;        // ms since the intro started (drives the fade-in + hint)
    this.done = false;
    this.skipped = false;
  }

  async load(onProgress) {
    const c = this.cfg, jobs = [];
    for (let i = 0; i < this.n; i++) {
      const n = String(i + 1).padStart(2, '0');
      jobs.push(this.assets.loadImage('intro_' + i, `${c.ASSET_BASE}saborosa-intro-${n}.webp`)
        .then(() => { onProgress && onProgress(); }));
    }
    await Promise.all(jobs);
  }

  // How far the camera drops to reach panel i (only meaningful if i is a roll).
  _rollDist(i) {
    const px = this.cfg.introRollPx && this.cfg.introRollPx[i];
    return px !== undefined ? px : this.cfg.GAME_H;
  }

  // Beat for a panel: the defaults, with any per-panel override applied (the
  // 3-2-1-GO countdown runs snappier than the title cards). The roll time is
  // scaled by DISTANCE off introRollMs (which is quoted for a full-height roll)
  // so a short roll and a long one move at the same speed.
  _beat(i) {
    const c = this.cfg, o = (c.introBeats && c.introBeats[i]) || {};
    let roll = c.introRollMs;
    if (i < this.n - 1 && this._rollTo.has(i + 1))
      roll = c.introRollMs * this._rollDist(i + 1) / c.GAME_H;
    return {
      hold: o.hold !== undefined ? o.hold : c.introHoldMs,
      roll: o.roll !== undefined ? o.roll : roll,
    };
  }

  // Cut the sequence short — the player pressed something. Fades out fast
  // rather than snapping, so it never feels like a glitch.
  skip() {
    if (this.mode === 'out' || this.done) return;
    this.skipped = true;
    this.mode = 'out';
    this.t = 0;
  }

  update(dt) {
    if (this.done) return;
    this.elapsed += dt;
    this.t += dt;

    if (this.mode === 'hold') {
      const b = this._beat(this.i);
      if (this.t >= b.hold) {
        this.t -= b.hold;
        if (this.i >= this.n - 1) { this.mode = 'out'; this.t = 0; }
        else if (this._rollTo.has(this.i + 1) && b.roll > 0) this.mode = 'roll';
        else this.i++;                       // CUT: the next panel is just there
      }
    } else if (this.mode === 'roll') {
      const b = this._beat(this.i);
      if (this.t >= b.roll) { this.t -= b.roll; this.i++; this.mode = 'hold'; }
    } else if (this.mode === 'out') {
      const ms = this.skipped ? this.cfg.introSkipFadeMs : this.cfg.introFadeOutMs;
      if (this.t >= ms) this.done = true;
    }
  }

  // Camera Y in strip space, in px. Parked on the current panel's station,
  // except mid-roll where it travels to the next one's.
  _camY() {
    const from = this.stationY[this.i];
    if (this.mode !== 'roll' || this.i >= this.n - 1) return from;
    const b = this._beat(this.i);
    const p = b.roll > 0 ? Math.min(1, this.t / b.roll) : 1;
    return from + (this.stationY[this.i + 1] - from) * this._ease(p);
  }

  // easeInOutCubic — the film pulls away slowly, travels, settles slowly.
  _ease(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }

  render(ctx, W, H) {
    const camY = this._camY();

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // The current panel, plus the incoming one while the camera is rolling.
    // Never the other panels sharing a station — those are the frames this one
    // already replaced, and they sit at exactly the same Y.
    this._draw(ctx, this.i, camY, W, H);
    if (this.mode === 'roll' && this.i < this.n - 1) this._draw(ctx, this.i + 1, camY, W, H);

    // Skip hint — fades in after a beat, fades out once it has been read.
    const c = this.cfg;
    if (!this.skipped && c.introHintText) {
      const a = this._hintAlpha();
      if (a > 0) {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.font = '13px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillText(c.introHintText, W - 17, H - 15);   // cheap drop shadow
        ctx.fillStyle = '#e8e8e0';
        ctx.fillText(c.introHintText, W - 18, H - 16);
        ctx.restore();
      }
    }

    // Fade in from black at the top of the sequence, out to black at the end.
    let black = 0;
    if (this.elapsed < c.introFadeInMs) black = 1 - this.elapsed / c.introFadeInMs;
    if (this.mode === 'out') {
      const ms = this.skipped ? c.introSkipFadeMs : c.introFadeOutMs;
      black = Math.max(black, Math.min(1, this.t / ms));
    }
    if (black > 0) {
      ctx.fillStyle = `rgba(0,0,0,${black})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  _draw(ctx, i, camY, W, H) {
    const im = this.assets.getDrawable('intro_' + i);
    if (im) ctx.drawImage(im, 0, Math.round(this.stationY[i] - camY), W, H);
  }

  _hintAlpha() {
    const c = this.cfg, t = this.elapsed;
    if (t < c.introHintInMs) return 0;
    const fade = 400;
    if (t < c.introHintInMs + fade) return (t - c.introHintInMs) / fade;
    const outAt = c.introHintInMs + c.introHintHoldMs;
    if (t < outAt) return 1;
    if (t < outAt + fade) return 1 - (t - outAt) / fade;
    return 0;
  }
}
