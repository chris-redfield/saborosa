/**
 * Elevador — the hand-drawn lift, and the ONE place that knows how to draw it.
 *
 * ⚠️ THIS FILE EXISTS BECAUSE A SECOND USER TURNED UP, NOT BECAUSE SHARING IS
 * TIDY. The art landed for level 3's shelf-climb and lived inside level3.js,
 * which was right while the bookcase was the only room with a lift in it. On
 * 2026-09-04 HIPÓLITO's room got one too — the player rides out of the boss
 * fight on it and arrives in the library on it — and the alternative was
 * `Level3.drawSlab(...)` being called from the boss room's cutscene. That is
 * exactly backwards: level 3's standing rule is that it REPLACES shared systems
 * for itself and touches nothing else, and a room reaching INTO it is the same
 * coupling wearing the other coat.
 *
 * So the drawing moved out and level 3 kept everything that is about level 3:
 * where its lifts stand in world x, which of them are on screen, and the boil
 * clock driven by its own camera. What came here is the part that was never
 * about the bookcase — how to turn "the front lip's centre is at this point on
 * screen, this wide" into pixels.
 *
 * ⚠️ THE ANCHOR IS THE FRONT LIP'S CENTRE, NOT THE IMAGE'S BOTTOM. The cutter
 * (tools/build-beat-elevador-defs.py) measures the near lip and writes `ax`/`ay`
 * to it, because the front FACE hangs below that line the way a body hangs
 * above it. Anchoring on the image's bottom sinks the slab by its own thickness
 * and puts the rider's feet in mid-air.
 *
 * ⚠️ ONE KNOB, AND EVERY OTHER PROPORTION COMES OUT OF THE DRAWING. `widthPx` is
 * how wide the near lip is on screen; the scale follows from it and the pack's
 * own `frontW`. An illustrated slab already HAS a perspective — do not add one.
 */
