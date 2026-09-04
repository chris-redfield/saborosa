/**
 * Vermes — the worms stuck to the bookcase's wall.
 *
 * Level 3's answer to the desert's cigarette mounds, and it is deliberately a
 * SEPARATE FILE rather than a mode of scenery.js. That is level 3's standing
 * rule (*"please isolate this behavior to this level... trying to make this
 * logic work alongside the other logic will be our demise"*): the bookcase
 * REPLACES the stage, the camera and the backdrop for itself and touches
 * nothing else. scenery.js is unchanged by this file existing.
 *
 * ⚠️ THEY ANSWER NOTHING, exactly like the mounds. No hitbox, no z-sort, no
 * shadow, no crowd entry; neither combat.js nor stage.js ever asks one a
 * question. That is the bargain that makes a wall's worth of them affordable
 * (see STATE.md, *The flies*).
 *
 * ---------------------------------------------------------------------------
 * ⚠️ WHY THIS CANNOT JUST BE `x - camX`, WHICH IS THE WHOLE PROBLEM
 * ---------------------------------------------------------------------------
 * The desert's plate SCROLLS: it is an image drawn at an offset, so a mound at
 * parallax 1.0 is welded to the sand for free. Level 3's plate is a VIDEO that
 * FILLS THE FRAME -- backdrop.js says so in as many words -- and the pan lives
 * inside the footage. The plate never moves on screen at all, so there is no
 * camera offset that means "where the wall has got to", and a worm drawn at a
 * fixed screen position is painted on the LENS, not on the bookcase.
 *
 * The only thing that knows where the wall is, is the footage. So it was
 * measured: `tools/build-level-3-plate.py --track` phase-correlates the shot it
 * already correlates for the legs and writes `level-3-wall-track.json` -- the
 * wall's own horizontal travel in canvas px, one sample per film frame. This
 * file samples it at `Level3.progress` and offsets by it. That is the weld.
 *
 * ⚠️ AND IT IS A TRACK RATHER THAN A RATE PER LEG BECAUSE THE SHOT WAS PANNED
 * BY HAND. Fitting a constant speed to each horizontal leg leaves up to 12% of
 * that leg unaccounted for -- about 580 canvas px at this scale, most of a
 * screen of slide, on art whose entire job is to look stuck down. Three numbers
 * would have looked right in the config and wrong on the screen.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ ONE WALL SPACE, BOTH AXES -- AND THAT IS WHAT MAKES THE LIFTS WORK
 * ---------------------------------------------------------------------------
 * The track carries `x` AND `y`, every frame, on every leg. So every patch in
 * the room lives in one (x, y) space and is drawn at
 * `it.x - wallX(), it.y - wallY()`, whichever leg the room is in.
 *
 * ⚠️ BOTH AXES MOVE ON EVERY LEG, INCLUDING THE ONES NAMED AFTER THE OTHER AXIS
 * (2026-09-04). The track used to hold each axis flat across the other's legs,
 * because a pan "does not move vertically". This shot does: shelf 2's pan slides
 * DOWN 274 canvas px over its 14 seconds -- a third of the frame -- and the
 * first rise slides 232 px sideways. `legs()` labels a leg by which axis
 * DOMINATES, which is the right question for the room's path and the wrong one
 * for art glued to the wall. So the worms follow the drift, which is what makes
 * them stay on their books rather than creep up them.
 *
 * ⚠️ THIS DOES NOT CONTRADICT THE OLD "PER-LEG, NOT PER-ROOM" RULE, IT
 * COMPLETES IT. That rule was written against a wall space with ONE axis, where
 * leg 2 walks back across x leg 0 already used and the same patch would land on
 * two shelves. It does -- but 4826 px HIGHER. With y in the space, (x, y) names
 * a spot on the bookcase exactly once and the ambiguity is gone. The layout is
 * still done a leg at a time, because each leg still decides its own span; the
 * COORDINATES are now shared.
 *
 * ⚠️ AND THAT IS THE WHOLE FIX FOR THE POP. The worms used to vanish at every
 * leg boundary because a lift drew nothing. Now shelf 1's patches simply keep
 * being drawn as the film climbs, ride DOWN the frame and leave out of the
 * bottom, and shelf 2's arrive from the top before the ride ends -- no fade, no
 * hand-off, nothing to time. The lift legs only have to dress the wall BETWEEN
 * those two, which is what `perLiftScreen` is for.
 *
 * ⚠️ A LIFT LEG'S OWN PATCHES MUST NOT REACH EITHER END OF ITS TRAVEL, and that
 * is not a nicety. A walk leg barely moves in y, so a patch that is on screen at
 * the moment a ride starts is on screen for very nearly the WHOLE of the walk
 * leg before it -- pinned over the shelf the player is walking along, on the
 * floor the walk layout deliberately keeps clear (`yTo`). So a lift's window
 * stops short at both ends and the two walk legs dress the rest, because it is
 * their wall.
 *
 * ⚠️ AND THE STOPPING POINT IS THE NEIGHBOUR'S MEASURED EXTREME, NOT THE LIFT'S
 * OWN END. It used to be "the lift's endpoint minus a screen and a knot", which
 * was only right while a walk leg's wall y could not move. Now that shelf 2
 * slides 274 px through its own leg, the margin it was relying on is most of the
 * way spent -- so the window is cut against the RANGE of wall y over the
 * neighbouring walk legs. Measure the neighbour; do not budget for it.
 *
 * ⚠️ THE PACK IS NINE KNOTS, NOT TWO PATCHES, and that is the cigarettes'
 * lesson applied: the mound sheets are chopped into their pieces and the field
 * is COMPOSED from them. These sheets chop by COLUMN rather than by row -- the
 * worms run right across the width, so there are no row bands to find -- giving
 * 4 knots off the dense sheet and 5 off the sparse one, from 27x40 to 117x199
 * drawn. `sheetOf` says which sheet each came from, which is all `denseShare`
 * needs to bias the scatter one way or the other.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ EVERY LEG IS SCATTERED OVER THE WALL IT ACTUALLY SHOWS
 * ---------------------------------------------------------------------------
 * A leg's window is read off the TRACK -- where the wall stands when the leg
 * starts and where it stands when it ends -- not off `L.px` from an assumed
 * zero.
 *
 * ⚠️ AND THAT IS A FIX, NOT A REFACTOR. The old layout ran every leg from
 * `-GAME_W` as though the wall started at 0, which is true of leg 0 and of
 * nothing else. Leg 2 begins at wall x 3647 and walks DOWN to -1869, so its
 * patches were laid across x it never reaches: measured, half a screen of bare
 * wall at the far end of legs 2 and 4, and 43% of leg 4's patches scattered
 * onto wall the camera never gets to. Same count, same knots, same `perLeg` --
 * they are simply on the part of the bookcase you can see now, which is worth
 * about a third more worms on shelves 2 and 3.
 *
 * THE LAYOUT IS HASHED, not random: the player can be carried back down past a
 * shelf they have seen, and a re-rolled infestation would be a different wall.
 * Same rule and the same `_h` as scenery.js.
 *
 * ⚠️ "NO PARALLAX, BUT LAYERS." Asked for in those terms. So `bands` still
 * exists and still splits the field into planes -- they differ in SCALE and in
 * draw order, near ones over far ones -- but every band reads the same track at
 * the same rate. A band that scrolled slower would come unstuck from the wall,
 * which is the one thing this file is for. The desert does the opposite on
 * purpose (see scenery.js) and that is the difference between a floor you look
 * across and a wall you look at.
 */
