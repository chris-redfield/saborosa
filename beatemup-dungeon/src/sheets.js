/**
 * Sheets — turns a character pack into drawable frames.
 *
 * TWO PACK FORMATS LIVE HERE AT ONCE, and that is the current state of the art
 * rather than an indulgence. The coconut and BOTH CIGARETTES have sheets drawn
 * for this game; only ERKPA is still read out of the MAIN GAME's 9x5 packs.
 * One villain left, and then the grid path can go.
 *
 *   'ragged'  the coconut, both cigarettes. Not a grid: rows of 2..10 frames,
 *             every frame its own size, cut by tools/build-beat-coconut-defs.py
 *             and tools/build-beat-enemy-defs.py into a packed atlas plus a
 *             per-frame ANCHOR. Poses are named animations.
 *   'grid'    the rest. 9 cols x 5 rows, frame (row, col) is
 *             frames[row * cols + col]. Poses are columns.
 *
 * TWO RAGGED PACKS DO NOT HAVE TO HOLD THE SAME MOVES IN THE SAME ROWS, which
 * is why the pose table is per pack (`pack.poses`) rather than read straight
 * out of CONFIG: the shared `CONFIG.POSE_RAGGED` is the default and a character
 * overrides the entries its own art contradicts.
 *
 * TWO FACINGS, LEFT AND RIGHT. The diagonals are gone. The old packs carried
 * down_left and up_left rows and this file built six facings out of them, but
 * the coconut's new sheet is drawn side-on only, so the diagonals could not be
 * kept for the player. Rather than run the player on two facings and everyone
 * else on six -- which shows up immediately, as enemies angling toward the
 * camera next to a player who never does -- the whole game is side-on now.
 * `up` and `down` were already never selected, for the genre reason: fighters
 * face ALONG the belt so the read of who is about to hit whom survives three
 * enemies closing at once. Two facings is that rule taken to its end.
 *
 * MIRRORING IS A DRAW-TIME FLIP, not a second set of frames. Each pack stores
 * the art for ONE side and a negative x-scale does the other.
 *
 * WHICH SIDE THAT IS DIFFERS BY PACK, and it is not a detail. The main game's
 * grid packs are drawn facing LEFT; the coconut's new sheet is drawn facing
 * RIGHT. Hard-coding either one flips the other pack backwards — the player
 * moonwalks, facing away from the direction they are walking — so every pack
 * declares its own `native` side and the flip is simply "not that side".
 *
 * ALIGNMENT DIFFERS BY FORMAT, and this is the part worth reading.
 *   grid    frames are bottom-aligned and centred on their own bbox.
 *   ragged  frames carry an anchor read off the coconut BODY -- horizontal
 *           centroid, and the body's lowest row as the ground line. Bbox
 *           centring is WRONG for this sheet: an extended arm makes the frame
 *           wider on one side, so the bbox centre slides toward the punch and
 *           the body wobbles away from it on every hit. The anchor is the fix,
 *           and it is why the cutter exists.
 */
const FACINGS = ['left', 'right'];

class Sheets {
  constructor(assets) {
    this.assets = assets;
    this.packs = {};      // kind -> pack
  }

  /**
   * Prepare one character kind for drawing. Cheap -- it only measures and
   * caches; frames themselves are read straight out of the defs at draw time.
   */
  build(kind) {
    const def = CONFIG.CHARACTERS[kind];
    if (!def) return null;
    const img = this.assets.getDrawable(kind);
    const data = this.assets.getJSON(kind);
    if (!img || !data || !data.frames) return null;

    const pack = (def.pack === 'ragged')
      ? this._buildRagged(img, data, def)
      : this._buildGrid(img, data);
    /* A per-character DRAWN size, on top of the shared `fighterSizePx`. Folded
       into the pack's own scale so everything that measures a sprite -- the
       draw, `size()`, the floating health bar -- reads the same number. */
    if (pack && def.drawScale) pack.scale *= def.drawScale;
    if (pack) this.packs[kind] = pack;
    return pack;
  }

  _buildGrid(img, data) {
    const cols = data.cols || 9;
    /* One scale for the whole pack, derived from the SIDE-ON IDLE pose (row 2,
       col 0). Every other frame is scaled by the same factor, so the poses keep
       their relative sizes and a wind-up that is genuinely taller than the idle
       still reads as taller. Measuring against a per-frame height instead would
       squash every pose to the same size and kill the animation. */
    const ref = data.frames[2 * cols];
    const refH = (ref && ref.h) || 1;
    // The main game's packs are drawn facing LEFT.
    return { kind: 'grid', img, cols, frames: data.frames, native: 'left',
             scale: CONFIG.fighterSizePx / refH, refH };
  }

