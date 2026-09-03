/**
 * Scenery — the cigarette mounds lying on the desert's floor.
 *
 * WHAT THEY ARE. Six drifts of cigarette butts (tools/build-beat-fundo-defs.py),
 * scattered across the belt so the ground is covered in them. The player walks
 * OVER the top: they are drawn behind every fighter and nothing collides with
 * them.
 *
 * ⚠️ THEY ANSWER NOTHING, AND THAT IS WHY A ROOM CAN AFFORD HUNDREDS OF THEM.
 * This game has two bargains for an object (see STATE.md, *The flies*): a PROP
 * is cheap because it answers the fighters' interface -- the z-sort, the shadow
 * pass and the hit resolver take it with no branch -- and SCENERY is cheap
 * because it answers nothing at all. A mound has no hitbox, no z-sort entry, no
 * shadow, no crowd entry, no stats, and neither combat.js nor stage.js ever asks
 * it a question. **The moment one of these needs to be stood on for real, it
 * stops being scenery and becomes a prop, and that is a different file.**
 *
 * ⚠️ THE LAYOUT IS DETERMINISTIC AND BUILT ONCE PER ROOM. Not `Math.random` per
 * frame, obviously -- but also not `Math.random` at build time, because the
 * player can walk back over ground they have already seen (the desert reverses)
 * and a re-rolled drift would be a different desert behind them. Hashed off the
 * row and the index, so the same room always lays out the same way.
 *
 * ⚠️ AND IT IS A REAL PER-FRAME COST, unlike the flies. Measured at the shipped
 * density: **19-21 mounds drawn per frame**, each roughly 790x200 -- about four
 * screens of overdraw on top of the plate's own. The coverage target has moved
 * three times (80 -> 60 -> 80 -> 90) and this is the expensive end of it.
 *
 * ⚠️ A MOUND'S INK IS ENTIRELY ABOVE ITS GROUND POINT, and that one fact explains
 * most of the tuning in CONFIG.SCENERY. It is why `zTo` runs past 1, why a row
 * placed at a band's CENTRE left the near edge bare, and why pushing the whole
 * field DOWN the belt raises coverage rather than lowering it -- the top rows stop
 * spending half of themselves painting up the back wall.
 *
 * ⚠️ THE COST KNEE IS BETWEEN 90% AND 100%, and it is why 100 was measured and
 * declined: 90.7% is 23-27 draws, a true 100.0% is 86-93. Four times the fill for
 * the last nine points. If a solid carpet is ever really wanted, the answer is to
 * BAKE the drifts into one repeating strip at build time (two or three blits) --
 * but a baked strip cannot have five bands moving at five speeds over it, so
 * the parallax and the carpet are alternatives, not additions.
 *
 * ⚠️ THE SPEEDS ARE A LOOK, AND THEY BREAK THE ONE RULE ABOVE ON PURPOSE.
 * `CONFIG.SCENERY.parallax` splits the rows into bands that scroll at different
 * rates, so the drifts at the back of the belt lag behind the ones the player is
 * walking over. **A layer under 1.0 no longer sits on a fixed patch of sand** --
 * it slides against the filmed plate, which is at parallax 1.0. That is the
 * effect, not a bug, and it is affordable for exactly the reason the rest of this
 * file is: nothing asks a mound where it is. The near band is left at 1.0 so the
 * ground the player's feet are actually on still holds still.
 *
 * ⚠️ HOW MANY BANDS IS DATA, AND THE ONLY REASON THAT IS TRUE IS _ramp.
 * `CONFIG.SCENERY.bands` was 3 and is 5, and the three per-band blocks are read
 * as CURVES sampled at that count rather than as one entry per band -- so the
 * count is one number to change and a shorter list is a legal, interpolated
 * shorthand rather than two silently missing planes. See _ramp; it is the piece
 * to keep if any of this is ever rewritten.
 *
 * ⚠️ A BAND CARRIES THREE NUMBERS, and they are independent: how fast it scrolls
 * (`parallax`), how big it is drawn (`bandScale`) and where it sits down the belt
 * (`bandOffsetZ`). Together they are one depth cue -- the near drifts are 10%
 * larger, 25% faster and pushed 20% of the belt's depth toward the lens.
 *
 * ⚠️ AND SPLITTING THE FIELD FINER SPENDS THE DEPTH CUE THINNER. What reads is
 * the STEP between neighbouring planes, so five bands over one budget is half the
 * step three bands had. The total spread is the dial that compensates, and it is
 * already at its documented ceiling (0.25) -- which means "make it 7 planes" is
 * a request with no room left in it, and the answer would be the per-ROW lerp
 * rather than more discrete bands.
 *
 * The SCALE is applied at DRAW time, not baked into the pack -- the six frames
 * are cut once at one scale (see wire-art: one scale per pack) and a band
 * multiplies on top. The two places it has to be honoured are the ANCHOR, which
 * is in frame pixels and must scale with the sprite, and the SPACING step, which
 * is a fraction of a mound's own width.
 *
 * ⚠️ AND NONE OF IT CHANGES THE DRAW ORDER. A band pushed past the near edge of
 * the belt is nearer the camera than any fighter can stand, and is still painted
 * BEHIND all of them -- scenery is one layer. It reads as ground sloping toward
 * the lens, not as something the player walks behind; that would be a second
 * pass in the `foreground` layer slot, which is a different feature.
 *
 * ⚠️ IT IS FILL, NOT VRAM, WHICH IS THE GOOD KIND OF EXPENSIVE HERE. Every one
 * of those draws samples ONE 699x857 atlas, so there is a single texture bound
 * and nothing to thrash -- and VRAM is what actually cost this project its frame
 * rate once (see PERFORMANCE.md). Quad count is nothing to a GPU; the number to
 * watch is the fill, and the dials are `CONFIG.SCENERY.rows` and `spacing`, with
 * `on: false` as the switch.
 */
