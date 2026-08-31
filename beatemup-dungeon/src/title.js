/**
 * title.js — the first thing the game shows.
 *
 * A photograph of a wall. The name FALLS IN from above it on the first frame,
 * and once it has landed LEBRON walks in from the left and off the right. Any
 * button starts the fight.
 *
 * ⚠️ IT USED TO BE THE FLYING DUNGEON'S CRAWLING VERMIN PANEL with the SABOROSA
 * logo over it, three frames on a ~105ms cycle read in place out of that game's
 * folder. All of that is gone -- one still photograph and hand-set type
 * replaced it on 2026-08-21. The frame clock went with it, which is most of why
 * this file got shorter.
 *
 * ⚠️ IT USED TO HOLD THE BARE PHOTOGRAPH FOR TWO SECONDS before fading the name
 * up, on the argument that a picture given time reads as a place rather than as
 * a background for some text. That was overruled on 2026-08-22: the title drops
 * in from off the top of the frame on the first frame, eased out so it lands
 * rather than stops. `titleDropAtMs` / `titleDropMs` are the knobs, and the
 * config note beside them says how to get the old screen back.
 *
 * ⚠️ AND HE IS DRAWN HERE, NOT SIMULATED. The walk-across is two numbers and a
 * frame clock reading the same packs the fight reads -- exactly what ending.js
 * does, for the reason its header gives at length: a `Player` is a belt entity
 * with depth, a camera, gates, an attack machine and a life total, and none of
 * that exists on a photograph. The cost is that this walk is not `Fighter
 * .update`; if the two ever visibly disagree, that is why.
 *
 * ⚠️ THE PHOTO IS 4:3 AND THE CANVAS IS 16:9, so it is drawn COVER: scaled to
 * fill and centre-cropped. `contain` would pillarbox and put two black bars
 * either side of the one image the screen has.
 *
 * ⚠️ IT IS ALSO THE FRUIT SELECT (2026-08-31), AND THAT IS ONE SCREEN RATHER
 * THAN TWO ON PURPOSE. What was asked for has no cut in it: *"the letters of the
 * name of the game go up back, leave the screen, then new letters go down,
 * written ESCOLHA SUA FRUTA, and the 3 images are used... After selecting the
 * coconut, the selectd coconut appears walking on screen like it used to do
 * before."* The photograph is held throughout, the name leaves the way it
 * arrived, and the walk at the end is the walk this file has always had -- now
 * carrying whoever was chosen. Splitting it would mean a third copy of the
 * cover-fit plate and a hand-off between two screens drawing the same picture:
 * a seam where the design has none.
 *
 * SO THIS RUNS AS STAGES OFF ONE CLOCK -- see `stage` in reset():
 *
 *     name    the title falls in and waits to be pressed          (as it always was)
 *     lift    the name accelerates up and off the top
 *     ask     ESCOLHA SUA FRUTA falls in; the picture fades up; left/right pick
 *     chosen  the choice is held a beat, then the prompt lifts and the art fades
 *     walk    the chosen hero crosses, exactly as before
 *
 * ⚠️ WITH `SELECT.on` FALSE THE MIDDLE THREE ARE SKIPPED and `name` hands
 * straight to `walk`. That is the old screen to the frame, and it is the
 * rollback.
 *
 * NO DROP SHADOW, NOTHING DARKENED UNDER THE TYPE. That is the house rule for
 * every title screen in this project -- the art shows at full brightness and
 * the letters sit on it crisp. The type is dark because the wall is sunlit; if
 * it ever stops reading, move it to a cleaner part of the wall rather than
 * shading the photograph.
 */
class Title {
  constructor(assets, sheets) {
    this.assets = assets;
    /* The character packs, for the walk-across. Built by boot() before this
       screen is ever drawn -- and drawn defensively anyway (see `_walker`),
       because a pack that failed to load must cost a walk-on, not the screen. */
    this.sheets = sheets;
    this.reset();
  }