  _buildRagged(img, data, def) {
    // Same rule as the grid: one scale for the pack, measured off the idle.
    const idle = (data.anims && data.anims.idle) || [0];
    const ref = data.frames[idle[0]];
    /* MEASURED ON THE BODY WHERE THE DEFS SAY WHAT THE BODY IS, and the frame
       otherwise. The cigarette's frames are a third SMOKE — it rises off his
       ember and is part of the animation — so scaling his pack by the frame
       height draws a two-thirds-size cigarette under a full-height plume. His
       cutter records `bodyH`, the idle frame without the smoke. The coconut's
       defs carry no such field and fall back to the frame, unchanged. */
    const refH = data.bodyH || (ref && ref.h) || 1;
    /* The coconut's beat 'em up sheet is drawn facing RIGHT — the opposite of
       the grid packs. `native` comes from the defs when the cutter records it,
       so a future villain sheet drawn the other way needs no code change. */
    return { kind: 'ragged', img, frames: data.frames, anims: data.anims || {},
             native: data.native || 'right',
             /* POSE MAP PER PACK. `CONFIG.POSE_RAGGED` is the shared table, but
                two ragged sheets do not have to hold the same moves in the same
                rows: the coconut's knockdown row is six frames of falling over,
                the cigarette's is a fall AND a stand-up, so the same `down`
                slice cannot serve both. A pack overrides only what differs. */
             poses: Object.assign({}, CONFIG.POSE_RAGGED, (def && def.poses) || {}),
             scale: CONFIG.fighterSizePx / refH, refH };
  }

  /**
   * Does this kind have REAL DRAWN art for a pose?
   *
   * Deliberately false for anything the grid packs only fake. `POSE.down`
   * exists there, but it is the main game's flattened carry pose standing in
   * for a body on the floor — the caller still has to rotate it. Answering
   * "yes, there is a down pose" would switch that rotation off and leave the
   * villains standing upright while knocked out.
   */
  has(kind, pose) {
    const pack = this.packs[kind];
    if (!pack || pack.kind !== 'ragged') return false;
    const m = pack.poses[pose];
    return !!(m && pack.anims[m.anim] && this._seq(pack, pose).length);
  }

  /** The atlas indices a pose plays through, for the ragged packs. */
  _seq(pack, pose) {
    const m = pack.poses[pose] || pack.poses.idle;
    const all = pack.anims[m.anim] || pack.anims.idle || [0];
    const cut = all.slice(m.from || 0, m.to == null ? all.length : m.to);
    /* AN EMPTY SLICE WOULD DRAW NOTHING AT ALL. The pose table is shared and
       the rows are not: asking for the coconut's fifth combo hit of a villain
       whose punch row holds three gives a slice past the end, `rect` returns
       null and `draw` quietly returns — an invisible fighter, still solid,
       still hitting. Falling back to the whole row is visibly wrong instead. */
    return cut.length ? cut : all;
  }

  /** Source rect for a (kind, pose, frame-in-pose). */
  rect(kind, pose, step) {
    const pack = this.packs[kind];
    if (!pack) return null;
    if (pack.kind === 'ragged') {
      const seq = this._seq(pack, pose);
      return pack.frames[seq[Math.min(step | 0, seq.length - 1)]] || null;
    }
    const seq = CONFIG.POSE[pose] || CONFIG.POSE.idle;
    const col = seq[Math.min(step | 0, seq.length - 1)];
    // Row 2 is the side-on row -- the only one still used now the diagonals
    // are gone. Right-facing is the same row, flipped at draw time.
    return pack.frames[2 * pack.cols + col] || null;
  }

  /** How many frames a pose has -- what the animation clocks count against. */
  poseLength(kind, pose) {
    const pack = this.packs[kind];
    if (pack && pack.kind === 'ragged') return this._seq(pack, pose).length;
    const seq = CONFIG.POSE[pose];
    return seq ? seq.length : 1;
  }

