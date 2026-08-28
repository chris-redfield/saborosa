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
    this.items = [];       // {x,z,k,p,s} world pos + scroll rate + draw scale
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
      this._scatter(defs, n, x0, x1, z, p, sc, S.spacing || 0.65, r);
    }

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
        this._scatter(defs, n, x0, x1, z, BL.parallax != null ? BL.parallax : 1,
                      BL.scale != null ? BL.scale : 1,
                      BL.spacing || S.spacing || 0.65, 100 + r);
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
  _scatter(defs, n, x0, x1, z, p, sc, spacing, seed) {
    let x = x0, i = 0;
    while (x < x1) {
      const k = Math.floor(Scenery._h(seed * 911 + i * 57) * n) % n;
      this.items.push({ x, z, k, p, s: sc });
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
  draw(ctx, camX) {
    if (!this.items.length) return;
    const img = this.assets.getDrawable('scenery');
    const defs = this.defs;
    if (!img || !defs) return;
    const topY = Belt.topY;
    for (const it of this.items) {
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
