/**
 * continue.js — the CONTINUE? countdown, over the fight the player just lost.
 *
 * WHAT IT IS. The last life is gone; the world stops where it is and this is
 * painted on top of it. Two beaten coconuts on the left, a hand-drawn CONTINUE?
 * and a big pixel-grid number on the right, counting down. Press anything and
 * the run carries on from exactly where it stopped; let it reach zero and the
 * whole panel goes grey and the game over screen follows.
 *
 * Asked for 2026-08-31: *"when the player dies his last life, keep the
 * background with the game, but on top of it, add a new layer with the countdown
 * animation... if the counter reaches zero and the players didn't press any
 * button, this other frame must be used."*
 *
 * ⚠️ THE WORLD BEHIND IT IS NOT DRAWN BY THIS FILE AND MUST NOT BE. It is the
 * frame the fight ended on, still on the canvas -- game.js paints this from
 * `drawEndCards()`, the same slot the CLEAR tally and the game over veil use,
 * which exists precisely because those cards sit OVER whatever was drawn. That
 * is what "keep the background with the game" means: nothing is captured, nothing
 * is re-rendered, the world simply stops being ticked.
 *
 * ⚠️ THREE LAYERS, ONE RECT, AND THE RECT IS THE WHOLE ALIGNMENT STORY. The
 * artist's pictures are full-canvas overlays that each carry a different part of
 * the composition -- the figures live in the left half (x 0.067..0.541 of the
 * sheet), the number and the word in the right (0.575..0.979), and the dead
 * frame carries both. They are drawn at ONE rect derived from the image's own
 * size, never from its content, so the parts line up because they were drawn
 * lined up. Fitting any of them to its own ink would scatter them.
 *
 * ⚠️ AND THE SAME RULE REACHED BACK INTO THE ASSET PIPELINE.
 * `tools/shrink-master.py` crops to the opaque bbox by default; cropped, these
 * thirteen pictures would each land on their own geometry and the panel would
 * shake as the digit changed. Cut with `--max-dim 1100 --no-crop`, all thirteen
 * are 1100x799 and cannot disagree. Same trap the fruit select hit.
 *
 * ⚠️ THE WORLD IS DIMMED 30% UNDER THE PANEL and the panel is not. See draw():
 * the veil is the bottom layer, so it recedes the fight without touching the
 * artist's colours.
 *
 * ⚠️ THE NUMBER DOES NOT CUT, IT FLIPS. Asked for 2026-09-01: *"between the
 * number frames, I want you to add the blank boards... the idea is to make it
 * look as a split-flap display (also called a flap sign), for example that
 * exists in the ferry building in san francisco."* Each second opens with the
 * dark board up, and then the digit. See `_flapFrame()`.
 *
 * ⚠️ ONE BOARD, NOT TWO -- `blank-02` ONLY. The artist cut two blanks, all-dark
 * and all-lit, and the first build alternated them on the reasoning that a real
 * sign shows the back of the falling leaf AND the empty face of the arriving
 * one. Corrected on sight: *"I actually want you to use only the dark one...
 * i see the bright one being used as well."* The lit board is brighter than any
 * digit frame, so it read as a flash in the middle of the turn rather than as
 * part of it. `blank-01` is now drawn by nothing and loaded by nothing.
 *
 * ⚠️ NOTHING IS TICKED HERE EXCEPT THIS SCREEN'S OWN CLOCK. The corpse holds
 * mid-fade, the crowd holds, the plate holds. That is deliberate and it is what
 * makes the screen read as the game being PAUSED on your death rather than as a
 * new place -- and it is why `game.js` must not call `update()` in this phase.
 */
class Continue {
  constructor(assets) {
    this.assets = assets;
    this.reset();
  }

  reset() {
    this.t = 0;          // seconds on screen
    this.dead = false;   // the counter ran out; the grey frame is up
    this.deadT = 0;
  }