const Elevador = {
  _art: null,

  /**
   * The pack, once the loader has it. Null until then, which is a REAL state
   * and not an error: callers draw NOTHING rather than falling back to a shape.
   *
   * ⚠️ A MISS IS NOT CACHED, and that is the point of the guard rather than a
   * style choice. This is first asked on the frame a room is drawn, which can be
   * before the loader has the pack; caching the null would answer "there is no
   * elevator" for the rest of the run and every lift in the game would be
   * invisible with nothing in the log.
   */
  art(assets) {
    if (this._art) return this._art;
    const d = (assets && assets.getJSON) ? assets.getJSON('elevador') : null;
    if (d && d.frames && d.frames.length) this._art = d;
    return this._art || null;
  },

  /** How many boil frames the pack has. 0 while it is still loading. */
  frameCount(assets) {
    const A = this.art(assets);
    return A ? A.frames.length : 0;
  },

  /**
   * The slab's geometry from where its front lip's centre sits ON SCREEN.
   *
   * `cx`/`y` are screen pixels and deliberately so: what varies between the two
   * users is how they arrive at that point — level 3 subtracts its own camera
   * from a world x, the ride cutscene lifts it off the belt line — and neither
   * of those is this file's business.
   */
  rect(assets, cx, y, widthPx) {
    const A = this.art(assets);
    const w = widthPx || 1010;
    /* ⚠️ THE HEIGHT NUDGE IS APPLIED **HERE**, WHICH IS WHY NEITHER CALLER HAD
       TO CHANGE. Both of them arrive at the belt line their own way and then
       ask this for a rect; taking the lift off here means one number moves
       every slab in the game and a third user gets it without knowing it
       exists. See CONFIG.ELEVADOR. */
    return { cx: cx, y: y - this.lift(), wFront: w, scale: A ? w / A.frontW : 1 };
  },

  /* --- The height nudge, and the rider it carries --------------------------
     Asked for 2026-09-05: the lift a finger higher on screen, *"e o personagem
     sobe junto"*. The reasoning is all on CONFIG.ELEVADOR; what lives here is
     the half that cannot live in config -- WHO is standing on a slab. */

  /** How far above the belt line every slab is drawn. 0 disables the feature. */
  lift() {
    const E = CONFIG.ELEVADOR || {};
    return E.liftPx || 0;
  },

  /* WHERE THE SLABS WERE DRAWN LAST FRAME, in SCREEN x, filled by `draw`.
     ⚠️ THE REGISTRY IS THE POINT, AND IT IS NOT LAZINESS ABOUT ASKING THE
     ROOMS. Two different objects put lifts on screen -- level 3's shelf-climb
     knows its own band's platforms, and the ride cutscene's slab stays PARKED
     under the player after the ride has handed back and level 3 has taken over,
     which is a slab level 3 has never heard of. Either the rider test learns
     both (and every future one), or it asks the one thing that already knows
     where a lift is because it just painted it. This is the second.

     ⚠️ SCREEN SPACE, NOT WORLD SPACE, because that is the only space both
     callers agree in -- level 3 subtracts its own camera and the cutscene
     subtracts the stage's. The rider is converted the same way at test time.

     ⚠️ AND IT IS ONE FRAME STALE by construction: draws happen after updates,
     so `tickRider` reads what was painted last frame. Over a 0.15s ease that is
     invisible, and the alternative -- a second geometry pass in the update --
     is exactly the duplicate this avoids.

     ⚠️ THE RENDERER OPENS THE FRAME (`beginFrame`) AND THE RIDER ONLY READS IT,
     which is the other way round from how this was first written and the reason
     is the PAUSE. Clearing the list inside `tickRider` looks tidier -- consume
     what you read -- but the pause card DRAWS the world every frame and ticks
     nothing, so the slabs would pile up for as long as the game sat paused. The
     side that runs on every painted frame has to be the side that clears. */
  _slabs: [],

  /** Open a new frame's registry. Called once at the top of game.js `render`. */
  beginFrame() { this._slabs.length = 0; },

  /**
   * The rider's height, eased. Called once per frame from game.js, above the
   * phase machine, because the lift is on screen in phases `update()` never
   * runs in (`liftout` and `liftin` are both cutscenes).
   *
   * ⚠️ IT ONLY READS THE REGISTRY -- `beginFrame` clears it. A frame in which no
   * slab is painted (a black fade, an end card) therefore leaves an EMPTY list
   * and he eases back to the floor, rather than being held up on the memory of
   * a lift; see the note on `_slabs` for why the clearing lives on that side.
   */
  tickRider(dt, player, camX) {
    const E = CONFIG.ELEVADOR || {};
    const slabs = this._slabs;
    if (!player) return;
    if (player.riseY == null) player.riseY = 0;
    const lift = this.lift();
    let target = 0;
    if (lift > 0) {
      const half = (E.standHalfRel != null ? E.standHalfRel : 0.35);
      const px = player.x - (camX || 0);
      for (const s of slabs) {
        if (Math.abs(px - s.cx) <= s.wFront * half) { target = lift; break; }
      }
    }
    /* A SPEED, SO THE STEP KEEPS ITS PACE WHATEVER `liftPx` IS. Both directions
       at the same rate: stepping down off a lift is the same edge. */
    const step = (E.riseSpeed != null ? E.riseSpeed : 160) * dt;
    if (player.riseY < target) player.riseY = Math.min(target, player.riseY + step);
    else if (player.riseY > target) player.riseY = Math.max(target, player.riseY - step);
  },

  /** Put him back on the floor with no ease. For the room swap; see LiftRide. */
  clearRider(player) { if (player) player.riseY = 0; },

  /**
   * One slab, at a rect from `rect()`. Draws nothing until the pack is in.
   *
   * ⚠️ `standable` IS THE DRAWER'S ANSWER TO "CAN HE BE ON THIS ONE?", and it is
   * asked rather than measured on purpose. The rider test below is an x-overlap,
   * and an x-overlap alone would hold the player up while the boss room's lift
   * is still 900px overhead descending TOWARD him -- he is directly under it for
   * a second and a half. Deriving "is it at rest" from the rect was tried on
   * paper and every version of it either failed during the RIDE (where the slab
   * is far off the belt line and he is genuinely on it) or during a JUMP taken
   * on a parked one. The object drawing the slab already knows which of its own
   * beats he is aboard for; nothing else can work it out.
   *
   * It defaults to TRUE so level 3 -- whose slabs are always at rest and always
   * boardable -- needs no argument, and so a third user gets the ordinary case
   * for free.
   */
  draw(ctx, assets, f, r, standable) {
    const A = this.art(assets);
    const img = (assets && assets.getDrawable) ? assets.getDrawable('elevador') : null;
    if (!A || !img || !r) return;
    const fr = A.frames[f] || A.frames[0];
    /* THE SLAB SAYS WHERE IT IS, so `tickRider` never has to ask a room. Noted
       on every drawn slab and not only the ridden one: the lift AHEAD at the
       end of a shelf is walked onto, and the one BEHIND is walked off. */
    if (standable !== false) this._slabs.push({ cx: r.cx, wFront: r.wFront });
    const w = fr.w * r.scale, h = fr.h * r.scale;
    const x = Math.round(r.cx - A.ax * r.scale);
    const y = Math.round(r.y - A.ay * r.scale);
    ctx.drawImage(img, fr.x, fr.y, fr.w, fr.h, x, y, Math.round(w), Math.round(h));
  },
};
