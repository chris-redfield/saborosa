/**
 * Intro — the storyboard title sequence (PORTABLE CORE).
 *
 * Two kinds of transition between panels, because the boards were drawn that way:
 *
 *   CUT  — the next panel appears IN FRONT of the current one, same position,
 *          camera still. This is most of them: the picture doesn't change, only
 *          what's printed over it (STILL LIFE, SELECT FRUIT, 3, 2, 1, GO!).
 *   ROLL — the camera rolls DOWN to the next panel, which sits lower in the
 *          strip. Only where the shot genuinely changes (boards 3->4, 6->7).
 *
 * The rolling boards OVERLAP — they're crops of one taller scene, so board 4's
 * top 414px is board 3's bottom. The camera therefore drops by only the unshared
 * part (introRollPx), not a whole screen, or that band plays twice and you see
 * the join. Those offsets are measured by tools/intro-align.py.
 *
 * Boards can be OMITTED (introOmit) without renumbering the art, so every index
 * in config still means the board with that number on disk. `order` is the
 * played sequence of raw board indices; `this.i` is a position within it.
 *
 * One board can hand over to an interactive step (introSelectAt): the sequence
 * parks there, the injected `select` object takes input, and the roll resumes
 * with the player's pick recorded on `pickedCharacter`.
 *
 * Dependencies are injected (assets store, config, optional select), same as
 * Plane / TrayBackground, so this drops into the main engine unchanged.
 */
class Intro {
  constructor(assets, cfg, select, liftoff) {
    this.assets = assets;
    this.cfg = cfg;
    this.select = select || null;
    this.liftoff = liftoff || null;

    // Played sequence of RAW board indices. Everything in config (introRollPx,
    // introBeats, introSelectAt…) is keyed by raw index, so omitting a board
    // never shifts what those numbers refer to.
    const omit = new Set(cfg.introOmit || []);
    this.order = [];
    for (let i = 0; i < cfg.INTRO_FRAMES; i++) if (!omit.has(i)) this.order.push(i);
    this.n = this.order.length;

    this._rollTo = new Set(cfg.introRollBefore || []);

    // Position -> Y in the strip. A board reached by a roll opens a station
    // further down; one reached by a cut shares its predecessor's.
    this.stationY = [];
    let y = 0;
    for (let k = 0; k < this.n; k++) {
      if (k > 0 && this._isRoll(k)) y += this._rollDist(this.order[k]);
      this.stationY.push(y);
    }

    this.i = 0;              // POSITION in `order`, not a raw board index
    this.mode = 'hold';      // 'hold' → ('select') → ('roll') → … → 'out'
    this.t = 0;              // ms elapsed in the current mode
    this.elapsed = 0;        // ms since the intro started (drives fade-in + hint)
    this.done = false;
    this.skipped = false;
    this.pickedCharacter = null;

    // Covers the case where the takeoff board IS the first one; normally it's
    // _advance() that trips this.
    this._maybeStartLiftoff();
  }

  panel(k) { return this.order[k]; }             // position -> raw board index
  _isRoll(k) { return k > 0 && this._rollTo.has(this.order[k]); }

  // Is this position the one that hands over to the interactive step?
  _isSelectAt(k) {
    return !!this.select && this.cfg.introSelectAt === this.order[k];
  }

  async load(onProgress) {
    const c = this.cfg, jobs = [];
    for (const i of this.order) {              // omitted boards are never fetched
      const n = String(i + 1).padStart(2, '0');
      jobs.push(this.assets.loadImage('intro_' + i, `${c.ASSET_BASE}saborosa-intro-${n}.webp`)
        .then(() => { onProgress && onProgress(); }));
    }
    if (this.select) jobs.push(this.select.load(onProgress));
    await Promise.all(jobs);
  }

  // Length of the takeoff window: the head start, plus every beat from the board
  // the plane appears on through to the end. Derived rather than configured, so
  // changing the countdown timing can't leave the plane airborne early or still
  // rolling at GO!. The lead is included so starting sooner makes the takeoff
  // LONGER rather than making it finish early.
  _liftoffMs() {
    const k0 = this.order.indexOf(this.cfg.introLiftoffFrom);
    if (k0 < 0) return 0;
    let ms = this.cfg.introLiftoffLeadMs || 0;
    for (let k = k0; k < this.n; k++) {
      const b = this._beat(k);
      ms += b.hold;
      if (k < this.n - 1 && this._isRoll(k + 1)) ms += b.roll;
    }
    return ms;
  }

  // How far the camera drops to reach raw board i (only meaningful for a roll).
  _rollDist(i) {
    const px = this.cfg.introRollPx && this.cfg.introRollPx[i];
    return px !== undefined ? px : this.cfg.GAME_H;
  }

  // Beat for the board at position k: the defaults, with any per-board override.
  // The roll time is scaled by DISTANCE off introRollMs (quoted for a full-height
  // roll) so a short roll and a long one move at the same speed.
  _beat(k) {
    const c = this.cfg, o = (c.introBeats && c.introBeats[this.order[k]]) || {};
    let roll = c.introRollMs;
    if (k < this.n - 1 && this._isRoll(k + 1))
      roll = c.introRollMs * this._rollDist(this.order[k + 1]) / c.GAME_H;
    return {
      hold: o.hold !== undefined ? o.hold : c.introHoldMs,
      roll: o.roll !== undefined ? o.roll : roll,
    };
  }