  _cfg() { return CONFIG.CONTINUE || {}; }
  _n(key, dflt) { const v = this._cfg()[key]; return v != null ? v : dflt; }

  /** How many whole seconds are left, 9 down to 0. */
  digit() {
    const secs = this._n('seconds', 9);
    return Math.max(0, secs - Math.floor(this.t));
  }

  /**
   * Every frame it is up. Returns 'go' to carry on, 'over' to hand to the game
   * over panel, or null.
   *
   * ⚠️ A PRESS AFTER ZERO DOES NOTHING, and that is the point of the screen.
   * The offer expires; a continue that could still be taken while the grey
   * frame is up would make the countdown decoration. So the press is only read
   * while `!this.dead`.
   *
   * ⚠️ THE COUNTDOWN RUNS TO THE END OF THE LAST SECOND, not to the moment the
   * digit becomes 0. `seconds: 9` shows 9 through 0, each for one second, and
   * the offer closes after the tenth -- otherwise the 0 the artist drew would
   * flash for a frame on its way to grey.
   */
  update(dt, input) {
    if (this.dead) {
      this.deadT += dt * 1000;
      return (this.deadT >= this._n('deadHoldMs', 1400)) ? 'over' : null;
    }
    this.t += dt;
    if (input && input.takeAnyPress()) return 'go';
    if (this.t >= this._n('seconds', 9) + 1) { this.dead = true; this.deadT = 0; }
    return null;
  }

  /**
   * The rect every layer is drawn into.
   *
   * FITTED BY HEIGHT AND CENTRED, with `hRel` and `yRel` as the only dials. The
   * sheet is 1.377:1 against a 1.778:1 canvas, so fitting by height is what
   * keeps all of it on screen -- fitting by width would push the figures' feet
   * off the bottom, and they are the thing that has to sit on the floor.
   */
  _rect(W, H, img) {
    const iw = img.width || img.naturalWidth, ih = img.height || img.naturalHeight;
    if (!iw || !ih) return null;
    const dh = H * this._n('hRel', 0.90);
    const dw = dh * iw / ih;
    return { x: (W - dw) / 2, y: H * this._n('yRel', 0.52) - dh / 2, w: dw, h: dh };
  }

