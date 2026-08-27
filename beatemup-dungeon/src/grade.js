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
    this.peak = 0;      // furthest the camera has been in this room
    this.span = 1;      // how far it can go
    this.t = 0;         // 0..1 through the day
    this.stops = null;  // parsed once per room
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
    this.on = !!(G && G.on && room && room.grade && G.stops && G.stops.length);
    this.peak = 0; this.t = 0; this.stops = null;
    if (!this.on) return;
    this.stops = G.stops.map(s => ({ t: s.t, rgb: Grade._rgb(s.color), a: s.alpha }));
    /* THE SAME SPAN THE CAMERA IS CLAMPED TO, so t reaches exactly 1 when the
       camera reaches the end of the room and not a pixel before -- `stage.js`
       clamps camX to `endX() - GAME_W`. Deriving it from `endX` alone would
       leave the last screen's worth of room permanently short of purple. */
    this.span = Math.max(1, stage.endX() - CONFIG.GAME_W);
  }

  clear() { this.on = false; }

  update(stage) {
    if (!this.on) return;
    if (stage.camX > this.peak) this.peak = stage.camX;
    this.t = Math.min(1, this.peak / this.span);
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
       shape is preserved by construction and the dial is one number. */
    const a = s.a * (CONFIG.GRADE.strength != null ? CONFIG.GRADE.strength : 1);
    if (!(a > 0)) return;
    ctx.save();
    ctx.globalCompositeOperation = CONFIG.GRADE.mode || 'multiply';
    ctx.globalAlpha = a;
    ctx.fillStyle = `rgb(${Math.round(s.rgb[0])},${Math.round(s.rgb[1])},${Math.round(s.rgb[2])})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}