  /**
   * Draw a fighter. (gx, gy) is its GROUND POINT on screen -- the spot its feet
   * stand on -- so the caller does the belt projection and this does not need
   * to know the world model at all.
   *
   * `alpha` and `flash` carry the flinch: a hit fighter blinks, and a dead one
   * fades. Both are applied here rather than by the caller so there is one
   * place a fighter's appearance is decided.
   */
  draw(ctx, kind, facing, pose, step, gx, gy, opts) {
    const pack = this.packs[kind];
    if (!pack) return;
    const f = this.rect(kind, pose, step);
    if (!f) return;
    const o = opts || {};
    const flip = facing !== (pack.native || 'left');
    const s = pack.scale * (o.scale || 1);
    const w = f.w * s, h = f.h * s;

    /* Where the frame sits relative to the ground point. The ragged pack knows
       its own anchor; the grid pack has none, so it falls back to bbox-centred
       and bottom-aligned, which is what it was always drawn with. */
    const ox = (f.ax != null ? -f.ax * s : -w / 2);
    const oy = (f.ay != null ? -f.ay * s : -h);
    /* TWO NUDGES, AND THEY ARE DIFFERENT QUESTIONS. `poseNudge` is per POSE and
       shared by every character -- "this pose is drawn a little high". The
       second is per CHARACTER and applies to every frame of it: "this pack's
       ground line is not quite where the cutter put it".

       ⚠️ ESPETO IS WHY THE SECOND EXISTS, and it is deliberately NOT a re-cut.
       His ground line was already moved once, in the cutter (`bodyMinRun`), and
       that worked -- but it also changed `bodyH`, and therefore his drawn size,
       and therefore the reaches measured off him. A second pass of the same
       medicine would move all three again for what is a pure vertical taste
       call. This is drawn px, down, and it touches nothing else: not the
       hurtbox, not the reaches, not the shadow, not `depthScale`.

       ⚠️ WHICH ALSO MAKES IT THE WRONG TOOL FOR A BIG NUMBER. It moves the
       PICTURE off the point the game thinks the fighter is standing on, so a
       large nudge is a sprite that no longer agrees with its own hitbox. Small
       corrections here; if it wants more than a few px, re-cut. */
    const pack_cfg = (CONFIG.CHARACTERS && CONFIG.CHARACTERS[kind]) || {};
    const nudge = ((CONFIG.poseNudge && CONFIG.poseNudge[pose]) || 0)
                + (pack_cfg.groundNudge || 0);

    // The whole transform is built around the ground point so the flip mirrors
    // the sprite about its own anchor rather than sliding it sideways.
    const blit = () => {
      ctx.translate(gx, gy + nudge * (o.scale || 1));
      /* ⚠️ `pivotY` MOVES WHERE THE ROTATION HAPPENS, and without it every
         rotation in this game is about the GROUND POINT -- which is right for a
         horse tipping over (it falls about its feet) and wrong for anything
         turning over in mid-air. A barrel being hoisted has to rotate about its
         own middle, or it swings around its base like a felled tree and leaves
         the hands entirely. Given in drawn px above the ground point; absent, it
         is 0 and this is exactly the old behaviour. */
      if (o.rotate) {
        const py = o.pivotY || 0;
        if (py) ctx.translate(0, -py);
        ctx.rotate(o.rotate);
        if (py) ctx.translate(0, py);
      }
      if (flip) ctx.scale(-1, 1);
      ctx.drawImage(pack.img, f.x, f.y, f.w, f.h, ox, oy, w, h);
    };

    ctx.save();
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    blit();
    ctx.restore();

    /* The hit flash. Drawn as a second pass in `lighter` over the same frame,
       clipped to the sprite by using the sprite itself as the source -- so it
       lights the character and not a rectangle of the floor behind it. Cheap,
       and it fails safe: an unsupported composite op just draws the sprite
       again at low alpha, which still reads as a flash. */
    if (o.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, o.flash);
      blit();
      ctx.restore();
    }