class Scenery {
  constructor(assets) {
    this.assets = assets;
    /* {x,z,k,p,s,b} -- world pos, frame, scroll rate, draw scale, and the BAND
       it belongs to. The band is carried per item purely so the field can be
       drawn in two halves with something painted between them; nothing about
       the layout reads it. See `drawBands`. */
    this.items = [];
    this.bands = 0;        // how many belt bands this room laid out
    this._dense = null;    // the baked high-density zone, if the room has one
    this.bandZ = null;     // each band's mean depth -- see planeForZ()
    this.defs = null;
  }

  /**
   * A hash, not a random. Same room, same layout, every time -- see the header.
   *
   * The sine trick rather than an integer hash because it is three operations
   * and this is called a few hundred times on a room change and never again.
   */
  static _h(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  /**
   * Read a band curve as a LIST, far -> near.
   *
   * ⚠️ THE OLD `{far, mid, near}` SHAPE STILL READS, and it is kept for exactly
   * one reason: it is what a three-band config says, and the band count is now
   * data (`CONFIG.SCENERY.bands`). A room that still spells three names gets
   * three points of a curve, which _ramp then samples at however many bands the
   * room actually asked for -- so changing the count can never leave a knob
   * silently unread.
   */
  static _list(v) {
    if (!v) return null;
    if (Array.isArray(v)) return v.length ? v : null;
    if (v.far == null && v.mid == null && v.near == null) return null;
    return [v.far, v.mid, v.near];
  }

  /**
   * Sample a far -> near curve at `n` band centres.
   *
   * ⚠️ THE LIST IS A CURVE, NOT ONE ENTRY PER BAND, and that is the whole reason
   * "3 planes" could become "5 planes" by editing one number. Give it as many
   * points as you want to control by hand and it is read literally; give it two
   * and it is a straight ramp across however many bands exist; give it three
   * against five bands and the two new planes are interpolated into the gaps
   * rather than falling off the end of the array as `undefined`.
   *
   * ⚠️ A LENGTH MISMATCH IS THE FAILURE THIS EXISTS TO PREVENT. Indexing a
   * 3-long array with band 4 yields `undefined`, which becomes NaN in the z
   * expression and draws NOTHING -- two whole planes missing with no error
   * anywhere. Resampling makes a mismatch mean something instead.
   */
  static _ramp(v, n, dflt) {
    const src = (Scenery._list(v) || []).map(x => (x == null ? dflt : x));
    if (!src.length) return new Array(n).fill(dflt);
    if (src.length === 1 || n === 1) return new Array(n).fill(src[0]);
    const out = [];
    for (let b = 0; b < n; b++) {
      const t = (b / (n - 1)) * (src.length - 1);
      const i = Math.min(src.length - 2, Math.floor(t));
      out.push(src[i] + (src[i + 1] - src[i]) * (t - i));
    }
    return out;
  }

  /**
   * Lay the mounds out for a room, or clear them for a room that wants none.
   *
   * ⚠️ OPT-IN PER ROOM (`ROOMS[n].scenery`), exactly like `flies`. The street is
   * a filmed pavement and the boss room is indoors; a floor of cigarette butts
   * belongs to the desert and declaring it is how a third room asks for one.
   */
  enterRoom(room) {
    this.items = [];
    this.bands = 0;
    const S = CONFIG.SCENERY;
    if (!S || !S.on || !room || !room.scenery) return;
    const defs = this.assets.getJSON ? this.assets.getJSON('scenery') : null;
    this.defs = defs;
    if (!defs || !defs.frames || !defs.frames.length) return;

    const n = defs.frames.length;
    const rows = S.rows || 4;
    const margin = S.marginPx || 700;
    /* FROM BEFORE THE START TO PAST THE END. The player can stand at `startX`
       with the camera at 0 and see a screen's width of ground to the left of
       him, so a scatter that began at his feet would show bare sand at the one
       moment the room is introducing itself. */
    const x0 = -margin;
    const depth = (room.belt && room.belt.depth) || CONFIG.beltDepth;

    /* THE DEPTH BANDS -- far first, near last, so `[b]` matches the band index a
       row falls into. `bands` is DATA: it was 3, it is 5, and nothing in this
       file counts on either number.

       A band carries three numbers and they are independent: how fast it scrolls
       (`parallax`), how big it is drawn (`bandScale`) and where it sits down the
       belt (`bandOffsetZ`). Any block may be absent or off on its own and that
       band's number falls back to the identity -- 1.0 for a rate or a scale, 0
       for an offset -- which is what this file did before there were bands at
       all, and they are exact no-ops rather than near-misses, so a room that
       wants none draws byte-for-byte what it used to.

       ⚠️ EACH BLOCK IS A CURVE SAMPLED AT `bands` POINTS, not one entry per band
       -- see _ramp. That is what makes the count a single editable number: the
       three tuned values of the old far/mid/near still describe the same shape,
       and five bands read five samples off it instead of three. */
    const BANDS = Math.max(1, Math.round(S.bands || 3));
    this.bands = BANDS;
    const P = S.parallax;
    const rate = Scenery._ramp((P && P.on) ? (P.rates || P) : null, BANDS, 1);
    const size = Scenery._ramp(S.bandScale, BANDS, 1);
    const drop = Scenery._ramp(S.bandOffsetZ, BANDS, 0);

    /* ⚠️ A LAYER FASTER THAN THE CAMERA RUNS OUT OF SCATTER BEFORE THE ROOM DOES.
       A mound at world `x` is drawn at `x - camX * p`, so filling the screen at
       the far end of the room needs mounds out to `p * camMax + GAME_W`. Under
       1.0 that is INSIDE the room and the existing field over-covers -- which is
       why the shipped values need none of this. Over 1.0 it is past the end, and
       without this the last stretch of a fast layer would simply be bare. */
    const camMax = Math.max(0, (room.endX || CONFIG.GAME_W) - CONFIG.GAME_W);
    const blP = (S.backLayer && S.backLayer.on && S.backLayer.parallax != null)
      ? S.backLayer.parallax : 1;
    const pMax = Math.max(1, blP, ...rate);
    const x1 = Math.max((room.endX || CONFIG.GAME_W),
                        pMax * camMax + CONFIG.GAME_W) + margin;

    /* ⚠️ ROWS SPAN THE WHOLE BAND, END TO END, AND THE FIRST VERSION DID NOT.
       They were placed at the CENTRE of each of `rows` equal bands -- 5 rows
       across 380 gave z = 38, 114, 190, 266, 342 -- which sounds even and is
       wrong, because a mound's ink sits ENTIRELY ABOVE its ground point (the
       anchor is bottom-centre). A row at z covers roughly [z - 140, z], so the
       last one reached 342 of 380 and **the near edge of the belt was bare**.
       Measured after the fact: the near third of the belt was 42% covered
       against 78% overall, which is exactly what was reported -- "they don't
       take the entire walkable area, the lower part has no cigarettes".

       It also spent a quarter of the field ABOVE the belt, where the first row's
       ink climbed into the wall for nothing.

       So the rows run from `zFrom` to `zTo` INCLUSIVE, and `zTo` is deliberately
       a little past 1: the last row's ground point sits just beyond the near
       edge so its ink covers up to it. */
    for (let r = 0; r < rows; r++) {
      /* ⚠️ THE BAND IS PICKED OFF THE ROW INDEX, NOT OFF THE `z` -- and now it has
         to be picked BEFORE it, because the band is one of the things that MOVES
         z. Off the row index because `zJitter` can push a row's ground point 30px
         and a mound that changed SPEED because its scatter landed slightly
         forward would tear the boundary open. Rows are what the bands are made
         of, so rows are what get sorted into them. */
      const b = Math.min(BANDS - 1, Math.floor(r * BANDS / rows));
      const p = rate[b], sc = size[b];
      const f = rows > 1 ? r / (rows - 1) : 0.5;
      /* `drop[b]` IS A FRACTION OF THE BELT'S DEPTH, positive = toward the
         viewer, which is the unit `zFrom`/`zTo` are already in. A band may be
         pushed past the near edge on purpose -- see CONFIG.SCENERY.bandOffsetZ:
         the mound's ink still reaches back up into the belt, and what falls off
         the bottom of the screen is meant to. */
      const z = (S.zFrom + (S.zTo - S.zFrom) * f + drop[b]) * depth
              + (Scenery._h(r * 97 + 3) - 0.5) * (S.zJitter || 40);
      this._scatter(defs, n, x0, x1, z, p, sc, S.spacing || 0.65, r, b);
    }

    /* EACH BAND'S OWN DEPTH, for `planeForZ`. The mean of its items' ground
       points: a band is a plane, and this is where that plane sits. Computed
       from the field as laid out rather than from `zFrom`/`zTo`, so `zJitter`
       and `bandOffsetZ` are already in it. */
    const sum = new Array(BANDS).fill(0), cnt = new Array(BANDS).fill(0);
    for (const it of this.items) {
      const b = it.b;
      if (b == null || b < 0 || b >= BANDS) continue;
      sum[b] += it.z; cnt[b]++;
    }
    this.bandZ = sum.map((v, i) => (cnt[i] ? v / cnt[i] : null));

    /* AND THE BAKED ZONE, laid out from the same ladder so it is the same floor
       -- see `_bakeDense`. It reads `this.items` only to leave it alone. */
    this._bakeDense(room, defs, rows, depth, rate, size, drop, BANDS);

    /* ⚠️ THE SIXTH LAYER, AND IT IS NOT A SIXTH BAND. Asked for 2026-08-28:
       *"testar outra camada de cigarros (sexta, no fundo)... essa camada não vai
       no belt normal do jogo, ela vai na área morta"*.

       It is laid out SEPARATELY rather than by raising `bands` to 6, and that is
       the whole reason it is safe to try. The five bands share one row ladder
       running `zFrom -> zTo`: add a sixth band and `rows` has to go 10 -> 12 to
       keep the split even, which re-spaces the ladder and MOVES ALL FIVE PLANES
       the user already tuned by eye. An additive block leaves them at exactly
       the z they are at today and can be switched off with one flag.

       ⚠️ AND IT IS NOT GROUND COVER, WHICH IS WHY IT IS NOT ON THE BELT. Its
       ground points sit at or above `Belt.topY` -- the dead area, where nothing
       walks -- so it answers to none of the coverage rules the belt rows do. It
       is scenery in the backdrop sense: the drift carries on up the back wall.

       ⚠️ NEGATIVE z IS THE POINT, and nothing else in this file uses it. z is
       measured DOWN from the belt's top edge, so a negative ground point is
       above the belt entirely. A mound's ink sits above its ground point, so a
       row placed slightly INSIDE the belt still spends most of itself in the
       dead area -- which is what "uma parte na área morta e a outra no belt"
       asks for, and why `zTo` is a small positive number rather than zero. */
    const BL = S.backLayer;
    if (BL && BL.on) {
      const bn = Math.max(1, BL.rows || 2);
      for (let r = 0; r < bn; r++) {
        const f = bn > 1 ? r / (bn - 1) : 0.5;
        const z = (BL.zFrom + (BL.zTo - BL.zFrom) * f) * depth
                + (Scenery._h(r * 131 + 17) - 0.5) * (BL.zJitter || 0);
        /* ⚠️ A SEED WELL CLEAR OF THE BELT ROWS'. The hash is keyed on the row
           index, so reusing 0 and 1 here would lay this layer out in lockstep
           with the two rows at the back of the belt -- the same drifts at the
           same x, which reads as one band drawn twice rather than as depth. */
        /* ⚠️ BAND -1, WHICH IS NOT A BAND. The dead-area layer is behind every
           belt band by construction, so it is given an index below all of them
           -- `drawBands(-1, k)` then means "everything behind band k" with no
           special case for it. */
        this._scatter(defs, n, x0, x1, z, BL.parallax != null ? BL.parallax : 1,
                      BL.scale != null ? BL.scale : 1,
                      BL.spacing || S.spacing || 0.65, 100 + r, -1);
      }
    }

    // FAR FIRST, so a nearer drift overlaps the one behind it. Sorted once here
    // rather than per frame; nothing moves after this.
    this.items.sort((a, b) => a.z - b.z);
  }

  /**
   * One row of drifts, from `x0` to `x1`. Shared by the belt's bands and by the
   * dead-area layer so there is one piece of code deciding how a row is spaced.
   *
   * SPACED BY THE MOUND'S OWN DRAWN WIDTH, so a run of narrow ones packs tighter
   * than a run of wide ones and the field never reads as a grid -- and by the
   * DRAWN width, which is the band's scale times the frame's, or a band drawn
   * bigger packs tighter as well as growing and "bigger" arrives as "denser".
   */
  _scatter(defs, n, x0, x1, z, p, sc, spacing, seed, band) {
    let x = x0, i = 0;
    while (x < x1) {
      const k = Math.floor(Scenery._h(seed * 911 + i * 57) * n) % n;
      this.items.push({ x, z, k, p, s: sc, b: band });
      const w = defs.frames[k].w * sc;
      x += w * spacing * (0.85 + 0.3 * Scenery._h(seed * 17 + i * 13));
      i++;
      if (i > 4000) break;          // a spacing of 0 would otherwise never end
    }
  }

  clear() { this.items = []; }

  /**
   * Draw everything on screen, behind the fighters.
   *
   * ⚠️ CULLED ON THE MOUND'S OWN WIDTH, not on a fixed margin. They run from 360
   * to 697px across, so a margin big enough for the widest wastes a third of the
   * draws on the narrowest, and one big enough for the narrowest pops the widest
   * in at the edge of the screen.
   */
  /**
   * THE DENSE ZONE -- one stretch of the room whose floor is BAKED.
   *
   * Asked for 2026-09-02, of HORACIO's arena: *"it has some gaps in the
   * cigarettes... I want it to be more saturated with background cigarettes but
   * without causing performance problems"*.
   *
   * ⚠️ MORE ROWS IS THE WRONG ANSWER AND THE COST TABLE SAYS SO. This field
   * measures 90.7% coverage at 23-27 mounds drawn a frame; 99.5% costs 49-55 and
   * a true 100% costs 86-93, about 16 screens of overdraw. Doubling that during
   * the boss fight is the worst moment in the game to spend it -- HORACIO is
   * four big textures and he summons a wall of charutobis on top.
   *
   * ⚠️ SO THE DENSITY IS BAKED, AND THE REASON IT IS EXACT RATHER THAN AN
   * APPROXIMATION IS THAT A BAND IS A RIGID LAYER. `parallax` is per BAND, not
   * per mound (see `_ramp` in enterRoom), so every item in a band shares one
   * scroll rate: the whole band translates by `camX * p` and nothing inside it
   * moves relative to anything else. Pre-render a band's stretch once and blit
   * it at `fromX - camX * p` and the pixels are identical to drawing every
   * mound. Density then costs NOTHING -- one blit per band whether it holds ten
   * mounds or two hundred.
   *
   * ⚠️ WHICH IS WHY THIS IS NOT THE "BAKE THE FLOOR INTO ONE STRIP" IDEA THE
   * COVERAGE NOTE REJECTS. That one is rejected because a single strip cannot
   * have three bands moving at three speeds over it -- true, and the answer is
   * one strip PER BAND, which keeps the parallax exactly.
   *
   * ⚠️ AND IT IS A ZONE, NOT THE WHOLE ROOM, FOR MEMORY. The desert is 6286px
   * long; five bands of that at belt height is about 48MB of canvas. The arena
   * is roughly one screen and costs a tenth of it.
   */
  _bakeDense(room, defs, rows, depth, rate, size, drop, BANDS) {
    const S = CONFIG.SCENERY, D = S && S.DENSE;
    this._dense = null;
    if (!D || !D.on || !room || !room.dense) return;
    if (typeof document === 'undefined') return;   // build tools have no DOM
    const x0 = room.dense.fromX, x1 = room.dense.toX;
    if (!(x1 > x0)) return;
    const extra = Math.max(1, Math.round(D.extraRows || rows));
    const n = defs.frames.length;

    /* The extra rows sit BETWEEN the existing ones -- `(r + 0.5) / extra` --
       because the gaps this exists to fill are the gaps between rows, which is
       the same finding the coverage note reached the hard way: packing tighter
       in x never closed them. Seeds are offset so the new field is not the old
       one drawn twice in the same places. */
    const items = [];
    const keep = this.items;
    this.items = items;
    for (let r = 0; r < extra; r++) {
      const b = Math.min(BANDS - 1, Math.floor(r * BANDS / extra));
      const f = (r + 0.5) / extra;
      const z = (S.zFrom + (S.zTo - S.zFrom) * f + drop[b]) * depth
              + (Scenery._h(r * 131 + 57) - 0.5) * (S.zJitter || 40);
      this._scatter(defs, n, x0, x1, z, rate[b], size[b],
                    (D.spacing || S.spacing || 0.65), 1000 + r, b);
    }
    this.items = keep;
    if (!items.length) return;

    const img = this.assets.getDrawable('scenery');
    if (!img) return;

    /* ⚠️ EACH STRIP IS SIZED TO ITS OWN BAND, NOT TO THE FIELD. A band's mounds
       occupy a slice of the belt, not all of it -- so one shared height sized to
       the global span made every strip mostly empty and cost 16MB of canvas
       across five of them. Per-band bounds cut that by about two thirds for the
       same pixels. Memory is the only thing bounding this feature (the draw cost
       is one blit either way), so it is worth the extra loop.

       A mound's anchor is exact bottom-centre, so its ink is entirely ABOVE its
       ground point: the top is `z - h * s` and the bottom is `z`. */
    const w = Math.ceil(x1 - x0);
    const strips = [];
    let bytes = 0;
    for (let b = 0; b < BANDS; b++) {
      const mine = items.filter((it) => (it.b != null ? it.b : 0) === b);
      if (!mine.length) { strips.push(null); continue; }
      let top = Infinity, bot = -Infinity;
      for (const it of mine) {
        const fr = defs.frames[it.k];
        top = Math.min(top, it.z - fr.h * it.s);
        bot = Math.max(bot, it.z);
      }
      const h = Math.ceil(bot - top) + 2;
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const c = cv.getContext('2d');
      for (const it of mine) {
        const fr = defs.frames[it.k];
        const sc = it.s, aw = fr.w * sc, ah = fr.h * sc, ax = fr.ax * sc;
        c.drawImage(img, fr.x, fr.y, fr.w, fr.h,
                    Math.round(it.x - x0 - ax),
                    Math.round(it.z - fr.ay * sc - top),
                    aw, ah);
      }
      bytes += w * h * 4;
      strips.push({ cv, p: rate[b], topRel: top, w, h });
    }
    this._dense = { x0, w, strips, count: items.length, bytes };
  }

  /**
   * Blit one band's baked strip. ⚠️ CALLED WHILE WALKING THE BANDS, not after
   * them: the strip belongs at its band's depth, and dropping all of them at
   * the end would paint the far band's fill over the near band's mounds.
   */
  _blitDense(ctx, camX, b) {
    const D = this._dense;
    if (!D) return;
    const st = D.strips[b];
    if (!st) return;
    const sx = D.x0 - camX * st.p;
    if (sx + st.w < 0 || sx > CONFIG.GAME_W) return;
    ctx.drawImage(st.cv, Math.round(sx), Math.round(Belt.topY + st.topRel));
  }

  /**
   * WHICH PLANE A BODY AT DEPTH `z` BELONGS IN -- how many bands are BEHIND it.
   *
   * ⚠️ THIS IS Z-SORTING AGAINST THE FLOOR, and it is what a randomly dealt
   * plane cannot do. `Emerge.pickPlane` deals a random one on purpose: a digger
   * is buried while it uses it, so which seam it comes up through is variety and
   * nothing is visible enough for the depth to matter. HORACIO is not buried --
   * he rolls across the room in plain sight at a chosen lane -- and a random
   * plane put him at z 68 with only the NEAREST band drawn over him, whose
   * mounds sit at the bottom of the screen and never overlap him at all. He read
   * as *"on top of all cigarette layers"*.
   *
   * Bands are laid out far-to-near, so the answer is the count whose own depth
   * is behind his. Floored at 1 for the reason `Emerge.pickPlane` gives: plane 0
   * means "behind every belt band", which reorders the floor against itself.
   */
  planeForZ(z) {
    if (!this.bandZ || !this.bandZ.length) return null;
    let n = 0;
    for (const bz of this.bandZ) if (bz != null && bz < z) n++;
    return Math.max(1, Math.min(this.bands, n));
  }

  draw(ctx, camX) { this.drawBands(ctx, camX, -Infinity, Infinity); }

  /**
   * Draw only the bands in `[lo, hi)`, so a fighter can be painted BETWEEN two
   * planes of the floor -- which is what makes a spawning enemy look like it is
   * coming out from behind the cigarettes rather than on top of them. Added
   * 2026-08-31; see CONFIG.EMERGE and the scenery branch in game.js.
   *
   * ⚠️ IT FILTERS, IT DOES NOT RE-SORT. `items` is in z order and stays in it,
   * so a two-pass draw is the one-pass draw with a gap in the middle -- the
   * mounds keep their overlaps exactly. That holds because the bands do not
   * interleave in z (measured on the desert: band 0-1 run z 129..226, band 2
   * 271..308, band 3 373..434, band 4 483..511), and if a future `bandOffsetZ`
   * ever makes them interleave, THIS is what would quietly change the floor.
   *
   * ⚠️ AND THE DEAD-AREA LAYER IS BAND -1, so `lo` must be -Infinity (or -1) to
   * include it, never 0.
   */
  drawBands(ctx, camX, lo, hi) {
    if (!this.items.length) return;
    const img = this.assets.getDrawable('scenery');
    const defs = this.defs;
    if (!img || !defs) return;
    const topY = Belt.topY;
    /* ⚠️ ONCE PER BAND, ON FIRST SIGHT -- NOT ON A BAND CHANGE, WHICH WAS A BUG.
       The first cut flushed the strip whenever the band changed between two
       items, on the strength of the note above saying bands do not interleave in
       z. Read it again: it says *"band 0-1 run z 129..226"* -- 0 and 1 SHARE a
       range. So in z order they alternate, the band flipped back and forth, and
       the same strip was blitted several times a frame: measured 6 blits for 5
       strips on a plain split, and every one of them re-draws its own
       semi-transparent edges over itself.

       Drawing on first sight is once by construction. It also puts the baked
       fill BEHIND that band's hand-placed mounds, which is the right way round:
       the fill is filler, and the field the user tuned by eye reads on top. */
    const drawn = this._denseDrawn || (this._denseDrawn = {});
    for (const k in drawn) delete drawn[k];
    for (const it of this.items) {
      const b = it.b != null ? it.b : 0;
      if (b < lo || b >= hi) continue;
      if (!drawn[b]) { drawn[b] = 1; this._blitDense(ctx, camX, b); }
      const f = defs.frames[it.k];
      /* ⚠️ EACH ITEM CARRIES ITS OWN SCROLL RATE, and the CULL below has to use
         the same number or a lagging layer pops in and out at the screen edge. */
      const sx = it.x - camX * it.p;
      /* ⚠️ THE ANCHOR SCALES WITH THE SPRITE, and forgetting that is the way this
         goes wrong. `ax`/`ay` are offsets in FRAME pixels: draw a 219px mound at
         1.1x while still subtracting the raw `ay` and its top stays put while its
         bottom drops 22px past the ground point -- the band hangs BELOW the belt
         line it is supposed to sit on, which presents as a z bug and sends you
         looking in the wrong file. Anchors here are exact bottom-centre
         (ax = w/2, ay = h), so scaling both keeps the ground point nailed where
         it was and the mound grows up and out around it. */
      const s = it.s, aw = f.w * s, ah = f.h * s, ax = f.ax * s;
      /* ⚠️ AGAINST THE ANCHOR, NOT THE WIDTH. `ax` is the mound's centre, so its
         left edge is `sx - ax` and its right is `sx + (w - ax)`. Culling on the
         full width either side was a whole mound's slack in both directions and
         drew about a third more than the screen can show. */
      if (sx + (aw - ax) < 0 || sx - ax > CONFIG.GAME_W) continue;
      ctx.drawImage(img, f.x, f.y, f.w, f.h,
                    Math.round(sx - ax), Math.round(topY + it.z - f.ay * s),
                    aw, ah);
    }
  }
}
