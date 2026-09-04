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
 * ⚠️ NOTHING IS DRAWN DURING A LIFT, ON REQUEST
 * ---------------------------------------------------------------------------
 * *"for now don't add worms to the background of the elevator parts, just when
 * movement is horizontal, lets keep that for later."* So the layout is per
 * WALK LEG and the draw returns early on a rise.
 *
 * ⚠️ THAT LEAVES A POP AT EACH LEG BOUNDARY and it is a known, accepted edge,
 * not an oversight. Done properly the patches would ride the wall DOWN out of
 * frame as the film pans up -- the vertical track is measured and sitting in
 * the same tool -- which is the "later" the request defers. Fading them would
 * be inventing a look nobody asked for, so they simply are not there.
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
 * ⚠️ THE LAYOUT IS PER LEG, AND THAT IS NOT AN OPTIMISATION
 * ---------------------------------------------------------------------------
 * Wall x is NOT monotonic: the shot goes +3647, back -5515, then +3396, so leg
 * 2 walks back across wall x that leg 0 already covered -- at a different
 * HEIGHT, in front of different books. Laying the field out in one wall-x space
 * would put the same patch of worms at the same place on two different shelves,
 * which is the switchback ambiguity that `Level3.progress` exists to avoid, in
 * a second costume. Each leg gets its own patches over its own span.
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
    /* {leg,x,y,v,s,b} -- which leg it belongs to, its position in that leg's
       wall space, which patch, drawn scale, and its band. */
    this.items = [];
    this.defs = null;
    this.track = null;
    this.leg = -1;
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
   * WHERE THE WALL HAS GOT TO, in canvas px, right now.
   *
   * ⚠️ SAMPLED, NOT INTERPOLATED, and that is not laziness: the track is one
   * value per FILM FRAME and the film is the thing being drawn, so the sample
   * the plate is showing is the sample the worms want. Interpolating between
   * two of them would put the worms on a wall position the footage is not
   * currently displaying -- a sub-frame lead or lag against the only thing they
   * are supposed to match.
   */
  wallX() {
    const t = this.track;
    if (!t || !t.x || !t.x.length) return 0;
    const i = Math.round(Level3.progress * t.fps);
    return t.x[Math.max(0, Math.min(t.x.length - 1, i))];
  }

  /** Lay out every walk leg's patches. Called once, on entering the room. */
  enterRoom(room) {
    this.items = [];
    this.leg = -1;
    const C = CONFIG.VERMES;
    if (!C || C.on === false) return;
    if (!Level3.owns(room)) return;
    const d = this._packs();
    if (!d) return;

    const legs = (CONFIG.LEVEL3 && CONFIG.LEVEL3.legs) || [];
    const bands = Math.max(1, C.bands || 1);
    const beltTop = (room.belt && room.belt.topY) || CONFIG.beltTopY;
    let n = 0;
    for (let li = 0; li < legs.length; li++) {
      const L = legs[li];
      if (L.kind !== 'walk') continue;      // no worms on a lift -- see header
      /* HOW WIDE THIS LEG'S WALL IS. `px` is the world distance the player
         walks, and the wall travels within a few percent of it (measured:
         1.02-1.15 canvas px of wall per world px), so it is the right span to
         scatter over -- plus a screen at each end so a patch is never born
         half-visible at a leg's edge. */
      const span = (L.px || 0) + CONFIG.GAME_W * 2;
      const count = Math.max(0, Math.round((C.perLeg != null ? C.perLeg : 12)));
      for (let i = 0; i < count; i++, n++) {
        const b = i % bands;
        const sc = Vermes._band(C.bandScale, bands, b);
        /* SPREAD, THEN JITTERED OFF THE SLOT. An even row of patches reads as
           wallpaper; the jitter is a fraction of a slot so they still cover the
           leg rather than clumping. Same shape as the summon wave's. */
        const slot = span / count;
        const x = -CONFIG.GAME_W + slot * (i + 0.5)
                + (Vermes._h(n * 3.1 + li * 17.7) - 0.5) * slot * (C.jitterXRel != null ? C.jitterXRel : 0.8);
        const yF = (C.yFrom != null ? C.yFrom : 0.05);
        const yT = (C.yTo != null ? C.yTo : 0.80);
        const y = beltTop * (yF + (yT - yF) * Vermes._h(n * 7.3 + li * 5.1));
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
    /* ⚠️ NOT DURING A LIFT, ON REQUEST -- see the header. `Level3.current()` is
       the leg the room is in, and it is asked every frame rather than cached:
       the room changes leg without telling anybody. */
    const L = Level3.current();
    if (!L || L.kind !== 'walk') return;
    const li = Level3.leg;

    const wall = this.wallX();
    const boil = (C.boilMs != null ? C.boilMs : 200);
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    for (const it of this.items) {
      if (it.leg !== li) continue;
      const sx = it.x - wall;
      const fr = d.variants[it.v];
      const f = d.frames[fr[Math.floor(now / boil + it.ph * fr.length) % fr.length]];
      const w = f.w * it.s, h = f.h * it.s;
      const dx = sx - f.ax * it.s, dy = it.y - f.ay * it.s;
      if (dx > CONFIG.GAME_W || dx + w < 0) continue;   // the only cull it needs
      ctx.drawImage(img, f.x, f.y, f.w, f.h, dx, dy, w, h);
    }
  }
}
