/**
 * title.js — the first thing the game shows.
 *
 * A photograph of a wall. The name FALLS IN from above it on the first frame,
 * and once it has landed LEBRON walks in from the left and off the right. Any
 * button starts the fight.
 *
 * ⚠️ IT USED TO BE THE FLYING DUNGEON'S CRAWLING VERMIN PANEL with the SABOROSA
 * logo over it, three frames on a ~105ms cycle read in place out of that game's
 * folder. All of that is gone -- one still photograph and hand-set type
 * replaced it on 2026-08-21. The frame clock went with it, which is most of why
 * this file got shorter.
 *
 * ⚠️ IT USED TO HOLD THE BARE PHOTOGRAPH FOR TWO SECONDS before fading the name
 * up, on the argument that a picture given time reads as a place rather than as
 * a background for some text. That was overruled on 2026-08-22: the title drops
 * in from off the top of the frame on the first frame, eased out so it lands
 * rather than stops. `titleDropAtMs` / `titleDropMs` are the knobs, and the
 * config note beside them says how to get the old screen back.
 *
 * ⚠️ AND HE IS DRAWN HERE, NOT SIMULATED. The walk-across is two numbers and a
 * frame clock reading the same packs the fight reads -- exactly what ending.js
 * does, for the reason its header gives at length: a `Player` is a belt entity
 * with depth, a camera, gates, an attack machine and a life total, and none of
 * that exists on a photograph. The cost is that this walk is not `Fighter
 * .update`; if the two ever visibly disagree, that is why.
 *
 * ⚠️ THE PHOTO IS 4:3 AND THE CANVAS IS 16:9, so it is drawn COVER: scaled to
 * fill and centre-cropped. `contain` would pillarbox and put two black bars
 * either side of the one image the screen has.
 *
 * NO DROP SHADOW, NOTHING DARKENED UNDER THE TYPE. That is the house rule for
 * every title screen in this project -- the art shows at full brightness and
 * the letters sit on it crisp. The type is dark because the wall is sunlit; if
 * it ever stops reading, move it to a cleaner part of the wall rather than
 * shading the photograph.
 */
class Title {
  constructor(assets, sheets) {
    this.assets = assets;
    /* The character packs, for the walk-across. Built by boot() before this
       screen is ever drawn -- and drawn defensively anyway (see `_walker`),
       because a pack that failed to load must cost a walk-on, not the screen. */
    this.sheets = sheets;
    this.reset();
  }

  /** Back to the top. Called when the game returns here after a run, so the
      hold and the name play again exactly as they did on the first boot. */
  reset() {
    this.t = 0;          // ms on screen; the drop and the walk are timed off it
    this.walkT = -1;     /* -1 until he sets off, then ms into the crossing. It
                            doubles as the "not walking" flag for the same
                            reason `out` does below: one clock, one meaning. */
    this.out = -1;       /* -1 until dismissed, then the fade-out clock.
                            IT DOUBLES AS THE "already going" FLAG: a second
                            press during the fade must not restart it, and a
                            separate boolean would be a second thing to keep in
                            step with this one. */
    this.done = false;
  }

  /** Every frame it is up. Returns true on the frame the game should begin. */
  update(dt, input) {
    this.t += dt * 1000;
    this._tickWalk(dt);
    if (this.out >= 0) {
      this.out += dt * 1000;
      if (this.out >= (CONFIG.titleFadeOutMs || 600)) { this.done = true; return true; }
    } else if (input && input.takeAnyPress()) {
      /* ACCEPTED FROM THE FIRST FRAME, before the name has even arrived. The
         hold is there to be looked at, not to be sat through -- anyone who has
         seen it once must be able to leave immediately, and a title screen that
         ignores input for two seconds reads as one that has hung. */
      this.out = 0;
    }
    return false;
  }

  /** 0..1 through the name's fade-in. 1 once it is fully up. */
  _nameAlpha() {
    const at = CONFIG.titleDropAtMs != null ? CONFIG.titleDropAtMs : 0;
    const fade = CONFIG.titleNameFadeMs != null ? CONFIG.titleNameFadeMs : 0;
    if (this.t < at) return 0;
    if (fade <= 0) return 1;
    return Math.min(1, (this.t - at) / fade);
  }