  /** Back to the top. Called when the game returns here after a run, so the
      hold and the name play again exactly as they did on the first boot. */
  reset() {
    this.t = 0;          // ms on screen; the drop and the walk are timed off it
    this.walkT = -1;     /* -1 until he sets off, then ms into the crossing. It
                            doubles as the "not walking" flag for the same
                            reason `out` does below: one clock, one meaning. */
    this.go = false;     /* Has the player asked for the walk? THE PRESS IS THE
                            START OF THE WALK, not the end of the screen -- see
                            update(). Separate from `walkT` because a press made
                            while the name is still falling is REMEMBERED and
                            spent the moment it lands, rather than ignored. */
    this.out = -1;       /* -1 until dismissed, then the fade-out clock.
                            IT DOUBLES AS THE "already going" FLAG: a second
                            press during the fade must not restart it, and a
                            separate boolean would be a second thing to keep in
                            step with this one. */
    this.done = false;

    /* THE FRUIT SELECT. `stage` is which of the five beats is running and
       `stageT` is ms into it -- a clock per stage rather than offsets off `t`,
       for the reason `_tickWalk` already gives: retune one beat and the ones
       after it keep the spacing they were tuned to. */
    this.stage = 'name';
    this.stageT = 0;
    /* WHICH HERO IS HIGHLIGHTED: an index into CONFIG.PLAYER_PACKS, or -1 for
       none.
       ⚠️ IT OPENS ON THE LEFT ONE, asked for 2026-08-31 ("make the left one
       already selected by default"). -1 is still a REAL state with a picture of
       its own -- both coconuts in their own colours, nobody washed out -- and
       `SELECT.defaultPick: -1` brings it back. It is also what the screen falls
       to if a hero's own picture is missing.
       ⚠️ AND -1 IS NOT "UNSET": at -1 a confirm does nothing, because an
       unanswered select must never quietly mean "the first one". That is
       `PlayerPick.set` refusing an out-of-range index, not a special case
       here. */
    const dp = this._sel('defaultPick', 0);
    this.pick = (dp >= 0 && dp < PlayerPick.list().length) ? dp : -1;
    // Edge detection for left/right. `input.left`/`right` are HELD flags, so
    // the screen has to remember the last frame or one tap scrolls the list.
    this._heldL = false;
    this._heldR = false;
  }

  /** Is the select actually running, or is this the old title screen? */
  _selecting() {
    return !!(CONFIG.SELECT && CONFIG.SELECT.on && CONFIG.SELECT.PROMPT);
  }

  _sel(key, dflt) {
    const S = CONFIG.SELECT || {};
    return S[key] != null ? S[key] : dflt;
  }

  /**
   * Every frame it is up. Returns true on the frame the game should begin.
   *
   * ⚠️ THE PRESS STARTS THE WALK; THE WALK ENDS THE SCREEN. It used to be one
   * step -- he set off on his own a beat after the name landed, and a press at
   * any point dismissed the screen out from under him. Asked for 2026-08-24:
   * the name lands, the screen WAITS, a press sends him across, and the game
   * begins by itself once he is gone. So there is exactly one press on this
   * screen and it buys the walk rather than skipping it.
   *
   * ⚠️ AN EARLY PRESS IS REMEMBERED, NOT IGNORED. It is still accepted from the
   * first frame, before the name has arrived -- the hold is there to be looked
   * at, not sat through, and a title screen that ignores input reads as one that
   * has hung. It is `go` that is set; `_tickWalk` spends it the moment the name
   * has landed. A screen that swallows presses and one that acts on them out of
   * order are both worse than waiting a beat.
   */
  update(dt, input) {
    this.t += dt * 1000;
    this.stageT += dt * 1000;
    this._tickWalk(dt);
    if (this.out >= 0) {
      this.out += dt * 1000;
      if (this.out >= (CONFIG.titleFadeOutMs || 600)) { this.done = true; return true; }
      return false;
    }
    /* THE SELECT OWNS THE INPUT WHILE IT IS UP. It returns true once it has
       handed back -- i.e. once the chosen hero is due to walk -- and until then
       nothing below runs, because a press on the select means "this one", not
       "start the game". */
    if (this._selecting() && this.stage !== 'name' && this.stage !== 'walk') {
      this._tickSelect(input);
      return false;
    }
    if (input && input.takeAnyPress()) this.go = true;
    /* THE PRESS OPENS THE SELECT INSTEAD OF SENDING HIM OFF. Only once the name
       has LANDED -- the same gate the walk used to sit behind, kept for the same
       reason: type still falling must not be yanked back up. An early press is
       still remembered in `go` and spent here the moment it lands. */
    if (this._selecting() && this.stage === 'name' && this.go
        && this.t >= this._landedAtMs()) {
      this.stage = 'lift';
      this.stageT = 0;
      return false;
    }
    /* HE IS OFF THE EDGE: start the fade. It runs OVER the last of his walk --
       he keeps going to `titleWalkEndXRel` underneath it, which is what that
       number has always been for. Measured at `titleWalkExitXRel` instead so
       the screen does not sit still for the three quarters of a second he
       spends invisible between the two.
       ⚠️ WITH NO WALK AT ALL (`titleWalk` false, or no sprite pack) there is
       nothing to wait for and the press dismisses the screen directly, or the
       game would be unstartable. */
    const walking = CONFIG.titleWalk && this.sheets;
    /* ⚠️ WITH NO WALK AT ALL (`titleWalk` false, or no sprite pack) there is
       nothing to wait for and the press dismisses the screen directly, or the
       game would be unstartable.
       ⚠️ BUT NOT WHILE THE SELECT IS STILL DUE. With `SELECT.on` the first press
       opens the question, and this line would answer it by ending the screen --
       the fruit select would exist and simply never be reachable on a build with
       the walk switched off. `_tickSelect` sets `out` itself when the choice is
       made and there is no walk to spend. */
    if (!walking) {
      if (this.go && !this._selecting()) this.out = 0;
      return false;
    }
    if (this.walkT >= 0 && this.walkT >= this._walkExitAtMs()) this.out = 0;
    return false;
  }

