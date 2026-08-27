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
 * density: **9-12 mounds drawn per frame**, each roughly 790x200 -- well under one
 * full-screen blit's worth of FILL on top of the plate's own. It was three times
 * that when this first shipped: the coverage target came down from 80% to 60%,
 * and then the mounds grew 30%, which means fewer of them.
 *
 * ⚠️ THE THREE SPEEDS ARE A LOOK, AND THEY BREAK THE ONE RULE ABOVE ON PURPOSE.
 * `CONFIG.SCENERY.parallax` splits the rows into three bands that scroll at
 * different rates, so the drifts at the back of the belt lag behind the ones the
 * player is walking over. **A layer under 1.0 no longer sits on a fixed patch of
 * sand** -- it slides against the filmed plate, which is at parallax 1.0. That is
 * the effect, not a bug, and it is affordable for exactly the reason the rest of
 * this file is: nothing asks a mound where it is. The near band is left at 1.0
 * so the ground the player's feet are actually on still holds still.
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
    this.items = [];       // {x, z, k, p} world coords + scroll rate, far -> near
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

    /* THE THREE SPEEDS, far band first, so `layers[b]` matches the band index a
       row falls into. Off -- or absent -- and every row is 1.0, which is the
       behaviour this had before and is still what every room but the desert
       wants. */
    const P = S.parallax;
    const layers = (P && P.on)
      ? [P.far, P.mid, P.near].map(v => (v == null ? 1 : v))
      : null;
    const bands = layers ? layers.length : 1;

    /* ⚠️ A LAYER FASTER THAN THE CAMERA RUNS OUT OF SCATTER BEFORE THE ROOM DOES.
       A mound at world `x` is drawn at `x - camX * p`, so filling the screen at
       the far end of the room needs mounds out to `p * camMax + GAME_W`. Under
       1.0 that is INSIDE the room and the existing field over-covers -- which is
       why the shipped values need none of this. Over 1.0 it is past the end, and
       without this the last stretch of a fast layer would simply be bare. */
    const camMax = Math.max(0, (room.endX || CONFIG.GAME_W) - CONFIG.GAME_W);
    const pMax = layers ? Math.max(1, ...layers) : 1;
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
      const f = rows > 1 ? r / (rows - 1) : 0.5;
      const z = (S.zFrom + (S.zTo - S.zFrom) * f) * depth
              + (Scenery._h(r * 97 + 3) - 0.5) * (S.zJitter || 40);
      /* ⚠️ THE BAND IS PICKED OFF THE ROW INDEX, NOT OFF THE JITTERED `z`.
         `zJitter` can push a row's ground point across a band's edge, and a mound
         that changed SPEED because its scatter landed 30px further forward would
         make the boundary visible as a tear. Rows are what the depth bands are
         made of, so rows are what get sorted into them. */
      const p = layers
        ? layers[Math.min(bands - 1, Math.floor(r * bands / rows))]
        : 1;
      let x = x0, i = 0;
      while (x < x1) {
        const k = Math.floor(Scenery._h(r * 911 + i * 57) * n) % n;
        this.items.push({ x, z, k, p });
        /* SPACED BY THE MOUND'S OWN WIDTH, so a run of narrow ones packs tighter
           than a run of wide ones and the field never reads as a grid. Under 1
           they overlap, which is what covers the ground -- see CONFIG.SCENERY. */
        const w = defs.frames[k].w;
        x += w * (S.spacing || 0.65)
           * (0.85 + 0.3 * Scenery._h(r * 17 + i * 13));
        i++;
        if (i > 4000) break;        // a spacing of 0 would otherwise never end
      }
    }
    // FAR FIRST, so a nearer drift overlaps the one behind it. Sorted once here
    // rather than per frame; nothing moves after this.
    this.items.sort((a, b) => a.z - b.z);
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
      /* ⚠️ AGAINST THE ANCHOR, NOT THE WIDTH. `ax` is the mound's centre, so its
         left edge is `sx - ax` and its right is `sx + (w - ax)`. Culling on the
         full width either side was a whole mound's slack in both directions and
         drew about a third more than the screen can show. */
      if (sx + (f.w - f.ax) < 0 || sx - f.ax > CONFIG.GAME_W) continue;
      ctx.drawImage(img, f.x, f.y, f.w, f.h,
                    Math.round(sx - f.ax), Math.round(topY + it.z - f.ay),
                    f.w, f.h);
    }
  }
}