  /**
   * 0..1 through the FALL. 1 once the name has landed.
   *
   * EASED OUT (cubic), which is the whole difference between a title landing
   * and a title being teleported: it comes in fast, decelerates into place, and
   * the last few pixels take as long as the first hundred.
   */
  _dropP() {
    const at = CONFIG.titleDropAtMs != null ? CONFIG.titleDropAtMs : 0;
    const ms = CONFIG.titleDropMs != null ? CONFIG.titleDropMs : 700;
    if (this.t < at) return 0;
    if (ms <= 0) return 1;
    const p = Math.min(1, (this.t - at) / ms);
    return 1 - Math.pow(1 - p, 3);
  }

  /** ms on the clock when the name has finished falling. */
  _landedAtMs() {
    return (CONFIG.titleDropAtMs != null ? CONFIG.titleDropAtMs : 0)
         + (CONFIG.titleDropMs != null ? CONFIG.titleDropMs : 700);
  }

  /**
   * The walk-across.
   *
   * ⚠️ IT RUNS OFF ITS OWN CLOCK, STARTED WHEN THE NAME LANDS, rather than off
   * the screen's `t` with the delay subtracted. Retiming the drop then moves
   * him with it and the beat between the two stays what it was tuned to --
   * which is the same reason the ending screen counts its arms-up hold from the
   * pose rather than from the top of the screen.
   *
   * The crossing is not stopped when the screen is dismissed: the fade-out runs
   * over the top of it, and a walker frozen under a fade is a thing you notice.
   */
  _tickWalk(dt) {
    if (!CONFIG.titleWalk) return;
    if (this.walkT < 0) {
      const after = CONFIG.titleWalkAfterMs != null ? CONFIG.titleWalkAfterMs : 250;
      if (this.t < this._landedAtMs() + after) return;
      this.walkT = 0;
      return;                                   // he sets off on the NEXT frame
    }
    this.walkT += dt * 1000;
  }

  /**
   * Where he is and which frame he is on, or null if he is not on screen.
   *
   * ⚠️ RETURNS null RATHER THAN THROWING when the pack is missing. This screen
   * is the first thing the game shows; a walk-on that cannot be drawn has to
   * cost the walk-on and nothing else.
   */
  _walker(W) {
    if (this.walkT < 0 || !this.sheets) return null;
    const x0 = W * (CONFIG.titleWalkStartXRel != null ? CONFIG.titleWalkStartXRel : -0.12);
    const x1 = W * (CONFIG.titleWalkEndXRel != null ? CONFIG.titleWalkEndXRel : 1.12);
    const speed = CONFIG.titleWalkSpeed || 210;
    const span = (x1 - x0) / Math.max(1, speed) * 1000;      // ms to cross
    let t = this.walkT;
    /* HE CAN COME ROUND AGAIN. `titleWalkRepeatMs` is the gap between
       crossings; 0 -- the shipping value -- means he crosses once and the
       screen is still after that. Written as a wrap rather than as a second
       state so there is only ever one clock to be wrong about. */
    const gap = CONFIG.titleWalkRepeatMs || 0;
    if (gap > 0) t = t % (span + gap);
    if (t > span) return null;                  // gone, or waiting to come back
    const n = Math.max(1, this.sheets.poseLength('coconut', 'walk'));
    const ms = (CONFIG.POSE_MS && CONFIG.POSE_MS.walk) || 124;
    return {
      x: x0 + speed * t / 1000,
      step: Math.floor(t / ms) % n,
    };
  }

  /**
   * Draw the plate COVER: fill the canvas, centre-crop the overflow.
   *
   * Kept apart because the arithmetic is the one thing here that is easy to get
   * subtly wrong -- scaling by the wrong axis squashes a 4:3 photo into 16:9,
   * which does not look like a bug, it looks like a badly shot photo.
   */
  _plate(ctx, W, H) {
    const img = this.assets.getDrawable('titleBg');
    if (!img) return;
    const iw = img.width || img.naturalWidth;
    const ih = img.height || img.naturalHeight;
    if (!iw || !ih) return;
    const s = Math.max(W / iw, H / ih);     // max = cover; min would be contain
    const dw = iw * s, dh = ih * s;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.restore();
  }