  /**
   * The three middle stages: the name leaving, the question, the choice made.
   *
   * ⚠️ A DIRECTION EDGE BEATS AN ANY-PRESS ON THE SAME FRAME, and that is not
   * belt-and-braces -- it is the only thing that makes this work on a pad. On a
   * keyboard the arrows return out of the keydown handler before `_anyPress` is
   * ever set, so they cannot confirm; on a GAMEPAD every button press sets it,
   * d-pad included (input.js says so in as many words: *"a player hunting for
   * the button to dismiss a screen should not have to find the right one"*).
   * Without this rule, nudging the d-pad left would move the highlight AND
   * commit it in the same frame, and the screen would be impossible to use with
   * the controller it was drawn for.
   *
   * ⚠️ THE PRESS IS TAKEN EITHER WAY. `takeAnyPress` is a queue, not a poll --
   * leaving it unread just spends it on the next frame instead, which is the
   * same bug one frame later and much harder to see.
   */
  _tickSelect(input) {
    const S = CONFIG.SELECT || {};
    if (this.stage === 'lift') {
      if (this.stageT >= this._sel('liftMs', 520) + this._sel('gapMs', 140)) {
        this.stage = 'ask';
        this.stageT = 0;
      }
      return;
    }
    if (this.stage === 'chosen') {
      /* The hold, then the prompt lifting out -- one stage rather than two
         because nothing may happen in between and a second stage would be a
         second clock to keep in step with this one. */
      if (this.stageT >= this._sel('chosenHoldMs', 500) + this._sel('liftMs', 520)) {
        this.stage = 'walk';
        this.stageT = 0;
        this.walkT = 0;
        /* ⚠️ NO WALK, NO SCREEN LEFT TO SHOW. `titleWalk` off or a pack that
           failed to load means there is nothing to wait for, exactly as the
           name-only screen handles it -- without this the select would answer
           the choice by sitting there. */
        if (!(CONFIG.titleWalk && this.sheets)) this.out = 0;
      }
      return;
    }

    // --- 'ask': the question is up (or arriving) and the player may answer ---
    const L = !!(input && input.left), R = !!(input && input.right);
    const hitL = L && !this._heldL, hitR = R && !this._heldR;
    this._heldL = L; this._heldR = R;
    const press = !!(input && input.takeAnyPress());

    /* ⚠️ NOT UNTIL THE QUESTION HAS LANDED. Answering type that is still falling
       is the same complaint the walk-on had, and here it would also mean picking
       before the pictures have faded up -- a choice made blind. */
    if (this.stageT < this._askLandedMs()) return;

    const packs = PlayerPick.list();
    if (hitL || hitR) {
      /* LEFT AND RIGHT ARE POSITIONS IN THE PICTURE, not a cursor to be
         scrolled. The two coconuts are drawn side by side, so left means the
         first of `PLAYER_PACKS` and right means the last -- the same mapping
         with three heroes would need the art redrawn anyway. */
      this.pick = hitL ? 0 : packs.length - 1;
      return;                              // the edge is spent; see the header
    }
    if (press && this.pick >= 0) {
      PlayerPick.set(this.pick);
      this.stage = 'chosen';
      this.stageT = 0;
    }
  }