    /* A solid colour repaint of the sprite, for the bomb's panic red.
       ⚠️ IT IS A THIRD PASS OVER `blit()` AND THAT IS THE WHOLE POINT. The
       first version masked the sprite into an offscreen canvas and blitted the
       result back, which meant reproducing this function's transform -- anchor,
       depth scale, flip, rotation, pivot -- by hand at the call site. It lined
       up while the bomb sat still and nowhere near it once the bomb was thrown.
       Drawing again through the same closure cannot drift, because it is the
       same transform.
       ⚠️ AND THE FILTER STARTS WITH brightness(0). The bomb art is black (median
       luma 0), and every hue/saturate filter is a no-op on black -- crushing to
       black first and building the colour back up out of invert+sepia is what
       makes the recipe work on ANY sprite instead of only on pale ones.
       Unsupported `filter` -> this pass is a plain redraw of the sprite, which
       is invisible rather than broken. */
    if (o.tint) {
      ctx.save();
      ctx.filter = o.tint;
      if (o.tintAlpha != null) ctx.globalAlpha = o.tintAlpha;
      blit();
      ctx.restore();
    }
  }

  /**
   * How far a pose sticks out to either side of its GROUND POINT, in drawn px.
   *
   * THE ANSWER TO "HOW FAR OFF SCREEN DOES THIS HAVE TO START". A sprite is
   * drawn around its anchor, and a ragged pack's anchor is NOT its centre --
   * for a barata it sits well over toward one side, so the drawing reaches
   * 169px one way and 89 the other. Spawning it a flat margin past the edge
   * therefore puts its horns on screen while its ground point is safely off it,
   * which is exactly what happened when the roaches were scaled up.
   *
   * ⚠️ IT WALKS EVERY FRAME OF THE POSE, not just the first. A walk cycle is
   * widest mid-stride (frame 3 for all four packs), so measuring frame 0 would
   * under-report it by the exact amount that shows.
   *
   * ⚠️ AND IT DOES NOT KNOW ABOUT MIRRORING. A flipped frame swaps these two
   * around, so a caller that does not know which way the sprite will face
   * should use the LARGER of them -- see Stage._spawn(), which does.
   *
   * Grid packs have no anchor and are drawn bbox-centred, so both sides come
   * back as half the width, which is correct for them.
   */
  overhang(kind, pose) {
    const pack = this.packs[kind];
    if (!pack) return { left: 0, right: 0 };
    const n = Math.max(1, this.poseLength(kind, pose));
    let left = 0, right = 0;
    for (let i = 0; i < n; i++) {
      const f = this.rect(kind, pose, i);
      if (!f) continue;
      const w = f.w * pack.scale;
      const ax = (f.ax != null) ? f.ax * pack.scale : w / 2;
      if (ax > left) left = ax;
      if (w - ax > right) right = w - ax;
    }
    return { left, right };
  }

  /**
   * How far the tallest frame of a pose reaches ABOVE the ground point, drawn px.
   *
   * ⚠️ THIS IS THE FRAME'S REACH, NOT `size()`'s BODY HEIGHT, and the difference
   * is the whole reason it is a second method. `size()` deliberately returns
   * `bh` -- the BODY -- because a health bar floated over the cigarette's frame
   * height would hover a third of a screen above his smoke. The one caller here
   * wants the opposite: emerge.js sinks a fighter far enough that NOTHING of him
   * shows above the floor, and a sink measured on the body leaves the plume
   * hanging in the air over an empty patch of sand.
   *
   * ⚠️ THE MAX ACROSS THE POSE, not the current frame. The sink is a distance
   * held for the length of a rise while the walk cycle plays underneath it;
   * measured per frame it would breathe, and the shortest frame of the cycle
   * would poke through the floor.
   */
  topPx(kind, pose) {
    const pack = this.packs[kind];
    if (!pack) return 0;
    const n = Math.max(1, this.poseLength(kind, pose));
    let top = 0;
    for (let i = 0; i < n; i++) {
      const f = this.rect(kind, pose, i);
      if (!f) continue;
      // A grid pack has no anchor and is drawn bottom-aligned, so its whole
      // height is above the ground point -- which is what the fallback says.
      const t = (f.ay != null ? f.ay : f.h) * pack.scale;
      if (t > top) top = t;
    }
    return top;
  }

  /**
   * Drawn size of a pose, for the health bar and the debug boxes.
   *
   * THE HEIGHT IS THE BODY'S WHERE THE DEFS KNOW IT (`bh`), not the frame's.
   * hud.js floats an enemy's bar above this number, and the cigarette's frames
   * carry a plume of smoke above his head — measured on the frame, his bar
   * hovers a third of a screen over an empty patch of sky.
   */
  size(kind, pose, step) {
    const pack = this.packs[kind];
    const f = pack && this.rect(kind, pose, step);
    if (!f) return { w: 0, h: 0 };
    return { w: f.w * pack.scale, h: (f.bh != null ? f.bh : f.h) * pack.scale };
  }
}

/**
 * Pick a facing from a movement vector. Left or right, nothing else.
 *
 * DEPTH DOES NOT CHOOSE A FACING any more -- there are no diagonal frames to
 * choose. A pure vertical push therefore KEEPS THE CURRENT SIDE: walking
 * straight up or down the belt has no left/right component to read, and
 * turning to face the camera the moment the player steps back would swing the
 * sprite round mid-fight. `prev` is the facing held in that case.
 */
function facingFor(dx, dz, prev) {
  if (dx > 0.01) return 'right';
  if (dx < -0.01) return 'left';
  return (prev === 'right') ? 'right' : 'left';
}

/** Which way along the belt a facing points: -1 left, +1 right. */
function facingSign(facing) {
  return facing === 'right' ? 1 : -1;
}