  /**
   * LEBRON, crossing.
   *
   * OVER THE PHOTOGRAPH AND UNDER THE TYPE, which is the order the layers were
   * asked for: he walks through the scene, and the title is printed on the
   * picture rather than living in it.
   *
   * Facing RIGHT because he is travelling right -- `sheets.draw` mirrors
   * against the pack's own native side, so this states the direction he moves
   * and not an assumption about which way the art was drawn.
   */
  _drawWalker(ctx, W, H) {
    const w = this._walker(W);
    if (!w) return;
    const gy = H * (CONFIG.titleWalkGroundYRel != null ? CONFIG.titleWalkGroundYRel : 0.93);
    const scale = CONFIG.titleWalkScale || 1;
    this.sheets.draw(ctx, 'coconut', 'right', 'walk', w.step, w.x, gy, { scale });
  }

  /**
   * One line of the title, set the way the flying dungeon sets its end panels.
   *
   * ⚠️ THE FAUX-BOLD STROKE IS NOT DECORATION. Futura is not bundled in either
   * game, so most machines fall through the stack to Century Gothic, URW Gothic
   * or Jost -- all lighter than the cut the design assumes. Stroking the glyphs
   * in their OWN colour puts that weight back, and on a machine that does have
   * Futura it is a fraction of a pixel and invisible. It is `heavy` only,
   * because the gloss is meant to be light.
   *
   * `letterSpacing` is guarded because it is a recent canvas property; without
   * it the words simply set tighter, which is a look, not a break.
   */
  _word(ctx, text, x, y, size, weight, family, heavy) {
    ctx.font = `${weight} ${size.toFixed(1)}px ${family}`;
    const ls = CONFIG.titleNameLsPct || 0;
    if ('letterSpacing' in ctx) {
      ctx.letterSpacing = (size * ls / 100).toFixed(2) + 'px';
    }
    ctx.fillText(text, x, y);
    const fb = CONFIG.titleFauxBoldPct || 0;
    if (heavy && fb > 0) {
      ctx.lineWidth = size * fb / 100;
      ctx.strokeText(text, x, y);
    }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  draw(ctx, W, H) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    this._plate(ctx, W, H);
    this._drawWalker(ctx, W, H);

    const a = this._nameAlpha();
    if (a > 0) {
      const name = CONFIG.TITLE_NAME || '';
      const sub = CONFIG.TITLE_SUBNAME || '';
      const ns = CONFIG.titleNameSize || 74;
      const ss = CONFIG.titleSubSize || 30;
      const gap = CONFIG.titleNameGap != null ? CONFIG.titleNameGap : 20;
      const cy = H * (CONFIG.titleNameY != null ? CONFIG.titleNameY : 0.30);

      const col = CONFIG.titleNameColor || '#2A1B10';
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = col;
      ctx.strokeStyle = col;
      ctx.lineJoin = 'round';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      /* THE PORTUGUESE NAME IS THE TITLE AND THE ENGLISH IS A GLOSS, which is
         the whole reason the weights differ. Heavy and large, then light and
         small under it -- the jam audience mostly cannot read the first line
         and should not have to hunt for the second. */
      const total = sub ? ns + gap + ss : ns;
      /* THE FALL, AND THE WHOLE BLOCK MAKES IT TOGETHER. The gloss is part of
         the title, not a caption that catches up afterwards -- two lines
         arriving separately reads as a bug in one of them.

         It falls from `titleDropFromRel` screen-heights above its resting
         place, which clears the top edge with room to spare whatever the type
         is set at, so nothing is ever seen half-drawn against the frame edge. */
      const from = H * (CONFIG.titleDropFromRel != null ? CONFIG.titleDropFromRel : 1);
      const drop = -from * (1 - this._dropP());
      const top = cy - total / 2 + drop;
      const fam = CONFIG.TITLE_FONT || CONFIG.hudFont;

      this._word(ctx, name, W / 2, top + ns / 2, ns,
                 CONFIG.titleNameWeight || 900, fam, true);
      if (sub) {
        this._word(ctx, sub, W / 2, top + ns + gap + ss / 2, ss,
                   CONFIG.titleSubWeight || 400, fam, false);
      }
      ctx.restore();
    }

    if (this.out >= 0) {
      const ms = CONFIG.titleFadeOutMs || 600;
      ctx.save();
      ctx.globalAlpha = ms > 0 ? Math.min(1, this.out / ms) : 1;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }
}