  /** ms into 'ask' when the question has finished falling and can be answered. */
  _askLandedMs() {
    return CONFIG.titleDropMs != null ? CONFIG.titleDropMs : 700;
  }

  /** ms into the crossing when he has cleared the visible edge. */
  _walkExitAtMs() {
    const W = CONFIG.GAME_W;
    const x0 = W * (CONFIG.titleWalkStartXRel != null ? CONFIG.titleWalkStartXRel : -0.12);
    const exit = W * (CONFIG.titleWalkExitXRel != null ? CONFIG.titleWalkExitXRel : 1.06);
    return (exit - x0) / Math.max(1, CONFIG.titleWalkSpeed || 210) * 1000;
  }

  /** 0..1 through the name's fade-in. 1 once it is fully up. */
  _nameAlpha() {
    const at = CONFIG.titleDropAtMs != null ? CONFIG.titleDropAtMs : 0;
    const fade = CONFIG.titleNameFadeMs != null ? CONFIG.titleNameFadeMs : 0;
    if (this.t < at) return 0;
    if (fade <= 0) return 1;
    return Math.min(1, (this.t - at) / fade);
  }

  /**
   * 0..1 through the FALL. 1 once the name has landed.
   *
   * TWO EASINGS, AND WHICH ONE IS RIGHT DEPENDS ON THE BOUNCE.
   *
   *   bounce on   the fall ACCELERATES (p squared) -- it is falling, and it has
   *               to arrive with speed for the bounce to be the thing that
   *               absorbs it.
   *   bounce off  eased OUT (cubic): fast in, decelerating into place, the last
   *               few pixels taking as long as the first hundred. That is the
   *               difference between a title landing and one being teleported.
   *
   * ⚠️ THE PAIRING IS NOT COSMETIC. A fall that eases to a stop and then
   * bounces reads as two unrelated moves played one after the other -- the type
   * has already arrived, and then something shakes it.
   */
  _dropP() {
    const at = CONFIG.titleDropAtMs != null ? CONFIG.titleDropAtMs : 0;
    const ms = CONFIG.titleDropMs != null ? CONFIG.titleDropMs : 700;
    if (this.t < at) return 0;
    if (ms <= 0) return 1;
    const p = Math.min(1, (this.t - at) / ms);
    return (CONFIG.titleBouncePx > 0) ? p * p : 1 - Math.pow(1 - p, 3);
  }

  /**
   * The landing bounce, in px DOWN from the resting place. 0 before it lands
   * and 0 once it has settled.
   *
   * A DAMPED SINE, and it starts at zero going POSITIVE -- down. That order is
   * the whole read: the block arrives, overshoots into the surface, springs
   * back past the line, and settles. Started negative it would leap upward on
   * contact, which is not a landing, it is a flinch.
   *
   * `(1-u)^2` is the damping. Squared rather than linear because the second dip
   * has to be much smaller than the first: at linear decay the two are close
   * enough in size to read as a wobble rather than as settling.
   */
  _bounceOffset() { return this._bounce(this.t - this._landedAtMs()); }

  /**
   * The bounce as a function of ms SINCE LANDING, so the title and the fruit
   * prompt can both use it off their own clocks. They must: two blocks of type
   * arriving with different physics on one screen read as two different objects,
   * and the second one reads as the broken one.
   */
  _bounce(t) {
    const amp = CONFIG.titleBouncePx || 0;
    const ms = CONFIG.titleBounceMs || 0;
    if (amp <= 0 || ms <= 0) return 0;
    if (t < 0 || t >= ms) return 0;
    const u = t / ms;
    const cycles = CONFIG.titleBounceCycles || 1.5;
    return amp * Math.sin(Math.PI * 2 * cycles * u) * Math.pow(1 - u, 2);
  }

  /** ms on the clock when the name has finished falling. */
  _landedAtMs() {
    return (CONFIG.titleDropAtMs != null ? CONFIG.titleDropAtMs : 0)
         + (CONFIG.titleDropMs != null ? CONFIG.titleDropMs : 700);
  }

