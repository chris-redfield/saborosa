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

  _blit(ctx, key, W, H) {
    const img = this.assets.getDrawable(key);
    if (!img) return;
    const r = this._rect(W, H, img);
    if (!r) return;
    ctx.drawImage(img, r.x, r.y, r.w, r.h);
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
         them would put a colour pair of coconuts under a grey pair. */
      this._blit(ctx, 'continue:dead', W, H);
      ctx.restore();
      return;
    }
    /* THE FIGURES, CYCLING. Two drawings alternating on their own clock: he is
       slumped and breathing, and the count is the thing that moves. Off `t`
       rather than a frame counter so the pace is a duration in the config and
       not a number of updates. */
    const ms = this._n('figureMs', 380);
    const f = (ms > 0 && Math.floor(this.t * 1000 / ms) % 2) ? 1 : 0;
    this._blit(ctx, 'continue:fig' + f, W, H);
    // The number and the word, over them -- they do not overlap, but the order
    // is stated rather than left to chance in case the art ever grows.
    this._blit(ctx, 'continue:n' + this.digit(), W, H);
    ctx.restore();
  }
}