  /**
   * `mul` swells the picture ABOUT ITS OWN CENTRE. Growing the drawn size
   * around the anchor is what makes a stamp read as a stamp rather than as the
   * panel sliding down and right off its corner -- the same arithmetic the fruit
   * select's punch uses, and the same note is on it there.
   */
  _blit(ctx, key, W, H, o) {
    const img = this.assets.getDrawable(key);
    if (!img) return;
    const r = this._rect(W, H, img);
    if (!r) return;
    const opt = o || {};
    const m = (opt.mul == null) ? 1 : opt.mul;
    /* THE CLIP IS IN THE PANEL'S OWN COORDINATES, as a fraction of its width,
       so it survives every `hRel`/`yRel` retune. `lo`/`hi` default to the whole
       thing; only the stamped dead frame passes them. */
    const clipped = (opt.lo != null || opt.hi != null);
    if (clipped) {
      const x0 = r.x + r.w * (opt.lo != null ? opt.lo : 0);
      const x1 = r.x + r.w * (opt.hi != null ? opt.hi : 1);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, -4000, Math.max(0, x1 - x0), 9000);
      ctx.clip();
    }
    if (m === 1) {
      ctx.drawImage(img, r.x, r.y, r.w, r.h);
    } else {
      /* SWOLLEN ABOUT A POINT IN THE PICTURE, not about the rect's middle --
         `cxRel`/`cyRel` are where the thing being stamped actually sits. */
      const cx = r.x + r.w * (opt.cxRel != null ? opt.cxRel : 0.5);
      const cy = r.y + r.h * (opt.cyRel != null ? opt.cyRel : 0.5);
      ctx.drawImage(img, cx - (cx - r.x) * m, cy - (cy - r.y) * m, r.w * m, r.h * m);
    }
    if (clipped) ctx.restore();
  }

  /**
   * The stamp on the grey frame, as a multiplier. 1 once it has settled.
   *
   * Asked for 2026-09-01: *"when at the last second, things turn gray, after it
   * activate the gray thing, add a medium punch to the coconuts, at the same
   * time."*
   *
   * ⚠️ THE COCONUTS ONLY, AND THIS PICTURE *CAN* BE SPLIT -- WHICH THE FRUIT
   * SELECT'S COULD NOT. It stamped the whole frame first and that was wrong:
   * *"only at the coconuts, don't punch the number display."* I had written the
   * usual note saying `contagem-dead` is one picture so there is nothing to stamp
   * but all of it -- and then measured it: the figures' ink ends at 0.545 of the
   * panel's width and the word and number begin at 0.575, **a 33px column of
   * nothing between them**. The select art had no such gap (one connected
   * component, 385 rows of ink in its thinnest column), which is why that one
   * needed an export and this one needs a clip. **The two cases look identical
   * and are not; measure before repeating the refusal.**
   *
   * ⚠️ IT FIRES ON `deadT`, THE SAME CLOCK THE GREY AND THE LIGHT RUN ON, so all
   * three land on one frame -- *"at the same time"* was the ask, and one clock
   * is the only way to keep it true when any of them is retuned.
   *
   * ⚠️ TINY AND INWARD: -0.10. The magnitude is the menu's; the sign is the
   * direction, and it is negative because *"instead of punching to the front,
   * punch it to the back"*. Same easeOutBack curve as the menu's and the fruit
   * select's, so all three are one gesture -- this one played backwards, which
   * is the right shape for a thing that has just STOPPED: the other two answer a
   * press, and this one answers a clock running out.
   */
  _popK() {
    const amt = this._n('deadPunch', -0.10);
    const ms = this._n('deadPunchMs', 400);
    /* ⚠️ THE SIGN IS THE DIRECTION, WHICH IS WHY THIS TESTS `!== 0` AND NOT
       `> 0`. A negative amount recoils AWAY from the camera and springs back;
       a positive one swells towards it. Asked for 2026-09-01: *"reverse the
       punch of the continue screen, instead of punching to the front, punch it
       to the back."* Carrying the direction in the sign rather than in a second
       `deadPunchIn: true` keeps it one number to read and one to tune -- and
       the curve below is untouched, so the two directions are the same gesture
       mirrored rather than two effects. */
    if (!amt || !(ms > 0)) return 1;
    const p = Math.min(1, this.deadT / ms);
    /* easeOutBack, the same constants title.js uses. Three lines duplicated
       rather than a shared helper: these two files share no module and one
       import path for one curve is more coupling than it saves. */
    const c1 = 1.70158, c3 = c1 + 1, q = p - 1;
    const e = 1 + c3 * q * q * q + c1 * q * q;
    return 1 + amt * (1 - e);
  }

  /**
   * Which of the two figure drawings is up, 0 or 1.
   *
   * TWO DRAWINGS ALTERNATING ON THEIR OWN CLOCK: he is slumped and breathing,
   * and the count is the thing that moves. Off `t` rather than a frame counter
   * so the pace is a duration in the config and not a number of updates.
   *
   * ⚠️ AND THE PERIOD SHRINKS ACROSS THE COUNTDOWN. Asked for 2026-09-01:
   * *"make the coconuts animation gradually much faster during the countdown"*.
   * `figureMs` at t=0, `figureEndMs` at the end of the count, straight-line
   * between them -- so the breathing that starts as a slump ends as a panic and
   * the picture tells you the offer is closing before the digit does.
   *
   * ⚠️ THE PHASE IS INTEGRATED, NOT DIVIDED, AND THAT IS THE WHOLE TRICK.
   * `floor(t / period)` is only a cycle count while `period` is CONSTANT; with a
   * period that shrinks, that expression is "how many of TODAY'S periods fit in
   * all the time so far", which jumps backwards and forwards as the period moves
   * and makes the figures stutter and skip rather than accelerate. What is
   * wanted is the number of cycles ACTUALLY COMPLETED, which is the integral of
   * the frequency: with p(t) = a + b*t that is (1/b)*ln((a + b*t)/a), and it is
   * exact rather than accumulated so it cannot drift with the frame rate.
   *
   * ⚠️ IT RUNS OFF THE COUNT'S OWN LENGTH, not a duration of its own. The ramp
   * is the countdown -- a second knob would be one more thing to keep in step
   * with `seconds`, and a ramp that finished early or late would read as the
   * animation having a reason of its own.
   */
  _figureFrame() {
    const a = this._n('figureMs', 380);
    if (!(a > 0)) return 0;
    const end = this._n('figureEndMs', a);
    const span = (this._n('seconds', 9) + 1) * 1000;      // the whole count, ms
    const t = Math.min(this.t * 1000, span);              // the ramp ends with it
    const b = (end > 0 && span > 0) ? (end - a) / span : 0;
    const phase = (b === 0) ? t / a : Math.log((a + b * t) / a) / b;
    return (Math.floor(phase) % 2) ? 1 : 0;
  }

  /**
   * The dark board, or null meaning "the digit itself".
   *
   * ⚠️ THE FLIP RUNS AT THE START OF THE NEW SECOND, NOT AT THE END OF THE OLD
   * ONE. A flap sign turns because the count changed -- the change is the cause
   * and the turn is what follows it, so the new digit's second opens with the
   * board dark and settles into the number. Hung at the end of the old second
   * instead, the digit you were reading would go out before anything had
   * happened, which reads as a dropout rather than as a mechanism.
   *
   * ⚠️ AND THE FIRST DIGIT FLIPS IN TOO. `t` starts at 0, so 9 gets the same
   * beat as every digit after it and the board arrives the way a sign does when
   * it wakes up. That is a consequence of measuring from the second boundary
   * rather than a special case, and it is the one that was wanted.
   */
  _flapFrame() {
    const ms = this._n('flapMs', 110);
    if (!(ms > 0)) return null;
    const into = (this.t - Math.floor(this.t)) * 1000;   // ms into this digit
    return (into < ms) ? 'continue:flapDark' : null;
  }

  draw(ctx, W, H) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    /* ⚠️ THE FIGHT IS DARKENED UNDER THE PANEL, AND I HAD ARGUED AGAINST IT.
       Asked for 2026-08-31: *"add a darkening filter like 30% to the game
       screen, before drawing these letters... so the gameplay kinda fades to
       background and the player has to decide."* The note that used to sit in
       game.js reasoned the opposite -- that dimming the thing you are deciding
       whether to go back to was the wrong note -- and the ask is the better
       read: the world is no longer what you are looking at, it is what you are
       looking at a decision ABOUT. It has to recede for the question to be the
       foreground.

       ⚠️ IT IS UNDER EVERY LAYER, INCLUDING THE GREY DEAD FRAME. The veil dims
       the WORLD, not the panel; drawn over the pictures it would take 30% off
       the artist's colours as well and the yellow would go muddy.

       ⚠️ `fadeInMs` FADES THE VEIL AND THE VEIL ONLY, AND IT USED TO CARRY THE
       PANEL WITH IT. That was a real bug and it was reported as one: *"it looks
       like the black filter is over everything... the characters of the continue
       screen looked darkened as well."* They were. Fading the panel in means the
       panel is TRANSLUCENT for those 250ms, and what shows through a translucent
       coconut is the world that has just been dimmed 30% -- so the darkening
       genuinely was on the characters, not because the veil was in the wrong
       place but because they were see-through while it arrived.

       ⚠️ THE GENERAL SHAPE: A FADE OVER A VEIL PUTS THE VEIL INSIDE WHAT IS
       FADING. Anything drawn at less than full alpha above a darkened layer
       takes that darkening on. So the fight recedes over a quarter of a second
       and the panel is solid from its first frame. 0 = both instant. */
    const fade = this._n('fadeInMs', 250);
    const veilP = fade > 0 ? Math.min(1, this.t * 1000 / fade) : 1;
    const veil = this._n('veilAlpha', 0.30);
    if (veil > 0) {
      ctx.globalAlpha = veil * veilP;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalAlpha = 1;
    if (this.dead) {
      /* ⚠️ THE GREY FRAME IS THE WHOLE PANEL, NOT A THIRD LAYER. The artist drew
         the figures, the word and the zero into one desaturated picture, so it
         REPLACES the two live layers rather than joining them -- drawing it over
         them would put a colour pair of coconuts under a grey pair.

         ⚠️ AND THE LIGHT COMES UP ON IT. Asked for 2026-09-01: *"when it gets
         black and white, it now gets black and white at once... after it gets
         black and white, make the grey more clear, give it a clearing to the
         gray, make the effect slow, like its illuminating the last frame"*. The
         SWITCH stays instant -- that is the count running out and it should land
         like a switch -- and then the frame is lit: it arrives at
         `deadLightFrom` brightness, murky, and rises to `deadLightTo` over
         `deadLightMs`. The grey clears as the light comes up on it.

         ⚠️ THE BRIGHTNESS IS A FILTER ON THE BLIT, NOT A WHITE VEIL OVER IT. A
         white rect at rising alpha would wash the WORLD behind the panel as well
         and take the picture towards flat white rather than towards a clearer
         grey; `ctx.filter` scales this image's own values and touches nothing
         else on the canvas. Same mechanism the props' recolour uses. It is
         cleared by the `restore()` below, which is why it can be set bare here.

         ⚠️ AND `deadLightMs` HAS TO FIT INSIDE `deadHoldMs`, which is why that
         hold grew with this change. A ramp still climbing when the game over
         panel takes the screen is a light being switched off mid-rise. */
      const lm = this._n('deadLightMs', 0);
      const from = this._n('deadLightFrom', 1), to = this._n('deadLightTo', 1);
      if (lm > 0 && (from !== 1 || to !== 1)) {
        const p = Math.min(1, this.deadT / lm);
        /* SMOOTHSTEP, NOT LINEAR. A light coming up has no hard start and no
           hard stop; a straight ramp arrives at full and simply stops, and the
           end of the move is the part being looked at here. */
        const e = p * p * (3 - 2 * p);
        ctx.filter = 'brightness(' + (from + (to - from) * e).toFixed(4) + ')';
      }
      /* TWO PASSES OVER ONE PICTURE: the word and the number at rest, then the
         figures stamped. Right first so the coconuts, which grow slightly past
         the split at the top of the pop, are cut by the clip rather than drawn
         over the number. */
      const sp = this._n('deadPunchSplit', 0.5595);
      this._blit(ctx, 'continue:dead', W, H, { lo: sp });
      this._blit(ctx, 'continue:dead', W, H, {
        hi: sp, mul: this._popK(),
        cxRel: this._n('deadPunchCX', 0.3009),
        cyRel: this._n('deadPunchCY', 0.5282),
      });
      ctx.restore();
      return;
    }
    // THE FIGURES, CYCLING -- see _figureFrame().
    this._blit(ctx, 'continue:fig' + this._figureFrame(), W, H);
    /* THE NUMBER AND THE WORD, over them -- they do not overlap, but the order
       is stated rather than left to chance in case the art ever grows.

       ⚠️ THE DARK BOARD IS NOT A LAYER ON TOP OF THE DIGIT, IT REPLACES IT. Both
       pictures carry the word CONTINUE? and the same grid at the same place, so
       drawing the blank over a number would leave the number showing through
       nothing and just repaint the word. One board is up at a time, which is
       also true of the real sign. */
    this._blit(ctx, this._flapFrame() || ('continue:n' + this.digit()), W, H);
    ctx.restore();
  }
}