  /**
   * The walk-across.
   *
   * ⚠️ IT RUNS OFF ITS OWN CLOCK, STARTED WHEN THE NAME LANDS, rather than off
   * the screen's `t` with the delay subtracted. Retiming the drop then moves
   * him with it and the beat between the two stays what it was tuned to --
   * which is the same reason the ending screen counts its arms-up hold from the
   * pose rather than from the top of the screen.
   *
   * The crossing is not stopped when the screen is dismissed: the fade-out runs
   * over the top of it, and a walker frozen under a fade is a thing you notice.
   */
  _tickWalk(dt) {
    if (!CONFIG.titleWalk) return;
    if (this.walkT < 0) {
      /* ⚠️ WITH THE SELECT ON, HE IS STARTED BY IT AND NOT BY THIS. `_tickSelect`
         sets `walkT = 0` the moment the question has cleared the screen, so this
         branch is simply never reached -- the gate below belongs to the OLD
         screen, where the press itself sent him. Two things able to start one
         walk is how a walker ends up crossing twice. */
      if (this._selecting()) return;
      /* ⚠️ HE WAITS TO BE ASKED. This used to fire on the clock alone; `go` is
         the press. `titleWalkAfterMs` still holds him until the name has
         landed, so a press made DURING the drop does not send him out from
         under falling type -- and a press made after it has landed sets him off
         at once, because the test is already true. */
      if (!this.go) return;
      const after = CONFIG.titleWalkAfterMs != null ? CONFIG.titleWalkAfterMs : 250;
      if (this.t < this._landedAtMs() + after) return;
      this.walkT = 0;
      return;                                   // he sets off on the NEXT frame
    }
    this.walkT += dt * 1000;
  }

  /**
   * Where he is and which frame he is on, or null if he is not on screen.
   *
   * ⚠️ RETURNS null RATHER THAN THROWING when the pack is missing. This screen
   * is the first thing the game shows; a walk-on that cannot be drawn has to
   * cost the walk-on and nothing else.
   */
  _walker(W) {
    if (this.walkT < 0 || !this.sheets) return null;
    const x0 = W * (CONFIG.titleWalkStartXRel != null ? CONFIG.titleWalkStartXRel : -0.12);
    const x1 = W * (CONFIG.titleWalkEndXRel != null ? CONFIG.titleWalkEndXRel : 1.12);
    const speed = CONFIG.titleWalkSpeed || 210;
    const span = (x1 - x0) / Math.max(1, speed) * 1000;      // ms to cross
    let t = this.walkT;
    /* HE CAN COME ROUND AGAIN. `titleWalkRepeatMs` is the gap between
       crossings; 0 -- the shipping value -- means he crosses once and the
       screen is still after that. Written as a wrap rather than as a second
       state so there is only ever one clock to be wrong about. */
    const gap = CONFIG.titleWalkRepeatMs || 0;
    if (gap > 0) t = t % (span + gap);
    if (t > span) return null;                  // gone, or waiting to come back
    const n = Math.max(1, this.sheets.poseLength(PlayerPick.kind(), 'walk'));
    const ms = (CONFIG.POSE_MS && CONFIG.POSE_MS.walk) || 124;
    return {
      x: x0 + speed * t / 1000,
      step: Math.floor(t / ms) % n,
    };
  }

  /**
   * Draw the plate COVER: fill the canvas, centre-crop the overflow.
   *
   * Kept apart because the arithmetic is the one thing here that is easy to get
   * subtly wrong -- scaling by the wrong axis squashes a 4:3 photo into 16:9,
   * which does not look like a bug, it looks like a badly shot photo.
   */
  _plate(ctx, W, H) {
    const img = this.assets.getDrawable('titleBg');
    if (!img) return;
    const iw = img.width || img.naturalWidth;
    const ih = img.height || img.naturalHeight;
    if (!iw || !ih) return;
    const s = Math.max(W / iw, H / ih);     // max = cover; min would be contain
    const dw = iw * s, dh = ih * s;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.restore();
  }

  /**
   * LEBRON, crossing.
   *
   * OVER THE PHOTOGRAPH AND UNDER THE TYPE, which is the order the layers were
   * asked for: he walks through the scene, and the title is printed on the
   * picture rather than living in it.
   *
   * Facing RIGHT because he is travelling right -- `sheets.draw` mirrors
   * against the pack's own native side, so this states the direction he moves
   * and not an assumption about which way the art was drawn.
   */
  _drawWalker(ctx, W, H) {
    const w = this._walker(W);
    if (!w) return;
    const gy = H * (CONFIG.titleWalkGroundYRel != null ? CONFIG.titleWalkGroundYRel : 0.93);
    const scale = CONFIG.titleWalkScale || 1;
    this.sheets.draw(ctx, PlayerPick.kind(), 'right', 'walk', w.step, w.x, gy, { scale });
  }

