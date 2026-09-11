/**
 * Grade — the day passing over a room, as a colour cast.
 *
 * WHAT IT IS. One composited rectangle over the whole frame, whose colour walks
 * from orange to purple as the player crosses the room. Asked for 2026-08-27:
 * "a color filter on stage 2 ... begin with a color like orange, and end with
 * purple, that will give the player the impression that the day is passing ...
 * it should affect everything on screen, except the HUD ... smooth transition,
 * almost unperceivable".
 *
 * ⚠️ IT IS DRIVEN BY DISTANCE, NOT BY TIME, and that is what makes the brief
 * literally true. "Purple at the end" is a promise about a PLACE, and only a
 * position clock keeps it: a wall clock would turn the sky purple early for a
 * player who lingers in the first fight and leave it orange for one who runs.
 * The cost is that the sunset pauses during a locked arena, which is invisible
 * -- nothing is moving to compare it against -- and resumes when they walk on.
 *
 * ⚠️ AND IT IS A HIGH-WATER MARK, so the day never runs backwards. This room
 * reverses (see reverseFloorX): the player can walk back over ground they have
 * already crossed, and a raw `camX / span` would rewind the sunset while they
 * did it. Evenings do not do that. `peak` only ever goes up.
 *
 * ⚠️ THE CLOCK COMES FROM `stage.dayClock01()` AND NOT FROM `camX` DIRECTLY,
 * which is what let the library take the same effect on 2026-09-05. Every
 * ordinary room answers it with exactly the camera fraction this file used to
 * compute; the bookcase answers with its FILM position, because its shot is a
 * switchback that visits the same camX three times at three different heights
 * -- a camera clock reads the same value on shelf 1 and shelf 3 there, and runs
 * backwards for the whole of shelf 2, which walks left. What stayed here is the
 * high-water mark: the stage says where the shot has got to, and this file
 * decides that an evening does not run backwards.
 *
 * ⚠️ THE RAMP HAS STOPS BECAUSE ORANGE TO PURPLE IS NOT A STRAIGHT LINE. Lerped
 * channel-wise in one hop, #ffa24a -> #6b3fa0 passes through a dead grey-brown
 * around the middle -- the two colours sit on opposite sides of the wheel, so
 * the straight line between them goes through the middle of it. The stops bend
 * the path the way a sky actually goes: orange, then red, then a pink-purple,
 * then purple. Each leg is a short lerp and no leg crosses the grey.
 *
 * ⚠️ MULTIPLY, NOT source-over. A flat rectangle at 20% alpha is a sheet of
 * coloured plastic over the picture: it lifts the blacks and flattens the whole
 * frame toward one value. `multiply` is coloured LIGHT -- it leaves black black,
 * tints the midtones and darkens as the tint darkens, which is what an evening
 * does to a desert. The alpha ramps up along with the colour so dusk is dimmer
 * than noon without a separate darkening pass.
 *
 * ⚠️ IT IS NOT ONLY A DAY ANY MORE (2026-09-11). The bookcase runs the same
 * machinery as a NIGHT -- blue, bluish purple, purple -- with its own stops and
 * its own strength, named by `ROOMS[3].grade: 'night'` and looked up in
 * `CONFIG.GRADE.PRESETS`. Two things about it are worth knowing here: its ramp
 * is far heavier than the desert's (which is why a preset carries a strength of
 * its own, instead of the one shared number both rooms used to divide), and its
 * CLOCK IS STEPPED -- `Level3.gradeClock01()` holds a colour flat for a whole
 * shelf and moves to the next one only while a lift is rising. Nothing in this
 * file knows that; it asks for a number between 0 and 1 and the room decides
 * what makes it move. That is the same division as the high-water mark.
 *
 * ⚠️ IT IS DRAWN BEFORE THE HUD AND THAT IS THE WHOLE OF "EXCEPT THE HUD".
 * game.js paints the layers, then the combat FX, then this, then the bars. There
 * is no mask and no second canvas; the exclusion IS the draw order. Anything
 * that must stay ungraded goes after this call, and anything that must be graded
 * goes before it -- which is also why the room fade, the dev text and the debug
 * overlay are all untouched.
 */
