/**
 * ending.js — the screen you get for winning.
 *
 * A photograph with the real coconut toy sat on a rock in it, and LEBRON walks
 * in from the left, stops in front of it, and throws his arms up. A beat later
 * the tally comes up over the top.
 *
 * A SIBLING OF title.js, ON PURPOSE. Same shape, same reasons: it owns its own
 * clock, it draws a 4:3 photograph COVER onto a 16:9 canvas, and it hands back
 * a single boolean when the shell should move on. The shell has no business
 * knowing how long a walk-in takes.
 *
 * ⚠️ IT DRAWS THE PLAYER ITSELF RATHER THAN TICKING THE REAL ONE, and that is
 * the decision worth defending. The `Player` in the fight is a belt entity: it
 * has depth, a camera to be projected through, gates it may not walk past, an
 * attack state machine and a life total. None of that exists on this screen —
 * there is no belt, no camera and nothing to fight — so driving it here would
 * mean feeding a simulation a world that is not there and hoping nothing in it
 * noticed. What is actually needed is two numbers and a pose, which is what
 * this keeps.
 *
 * THE COST OF THAT is that the walk here is not the walk in the game: it is a
 * position and a frame clock, not `Fighter.update`. If they ever visibly
 * disagree, this is why.
 *
 * ⚠️ THE VICTORY FRAME IS ADDRESSED BY ATLAS POSITION. `CONFIG.CHARACTERS
 * .coconut.poses.victory` points at atlas frame 10 through the `jump` row,
 * because that is where the packer put the drawing. Re-cutting the sheet can
 * move it. See the note on that config line before trusting the name.
 */
class Ending {
  constructor(assets, sheets) {
    this.assets = assets;
    this.sheets = sheets;
    this.reset();
  }

  reset() {
    this.t = 0;              // seconds on this screen
    this.phase = 'walk';     // walk -> pose -> done
    this.poseT = 0;          // seconds since the arms went up
    this.x = 0;              // screen x of his ground point
    this.started = false;
  }

  /** True on the frame the tally should come up. */
  update(dt) {
    const C = CONFIG.ENDING || {};
    const W = CONFIG.GAME_W;
    if (!this.started) {
      this.started = true;
      this.x = W * (C.startXRel != null ? C.startXRel : -0.1);
    }
    this.t += dt;

    if (this.phase === 'walk') {
      const stop = W * (C.stopXRel != null ? C.stopXRel : 0.42);
      this.x += (C.walkSpeed || 210) * dt;
      if (this.x >= stop) {
        this.x = stop;
        this.phase = 'pose';
        this.poseT = 0;
      }
      return false;
    }

    if (this.phase === 'pose') {
      /* THE HOLD IS COUNTED FROM THE POSE, NOT FROM THE START OF THE SCREEN.
         It was asked for as "1.5 seconds after this animation" -- so a longer
         walk-in must not eat into it, which is exactly what timing it off `t`
         would do. */
      this.poseT += dt;
      if (this.poseT * 1000 >= (C.poseHoldMs != null ? C.poseHoldMs : 1500)) {
        this.phase = 'done';
        return true;
      }
    }
    return false;
  }

  /** Draw the plate COVER — same arithmetic, and same trap, as title.js. */
  _plate(ctx, W, H) {
    const img = this.assets.getDrawable('endingBg');
    if (!img) return;
    const iw = img.width || img.naturalWidth;
    const ih = img.height || img.naturalHeight;
    if (!iw || !ih) return;
    const s = Math.max(W / iw, H / ih);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
    ctx.restore();
  }

  draw(ctx, W, H) {
    const C = CONFIG.ENDING || {};
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    this._plate(ctx, W, H);

    /* UP OUT OF THE OUTRO'S BLACK. The screen before this one ended on a fade
       to black, so arriving at full brightness is a cut. Only the plate fades;
       he walks in over it. */
    const fin = C.fadeInMs || 0;
    if (fin > 0 && this.t * 1000 < fin) {
      ctx.save();
      ctx.globalAlpha = 1 - Math.min(1, this.t * 1000 / fin);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    const gy = H * (C.groundYRel != null ? C.groundYRel : 0.93);
    const scale = C.scale || 1;
    /* Facing RIGHT because he is walking right. `sheets.draw` mirrors against
       the pack's own native side, so this is the direction he travels and not
       an assumption about which way the art faces. */
    /* WHOEVER FINISHED THE GAME WALKS IN. One hero in a one-player run, both of
       them a stride apart in a two-player one -- the same `spawnGapX` the title
       walk and every door in the game use, so the pair arrives here looking
       like the pair that has been playing.
       ⚠️ THE SLOT COUNT COMES FROM `Party`, not from a flag set when this
       screen opened: by the time the ending runs, the party IS the answer to
       "who played", including a hero who spent his last life on the last boss
       and is still a slot.
       ⚠️ AND THE ONE IN FRONT IS DRAWN LAST, which is the reverse of the loop
       order -- the same countdown the title walk uses and for the same reason.
       ⚠️ THEY SHARE ONE STEP AND ONE POSE. Two clocks a stride apart would read
       as a hero and his echo rather than as two people arriving together. */
    const slots = (typeof Party !== 'undefined' && Party.slots()) ? Party.slots() : 1;
    const gap = (CONFIG.TWO_PLAYER || {}).spawnGapX || 150;
    const ms = (CONFIG.POSE_MS && CONFIG.POSE_MS.walk) || 124;
    const n = Math.max(1, this.sheets.poseLength(PlayerPick.kind(0), 'walk'));
    const step = Math.floor(this.t * 1000 / ms) % n;
    for (let sl = slots - 1; sl >= 0; sl--) {
      const kind = PlayerPick.kind(sl);
      const x = this.x - gap * sl;
      if (this.phase === 'walk') {
        this.sheets.draw(ctx, kind, 'right', 'walk', step, x, gy, { scale });
      } else {
        this.sheets.draw(ctx, kind, 'right', 'victory', 0, x, gy, { scale });
      }
    }
  }
}