  /**
   * One line of the title, set the way the flying dungeon sets its end panels.
   *
   * ⚠️ THE FAUX-BOLD STROKE IS NOT DECORATION. Futura is not bundled in either
   * game, so most machines fall through the stack to Century Gothic, URW Gothic
   * or Jost -- all lighter than the cut the design assumes. Stroking the glyphs
   * in their OWN colour puts that weight back, and on a machine that does have
   * Futura it is a fraction of a pixel and invisible. It is `heavy` only,
   * because the gloss is meant to be light.
   *
   * `letterSpacing` is guarded because it is a recent canvas property; without
   * it the words simply set tighter, which is a look, not a break.
   */
  _word(ctx, text, x, y, size, weight, family, heavy) {
    ctx.font = `${weight} ${size.toFixed(1)}px ${family}`;
    const ls = CONFIG.titleNameLsPct || 0;
    if ('letterSpacing' in ctx) {
      ctx.letterSpacing = (size * ls / 100).toFixed(2) + 'px';
    }
    ctx.fillText(text, x, y);
    const fb = CONFIG.titleFauxBoldPct || 0;
    if (heavy && fb > 0) {
      ctx.lineWidth = size * fb / 100;
      ctx.strokeText(text, x, y);
    }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  /**
   * THE CONFIRM PUNCH, lifted from the MAIN GAME's own character select
   * (`src/screens/select.js` in the repo root -- its "lock-in"). That screen is
   * where this moment already existed, so "reproduce the punch effect" meant
   * reading it rather than inventing one: a stamp pop of 1.25 settling to 1.0 on
   * an easeOutBack, and a decaying screen shake, both fired by the confirm. Its
   * numbers are copied, not re-tuned.
   *
   * ⚠️ IT SHAKES THE PANEL, NOT THE PHOTOGRAPH. The main game shakes its
   * foreground group over a background that holds still, and `intro.js` says why
   * in as many words: *"Background and readability darken sit UNDER the shake so
   * screen edges never reveal gaps when the foreground jolts."* Shaking the
   * plate here would read as the camera being hit and would show the frame edge
   * besides.
   */
  _easeOutBack(p) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
  }

  /** The punch block, or null when nothing is being punched. */
  _punch() {
    const P = (CONFIG.SELECT && CONFIG.SELECT.PUNCH) || null;
    if (!P || P.on === false || this.stage !== 'chosen') return null;
    return P;
  }

  /**
   * How far the picture is swollen by the stamp; 1 once it has settled.
   *
   * ⚠️ THE WHOLE PICTURE, NOT THE CHOSEN FIGURE, and that is a fact about the
   * art rather than a shortcut. The main game stamps ONE fruit because its art
   * is a row of separate panels it can clip to (`p.rect`); ours is a single
   * drawing of two coconuts whose arms overlap -- measured, the thinnest column
   * between them still carries 385 rows of ink out of 1087. There is no line to
   * clip on, and a split would slice an arm in half mid-pop. So the board stamps
   * where the main game stamps the fruit.
   */
  _popK() {
    const P = this._punch();
    if (!P) return 1;
    const ms = P.stampMs != null ? P.stampMs : 400;
    if (ms <= 0) return 1;
    const p = Math.min(1, this.stageT / ms);
    return 1 + (P.pop != null ? P.pop : 0.25) * (1 - this._easeOutBack(p));
  }

  /** The shake offset in px, decaying linearly, or null once it is spent. */
  _shake() {
    const P = this._punch();
    if (!P) return null;
    const ms = P.shakeMs != null ? P.shakeMs : 180;
    const amp = (P.shakeAmp != null ? P.shakeAmp : 9)
              * Math.max(0, 1 - this.stageT / Math.max(1, ms));
    if (amp <= 0.01) return null;
    /* SECONDS, because the frequencies are the main game's rad/sec numbers and
       are copied unchanged. Rewriting them for a ms clock would be a second
       place for the feel to drift away from the screen this is reproducing. */
    const t = this.stageT / 1000;
    return { x: Math.sin(t * (P.shakeFreqX != null ? P.shakeFreqX : 82)) * amp,
             y: Math.cos(t * (P.shakeFreqY != null ? P.shakeFreqY : 71)) * amp };
  }