  // Cut the sequence short — the player pressed something. Ignored while the
  // selection is up: there, keys are the player choosing a fruit, not skipping.
  skip() {
    if (this.mode === 'out' || this.mode === 'select' || this.done) return;
    this.skipped = true;
    this.mode = 'out';
    this.t = 0;
  }

  // True while the board is waiting on the player (the shell stops treating
  // keypresses as "skip the intro").
  get awaitingInput() { return this.mode === 'select'; }

  // Leave the current board: roll to the next, cut to it, or end the sequence.
  _advance() {
    if (this.i >= this.n - 1) { this.mode = 'out'; this.t = 0; return; }
    const b = this._beat(this.i);
    if (this._isRoll(this.i + 1) && b.roll > 0) this.mode = 'roll';
    else this.i++;                             // CUT: the next board is just there
    this._maybeStartLiftoff();
  }

  // Roll the plane onto the runway the moment its board comes up.
  _maybeStartLiftoff() {
    if (!this.liftoff || this.liftoff.running) return;
    if (this.order[this.i] !== this.cfg.introLiftoffFrom) return;
    this._startLiftoff();
  }

  // How long until the board at position k0 arrives: what's left of the current
  // beat, then every whole beat in between. Infinity while the select is up —
  // that ends when the player decides, not on a clock, so nothing can be
  // scheduled against it.
  _msUntilBoard(k0) {
    if (k0 < 0 || this.i >= k0) return Infinity;
    // An UNRESOLVED select anywhere between here and there stops the clock. It
    // ends when the player decides, so nothing past it has a knowable time — and
    // scheduling against it would fly the plane across the select board while
    // they're still choosing. Checked for the whole span, not just while the
    // board is up: the hold that precedes it is equally unschedulable.
    if (this.pickedCharacter === null) {
      for (let k = this.i; k < k0; k++) if (this._isSelectAt(k)) return Infinity;
    }
    let ms;
    if (this.mode === 'hold') {
      ms = Math.max(0, this._beat(this.i).hold - this.t);
      if (this._isRoll(this.i + 1)) ms += this._beat(this.i).roll;
    } else if (this.mode === 'roll') {
      ms = Math.max(0, this._beat(this.i).roll - this.t);
    } else {
      return Infinity;
    }
    for (let k = this.i + 1; k < k0; k++) {
      ms += this._beat(k).hold;
      if (this._isRoll(k + 1)) ms += this._beat(k).roll;
    }
    return ms;
  }

  // Head start: begin the takeoff introLiftoffLeadMs BEFORE its board arrives,
  // so the plane is already rolling in by the time it cuts. The lead is measured
  // against real remaining time, so it can reach back past the previous board's
  // hold and into the camera roll before it — the plane spends the first stretch
  // off the left edge anyway, so nothing is visible during the move.
  _maybeLeadLiftoff() {
    const lead = this.cfg.introLiftoffLeadMs || 0;
    if (!this.liftoff || this.liftoff.running || lead <= 0) return;
    const k0 = this.order.indexOf(this.cfg.introLiftoffFrom);
    if (this._msUntilBoard(k0) <= lead) this._startLiftoff();
  }

  _startLiftoff() {
    this.liftoff.prepare(this.pickedCharacter !== null ? this.pickedCharacter : 0);
    this.liftoff.start(this._liftoffMs());
  }

  update(dt, input) {
    if (this.done) return;
    this.elapsed += dt;
    this.t += dt;
    if (this.liftoff) this.liftoff.update(dt);

    this._maybeLeadLiftoff();   // can fire mid-hold OR mid-roll

    if (this.mode === 'hold') {
      const b = this._beat(this.i);
      if (this.t >= b.hold) {
        this.t -= b.hold;
        // This board opens the fruit select — park here until the player picks.
        if (this._isSelectAt(this.i)) { this.mode = 'select'; this.t = 0; }
        else this._advance();
      }
    } else if (this.mode === 'select') {
      const picked = this.select.update(dt, input || {});
      if (picked !== null && picked !== undefined) {
        this.pickedCharacter = picked;
        this.t = 0;
        this._advance();
      }
    } else if (this.mode === 'roll') {
      const b = this._beat(this.i);
      if (this.t >= b.roll) { this.t -= b.roll; this.i++; this.mode = 'hold'; }
    } else if (this.mode === 'out') {
      const ms = this.skipped ? this.cfg.introSkipFadeMs : this.cfg.introFadeOutMs;
      if (this.t >= ms) this.done = true;
    }
  }

  // Camera Y in strip space, in px. Parked on the current board's station,
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

    // The current board, plus the incoming one while the camera is rolling.
    // Never the other boards sharing a station — those are the frames this one
    // already replaced, and they sit at exactly the same Y.
    this._draw(ctx, this.i, camY, W, H);
    if (this.mode === 'roll' && this.i < this.n - 1) this._draw(ctx, this.i + 1, camY, W, H);

    // The plane takes off over the board — it's the foreground of the shot.
    if (this.liftoff) this.liftoff.render(ctx, W, H);

    // The select board opens in front of the panel that's already on screen.
    if (this.mode === 'select') this.select.render(ctx, W, H);

    // Skip hint — fades in after a beat, out once it has been read. Suppressed
    // while the player is choosing, where "any key" means something else.
    const c = this.cfg;
    if (!this.skipped && this.mode !== 'select' && c.introHintText) {
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

  _draw(ctx, k, camY, W, H) {
    const im = this.assets.getDrawable('intro_' + this.order[k]);
    if (im) ctx.drawImage(im, 0, Math.round(this.stationY[k] - camY), W, H);
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
