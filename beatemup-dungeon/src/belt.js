/**
 * Belt — how deep the walkable band is, and where it sits on the screen.
 *
 * EVERYTHING IN THIS GAME LIVES ON THE BELT. A fighter is (x, z): x along it, z
 * across it from 0 (far) to `depth` (near), and the screen y of anything
 * standing on it is `topY + z`. Depth also drives the perspective scale, since
 * `z / depth` is how far across the band a body is.
 *
 * ⚠️ THE BAND USED TO BE ONE SIZE FOR THE WHOLE GAME, and this file exists
 * because it is not any more. Asked for 2026-08-27: the desert's belt is DOUBLE
 * the street's. The street was shot low and tight and 190px of depth is the
 * ground it has; the desert's plate is a high, open shot of dirt with the
 * horizon most of the way up the frame, and the same 190px band left the bottom
 * third of the picture unwalkable.
 *
 * SO IT IS A PROPERTY OF THE ROOM, like `plate` and `music` already are -- and
 * for the same reason those are. A room is a PLACE. How much floor it has is
 * part of what makes it one.
 *
 * ⚠️ `CONFIG.beltTopY` AND `CONFIG.beltDepth` ARE STILL REAL AND ARE THE
 * DEFAULT. A room that declares no `belt` gets them, which is every room but the
 * desert, so nothing about the street or the boss room moved. They are also
 * still what the TITLE SCREEN measures against (`titleWalkGroundYRel`), which is
 * correct: the title is not a room and has no belt to be a property of.
 *
 * ⚠️ NOTHING MAY READ `CONFIG.beltTopY` / `CONFIG.beltDepth` DIRECTLY ANY MORE.
 * That is the whole discipline this file asks for: a single read site left on
 * CONFIG is a body standing on the street's floor in the desert, and it will
 * look like a sprite-anchor bug rather than like a missed find-and-replace. If
 * you add a file that puts something on the ground, it reads `Belt`.
 *
 * ⚠️ AND THE DEBUG OVERLAY READS IT TOO, which is not a detail. `src/debug.js`
 * draws the belt band, the walkable region and the depth ruler from these same
 * two numbers -- so the C-key view follows a room's belt automatically and
 * cannot disagree with where the fighters actually stand. An overlay that drew
 * the default band over a room with a bigger one would be the exact failure
 * mode the debug views exist to rule out.
 *
 * WHO SETS IT: `Stage`, in `reset()` and `enterRoom()` -- the two places the
 * room can change. It is set BEFORE the player is placed in either, because
 * where he starts is `depth * playerStartZRel` and reading it a line early puts
 * him on the previous room's floor.
 */
const Belt = {
  /* Seeded from the defaults so a read before the first `set()` is still a
     sane answer rather than NaN. config.js loads first, so CONFIG is here. */
  topY: CONFIG.beltTopY,
  depth: CONFIG.beltDepth,

  /**
   * Point the belt at a room's band, or back at the default.
   *
   * Takes the ROOM rather than two numbers so the call site cannot pass one and
   * forget the other -- `topY` and `depth` are a pair, and a room that moved the
   * far edge without resizing the band would put its near edge off the bottom of
   * the canvas.
   */
  set(room) {
    const b = (room && room.belt) || null;
    this.topY = (b && b.topY != null) ? b.topY : CONFIG.beltTopY;
    this.depth = (b && b.depth != null) ? b.depth : CONFIG.beltDepth;
  },

  /** The near edge, in screen y. Where the floor runs out. */
  bottomY() { return this.topY + this.depth; },
};