  /**
   * 0..1 through a lift-OUT, and 0 when nothing is leaving.
   *
   * ACCELERATING (`p` squared) where every arrival on this screen decelerates.
   * The two are opposite moves: a thing landing slows into place, a thing
   * leaving picks up speed as it goes. Matching easings would make the exit read
   * as the fall played backwards, which is the one thing it must not look like.
   */
  _liftP() {
    const ms = this._sel('liftMs', 520);
    const t = (this.stage === 'lift') ? this.stageT
            : (this.stage === 'chosen') ? this.stageT - this._sel('chosenHoldMs', 500)
            : -1;
    if (t <= 0) return 0;
    if (ms <= 0) return 1;
    const p = Math.min(1, t / ms);
    return p * p;
  }

  /** 0..1 through the fruit prompt's fall. Same shape as the title's. */
  _askP() {
    const ms = CONFIG.titleDropMs != null ? CONFIG.titleDropMs : 700;
    if (ms <= 0) return 1;
    const p = Math.min(1, this.stageT / ms);
    return (CONFIG.titleBouncePx > 0) ? p * p : 1 - Math.pow(1 - p, 3);
  }

  /** How far a block of type falls from / lifts to, in px. */
  _travel(H) {
    return H * (CONFIG.titleDropFromRel != null ? CONFIG.titleDropFromRel : 1);
  }

