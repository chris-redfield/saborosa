/**
 * Party -- who is being played.
 *
 * This game was written around one hero, and the word `player` appears some
 * seven hundred times across src/. Two heroes is NOT seven hundred edits,
 * because almost nothing in the game actually wants "the party" -- it wants ONE
 * fighter, and the only real question is WHICH one:
 *
 *     the camera        the one in FRONT          lead(dir)
 *     an enemy's brain  the one NEAREST to it     nearestTo(x, z)
 *     a boss's beats    the one it has chosen     (held on the boss)
 *     combat            every one of them         forEach / inPlay()
 *     the HUD           every one of them, in slot order
 *     the walls         both, and the SAME walls  (bounds are camera-derived)
 *
 * So this object is not a container that the game loops over. It is the thing
 * that answers "which one" so that the answer is written down ONCE, in a place
 * where it can be read, instead of being re-decided at each of the forty call
 * sites that needed a fighter.
 *
 * ONE PLAYER MUST COME OUT EXACTLY AS IT WENT IN. With a single slot every
 * method here returns that slot: `lead` is him, `rear` is him, `nearestTo` is
 * him, `forEach` runs once. That is the property the whole conversion is built
 * on -- there is no `if (twoUp())` anywhere in the engine, because a party of
 * one makes every question degenerate to the answer it already had.
 *
 * WHY NOT AN ARRAY. Three reasons, all of them things an array made worse:
 *
 *   1. "The player" is also a SLOT -- P1 is P1 whether or not he is currently
 *      alive, out of lives, or waiting for a continue. An array of live bodies
 *      loses the slot the moment it is filtered, and the HUD, the continue
 *      screen and the lives counter are all addressed BY slot.
 *   2. The direction matters. `lead` is not `max(x)`: the bookcase's second
 *      shelf is walked LEFT (see Level3.promptDir), so the leader there is the
 *      one with the SMALLEST x. Written as an array every caller would have to
 *      remember that, and the one that forgot would work everywhere except the
 *      last stage.
 *   3. It must never hand back nothing. The camera asks every frame, including
 *      the frames where both heroes are dead on the floor, so `lead` falls back
 *      through alive -> in-play -> slot 0 rather than returning null and
 *      putting a `?.` at every call site.
 *
 * A SINGLETON, LIKE PlayerPick AND FOR THE SAME REASON. It is the finger
 * pointing at the fighters, not data about them; CONFIG stays pure data that
 * tools/build-manifest.js can evaluate in node.
 */
