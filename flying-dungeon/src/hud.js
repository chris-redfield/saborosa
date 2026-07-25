/**
 * Hud — the on-screen readout (PORTABLE CORE).
 *
 * Drawn ON THE CANVAS in screen space, so it letterboxes and scales with the
 * picture and sits at a fixed place in the camera's frame. The old readout was
 * a DOM div layered over the page: it kept its CSS pixel size while the canvas
 * scaled to the window, so it drifted out of the frame's corner at any size but
 * one. Nothing here touches the DOM.
 *
 * It is rendered AFTER the film pass on purpose. The film's vignette darkens
 * exactly the corners the HUD lives in, and the gate weave shakes the whole
 * scene — running the HUD through both would leave it dim and twitching. Fixed
 * to the camera means fixed: no weave, no grain, full contrast.
 *
 * Dependencies injected (config). No DOM, no globals.
 */
class Hud {
  constructor(cfg) {
    this.cfg = cfg;
    this.joltT = -1;        // ms into the timer's jolt; <0 = not jolting
  }

  /* Time just went BACKWARDS — shake the timer so the player sees the number
     move rather than merely reading a smaller one.

     Deliberately the SAME damped oscillation the coin does when it is shot
     (Coin._spasm), at the same rate, so the coin's flinch and the clock's
     flinch are visibly the same event at both ends of the screen. Only the
     amplitude differs: this one has to stay small enough to read digits
     through. */
  jolt() { this.joltT = 0; }

  update(dt) {
    if (this.joltT < 0) return;
    this.joltT += dt;
    if (this.joltT >= this.cfg.hudJoltMs) this.joltT = -1;
  }

  // {dx, dy, k} — offset in px and a size multiplier, or null when at rest.
  _jolt() {
    const c = this.cfg;
    if (this.joltT < 0 || !(c.hudJoltMs > 0)) return null;
    const p = Math.min(1, this.joltT / c.hudJoltMs);
    const decay = 1 - p;
    const w = Math.sin(p * c.hudJoltFreq) * decay;
    return {
      dx: w * c.hudJoltAmp,
      dy: w * c.hudJoltAmp * 0.4,
      k: 1 + c.hudJoltScale * decay,
    };
  }

  _font(size) { return `${this.cfg.hudWeight} ${size}px ${this.cfg.hudFont}`; }

  // Elapsed time as HH:MM:SS. Hours are NOT capped at two digits — a run that
  // somehow passes 99h shows 100:00:00 rather than silently wrapping to 00.
  _clock(ms) {
    const t = Math.max(0, Math.floor(ms / 1000));
    const p = n => String(n).padStart(2, '0');
    return `${p(Math.floor(t / 3600))}:${p(Math.floor(t / 60) % 60)}:${p(t % 60)}`;
  }

  // One label, with a cheap 1px drop shadow so it survives over pale fruit.
  _text(ctx, s, x, y, align, baseline) {
    const c = this.cfg;
    ctx.textAlign = align;
    ctx.textBaseline = baseline || 'top';
    if (c.hudShadow) {
      ctx.fillStyle = c.hudShadow;
      ctx.fillText(s, x + 2, y + 2);
    }
    ctx.fillStyle = c.hudColor;
    ctx.fillText(s, x, y);
  }

  // state: { fliesLeft, fliesKilled, timeMs }
  render(ctx, W, H, state) {
    const c = this.cfg;
    ctx.save();
    ctx.font = this._font(c.hudSize);
    // Futura-ish faces read better with air between the letters. Newer engines
    // only; harmless where it's unsupported.
    if ('letterSpacing' in ctx) ctx.letterSpacing = c.hudLetterSpacing;

    const m = c.hudMargin;
    this._text(ctx, `FLIES ${state.fliesLeft}`, W - m + c.hudFliesOffsetX, m, 'right');

    // Timer, centred on X along the bottom. Its gap from the lower edge is the
    // SAME hudMargin the corner labels use at the top — 'bottom' baseline
    // against H - margin mirrors 'top' baseline against margin — so the block
    // stays symmetric on its own if the margin is ever retuned.
    //
    // The jolt moves ONLY the timer: it is the thing that changed, and shaking
    // the fly counter alongside it would read as the whole HUD glitching.
    // Scaled about the text's own anchor (centre / bottom baseline), so it
    // pulses in place instead of walking off its margin.
    const j = this._jolt();
    ctx.font = this._font(c.hudTimerSize * (j ? j.k : 1));
    this._text(ctx, this._clock(state.timeMs || 0),
               W / 2 + (j ? j.dx : 0), H - m + (j ? j.dy : 0), 'center', 'bottom');

    ctx.restore();
  }
}
