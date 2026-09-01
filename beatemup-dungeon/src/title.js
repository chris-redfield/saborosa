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
 * ⚠️ AND IT IS ALSO THE MENU, THE OPTIONS AND THE CREDITS (2026-09-01). Three
 * more screens joined it rather than three more files, for exactly the reason
 * the select did: they are the same photograph with different words on it. The
 * title does not even re-drop coming back from them -- the drop is timed off
 * `t`, which never rewinds, so returning to `name` finds the name already
 * landed. A separate screen would have had to fake that.
 *
 * SO THIS RUNS AS STAGES OFF ONE CLOCK -- see `stage` in reset():
 *
 *     name     the title falls in, then the three menu items fade up under it
 *     options  OPÇÕES: two meters, up/down to choose, left/right to set
 *     credits  SABOROSA: who made it
 *     lift     the name accelerates up and off the top
 *     ask      ESCOLHA SEU COCO falls in; the picture fades up; left/right pick
 *     chosen   the choice is held a beat, then the prompt lifts and the art fades
 *     walk     the chosen hero crosses, exactly as before
 *
 * ⚠️ `options` AND `credits` RETURN TO `name`, THEY DO NOT END ANYTHING. The
 * menu is the screen's resting state and everything else on it is a detour.
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
  constructor(assets, sheets, letters) {
    this.assets = assets;
    /* The hand-lettered pack. Every word on this screen is one of its frames --
       and every one of them falls back to the type it replaced, so a pack that
       failed to load costs the look and not the screen. */
    this.letters = letters || null;
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
    /* THE MENU. `menu` is which of COMEÇAR / OPÇÕES / SABOROSA is highlighted;
       `optRow` is which meter the options screen is on. Both open at the top,
       which is the item the player wants nine times out of ten. */
    this.menu = 0;
    this.optRow = 0;
    this._heldU = false;
    this._heldD = false;
    /* ms since the menu became answerable -- its own fade clock, so returning
       from the options screen brings the items back up rather than snapping
       them on. Set the moment the name lands, and again on every return. */
    this.menuT = -1;
    /* ms since the highlight last MOVED, or -1 for "not moving". One clock for
       both lists, because only one of them is ever on screen. See _itemPop. */
    this.itemPopT = -1;
    /* WHAT THE PRESS BOUGHT, held until its stamp has played. null when idle.
       See the resolution in update(). */
    this.pending = null;
  }

  /** The three menu items, top to bottom. Order is the sheet's order. */
  static MENU() { return ['menuStart', 'menuOptions', 'menuCredits']; }

  /** Is the hand-lettered pack up? Everything on this screen asks first. */
  _art() {
    return (this.letters && this.letters.has('title')) ? this.letters : null;
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
    /* THE MENU'S OWN CLOCK, STARTED WHEN THE NAME LANDS. It is not `stageT` and
       not an offset off `t`: coming back from the options screen the items have
       to fade up again, and only a clock that can be restarted does that. -1 is
       "not yet", which is also the gate `_tickMenu` reads -- one value, one
       meaning, so the menu cannot be answerable before it is visible. */
    if (this.menuT >= 0) this.menuT += dt * 1000;
    else if (this.stage === 'name' && this.t >= this._landedAtMs()) this.menuT = 0;
    if (this.itemPopT >= 0) this.itemPopT += dt * 1000;
    this._tickWalk(dt);
    if (this.out >= 0) {
      this.out += dt * 1000;
      if (this.out >= (CONFIG.titleFadeOutMs || 600)) { this.done = true; return true; }
      return false;
    }
    /* THE TWO DETOURS OWN THE INPUT WHILE THEY ARE UP, and they are checked
       BEFORE the select's branch below -- that branch claims every stage that is
       not `name` or `walk`, so an options screen added after it would have been
       fed to `_tickSelect` and answered a question nobody asked. */
    if (this.stage === 'options') { this._tickOptions(input); return false; }
    if (this.stage === 'credits') {
      /* ⚠️ NOT UNTIL IT HAS BEEN UP A MOMENT. The press that OPENED the credits
         is gone by now, but a held button repeats, and a screen that can be
         opened and closed by one long press reads as not opening at all. */
      if (this.stageT >= (CONFIG.LETTERS && CONFIG.LETTERS.menuFadeMs || 320)
          && input && input.takeAnyPress()) this._toMenu();
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
    /* THE MENU ANSWERS THE PRESS NOW, WHEN THERE IS A MENU TO ANSWER IT. With
       no lettering pack there are no items to draw, so the screen keeps its old
       any-press behaviour rather than becoming unstartable -- the same fallback
       rule every other use of the pack follows. */
    /* THE CHOICE IS SPENT ONCE ITS STAMP HAS PLAYED, not on the frame it was
       made. ⚠️ WITHOUT THIS BEAT THE PUNCH DOES NOT EXIST: confirming COMEÇAR
       moves the screen on, so an item stamped and dismissed in the same frame is
       a pop nobody ever sees. The select screen buys the same beat with
       `chosenHoldMs`, for the same reason -- the feedback for a press needs a
       moment on screen before the press is acted on. */
    if (this.pending && this.itemPopT >= this._lcfg('menuHoldMs', 300)) {
      const act = this.pending;
      this.pending = null;
      if (act === 'options') { this.stage = 'options'; this.stageT = 0; return false; }
      if (act === 'credits') { this.stage = 'credits'; this.stageT = 0; return false; }
      this.go = true;      // COMEÇAR: the flag the any-press used to set
    }
    if (this.stage === 'name' && this._menuOn()) this._tickMenu(input);
    else if (input && input.takeAnyPress()) this.go = true;
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

  /** Is there a menu to run? Only if its words exist. */
  _menuOn() {
    const L = this._art();
    return !!(L && L.has('menuStart') && L.has('menuOptions') && L.has('menuCredits'));
  }

  /**
   * The stamp on an item that has just taken the highlight, as a multiplier.
   *
   * Asked for 2026-09-01: *"when the other menus are selected, they should have
   * a tiny punch, so for example, começar, opções, saborosa etc, all should have
   * a tiny punch."*
   *
   * ⚠️ THE SAME SHAPE AS THE SELECT'S CONFIRM PUNCH, DELIBERATELY SMALLER. Both
   * are `1 + amount * (1 - easeOutBack(p))` -- swell, overshoot back, settle --
   * because they are the same gesture at two weights: this one says "you moved
   * onto this", the other says "you chose it". Copying the CURVE and changing
   * only the amount is what keeps them reading as one interface. 0.10 against
   * the confirm's 0.25.
   *
   * ⚠️ IT MULTIPLIES ON TOP OF `selectedMul`, which is the standing size of a
   * highlighted item -- so the pop is a move, not a second way of being
   * selected. When it settles the item is exactly where the highlight leaves it.
   *
   * ⚠️ IT IS DRIVEN BY THE ITEM BEING ACTED ON, NOT BY THE CURSOR REACHING IT,
   * and not by which item happens to be selected. It stamped on the cursor move
   * first and that was wrong: *"the punch is for when you click the option, not
   * for when you place the cursor on top of it."* A punch answers a COMMITMENT
   * -- it is the same gesture the select makes when a coconut is chosen -- and
   * spending it on every nudge of the d-pad both cheapens it and leaves the
   * actual choice with no feedback of its own. What a cursor move gets is the
   * highlight: 10% bigger, and a STATE does not need an animation to announce
   * it. (Keyed on "is selected" it would also replay on every redraw.)
   */
  _itemPop() {
    const ms = this._lcfg('itemPopMs', 260);
    const amt = this._lcfg('itemPop', 0.10);
    if (this.itemPopT < 0 || !(ms > 0) || !(amt > 0)) return 1;
    const p = Math.min(1, this.itemPopT / ms);
    return 1 + amt * (1 - this._easeOutBack(p));
  }

  /** Back to the resting screen, from either detour. */
  _toMenu() {
    this.stage = 'name';
    this.stageT = 0;
    this.menuT = 0;              // the items fade back up
    this.itemPopT = -1;          // ...without one of them stamping on arrival
    this.pending = null;
    this._heldU = this._heldD = this._heldL = this._heldR = false;
  }

  /**
   * A d-pad edge on the vertical axis, as (up, down). Held flags, so the screen
   * has to remember the last frame or one tap runs the whole list.
   */
  _vEdge(input) {
    const U = !!(input && input.up), D = !!(input && input.down);
    const hit = { u: U && !this._heldU, d: D && !this._heldD };
    this._heldU = U; this._heldD = D;
    return hit;
  }

  /**
   * COMEÇAR / OPÇÕES / SABOROSA.
   *
   * ⚠️ THE SAME DIRECTION-BEATS-ANY-PRESS RULE THE SELECT ALREADY LIVES BY, and
   * it matters more here: on a gamepad every button sets `_anyPress`, the d-pad
   * included, so without this a nudge downwards would move the highlight AND
   * confirm it in the same frame -- and one of the three things it could confirm
   * starts the game. The press is TAKEN either way, because `takeAnyPress` is a
   * queue: leaving it unread spends it on the next frame instead.
   *
   * ⚠️ AND NOT UNTIL THE NAME HAS LANDED. `menuT` is set by the drawing side the
   * frame the items become visible, so the menu cannot be answered before it can
   * be read -- the same gate the select's question sits behind.
   */
  _tickMenu(input) {
    const hit = this._vEdge(input);
    const press = !!(input && input.takeAnyPress());
    if (this.menuT < 0) return;              // the name is still falling
    /* THE CHOICE IS MADE AND ITS STAMP IS PLAYING. The press above is still
       TAKEN -- `takeAnyPress` is a queue, so leaving it unread spends it a frame
       later, on whatever screen the choice hands to. */
    if (this.pending) return;
    const n = Title.MENU().length;
    if (hit.u || hit.d) {
      /* WRAPPING, because three items is short enough that running off the end
         is a dead press rather than a boundary anyone wants to feel.
         ⚠️ AND NO STAMP HERE -- see the note above. */
      this.menu = (this.menu + (hit.d ? 1 : n - 1)) % n;
      return;
    }
    if (!press) return;
    /* THE PRESS BUYS THE STAMP AND NOTHING ELSE; update() spends the choice once
       it has played. COMEÇAR still resolves to `go`, the flag the any-press used
       to set, so everything downstream is the path this screen already had. */
    this.pending = ['start', 'options', 'credits'][this.menu];
    this.itemPopT = 0;
  }

  /**
   * OPÇÕES: two meters, VOLUME and MÚSICA.
   *
   * ⚠️ LEFT/RIGHT SET, UP/DOWN CHOOSE, AND ANY OTHER PRESS LEAVES. There is no
   * BACK item drawn on the sheet, so the way out has to be the button the player
   * already used to get in.
   *
   * ⚠️ THE LEVELS ARE WRITTEN STRAIGHT INTO `CONFIG.OPTIONS` AND APPLIED. They
   * are bars, 0..8, and `sound.applyOptions()` turns them into the two gains --
   * so the meter and the audio cannot disagree, and nothing has to remember to
   * push a value at the sound engine later.
   */
  _tickOptions(input) {
    const hit = this._vEdge(input);
    const L = !!(input && input.left), R = !!(input && input.right);
    const hitL = L && !this._heldL, hitR = R && !this._heldR;
    this._heldL = L; this._heldR = R;
    const press = !!(input && input.takeAnyPress());
    // Moving between the rows is a cursor move: the highlight, and no stamp.
    if (hit.u || hit.d) { this.optRow = this.optRow ? 0 : 1; return; }
    if (hitL || hitR) {
      const O = CONFIG.OPTIONS || {};
      const max = O.bars || 8;
      const key = this.optRow ? 'music' : 'volume';
      O[key] = Math.max(0, Math.min(max, (O[key] || 0) + (hitR ? 1 : -1)));
      /* THE STAMP GOES HERE, NOT ON UP/DOWN. Setting a meter IS acting on the
         option -- this screen's equivalent of clicking one -- where moving
         between the rows is only the cursor. Same rule as the menu. */
      this.itemPopT = 0;
      if (this.sound && this.sound.applyOptions) this.sound.applyOptions();
      return;
    }
    if (press && this.stageT >= (CONFIG.LETTERS && CONFIG.LETTERS.menuFadeMs || 320)) {
      this._toMenu();
    }
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
   * ⚠️ SINCE 2026-09-01 THIS IS THE CHOSEN FIGURE ONLY -- `_drawLayers` applies
   * it to one layer. The number is unchanged; what changed is the art. The note
   * below is the record of why it was the whole picture before, and it is the
   * argument for asking for an export rather than writing a clever split.
   *
   * ⚠️ [HISTORICAL] THE WHOLE PICTURE, NOT THE CHOSEN FIGURE, and that was a
   * fact about the art rather than a shortcut. The main game stamps ONE fruit
   * because its art
   * is a row of separate panels it can clip to (`p.rect`); ours was a single
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
  /**
   * The two coconuts as SEPARATE layers, so the confirm punch swells only the
   * one that was chosen. Returns false if the layer pack is not there, which is
   * the caller's cue to draw the old single picture.
   *
   * Asked for on the first playtest of the select and refused then -- *"make it
   * only move the selected character"* -- because the art was one drawing of two
   * coconuts that touch. It arrived as four files on the master canvas
   * (2026-09-01) and this is all it took.
   *
   * ⚠️ EVERY LAYER IS DRAWN AT THE SAME RECT, and that rect is the one the
   * single picture used. The four files share the artist's canvas, so they line
   * up by construction -- fitting each to its own ink would scatter them, which
   * is the trap this codebase has now hit on three separate packs.
   *
   * ⚠️ THE POP SCALES ABOUT THE FIGURE'S OWN CENTRE, NOT THE RECT'S. A layer is
   * a full-canvas overlay with one coconut somewhere on it; swelling it about
   * the picture's middle would slide the coconut sideways as it grew -- 39px at
   * a 1.25 pop -- and read as the pair drifting apart rather than as one of them
   * being hit. `cxRel`/`cyRel` are the measured ink centres.
   *
   * ⚠️ AND THE CHOSEN ONE IS DRAWN LAST. The two overlap by about 400px of the
   * master canvas, so the one that is swelling has to be on top or its new size
   * is clipped by the neighbour it is growing into.
   */
  _drawLayers(ctx, W, H, a) {
    const S = CONFIG.SELECT || {};
    const packs = PlayerPick.list();
    const layers = [];
    for (let i = 0; i < packs.length; i++) {
      const L = (S.LAYERS || {})[packs[i]];
      if (!L) return false;
      const on = (this.pick === i);
      const img = this.assets.getDrawable('sel:' + packs[i] + ':' + (on ? 'on' : 'off'));
      if (!img) return false;
      layers.push({ img, L, on });
    }
    // The picked one last; see the header.
    layers.sort((p, q) => (p.on ? 1 : 0) - (q.on ? 1 : 0));
    const pop = this._popK();
    for (const l of layers) {
      const iw = l.img.width || l.img.naturalWidth, ih = l.img.height || l.img.naturalHeight;
      if (!iw || !ih) continue;
      const base = H * this._sel('artHRel', 0.80);
      const bw = base * iw / ih;
      const cy = H * this._sel('artYRel', 0.60);
      const x0 = (W - bw) / 2, y0 = cy - base / 2;
      const m = l.on ? pop : 1;
      // The figure's centre on screen, and the layer swollen about it.
      const fx = x0 + bw * (l.L.cxRel != null ? l.L.cxRel : 0.5);
      const fy = y0 + base * (l.L.cyRel != null ? l.L.cyRel : 0.5);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(l.img, fx - (fx - x0) * m, fy - (fy - y0) * m, bw * m, base * m);
      ctx.restore();
    }
    return true;
  }

  _drawArt(ctx, W, H) {
    const a = this._artAlpha();
    if (a <= 0) return;
    if (this._drawLayers(ctx, W, H, a)) return;
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
  _lcfg(key, dflt) {
    const L = CONFIG.LETTERS || {};
    return L[key] != null ? L[key] : dflt;
  }

  /**
   * The three menu items, under the name.
   *
   * ⚠️ THE HIGHLIGHT IS SIZE AND NOTHING ELSE -- `LETTERS.selectedMul`, 1.10.
   * Asked for in those words. There is no colour change and no marker: the art
   * is one colour, and a second one would be a decision the artist did not make.
   *
   * ⚠️ THEY FADE IN ON THEIR OWN CLOCK rather than arriving with the name. The
   * name is a title and it FALLS; a menu that fell with it would read as four
   * lines of one block, and the player would have to work out which of them can
   * be answered.
   */
  _drawMenu(ctx, W, H) {
    const L = this._art();
    if (!L || this.menuT < 0) return;
    /* THEY SLIDE UP FROM UNDER THE FRAME, THEY DO NOT FADE. Asked for
       2026-09-01: *"the começar, opções and saborosa letters, should not fade in
       like they do right now, they should slide in from the below, like the
       title does from the upper part, but do it coming from the lower end."*

       ⚠️ SAME TRAVEL AND SAME EASING AS THE NAME'S DROP, MIRRORED. `_travel` is
       the screen-height the title falls from and `1 - (1-p)^3` is the curve it
       lands on, so the two moves are one gesture from opposite edges rather than
       two animations that happen to share a screen. Only the SIGN differs.

       ⚠️ AND NO FADE AT ALL, WHICH IS THE POINT OF THE ASK. A slide that also
       fades reads as a fade with some drift in it -- the movement has to be the
       whole event. `menuFadeMs` no longer touches this list; it still fades the
       options and credits screens, which arrive rather than move.

       ⚠️ THE LIST MOVES AS ONE BLOCK. Staggering the three would be juice, and
       it would also be three things arriving where the design has one -- the
       name and its gloss already fall together for the same reason. */
    const ms = this._lcfg('menuRiseMs', 520);
    const p = ms > 0 ? Math.min(1, this.menuT / ms) : 1;
    /* ⚠️ AND IT BOUNCES ON ARRIVAL, THE WAY THE NAME DOES. Asked for
       2026-09-01: *"when the 3 rows come from lower, they should bounce like the
       title does."* Same two pieces the drop uses and the same config: the
       ACCELERATING approach (`p * p`, not an ease-out) and then `_bounce`, the
       decaying sine over `titleBounceMs`. An eased-out arrival cannot bounce --
       it is already slowing to a stop, so a wobble after it reads as a separate
       twitch. The two have to be chosen together, which is why `_dropP` picks
       its curve off `titleBouncePx` as well.

       ⚠️ THE BOUNCE IS NEGATED BECAUSE THE TRAVEL IS. A thing overshoots PAST
       its resting place in the direction it was moving: the name arrives from
       above and dips down, these arrive from below and ride up. Same amplitude,
       opposite sign -- and `titleBouncePx: 0` still turns both off at once. */
    const rise = (CONFIG.titleBouncePx > 0) ? p * p : 1 - Math.pow(1 - p, 3);
    const a = 1;
    const cy = H * this._lcfg('menuYRel', 0.55)
             + this._travel(H) * (1 - rise)
             - this._bounce(this.menuT - ms);
    const gap = H * this._lcfg('menuGapRel', 0.11);
    const keys = Title.MENU();
    /* THE MENU'S OWN TRIM, UNDER THE PACK'S ONE SCALE -- and the highlight
       MULTIPLIES it rather than replacing it, so the selected item stays 10%
       bigger than its neighbours whatever `menuMul` is set to. */
    const base = this._lcfg('menuMul', 1);
    const pop = this._itemPop();
    for (let i = 0; i < keys.length; i++) {
      const on = (i === this.menu);
      L.draw(ctx, keys[i], W / 2, cy + (i - 1) * gap,
             { alpha: a,
               mul: base * (on ? this._lcfg('selectedMul', 1.10) * pop : 1) });
    }
  }

  /**
   * OPÇÕES: the heading and the two meters.
   *
   * ⚠️ A METER IS THE ROW DRAWN SHORT, NOT BARS COUNTED OUT. The cutter recorded
   * where each of the artist's eight bars ends, so `cutFor(n)` is the width that
   * shows n of them -- one blit, and the spacing is the spacing they were drawn
   * with. Counting bars here would mean inventing a gap between them.
   *
   * ⚠️ AND THE ROW STAYS PUT AS IT SHORTENS. `Letters.draw` centres a cut frame
   * on the WHOLE frame, so turning the volume down empties the meter instead of
   * sliding VOLUME across the screen.
   */
  _drawOptions(ctx, W, H) {
    const L = this._art();
    if (!L) return;
    const O = CONFIG.OPTIONS || {};
    const fade = this._lcfg('menuFadeMs', 320);
    const a = fade > 0 ? Math.min(1, this.stageT / fade) : 1;
    L.draw(ctx, 'optTitle', W / 2, H * this._lcfg('optTitleYRel', 0.22), { alpha: a });
    const cy = H * this._lcfg('optRowYRel', 0.48);
    const gap = H * this._lcfg('optRowGapRel', 0.17);
    const rows = [['optVolume', O.volume], ['optMusic', O.music]];
    for (let i = 0; i < rows.length; i++) {
      const [key, n] = rows[i];
      L.draw(ctx, key, W / 2, cy + i * gap, {
        alpha: a,
        mul: (i === this.optRow)
          ? this._lcfg('selectedMul', 1.10) * this._itemPop() : 1,
        cut: L.cutFor(key, n == null ? L.bars(key) : n),
      });
    }
  }

  /** SABOROSA, and who that is. */
  _drawCredits(ctx, W, H) {
    const L = this._art();
    if (!L) return;
    const fade = this._lcfg('menuFadeMs', 320);
    const a = fade > 0 ? Math.min(1, this.stageT / fade) : 1;
    L.draw(ctx, 'credTitle', W / 2, H * this._lcfg('credTitleYRel', 0.32), { alpha: a });
    L.draw(ctx, 'credNames', W / 2, H * this._lcfg('credNamesYRel', 0.58), { alpha: a });
  }

  /**
   * The two coconut names, under the two coconuts.
   *
   * ⚠️ PLACED OFF THE CANVAS CENTRE, NOT OFF THE PICTURE'S RECT. `_drawArt`
   * fits the select art by HEIGHT, so its left and right edges move with the
   * canvas aspect -- hanging the names off them would put them under the
   * coconuts on a 16:9 screen and beside them on anything else. The pair is
   * symmetrical about the middle, which is where the artist centred them.
   */
  _drawPickNames(ctx, W, H, a) {
    const L = this._art();
    if (!L || a <= 0) return;
    const dx = W * this._lcfg('pickNameXRel', 0.235);
    const y = H * this._lcfg('pickNameYRel', 0.90);
    const mul = this._lcfg('selectedMul', 1.10);
    const names = ['pickLEBRON', 'pickIPANEIMA'];
    for (let i = 0; i < names.length; i++) {
      /* THE PICKED ONE IS BIGGER, the same 10% the menu uses -- the two screens
         are asking the same kind of question and should answer it the same way.
         At `pick` -1 neither grows, which is the state where nobody is chosen. */
      L.draw(ctx, names[i], W / 2 + (i ? dx : -dx), y,
             { alpha: a, mul: (this.pick === i) ? mul : 1 });
    }
  }

  _drawType(ctx, W, H) {
    if (this.stage === 'options') { this._drawOptions(ctx, W, H); return; }
    if (this.stage === 'credits') { this._drawCredits(ctx, W, H); return; }
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
      /* ESCOLHA SEU COCO, DRAWN RATHER THAN SET -- and it falls and lifts on the
         same `dy` the typed prompt did, so the beat is untouched and only the
         letterforms changed. ⚠️ The names under the coconuts ride the PICTURE's
         alpha, not the prompt's: they belong to the art below them, and fading
         them with the question would leave two names hanging over nothing while
         the coconuts went. */
      const L = this._art();
      if (L && L.has('choose')) {
        L.draw(ctx, 'choose', W / 2, H * this._lcfg('chooseYRel', 0.11) + dy);
        this._drawPickNames(ctx, W, H, this._artAlpha());
        return;
      }
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
    /* THE HAND-DRAWN NAME, IF IT IS THERE. Asked for 2026-09-01: *"instead of
       using the generated lettering, use the hand drawn ones"*.

       ⚠️ IT FALLS ON THE SAME `dy` AND FADES ON THE SAME `a` -- the two pictures
       are a drop-in for the two lines of type, so the drop, the bounce, the lift
       and the timing are all the ones that were tuned. Only the letterforms
       changed, and the two lines now have their own `yRel` because a picture has
       a height of its own and cannot be stacked by a font size and a gap.

       ⚠️ AND THE WEIGHT HIERARCHY IS IN THE ART NOW. `titleNameWeight` /
       `titleSubWeight` were doing that job and no longer apply here; the artist
       drew the gloss smaller, and the pack's one scale carries that through. */
    const L = this._art();
    if (L) {
      ctx.save();
      ctx.globalAlpha = a;
      L.draw(ctx, 'title', W / 2, H * this._lcfg('titleYRel', 0.20) + dy);
      L.draw(ctx, 'subtitle', W / 2, H * this._lcfg('subtitleYRel', 0.31) + dy);
      ctx.restore();
      /* THE MENU IS NOT PART OF THE BLOCK and does not move with it: it fades
         up where it belongs once the name has landed. In `lift` it is gone
         already -- the question is on its way in. */
      if (this.stage === 'name') this._drawMenu(ctx, W, H);
      return;
    }
    this._block(ctx, W, H, lines, cy, dy, a);
  }
}