  /**
   * The picture, faded up under the question and down again with the answer.
   *
   * ⚠️ CONTAIN, NOT COVER, AND FITTED BY HEIGHT. The title photograph is a
   * backdrop and is allowed to lose its edges; this is a drawing of two
   * characters and cropping it would cut a coconut in half. Its width follows
   * from its own aspect -- setting one would stretch them.
   *
   * ⚠️ A MISSING HIGHLIGHT FALLS BACK TO THE UNSELECTED PICTURE rather than
   * drawing nothing. This is the screen the player has to get through to reach
   * the game: a pack whose picture failed to load must cost the highlight, not
   * the ability to choose.
   */
  _drawArt(ctx, W, H) {
    const a = this._artAlpha();
    if (a <= 0) return;
    const kind = (this.pick >= 0) ? PlayerPick.list()[this.pick] : null;
    const img = (kind && this.assets.getDrawable('select:' + kind))
             || this.assets.getDrawable('select:none');
    if (!img) return;
    const iw = img.width || img.naturalWidth, ih = img.height || img.naturalHeight;
    if (!iw || !ih) return;
    /* THE STAMP. Growing the DRAWN SIZE about the anchor is the scale: `cy` is
       the picture's middle and the rect is built around it, so a bigger `dh`
       swells it in place instead of pushing it down and right off its corner. */
    const dh = H * this._sel('artHRel', 0.80) * this._popK();
    const dw = dh * iw / ih;
    const cy = H * this._sel('artYRel', 0.60);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (W - dw) / 2, cy - dh / 2, dw, dh);
    ctx.restore();
  }

  /** 0..1. Up with the question, down with the answer. */
  _artAlpha() {
    if (!this._selecting()) return 0;
    const fade = this._sel('artFadeMs', 320);
    if (this.stage === 'ask') return fade > 0 ? Math.min(1, this.stageT / fade) : 1;
    if (this.stage === 'chosen') return 1 - this._liftP();
    return 0;
  }

  /**
   * One block of type -- the title and its gloss, or the fruit prompt -- set,
   * positioned and offset.
   *
   * PULLED OUT OF `draw` WHEN THE SELECT ARRIVED, because there are two of these
   * now and they have to be identical in everything but their words: same font,
   * same colour, same centring, same fall. Two copies of this arithmetic would
   * drift the first time one of them was nudged.
   */
  _block(ctx, W, H, lines, cy, dy, alpha) {
    if (alpha <= 0) return;
    const gap = CONFIG.titleNameGap != null ? CONFIG.titleNameGap : 20;
    let total = 0;
    lines.forEach((l, i) => { total += l.size + (i ? gap : 0); });
    const col = CONFIG.titleNameColor || '#2A1B10';
    const fam = CONFIG.TITLE_FONT || CONFIG.hudFont;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = col;
    ctx.strokeStyle = col;
    ctx.lineJoin = 'round';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let y = cy - total / 2 + dy;
    for (const l of lines) {
      this._word(ctx, l.text, W / 2, y + l.size / 2, l.size, l.weight, fam, !!l.heavy);
      y += l.size + gap;
    }
    ctx.restore();
  }

  draw(ctx, W, H) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    this._plate(ctx, W, H);
    this._drawWalker(ctx, W, H);
    /* THE PICTURE OVER THE PHOTOGRAPH AND UNDER THE TYPE -- the same order the
       walker and the title already keep, for the same reason: the type is
       printed on the screen, everything else lives in it. He and the picture
       never share a frame anyway (the art is gone before he sets off), so this
       is an ordering rule rather than a compositing decision. */
    /* THE PUNCH SHAKES THE PANEL AND THE TYPE, NOT THE PHOTOGRAPH -- see
       `_shake`. The walker is outside it too, and could not be caught by it
       anyway: he does not set off until the `chosen` stage is over. */
    const sh = this._shake();
    ctx.save();
    if (sh) ctx.translate(sh.x, sh.y);
    this._drawArt(ctx, W, H);
    this._drawType(ctx, W, H);
    ctx.restore();

    if (this.out >= 0) {
      const ms = CONFIG.titleFadeOutMs || 600;
      ctx.save();
      ctx.globalAlpha = ms > 0 ? Math.min(1, this.out / ms) : 1;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  /**
   * Whichever block of type this stage is showing, wherever it currently is.
   *
   * ⚠️ ONE OF THEM, NEVER BOTH. The name leaves before the question arrives --
   * that is what the `gapMs` beat is for -- so there is no frame where two
   * blocks are on screen and none where the screen is asked to decide between
   * them.
   */
  _drawType(ctx, W, H) {
    const ns = CONFIG.titleNameSize || 74;
    const ss = CONFIG.titleSubSize || 30;
    const cy = H * (CONFIG.titleNameY != null ? CONFIG.titleNameY : 0.30);
    const travel = this._travel(H);

    if (this.stage === 'ask' || this.stage === 'chosen') {
      const size = this._sel('promptSize', 58);
      const py = H * this._sel('promptYRel', 0.11);
      /* FALLING IN, or -- once the choice is made and the hold is over --
         accelerating back out of the top, exactly as the name did. */
      const dy = (this.stage === 'ask')
        ? -travel * (1 - this._askP()) + this._bounce(this.stageT - this._askLandedMs())
        : -travel * this._liftP();
      this._block(ctx, W, H, [{ text: this._sel('PROMPT', ''), size,
                                weight: CONFIG.titleNameWeight || 900, heavy: true }],
                  py, dy, 1);
      return;
    }

    /* THE NAME. `lift` is the only stage that moves it after it has landed; in
       `walk` it is simply gone, because the screen has moved on from being a
       title. ⚠️ WITH THE SELECT OFF there is no `lift` and no `walk` stage
       change, so this is the old screen's behaviour untouched -- the name stays
       up while he crosses, which is what it always did. */
    if (this._selecting() && this.stage === 'walk') return;
    const a = this._nameAlpha();
    if (a <= 0) return;
    const name = CONFIG.TITLE_NAME || '';
    const sub = CONFIG.TITLE_SUBNAME || '';
    /* THE PORTUGUESE NAME IS THE TITLE AND THE ENGLISH IS A GLOSS, which is the
       whole reason the weights differ. Heavy and large, then light and small
       under it -- the jam audience mostly cannot read the first line and should
       not have to hunt for the second.

       THE FALL, AND THE WHOLE BLOCK MAKES IT TOGETHER. The gloss is part of the
       title, not a caption that catches up afterwards -- two lines arriving
       separately reads as a bug in one of them. It falls from
       `titleDropFromRel` screen-heights above its resting place, which clears
       the top edge with room to spare whatever the type is set at, so nothing
       is ever seen half-drawn against the frame edge. */
    const lines = [{ text: name, size: ns, weight: CONFIG.titleNameWeight || 900,
                     heavy: true }];
    if (sub) lines.push({ text: sub, size: ss, weight: CONFIG.titleSubWeight || 400 });
    const dy = (this.stage === 'lift')
      ? -travel * this._liftP()
      : -travel * (1 - this._dropP()) + this._bounceOffset();
    this._block(ctx, W, H, lines, cy, dy, a);
  }
}