class Grade {
  constructor() {
    this.on = false;
    this.peak = 0;      // furthest through the room the shot has been, 0..1
    this.t = 0;         // 0..1 through the day
    this.stops = null;  // parsed once per room
    this.strength = 1;  // the room's master level -- per preset, see enterRoom
    this.saturate = 1;  // the room's saturation pass, 1 = off. See enterRoom
  }

  static _rgb(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16),
            parseInt(h.slice(2, 4), 16),
            parseInt(h.slice(4, 6), 16)];
  }

  /**
   * Opt in per room, exactly like `scenery` and `flies` (`ROOMS[n].grade`).
   *
   * The street is a different day and the boss room is indoors; a sunset belongs
   * to the room that was asked for and declaring it is how a second room asks.
   */
  enterRoom(room, stage) {
    const G = CONFIG.GRADE;
    this.on = false;
    this.peak = 0; this.t = 0; this.stops = null;
    this.strength = 1; this.saturate = 1;
    if (!(G && G.on && room && room.grade)) return;
    /* ⚠️ A ROOM MAY NAME A PRESET INSTEAD OF SAYING `true`, and a preset carries
       BOTH halves -- its stops AND its own strength. The desert and the library
       shared one ramp and one multiplier until 2026-09-11, which meant the
       bookcase could not be pushed without moving stage 2 with it; the library
       is a NIGHT now (blue -> bluish purple -> purple) and wants a much heavier
       tint than a sunset does. `true` still means the default day ramp, so
       nothing that was opted in has to say anything new. */
    let P = null;
    if (typeof room.grade === 'string') {
      P = (G.PRESETS && G.PRESETS[room.grade]) || null;
      /* ⚠️ LOUD, because the fallback LOOKS FINE: a missing preset would quietly
         paint an orange sunset over the room that asked for a night. */
      if (!P && typeof console !== 'undefined') {
        console.warn('Grade: no preset named "' + room.grade + '", falling back to CONFIG.GRADE.stops');
      }
    }
    const stops = (P && P.stops && P.stops.length) ? P.stops : G.stops;
    if (!stops || !stops.length) return;
    this.on = true;
    /* The preset's own level if it has one, the shared one otherwise. */
    this.strength = (P && P.strength != null) ? P.strength
                  : (G.strength != null ? G.strength : 1);
    /* ⚠️ THE SATURATION PASS IS PER PRESET AND DEFAULTS TO 1 -- OFF -- so a room
       that says nothing pays nothing, which matters because unlike the tint this
       one is a full-frame blit rather than a rectangle. See `_saturate`. */
    this.saturate = (P && P.saturate != null) ? P.saturate
                  : (G.saturate != null ? G.saturate : 1);
    this.stops = stops.map(s => ({ t: s.t, rgb: Grade._rgb(s.color), a: s.alpha }));
    /* ⚠️ NOTHING IS MEASURED HERE ANY MORE. The span used to be read off the
       stage on the way in, which was fine while the clock was the camera and
       wrong the moment it was not: level3.js lays its bands out in its OWN
       `enterRoom`, and the order of the two is stage.js's business rather than
       something this file should be relying on. `dayClock01()` is asked every
       frame instead and answers whatever the room is by then. */
  }

  clear() { this.on = false; }

  update(stage) {
    if (!this.on) return;
    const c = stage.dayClock01();
    if (c > this.peak) this.peak = c;
    this.t = Math.min(1, this.peak);
  }

  /** The colour and strength for the current t, walked along the stops. */
  _sample() {
    const S = this.stops, n = S.length;
    if (this.t <= S[0].t) return S[0];
    if (this.t >= S[n - 1].t) return S[n - 1];
    let i = 0;
    while (i < n - 2 && this.t > S[i + 1].t) i++;
    const a = S[i], b = S[i + 1];
    const f = (this.t - a.t) / Math.max(1e-6, b.t - a.t);
    return {
      rgb: [a.rgb[0] + (b.rgb[0] - a.rgb[0]) * f,
            a.rgb[1] + (b.rgb[1] - a.rgb[1]) * f,
            a.rgb[2] + (b.rgb[2] - a.rgb[2]) * f],
      a: a.a + (b.a - a.a) * f,
    };
  }

  draw(ctx, w, h) {
    if (!this.on) return;
    const s = this._sample();
    /* ⚠️ ONE MASTER MULTIPLIER OVER THE WHOLE RAMP, applied here rather than
       baked into the stops. The stops are the SHAPE of the day -- which colour,
       and how the weight builds from noon to dusk -- and `strength` is how much
       of it is let through. Tuning "too strong" by editing four alphas is four
       chances to change the shape while trying to change the level; this way the
       shape is preserved by construction and the dial is one number.

       ⚠️ IT IS THE ROOM'S MULTIPLIER, RESOLVED ON THE WAY IN, not
       `CONFIG.GRADE.strength` read here. A preset brings its own -- the night
       over the bookcase needs roughly double the sunset over the desert, and
       reading the shared number here would have tied the two together again in
       the one line that was supposed to separate them. */
    const a = s.a * (this.strength != null ? this.strength : 1);
    if (a > 0) {
      ctx.save();
      ctx.globalCompositeOperation = CONFIG.GRADE.mode || 'multiply';
      ctx.globalAlpha = a;
      ctx.fillStyle = `rgb(${Math.round(s.rgb[0])},${Math.round(s.rgb[1])},${Math.round(s.rgb[2])})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    /* ⚠️ AFTER THE TINT, ON PURPOSE AND BY REQUEST -- *"increase the saturation
       of the image in 10%, ON TOP OF the filter"*. The two are not commutative:
       saturating first and tinting after would boost the room's own colours and
       then bury them under the blue; this way the thing being saturated IS the
       graded picture, so it is the NIGHT that gets its colour back rather than
       the daylight underneath it. */
    this._saturate(ctx, w, h);
  }

  /**
   * Push the whole composited frame's saturation, in place.
   *
   * ⚠️ IT IS A SELF-BLIT, AND THERE IS NO OTHER WAY TO DO THIS ON A 2D CANVAS.
   * `ctx.filter` applies to what you DRAW, not to what is already down -- so to
   * filter the frame you have to draw the frame, and the only copy of it is the
   * canvas itself. `drawImage(ctx.canvas, 0, 0)` is defined against a SNAPSHOT
   * taken when the call is made, so reading and writing the same bitmap is
   * well-defined rather than a trick.
   *
   * ⚠️ `copy`, NOT source-over, AND THAT IS THE WHOLE CORRECTNESS OF IT. Drawn
   * normally the saturated frame would be composited ON TOP of the frame it was
   * made from -- the picture over itself, which for an opaque frame is a no-op
   * you would never see, and for anything with alpha in it is a double-exposure.
   * `copy` clears the destination and replaces it. The canvas is created with
   * `{ alpha: false }` and the source is fully opaque, so nothing is lost.
   *
   * ⚠️ IT IS A FULL-FRAME BLIT EVERY FRAME, WHICH IS WHY IT IS OPT-IN. The tint
   * above is a rectangle; this is 1280x720 read and written through a filter.
   * Only a room whose preset names `saturate` pays for it, and `1` -- the
   * default -- returns before touching the context. This game has a VRAM
   * history on old cards (see PERFORMANCE.md), so if stage 3 ever drops frames
   * this is the first thing to switch off and the cheapest thing to lose.
   *
   * ⚠️ AND IT DEGRADES TO NOTHING RATHER THAN TO WRONG. A browser without
   * `ctx.filter` ignores the assignment, and the pass becomes an identity copy
   * of the frame onto itself: wasted, invisible, not broken.
   *
   * ⚠️ IT SITS INSIDE `draw`, SO THE HUD IS EXCLUDED FOR FREE. "Everything
   * except the HUD" is the draw order in this game and nothing else -- see the
   * header. A saturation pass called from game.js would have been one more
   * place that has to be kept below the bars by hand.
   */
  _saturate(ctx, w, h) {
    const k = this.saturate;
    if (!(k > 0) || k === 1) return;
    if (!ctx.canvas) return;
    ctx.save();
    ctx.filter = `saturate(${k})`;
    ctx.globalCompositeOperation = 'copy';
    ctx.globalAlpha = 1;
    ctx.drawImage(ctx.canvas, 0, 0, w, h);
    ctx.restore();
  }
}