class Vermes {
  constructor(assets) {
    this.assets = assets;
    /* {leg,x,y,v,s,b} -- which leg laid it down (debug only; the draw does not
       filter on it any more), its position in the ROOM'S wall space, which
       patch, drawn scale, and its band. */
    this.items = [];
    this.defs = null;
    this.track = null;
  }

  /** The same hash scenery.js uses -- same room, same wall, every time. */
  static _h(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  _packs() {
    if (this.defs) return this.defs;
    const a = this.assets;
    if (!a || !a.getJSON) return null;
    const d = a.getJSON('vermes');
    if (d && d.frames && d.variants) this.defs = d;
    if (!this.track) this.track = a.getJSON('level3Track') || null;
    return this.defs;
  }

  /**
   * WHERE THE WALL HAS GOT TO, in canvas px, right now -- on both axes.
   *
   * ⚠️ SAMPLED, NOT INTERPOLATED, and that is not laziness: the track is one
   * value per FILM FRAME and the film is the thing being drawn, so the sample
   * the plate is showing is the sample the worms want. Interpolating between
   * two of them would put the worms on a wall position the footage is not
   * currently displaying -- a sub-frame lead or lag against the only thing they
   * are supposed to match.
   */
  _at(axis, i) {
    const t = this.track;
    const a = t && t[axis];
    if (!a || !a.length) return 0;
    return a[Math.max(0, Math.min(a.length - 1, i))];
  }

  /** The film frame the plate is showing. Both axes read the same one. */
  _frame() {
    const t = this.track;
    return t && t.fps ? Math.round(Level3.progress * t.fps) : 0;
  }

  wallX() { return this._at('x', this._frame()); }
  wallY() { return this._at('y', this._frame()); }

  /**
   * Where the wall stood at a given FILM SECOND. This is what anchors a leg:
   * the layout asks the track where the wall is at the leg's two ends and
   * scatters between them, rather than assuming a leg starts at zero.
   */
  _wallAt(sec) {
    const t = this.track;
    const i = t && t.fps ? Math.round(sec * t.fps) : 0;
    return { x: this._at('x', i), y: this._at('y', i) };
  }

  /**
   * The EXTREMES of one axis over a leg -- what the layout scatters between.
   *
   * ⚠️ NOT THE TWO ENDPOINTS. Both axes move on every leg now, so a pan that
   * ends where it began in y can still have wandered 200 px through the middle,
   * and a window built from endpoints would leave that wander bare. This is also
   * what a lift's window is cut against: the measured reach of its NEIGHBOURS.
   */
  _wallRange(axis, sec0, sec1) {
    const t = this.track;
    if (!t || !t.fps) return { min: 0, max: 0 };
    const a = Math.max(0, Math.round(sec0 * t.fps));
    const b = Math.max(a, Math.round(sec1 * t.fps));
    let lo = Infinity, hi = -Infinity;
    for (let i = a; i <= b; i++) {
      const v = this._at(axis, i);
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    return { min: lo, max: hi };
  }

  /** The nearest walk leg before (`step` -1) or after (`step` +1) index `li`. */
  _neighbourWalk(legs, li, step) {
    for (let i = li + step; i >= 0 && i < legs.length; i += step)
      if (legs[i].kind === 'walk' && legs[i].film) return legs[i];
    return null;
  }

  /**
   * Lay out every leg's patches -- WALKS AND LIFTS. Called once, on entering.
   *
   * Every item lands in the room's single (x, y) wall space, so the draw never
   * has to know which leg is on screen. What each leg decides is its own WINDOW:
   * a walk spreads along the wall x it pans across, a lift along the wall y it
   * climbs.
   */
  enterRoom(room) {
    this.items = [];
    const C = CONFIG.VERMES;
    if (!C || C.on === false) return;
    if (!Level3.owns(room)) return;
    const d = this._packs();
    if (!d) return;

    const legs = (CONFIG.LEVEL3 && CONFIG.LEVEL3.legs) || [];
    const bands = Math.max(1, C.bands || 1);
    const beltTop = (room.belt && room.belt.topY) || CONFIG.beltTopY;
    const GW = CONFIG.GAME_W, GH = CONFIG.GAME_H;
    /* HALF THE TALLEST KNOT DRAWN (693/2, rounded up), which is what "off the
       screen" has to mean for art anchored at its CENTRE. Used as the margin at
       both ends of a lift's window and across a lift's width. */
    const PAD = 360;
    let n = 0;
    for (let li = 0; li < legs.length; li++) {
      const L = legs[li];
      if (!L.film) continue;
      const w0 = this._wallAt(L.film[0]);
      const rx = this._wallRange('x', L.film[0], L.film[1]);
      const ry = this._wallRange('y', L.film[0], L.film[1]);
      const lift = L.kind !== 'walk';

      /* THE WINDOW THIS LEG SCATTERS OVER, in wall space.

         A WALK moves in x and holds y: the wall it shows is everything between
         its two ends plus one screen (the frame is a screen wide), plus a
         screen of margin so a patch is never born half-visible at the edge. Its
         y is the book band, exactly as before -- `yFrom`/`yTo` are fractions of
         the belt's top, now measured from the leg's own wall y instead of from
         an implied zero.

         ⚠️ A LIFT IS THE OTHER WAY ROUND AND ITS WINDOW IS SHORTER THAN ITS
         TRAVEL. It spreads along y and holds x, and it must stop a screen-plus-
         a-knot short of the wall the NEXT walk leg stands on and a knot short of
         the one the PREVIOUS walk leg stands on -- see the header. Those two
         ends are already dressed by those legs, and anything the lift put there
         would be nailed to the shelf for the whole of that walk. */
      let lo, span, count;
      if (lift) {
        /* ⚠️ CUT AGAINST THE NEIGHBOURS' MEASURED REACH, not against this leg's
           own endpoints. A walk leg drifts in y as well now (shelf 2 by 274 px),
           so the wall it will occupy is a RANGE, and anything of the lift's
           inside that range is nailed to that shelf for the whole walk. */
        const prev = this._neighbourWalk(legs, li, -1);
        const next = this._neighbourWalk(legs, li, +1);
        const hi = (prev ? this._wallRange('y', prev.film[0], prev.film[1]).min : ry.max) - PAD;
        lo = (next ? this._wallRange('y', next.film[0], next.film[1]).max : ry.min) + GH + PAD;
        span = hi - lo;
        /* HOW MANY, FROM HOW MANY SHOULD BE ON SCREEN. A knot is visible over
           GH + 2*PAD of travel, so this is the honest conversion from "patches
           in frame" to "patches over the whole climb". A short lift keeps the
           density and simply gets fewer. */
        count = Math.max(0, Math.round((C.perLiftScreen != null ? C.perLiftScreen : 22)
                                       * span / (GH + PAD * 2)));
      } else {
        lo = rx.min - GW;
        span = (rx.max - rx.min) + GW * 2;
        count = Math.max(0, Math.round(C.perLeg != null ? C.perLeg : 12));
      }
      if (span <= 0 || count <= 0) continue;

      for (let i = 0; i < count; i++, n++) {
        const b = i % bands;
        const sc = Vermes._band(C.bandScale, bands, b);
        /* SPREAD, THEN JITTERED OFF THE SLOT. An even row of patches reads as
           wallpaper; the jitter is a fraction of a slot so they still cover the
           leg rather than clumping. Same shape as the summon wave's. */
        const slot = span / count;
        const along = lo + slot * (i + 0.5)
                    + (Vermes._h(n * 3.1 + li * 17.7) - 0.5) * slot * (C.jitterXRel != null ? C.jitterXRel : 0.8);
        let x, y;
        if (lift) {
          y = along;
          /* ACROSS THE FRAME, not along a band. ⚠️ OVER THE RIDE'S WHOLE X
             RANGE, not just its start: the first rise slides 232 px sideways,
             and a field laid out at the starting x would come off one edge of
             the frame and leave the other bare by the top. */
          x = rx.min - PAD + ((rx.max - rx.min) + GW + PAD * 2) * Vermes._h(n * 7.3 + li * 5.1);
        } else {
          x = along;
          const yF = (C.yFrom != null ? C.yFrom : 0.05);
          const yT = (C.yTo != null ? C.yTo : 0.80);
          y = w0.y + beltTop * (yF + (yT - yF) * Vermes._h(n * 7.3 + li * 5.1));
        }
        /* WHICH KNOT. Two rolls, not one: the first picks the SHEET (dense or
           sparse) so `denseShare` means what it says, the second picks a knot
           from that sheet. Rolling once over all nine would make the share a
           function of how many knots each sheet happened to yield. */
        const want = Vermes._h(n * 11.9 + li * 2.3)
                   < (C.denseShare != null ? C.denseShare : 0.5) ? 0 : 1;
        const pool = this._pool(d, want);
        const v = pool[Math.floor(Vermes._h(n * 23.3 + li * 4.7) * pool.length) % pool.length];
        this.items.push({ leg: li, x: x, y: y, v: v, s: sc, b: b,
                          /* ⚠️ ITS OWN BOIL PHASE. Every patch flipping on the
                             same frame is one big shudder rather than a wall of
                             worms; the offset is what makes it look alive. */
                          ph: Vermes._h(n * 19.7 + li) });
      }
    }
    /* FAR BANDS FIRST, so a near patch paints over a far one. The bands do not
       move at different rates -- see the header -- so this ordering is the only
       thing that makes them read as planes at all. */
    this.items.sort((p, q) => p.b - q.b);
  }

  /**
   * The knots that came off one sheet, cached.
   *
   * ⚠️ FALLS BACK TO EVERY KNOT rather than to an empty list. A pack cut before
   * `sheetOf` existed, or one where a sheet lost all its knots to MIN_W, would
   * otherwise place nothing at all and look like the feature being off.
   */
  _pool(d, sheet) {
    if (!this._pools) this._pools = {};
    if (this._pools[sheet]) return this._pools[sheet];
    const all = d.variants.map((_, i) => i);
    const of = d.sheetOf;
    const got = of ? all.filter(i => of[i] === sheet) : all;
    this._pools[sheet] = got.length ? got : all;
    return this._pools[sheet];
  }

  /** Read a band curve as a list, far -> near. The shape scenery.js uses. */
  static _band(curve, bands, i) {
    if (curve == null) return 1;
    if (typeof curve === 'number') return curve;
    const a = Array.isArray(curve) ? curve : [curve.far, curve.mid, curve.near];
    const pts = a.filter(v => v != null);
    if (!pts.length) return 1;
    if (pts.length === 1 || bands < 2) return pts[0];
    const t = (i / (bands - 1)) * (pts.length - 1);
    const lo = Math.floor(t), hi = Math.min(pts.length - 1, lo + 1);
    return pts[lo] + (pts[hi] - pts[lo]) * (t - lo);
  }

  draw(ctx) {
    const C = CONFIG.VERMES;
    if (!C || C.on === false || !this.items.length) return;
    const d = this._packs();
    if (!d) return;
    const img = this.assets.getDrawable('vermes');
    if (!img) return;

    /* ⚠️ NO LEG TEST. Every patch is in one wall space and the cull below is
       what decides -- which is the entire reason a rise no longer blanks the
       wall. During a lift the shelf you just left is still being drawn, sliding
       out of the bottom of frame, and the next one arrives before you do. */
    const fi = this._frame();
    const wx = this._at('x', fi), wy = this._at('y', fi);
    const boil = (C.boilMs != null ? C.boilMs : 200);
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    for (const it of this.items) {
      const fr = d.variants[it.v];
      const f = d.frames[fr[Math.floor(now / boil + it.ph * fr.length) % fr.length]];
      const w = f.w * it.s, h = f.h * it.s;
      const dx = (it.x - wx) - f.ax * it.s, dy = (it.y - wy) - f.ay * it.s;
      /* THE ONLY CULL IT NEEDS, and it is on BOTH axes now: the far shelves are
         separated from the near one by 4826 px of wall y, so y is what keeps
         leg 2's infestation off leg 0's screen. */
      if (dx > CONFIG.GAME_W || dx + w < 0) continue;
      if (dy > CONFIG.GAME_H || dy + h < 0) continue;
      ctx.drawImage(img, f.x, f.y, f.w, f.h, dx, dy, w, h);
    }
  }
}
