/**
 * Sheets — reads the main game's 9-col x 5-row character packs and presents
 * them as the SIX FACINGS a beat 'em up uses.
 *
 * The defs (tools/build-character-defs.py) are a flat `frames` array in reading
 * order, so frame (row, col) is `frames[row * cols + col]`. Rows are
 * directions, columns are poses.
 *
 *     row 0   down        SKIPPED
 *     row 1   down_left   → down_left, and mirrored → down_right
 *     row 2   left        → left,      and mirrored → right
 *     row 3   up_left     → up_left,   and mirrored → up_right
 *     row 4   up          SKIPPED
 *
 * ⚠️ ROWS 0 AND 4 ARE SKIPPED ON PURPOSE and this is the genre rule, not a
 * shortcut. A beat 'em up's fighters face ALONG the belt — a sprite facing the
 * camera, or its back to it, destroys the read of who is about to hit whom,
 * which in a game where three enemies are closing at once is the only thing
 * keeping the screen legible. So `up` and `down` are never selected however
 * hard the player pushes the stick: see `facingFor()`, which folds a pure
 * vertical push onto whichever horizontal facing the fighter already had.
 *
 * ⚠️ MIRRORING IS A DRAW-TIME FLIP, not a second set of frames. The packs only
 * carry the left-facing halves, and building right-facing copies at load would
 * double the texture memory for something a negative x-scale does for free.
 *
 * ALIGNMENT. Frames are bottom-aligned to the fighter's ground line, because
 * the poses vary a lot in height (79px to 149px across a row) and the one thing
 * that must not move is the feet. The main game does something cleverer — a
 * body-colour centroid scan, src/entities/spritesheet.js — which is worth
 * porting if a pose ever visibly floats; `CONFIG.poseNudge` is the hand-tuned
 * stopgap until then.
 */
const FACINGS = ['left', 'right', 'down_left', 'down_right', 'up_left', 'up_right'];

// facing → { row, flip }. The three rows the packs actually give us, each
// serving one left-facing direction and its mirrored twin.
const FACING_SRC = {
  left:       { row: 2, flip: false },
  right:      { row: 2, flip: true },
  down_left:  { row: 1, flip: false },
  down_right: { row: 1, flip: true },
  up_left:    { row: 3, flip: false },
  up_right:   { row: 3, flip: true },
};

class Sheets {
  constructor(assets) {
    this.assets = assets;
    this.packs = {};      // kind → { img, frames, cols, scale, refH }
  }

  /**
   * Prepare one character kind for drawing. Cheap — it only measures and
   * caches; the frames themselves are read straight out of the defs at draw
   * time.
   */
  build(kind) {
    const def = CONFIG.CHARACTERS[kind];
    if (!def) return null;
    const img = this.assets.getDrawable(kind);
    const data = this.assets.getJSON(kind);
    if (!img || !data || !data.frames) return null;

    const cols = data.cols || 9;
    /* One scale for the whole pack, derived from the SIDE-ON IDLE pose (row 2,
       col 0). Every other frame is scaled by the same factor, so the poses keep
       their relative sizes and a wind-up that is genuinely taller than the idle
       still reads as taller. Measuring against a per-frame height instead would
       squash every pose to the same size and kill the animation. */
    const ref = data.frames[2 * cols];
    const refH = (ref && ref.h) || 1;
    const pack = {
      img, cols,
      frames: data.frames,
      scale: CONFIG.fighterSizePx / refH,
      refH,
    };
    this.packs[kind] = pack;
    return pack;
  }

  /** Source rect for a (kind, facing, pose, frame-in-pose). */
  rect(kind, facing, pose, step) {
    const pack = this.packs[kind];
    if (!pack) return null;
    const src = FACING_SRC[facing] || FACING_SRC.left;
    const seq = CONFIG.POSE[pose] || CONFIG.POSE.idle;
    const col = seq[Math.min(step | 0, seq.length - 1)];
    return pack.frames[src.row * pack.cols + col] || null;
  }

  /** How many frames a pose has — what the animation clocks count against. */
  poseLength(pose) {
    const seq = CONFIG.POSE[pose];
    return seq ? seq.length : 1;
  }

  /**
   * Draw a fighter. (gx, gy) is its GROUND POINT on screen — the spot its feet
   * stand on — so the caller does the belt projection and this does not need to
   * know the world model at all.
   *
   * `alpha` and `tint` carry the flinch: a hit fighter blinks, and a dead one
   * fades. Both are applied here rather than by the caller so there is one
   * place a fighter's appearance is decided.
   */
  draw(ctx, kind, facing, pose, step, gx, gy, opts) {
    const pack = this.packs[kind];
    if (!pack) return;
    const f = this.rect(kind, facing, pose, step);
    if (!f) return;
    const o = opts || {};
    const src = FACING_SRC[facing] || FACING_SRC.left;

    const s = pack.scale * (o.scale || 1);
    const w = f.w * s, h = f.h * s;
    const nudge = (CONFIG.poseNudge && CONFIG.poseNudge[pose]) || 0;

    ctx.save();
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    // The whole transform is built around the ground point so the flip mirrors
    // the sprite about its own centre line rather than sliding it sideways.
    ctx.translate(gx, gy + nudge * (o.scale || 1));
    if (o.rotate) ctx.rotate(o.rotate);
    if (src.flip) ctx.scale(-1, 1);
    ctx.drawImage(pack.img, f.x, f.y, f.w, f.h, -w / 2, -h, w, h);
    ctx.restore();

    /* The hit flash. Drawn as a second pass in `lighter` over the same frame,
       clipped to the sprite by using the sprite itself as the source — so it
       lights the character and not a rectangle of the floor behind it. Cheap,
       and it fails safe: an unsupported composite op just draws the sprite
       again at low alpha, which still reads as a flash. */
    if (o.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, o.flash);
      ctx.translate(gx, gy + nudge * (o.scale || 1));
      if (o.rotate) ctx.rotate(o.rotate);
      if (src.flip) ctx.scale(-1, 1);
      ctx.drawImage(pack.img, f.x, f.y, f.w, f.h, -w / 2, -h, w, h);
      ctx.restore();
    }
  }

  /** Drawn size of a pose, for the health bar and the debug boxes. */
  size(kind, facing, pose, step) {
    const pack = this.packs[kind];
    const f = pack && this.rect(kind, facing, pose, step);
    if (!f) return { w: 0, h: 0 };
    return { w: f.w * pack.scale, h: f.h * pack.scale };
  }
}

/**
 * Pick a facing from a movement vector, honouring the six-facing rule.
 *
 * ⚠️ A PURE VERTICAL PUSH KEEPS THE CURRENT HORIZONTAL SIDE. Walking straight
 * up or down the belt has no left/right component to read a facing from, and
 * the packs have no forward/backward frames to fall back on — so the fighter
 * holds whichever way it was already facing and walks sideways-on. That is what
 * the genre does, and it is also what the player wants: turning to face the
 * camera the moment they step back would swing the sprite round mid-fight.
 *
 * `prev` is the facing to keep in that case.
 */
function facingFor(dx, dz, prev) {
  const side = dx > 0.01 ? 'right' : dx < -0.01 ? 'left'
    : (prev && prev.indexOf('right') >= 0 ? 'right' : 'left');
  // Positive dz is toward the camera (down the screen) = the `down_` rows.
  if (dz > 0.01) return 'down_' + side;
  if (dz < -0.01) return 'up_' + side;
  return side;
}

/** Which way along the belt a facing points: -1 left, +1 right. */
function facingSign(facing) {
  return facing && facing.indexOf('right') >= 0 ? 1 : -1;
}