const Party = {
  /**
   * The slots, in join order: index 0 is P1, index 1 is P2. Never reordered
   * and never compacted -- an index into this list IS the player number, and
   * it is what the HUD, the lives counter and the continue screen address.
   */
  list: [],

  /** Start of a run: forget everybody. Called wherever a Player used to be
      built fresh in game.js. */
  reset() {
    this.list.length = 0;
    return this;
  },

  /**
   * Add a hero and hand back the slot he landed in.
   *
   * THE SLOT IS STAMPED ON THE FIGHTER as `slot`, so anything holding a
   * Player can ask which number he is without a lookup back through here --
   * the HUD draws his bar from it, and the input layer finds his device with
   * it. One direction only: this list is the truth and `slot` is a copy of the
   * index, which is safe exactly because the list is never reordered.
   */
  add(p) {
    if (!p) return -1;
    p.slot = this.list.length;
    this.list.push(p);
    return p.slot;
  },

  /** P1. Always there once a run has started; null on the title screen. */
  p1() { return this.list[0] || null; },
  /** P2, or null in a one-player run. */
  p2() { return this.list[1] || null; },
  /** A slot by number, or null. */
  at(i) { return this.list[i] || null; },

  /** How many slots exist at all, including a player who is out of lives. */
  slots() { return this.list.length; },

  /**
   * Is this a two-player run? Asked by the few things that genuinely have to
   * branch -- the second life bar, the forced-distinct character pick, and
   * whether a death freezes the world.
   */
  twoUp() { return this.list.length > 1; },

  /**
   * The heroes still IN the run: everyone who has not run out of lives.
   *
   * `out` IS A SLOT THAT HAS SPENT ITS LAST LIFE, and it is not the same as
   * `dead`. A dead hero is a body on the floor with a life left to spend and a
   * revive coming; an `out` hero has no lives and is waiting for a continue or
   * for the run to end. The difference is the whole two-player game-over rule:
   * the run is over when every slot is `out`, and until then the world keeps
   * running for whoever is left.
   */
  inPlay() { return this.list.filter(p => p && !p.out); },

  /** The heroes who can be hit, can hit, and are drawn standing up. */
  alive() { return this.list.filter(p => p && !p.out && !p.dead); },

  /** Is there anybody still fighting? False is the two-player game over. */
  anyAlive() { return this.alive().length > 0; },

  /** Is the run over -- every slot out of lives? */
  allOut() {
    const l = this.list;
    if (!l.length) return false;
    return l.every(p => !p || p.out);
  },

  /**
   * Run `fn(player, slot)` over everyone in the run. Used wherever the old
   * code did one thing to one hero: combat, the per-frame update, the draw
   * list, props.
   */
  forEach(fn) {
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i];
      if (p && !p.out) fn(p, i);
    }
    return this;
  },

  /**
   * THE ONE IN FRONT, where "front" is whichever way this leg of the level is
   * walked. `dir` is +1 for every room in the game except the bookcase's
   * second shelf, which runs LEFT -- see Level3.promptDir, which is where
   * callers in that room get it from.
   *
   * THIS IS THE CAMERA'S REFERENCE AND THE CHOICE WAS MADE DELIBERATELY. The
   * camera follows the leader and the trailing hero is carried along by the
   * left-hand wall that `Stage.bounds()` already draws at `camX +
   * gateMarginX`. The alternative -- following the one BEHIND -- was rejected
   * because it lets one idle player stop the level: the scroll segment's own
   * end test is "has he walked to `toX`", so a camera waiting for a hero who
   * is standing still is a wave that never spawns.
   *
   * NEVER NULL. Falls through alive -> in-play -> slot 0, because the camera
   * asks on every frame including the ones where both heroes are on the floor,
   * and a null there is a camera that jumps rather than holds.
   */
  lead(dir) {
    const d = (dir < 0) ? -1 : 1;
    const pool = this.alive();
    const from = pool.length ? pool : (this.inPlay().length ? this.inPlay() : this.list);
    let best = null;
    for (const p of from) {
      if (!p) continue;
      if (!best || (p.x - best.x) * d > 0) best = p;
    }
    return best || null;
  },

  /** The one BEHIND, by the same rule and with the same fallbacks. */
  rear(dir) {
    const d = (dir < 0) ? -1 : 1;
    const pool = this.alive();
    const from = pool.length ? pool : (this.inPlay().length ? this.inPlay() : this.list);
    let best = null;
    for (const p of from) {
      if (!p) continue;
      if (!best || (p.x - best.x) * d < 0) best = p;
    }
    return best || null;
  },

  /**
   * WHO AN ENEMY GOES FOR: the nearest hero that can still be fought.
   *
   * THE METRIC IS THE CROWD'S OWN, NOT A PLAIN HYPOT. `Crowd.update` already
   * measures distance to the player as `hypot(dx, dz * 2)` -- the belt is
   * shallow, so a step across it costs twice a step along it, and an enemy
   * that treated depth as cheap would walk past the hero in front of it to
   * reach one standing at the back. Copying that weighting here is what makes
   * a two-player target pick agree with the crowd's existing sense of "near".
   *
   * A DEAD HERO IS NOT A TARGET, and that is the one place this can bite: an
   * enemy mid-swing whose target dies has `target` repointed at the survivor
   * on the next frame, which would teleport its aim across the arena. That is
   * why the callers hold their choice for the length of a swing rather than
   * re-asking every frame -- see Crowd.update.
   */
  nearestTo(x, z) {
    let best = null, bd = Infinity;
    for (const p of this.alive()) {
      const d = Math.hypot(p.x - x, (p.z - z) * 2);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  },

  /**
   * WHO THIS FIGHTER IS FIGHTING. The one call the crowd AND the bosses make,
   * so that "who am I going for" has a single rule in the game.
   *
   * `keep` MEANS "DO NOT RE-PICK WHILE THE ONE YOU HAVE IS STILL VALID", and
   * the two callers mean different things by it:
   *
   *     a mook   keep = is it mid-swing. A punch that re-aimed between the
   *              wind-up and the blow would swing at a hero who was never in
   *              front of it -- the reach is resolved against `target.x` on the
   *              frame the blow lands, so this is not cosmetic.
   *     a boss   keep = always. A boss is a script several seconds long that
   *              samples a position at the start of a beat (the Mosca's fly-in
   *              is computed once, HORACIO's casts aim once); re-pointing one
   *              of those halfway through is the class of bug this game has
   *              found four times under other names.
   *
   * IT NEVER RETURNS NOTHING. Every enemy in the game dereferences its target
   * unconditionally -- `player.x` on the first line of a dozen branches -- so a
   * null here is a crash on the frame both heroes are on the floor. The fall
   * back is the dead hero himself: a body is still a position, the enemy walks
   * toward it for the frame or two before the death phase takes over, and
   * nothing reads him as hittable because `vulnerable()` already says no.
   */
  targetFor(f, keep) {
    const cur = f && f.target;
    if (keep && cur && !cur.dead && !cur.out) return cur;
    return this.nearestTo(f.x, f.z) || cur || this.lead(1);
  },

  /**
   * THE SINGLE FIGHTER TO HAND TO CODE THAT CAN ONLY TAKE ONE, when the
   * question is not "which is in front" or "which is nearest" but simply "the
   * player" -- a prompt's anchor, a debug readout, a sound's listener.
   *
   * IT IS THE LEADER AND NOT SLOT 0 ON PURPOSE. Every one of those uses is
   * about the FRAME, and the frame belongs to whoever is driving it.
   */
  ref(dir) { return this.lead(dir); },

  /**
   * Put the party on the floor at one spot: slot 0 lands on it, and each
   * further slot is set back along the walk and across the belt.
   *
   * USED WHEREVER THE OLD CODE WROTE `player.x = r.startX`. The offset is a
   * config number rather than a literal because it is the one thing about a
   * two-player spawn anybody will want to move: too close and the two heroes
   * are drawn on top of each other at every door in the game.
   *
   * `dir` IS THE LEG'S DIRECTION AGAIN, so on a leftward shelf P2 is set back
   * to the RIGHT. Getting this wrong puts the second hero past the leader at
   * the one door where it is visible.
   */
  place(x, z, dir) {
    this.placeX(x, dir);
    const T = CONFIG.TWO_PLAYER || {};
    const gz = (T.spawnGapZRel != null) ? T.spawnGapZRel : 0.16;
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i];
      if (!p) continue;
      /* ACROSS THE BELT AS WELL AS BACK ALONG IT, and clamped to the belt: the
         second slot is nudged toward the far edge so the pair reads as two
         bodies rather than one with a shadow, and a room whose band is shallow
         must not put a hero's feet off the back of it. */
      p.z = Math.max(0, Math.min(Belt.depth, z + Belt.depth * gz * i));
    }
    return this;
  },

  /**
   * The same spread ALONG the walk only, leaving each hero's depth alone.
   *
   * WHAT IT IS FOR: the places that move the party sideways without re-seating
   * it -- the lift's boarding mark, a mid-fight join. Where they are standing
   * across the belt is something the players chose, and a routine that only
   * needs to move them along the floor has no business flattening it.
   */
  placeX(x, dir) {
    const T = CONFIG.TWO_PLAYER || {};
    const gx = (T.spawnGapX != null) ? T.spawnGapX : 120;
    const d = (dir < 0) ? -1 : 1;
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i];
      if (p) p.x = x - d * gx * i;
    }
    return this;
  },

  /**
   * Shift everybody by the same distance. THE LIFT'S HAND-OVER BETWEEN TWO
   * BANDS OF LEVEL 3 IS THE ONE CALLER, and it is why this exists rather than a
   * per-hero screen offset: the bands are 4000px apart and the seam has to move
   * NOTHING on screen, so the shift is the CAMERA's delta and every rider gets
   * the same one. Each hero keeps his own screen x for free, which is exactly
   * what the single-rider version was hand-computing.
   */
  shift(dx) {
    if (!dx) return this;
    for (const p of this.list) if (p) p.x += dx;
    return this;
  },
};
