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
 * ⚠️ AND IT IS ALSO THE MENU, THE OPTIONS, THE CREDITS (2026-09-01) AND THE
 * SOUNDTRACK (2026-10-09). Four more screens joined it rather than four more
 * files, for exactly the reason the select did: they are the same photograph
 * with different words on it. The
 * title does not even re-drop coming back from them -- the drop is timed off
 * `t`, which never rewinds, so returning to `name` finds the name already
 * landed. A separate screen would have had to fake that.
 *
 * SO THIS RUNS AS STAGES OFF ONE CLOCK -- see `stage` in reset():
 *
 *     name     the title falls in, then the three menu items fade up under it
 *     options  OPÇÕES: two meters, up/down to choose, left/right to set
 *     credits  SABOROSA: who made it, then it ROLLS UP to who made the music
 *     music    MÚSICA: the soundtrack, up/down to choose, right to play
 *     lift     the name accelerates up and off the top
 *     ask      ESCOLHA SEU COCO falls in; the picture fades up; left/right pick
 *     chosen   the choice is held a beat, then the prompt lifts and the art fades
 *     walk     the chosen hero crosses, exactly as before
 *
 * ⚠️ `options`, `credits` AND `music` RETURN TO `name`, THEY DO NOT END
 * ANYTHING. The menu is the screen's resting state and everything else on it is
 * a detour. ⚠️ `music` IS THE ONLY ONE THAT CHANGES THE WORLD ON ITS WAY THROUGH
 * -- and it is MEANT to: the song it leaves playing is the menu's song from then
 * on, in place of the title theme, until the player enters the game or chooses
 * again. `_toMenu` deliberately does not restore anything; see the note there.
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
    /*
       TWO PLAYERS ON THIS SCREEN (2026-10-09).
       `pick` is still P1's and every read of it is unchanged; `pick2` is P2's,
       and it is -1 until a second player joins. The pair is also held as
       `picks` so the tick can loop over slots instead of branching -- the three
       are kept in step by `_setPick`, which is the ONLY writer.

       WHY A SECOND PLAYER NEEDS NO NEW ART, which is the whole reason the join
       lives here. This screen has no cursor to duplicate: the highlight IS the
       picture, two 'on'/'off' drawings per coconut, and a player who has taken
       one simply lights it up. With two players, both are lit. That is the
       feedback, and every word on this screen is hand-drawn so a "PRESS START"
       prompt would have been art to ask for.

       AND WITH TWO CHARACTERS THE SECOND CHOICE IS THE FIRST ONE'S COMPLEMENT.
       The two slots may not hold the same pack (PlayerPick.set says why), so
       moving either cursor pushes the other off -- unless that other has
       already CONFIRMED, in which case the character is his and the move is
       refused. A confirmed pick cannot be taken out from under a player.
    */
    this.picks = [this.pick, -1];
    this.pick2 = -1;
    this.locked = [false, false];
    /** How many are playing. Read by game.js when this screen hands over. */
    this.players = 1;
    /** Per-slot edge memory for left/right -- the shared `_heldL`/`_heldR`
        belong to the menu, the options and the jukebox, which are one cursor. */
    this._heldLS = [false, false];
    this._heldRS = [false, false];
    // Edge detection for left/right. `input.left`/`right` are HELD flags, so
    // the screen has to remember the last frame or one tap scrolls the list.
    this._heldL = false;
    this._heldR = false;
    /* THE MENU. `menu` is which of COMEÇAR / OPÇÕES / SABOROSA / MÚSICA is
       highlighted; `optRow` is which meter the options screen is on; `juke` is
       which song the MÚSICA screen's cursor is on. All open at the top, which
       is what the player wants nine times out of ten. */
    this.menu = 0;
    this.optRow = 0;
    this.juke = 0;
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
  /**
   * THE MENU, IN ORDER DOWN THE SCREEN.
   *
   * ⚠️⚠️ MÚSICA WAS ADDED UNDER CREDITS (2026-10-09) AND THE OTHER THREE DID
   * NOT MOVE A PIXEL. `_drawMenu` lays items out at `(i - 1) * gap` from
   * `menuYRel` -- an offset from the SECOND item, not from the middle of the
   * list -- so a fourth entry appears below the third and the composition that
   * was already signed off is untouched. Re-centring the block on the list
   * (`i - (n-1)/2`) is the obvious-looking change and it would have shifted all
   * three of them up half a gap to make room for the new one.
   *
   * ⚠️ A FIFTH ITEM IS WHERE THAT STOPS BEING FREE: at `menuYRel` 0.68 and
   * `menuGapRel` 0.11 the fourth item's centre is already at 0.90 of the
   * canvas, so the next one would be off the bottom. Whoever adds it has to
   * decide the layout properly rather than inheriting this.
   */
  static MENU() { return ['menuStart', 'menuOptions', 'menuCredits', 'menuMusic']; }

  /**
   * What each menu item DOES, by its pack key.
   *
   * ⚠️ A MAP AND NOT A PARALLEL ARRAY. `pending` used to be
   * `['start','options','credits'][this.menu]` -- an index into one list used to
   * read another, which is correct exactly as long as the two lists are the same
   * length and in the same order. The moment the drawn list is FILTERED (see
   * `_menu`) that stops being true and the cursor silently selects the wrong
   * action. Keyed by the thing both lists already agree on.
   */
  static MENU_ACTION() {
    return { menuStart: 'start', menuOptions: 'options',
             menuCredits: 'credits', menuMusic: 'music' };
  }

  /**
   * The menu as it is actually on screen: the declared order, minus any item
   * the pack cannot letter.
   *
   * ⚠️ WITHOUT THIS FILTER A PACK THAT PREDATES AN ITEM GIVES A CURSOR ON AN
   * INVISIBLE ROW. `_menuOn` gates on the three original keys -- it is the "is
   * the hand-lettering up at all" test and must stay that -- so an older
   * `batidao-letters` without `menuMusic` would turn the menu ON, draw three
   * items, and still let the player scroll onto a fourth that draws nothing and
   * opens a screen with no heading. Same bargain `_songs()` strikes for the
   * soundtrack, and the same reason: the art decides the length of the list.
   */
  _menu() {
    const L = this._art();
    if (!L) return [];
    /* ⚠️ `JUKEBOX.on: false` TAKES THE ITEM OFF THE MENU, not just out of the
       screen. A switch that left MÚSICA sitting there opening an empty list
       would be a knob that half works, which is worse than no knob -- and this
       is the only place that can do it, because the item and the screen it
       opens are the same decision. Read HERE and not in `_drawMenu`, so the
       cursor cannot land on a row that is not drawn. */
    const jukeOff = CONFIG.JUKEBOX && CONFIG.JUKEBOX.on === false;
    return Title.MENU().filter(k => L.has(k) && !(jukeOff && k === 'menuMusic'));
  }

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
    /* THE THREE DETOURS OWN THE INPUT WHILE THEY ARE UP, and they are checked
       BEFORE the select's branch below -- that branch claims every stage that is
       not `name` or `walk`, so an options screen added after it would have been
       fed to `_tickSelect` and answered a question nobody asked.
       ⚠️ A FOURTH DETOUR GOES HERE TOO, above that branch, for the same reason. */
    if (this.stage === 'options') { this._tickOptions(input); return false; }
    if (this.stage === 'music') { this._tickMusic(input); return false; }
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
      if (act === 'music') {
        this.stage = 'music';
        this.stageT = 0;
        /* THE CURSOR STARTS AT THE TOP, every time the screen is opened. A
           remembered row would be the only thing on this title screen that
           carries state between visits. */
        this.juke = 0;
        /* ⚠️⚠️ AND THE PRESS THAT OPENED THE SCREEN IS DROPPED. Without this the
           list played its FIRST ROW the instant it appeared -- *"when I enter
           the musica menu, it automatically selects the first music"*.
           ⚠️ BECAUSE `_tickMenu` CONSUMES `takeAnyPress()` BUT NOT
           `takeAttack()`: both are set by one press of the attack button, so
           confirming MÚSICA left `_attackQueued` standing, and the very first
           frame of `_tickMusic` -- which now reads `takeAttack()` as "play" --
           found a press that was aimed at the MENU.
           ⚠️ THIS IS THE ONLY DETOUR THAT NEEDS IT, and only since the attack
           button became this screen's action. OPÇÕES and the credits read
           nothing but `takeAnyPress`, which the menu had already spent, and
           they additionally sit behind a `menuFadeMs` grace for the same class
           of bug -- a timing guard where this is the actual fix.
           ⚠️ `flush()` AND NOT `takeAttack()`: dropping every queued press is
           what "a new screen" means, and it leaves `_dirPrev` alone so a
           direction still being held does not manufacture a fresh edge. */
        if (input && input.flush) input.flush();
        return false;
      }
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
  /** The jukebox's config block. */
  _jcfg() { return CONFIG.JUKEBOX || {}; }

  /**
   * The songs the MÚSICA screen can play: the config list, minus anything the
   * pack cannot letter.
   *
   * ⚠️⚠️ A TRACK WITH NO DRAWN NAME IS DROPPED, NOT TYPESET AND NOT DRAWN BLANK.
   * Two of the game's seven tracks are not on the artist's sheet -- the
   * ZERAMENTO song and HIPÓLITO's theme -- and the house rule for this whole
   * front end is that every word outside a fight is hand-drawn. A missing row
   * would be a selectable gap that plays a song with no title on it; filtering
   * here means the list is exactly as long as the lettering allows.
   *
   * ⚠️ SO ADDING A SONG IS: draw it on the sheet, run the cutter, add one line
   * to `JUKEBOX.TRACKS`. No code. And until the art lands, the line can sit in
   * the config harmlessly -- this filter hides it.
   */
  _songs() {
    const L = this._art();
    const list = this._jcfg().TRACKS || [];
    if (!L) return [];
    return list.filter(t => t && t.letter && t.key && L.has(t.letter));
  }

  /**
   * MÚSICA: move the cursor, PRESS to play, any other press leaves.
   *
   * ⚠️⚠️ THE ATTACK BUTTON PLAYS, AND GETTING HERE TOOK TWO WRONG TURNS WORTH
   * WRITING DOWN.
   *
   *   v1  up/down the cursor, RIGHT to play, any press leaves. Reasoned from
   *       "`takeAnyPress` is the only way out, so the press that leaves cannot
   *       also be the press that plays -- put the action on an axis." Every
   *       part of it worked and the screen was unusable: the button a player
   *       presses is the ACTION button, and it exited.
   *   v2  the cursor itself plays, after a settle. Discoverable, needs no
   *       prompt -- and wrong: *"when I place the cursor on top of a song it
   *       already starts playing, it should play only if I pressed a key."*
   *
   * ⚠️⚠️ **THE PREMISE OF v1 WAS SIMPLY FALSE, AND THAT IS THE LESSON.**
   * `takeAnyPress()` is not the only thing this screen can ask. `takeAttack()`
   * is a SEPARATE taker on the same object, so "the attack button" and "any
   * button" are distinguishable -- and once they are, the action can be the
   * action button and every OTHER button can still be the exit. Two designs
   * were built around a constraint that one line of input.js disproves.
   *
   * SO: up/down moves. ATTACK (or RIGHT) plays the highlighted row. LEFT stops.
   * Any other press -- jump, pickup, Enter, a stray key -- leaves, which is the
   * `takeAnyPress` exit OPÇÕES and the credits use, intact.
   *
   * ⚠️ AND IT WORKS ON A PAD: the mapped `lift` button sets `_attackQueued`,
   * and every pad button sets `_anyPress`, so play and leave land on the same
   * two roles they do on the keyboard.
   */
  _tickMusic(input) {
    const hit = this._vEdge(input);
    const L = !!(input && input.left), R = !!(input && input.right);
    const hitL = L && !this._heldL, hitR = R && !this._heldR;
    this._heldL = L; this._heldR = R;
    /* ⚠️⚠️ BOTH TAKERS ARE READ EVERY FRAME AND BEFORE ANY BRANCH, because the
       attack press sets `_anyPress` TOO. Leaving either unread spends it on a
       later frame -- which is this screen exiting one frame after it started a
       song. Reading both and then deciding cannot do that. */
    const atk = !!(input && input.takeAttack());
    const press = !!(input && input.takeAnyPress());
    const songs = this._songs();
    const n = songs.length;
    if (hit.u || hit.d) {
      /* WRAPPING, like the menu, and for the same reason: five rows is short
         enough that running off the end is a dead press. ⚠️ NO STAMP AND NO
         SOUND -- moving the cursor is not acting on the row, which is the rule
         the menu and OPÇÕES follow and the thing v2 got wrong. */
      if (n) this.juke = (this.juke + (hit.d ? 1 : n - 1)) % n;
      return;
    }
    if ((atk || hitR) && n) {
      /* ⚠️ PLAY BY ASSET KEY, and every one of the five is ALREADY LOADED --
         they are the game's own tracks, listed in the manifest as MUSIC_TRACK /
         TITLE_TRACK / MUSIC_TRACKS. This screen adds no audio to the build,
         which is the whole reason it is cheap.
         ⚠️ AND IT RETURNS, so the `press` this attack also set cannot fall
         through to the exit below. */
      if (this.sound) this.sound.playMusic(songs[Math.min(this.juke, n - 1)].key);
      this.itemPopT = 0;      // the stamp goes on the ACTION
      return;
    }
    if (hitL) {
      if (this.sound) this.sound.stopMusic(this._jcfg().stopFadeSec);
      this.itemPopT = 0;
      return;
    }
    if (press && this.stageT >= (CONFIG.LETTERS && CONFIG.LETTERS.menuFadeMs || 320)) {
      this._toMenu();
    }
  }

  _toMenu() {
    /* ⚠️⚠️ THE JUKEBOX'S CHOICE SURVIVES THIS, AND THAT IS THE POINT. Asked
       2026-10-09: *"the song that the player selects on the jukebox, keeps
       playing in the menu, in the place of the default coco nha nha. It only
       changes if the player enters the game, or if he changes it again in the
       jukebox."* So there is deliberately NO `playMusic` here.

       ⚠️ THIS LINE EXISTED AND WAS REMOVED, so do not add it back as an
       oversight. It restored `musicTitle` on every return, which is right if
       the menu owns its own song and wrong now that the player can choose one:
       the restore would have thrown their choice away on the way out of the
       very screen that made it.

       ⚠️ AND THE DEFAULT STILL COMES BACK ON ITS OWN, one level up.
       `game.js`'s `titleMusic()` runs whenever the TITLE PHASE is entered --
       including on the return from a finished run -- so the choice lives for
       this visit to the title screen and no longer. Nothing here has to
       arrange that, and arranging it here is what would break the ask.

       ⚠️ STOPPING THE MUSIC (left, on the jukebox) THEREFORE LEAVES THE MENU
       SILENT. That is the same rule, not an edge case: stopping is a choice the
       player made on that screen, and un-making it here would be the restore
       under another name. */
    this.stage = 'name';
    this.stageT = 0;
    this.menuT = 0;              // answerable at once: nothing re-animates
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
    const n = this._menu().length;
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
    /* ⚠️ RESOLVED THROUGH THE FILTERED LIST, so the cursor and the action
       cannot disagree about which row is which. See `MENU_ACTION`. */
    const keys = this._menu();
    this.pending = Title.MENU_ACTION()[keys[Math.min(this.menu, keys.length - 1)]];
    if (!this.pending) return;
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

    /* ⚠️ NOT UNTIL THE QUESTION HAS LANDED. Answering type that is still falling
       is the same complaint the walk-on had, and here it would also mean picking
       before the pictures have faded up -- a choice made blind. */
    if (this.stageT < this._askLandedMs()) return;

    /* --- 'ask': the question is up and the players may answer ---------------
       EACH SLOT IS READ ON ITS OWN DEVICE, which is what makes two cursors
       possible at all -- the merged `input` this method is handed cannot tell
       which pair of hands moved. It is still used for nothing here; see
       `_inp`. */
    this._tickJoin();
    const packs = PlayerPick.list();
    for (let sl = 0; sl < this.players; sl++) {
      const inp = this._inp(sl);
      const L = !!(inp && inp.left), R = !!(inp && inp.right);
      const hitL = L && !this._heldLS[sl], hitR = R && !this._heldRS[sl];
      this._heldLS[sl] = L; this._heldRS[sl] = R;
      /* ⚠️ THE PRESS IS TAKEN EITHER WAY -- see the header. A queue left unread
         is spent on the next frame instead, which is the same bug one frame
         later and much harder to see. */
      const press = !!(inp && inp.takeAnyPress());
      if (hitL || hitR) {
        /* LEFT AND RIGHT ARE POSITIONS IN THE PICTURE, not a cursor to be
           scrolled. The two coconuts are drawn side by side, so left means the
           first of `PLAYER_PACKS` and right means the last -- the same mapping
           with three heroes would need the art redrawn anyway. */
        this._setPick(sl, hitL ? 0 : packs.length - 1);
        continue;                          // the edge is spent; see the header
      }
      if (press && this.picks[sl] >= 0) this.locked[sl] = true;
    }

    /* NOBODY MOVES UNTIL EVERYBODY HAS ANSWERED. With one player this is the
       `press && pick >= 0` it replaced. */
    for (let sl = 0; sl < this.players; sl++) if (!this.locked[sl]) return;
    for (let sl = 0; sl < this.players; sl++) PlayerPick.set(this.picks[sl], sl);
    this.stage = 'chosen';
    this.stageT = 0;
  }

  /** The Input a slot is playing on. Null (and therefore inert) until game.js
      has handed the per-player devices over -- which is what keeps this screen
      working in any harness that builds a Title with one merged input. */
  _inp(slot) {
    return (this.inputs && this.inputs[slot]) || null;
  }

  /**
   * A SECOND PLAYER ARRIVING AT THE SELECT: claim the device being pressed and
   * give him the character the first player is not on.
   *
   * THE JOIN PRESS IS NOT ALSO A CONFIRM. `Input.claim` drops every instance's
   * held state and the new slot's queue is flushed, so the button that bought
   * him in cannot also answer the question he has only just been asked -- which
   * on a pad is the likely case, because `scanJoin` reads a HELD button.
   */
  _tickJoin() {
    if (this.players >= 2) return;
    const T = CONFIG.TWO_PLAYER || {};
    if (T.on === false) return;
    const inputs = this.inputs;
    if (!inputs || !inputs[0] || !inputs[1]) return;
    if (typeof Input === 'undefined' || !Input.scanJoin) return;
    /* NO TIME WINDOW ON THIS SCREEN -- see Input.scanJoin. The first player is
       by definition sitting in front of the question, so "has he touched
       something else lately" is a guess the game does not need to make here,
       and making it is what stopped the join working at all. */
    const dev = Input.scanJoin(inputs[0], Infinity);
    if (!dev) return;
    Input.claim(dev, 1);
    this.players = 2;
    this._heldLS[1] = this._heldRS[1] = false;
    this.locked[1] = false;
    this._setPick(1, this._freeFor(1));
    inputs[1].flush();
  }

  /** The first pack no OTHER slot is holding. */
  _freeFor(slot) {
    const n = PlayerPick.list().length;
    for (let i = 0; i < n; i++) {
      let taken = false;
      for (let o = 0; o < this.picks.length; o++) {
        if (o !== slot && this.picks[o] === i) taken = true;
      }
      if (!taken) return i;
    }
    return 0;
  }

  /**
   * ONE SLOT TAKES A CHARACTER, and it is the only writer of `picks` / `pick` /
   * `pick2` -- three names for two values, kept in step here so that every
   * existing read of `this.pick` goes on meaning P1.
   *
   * A CONFIRMED CHARACTER CANNOT BE TAKEN. The other player has answered and
   * the screen has his answer; moving him would mean a player walking on as
   * somebody he did not choose, which is worse than a cursor that refuses to
   * move. An UNCONFIRMED one is pushed off, because the two slots may not hold
   * the same pack.
   */
  _setPick(slot, i) {
    if (!(i >= 0)) return;
    for (let o = 0; o < this.picks.length; o++) {
      if (o === slot || this.picks[o] !== i) continue;
      if (this.locked[o]) return;                   // his, and he has said so
      this.picks[o] = this._otherThan(i);
    }
    this.picks[slot] = i;
    this.pick = this.picks[0];
    this.pick2 = (this.players > 1) ? this.picks[1] : -1;
  }

  /** The pack that is not `i`. With two of them that is the whole answer; with
      more it is the first other one, which is as much as the two-sided art can
      express anyway. */
  _otherThan(i) {
    const n = PlayerPick.list().length;
    for (let k = 0; k < n; k++) if (k !== i) return k;
    return i;
  }

  /** ms into 'ask' when the question has finished falling and can be answered.
   *  ⚠️ THE SAME NUMBER THE FALL USES, read from one place -- it IS "the fall
   *  has finished", and two copies of that would let the screen accept a press
   *  while the type was still moving (or refuse one after it had landed). */
  _askLandedMs() {
    return this._askMs();
  }

  /** ms into the crossing when he has cleared the visible edge. */
  _walkExitAtMs() {
    const W = CONFIG.GAME_W;
    const x0 = W * (CONFIG.titleWalkStartXRel != null ? CONFIG.titleWalkStartXRel : -0.12);
    const exit = W * (CONFIG.titleWalkExitXRel != null ? CONFIG.titleWalkExitXRel : 1.06);
    /* THE TRAILING HERO HAS TO GET OFF TOO. The exit is measured on the LEADER,
       so with two of them the fade would start with the second one still a
       stride inside the frame -- a hero cut in half by a dip to black on the
       last screen before the game begins. The gap is the same one that draws
       them, converted to time at the same speed. */
    const gap = (this.players > 1)
              ? ((CONFIG.TWO_PLAYER || {}).spawnGapX || 150) : 0;
    return (exit - x0 + gap) / Math.max(1, CONFIG.titleWalkSpeed || 210) * 1000;
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
    const n = Math.max(1, this.sheets.poseLength(PlayerPick.kind(0), 'walk'));
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
    /* BOTH OF THEM WALK OFF, IN STEP AND A STRIDE APART. The second hero is set
       back by the same `TWO_PLAYER.spawnGapX` every door in the game uses, so
       the pair that leaves this screen is the pair that walks into the street.
       ⚠️ THE ONE IN FRONT IS DRAWN LAST so he overlaps correctly, which is the
       reverse of the loop order -- hence the countdown.
       ⚠️ AND THE STEP IS SHARED. They are the same walk on the same clock; two
       clocks a stride apart would read as one hero and his echo. */
    const gap = (CONFIG.TWO_PLAYER || {}).spawnGapX || 150;
    for (let sl = this.players - 1; sl >= 0; sl--) {
      this.sheets.draw(ctx, PlayerPick.kind(sl), 'right', 'walk', w.step,
                       w.x - gap * sl, gy, { scale });
    }
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
  /**
   * How long ESCOLHA SEU COCO takes to fall in, in ms.
   *
   * ⚠️ IT DEFAULTS TO THE ART'S OWN FADE, SO THE TWO ARRIVE TOGETHER BY
   * CONSTRUCTION. It used to be `CONFIG.titleDropMs` (900) while the coconuts
   * and their names faded up over `artFadeMs` (320) -- so the pictures were
   * fully there at 320ms and the question was still falling for another 580.
   * Reported 2026-09-11: *"the escolha seu coco letters come only later, it
   * should come at the same moment that the other stuff enters the screen."*
   *
   * ⚠️ ONE NUMBER, NOT TWO KEPT IN STEP. Setting `SELECT.dropMs` to 320 by hand
   * would have fixed it today and drifted the first time `artFadeMs` moved --
   * the pair would have to be edited together with nothing saying so. Reading
   * the fade as the DEFAULT means "together" survives a retune, and an explicit
   * `dropMs` is there for anyone who deliberately wants them apart.
   *
   * ⚠️ AND IT NO LONGER TOUCHES `titleDropMs`, which is the TITLE's drop and
   * belongs to the other screen. Sharing it was why this was 900 in the first
   * place.
   */
  _askMs() {
    const S = CONFIG.SELECT || {};
    return S.dropMs != null ? S.dropMs : this._sel('artFadeMs', 320);
  }

  _askP() {
    const ms = this._askMs();
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
      /* LIT IF EITHER PLAYER IS ON IT. `pick2` is -1 in a one-player run, and
         -1 can never equal a pack index, so this is the single-player test it
         replaced with no branch on the mode. */
      const on = (this.pick === i) || (this.pick2 === i);
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
      const cy = H * this._sel('artYRel', 0.60) + this._selNudge();
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
    /* THE FALLBACK TAKES THE NUDGE TOO -- see `_selNudge`. A failed download
       already costs the per-coconut highlight; it must not also move the
       layout, or the screen is laid out differently on a bad connection. */
    const cy = H * this._sel('artYRel', 0.60) + this._selNudge();
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
   * HOW FAR DOWN THE WHOLE TITLE SCREEN'S TEXT SITS, in px -- the name, the
   * gloss and the three menu items together. See CONFIG.LETTERS.titleNudgePx.
   *
   * ⚠️ IT IS A METHOD RATHER THAN A NUMBER READ AT EACH SITE so the four places
   * that draw this screen cannot drift apart. They are the name, the gloss, the
   * menu, and the typed fallback the screen uses when the letter pack is
   * missing -- and a nudge that reached three of those would be a bug you only
   * see on a bad connection.
   *
   * ⚠️ IT IS ADDED TO THE RESTING POSITION, NOT TO THE ANIMATION. The drop, the
   * bounce and the lift are all offsets from where these things come to rest;
   * this moves the rest, so the whole gesture follows it without any of the
   * timing numbers changing.
   */
  _nudge() { return this._lcfg('titleNudgePx', 0); }

  /**
   * The same idea for the FRUIT SELECT, and a second knob rather than a share of
   * the first.
   *
   * *"In the escolha seu coco screen, bring all the lettering and drawings down
   * by 1 finger (1 dedinho). Of course the background doesn't need to go down,
   * only the front stuff."* (2026-09-11)
   *
   * ⚠️ IT IS ITS OWN NUMBER BECAUSE `titleNudgePx`'s NOTE SAYS SO. That one is
   * explicit that it does not reach the other front-end screens -- the select,
   * OPCOES and the credits have their own layouts and were not in that ask, and
   * a shared nudge would move four screens to fix one. This ask is the select,
   * so the select gets a nudge of its own and the title's 24 is untouched.
   *
   * ⚠️ IT MOVES THE PICTURE AS WELL AS THE TYPE, which is why it lives in
   * `CONFIG.SELECT` and not in `CONFIG.LETTERS`: it is a property of the SCREEN,
   * not of the lettering pack. Four sites take it -- the drawn prompt, its typed
   * fallback, the two names under the coconuts, and the art (both the layered
   * path and the single-picture fallback). Miss one and the screen comes apart
   * on exactly the machine whose download failed.
   *
   * ⚠️ THE BACKGROUND IS NOT ONE OF THEM, AND THAT IS THE ASK. The photograph is
   * drawn cover-fit by the title's own plate pass and is never offered this
   * offset; the walk-across after the choice is not either, because his feet are
   * on a ground line read off that photograph and moving him would sink them
   * into it.
   *
   * ⚠️ ADDED TO THE RESTING POSITION, NOT TO THE ANIMATION -- same rule as
   * `_nudge`. The prompt's fall, bounce and lift are offsets from where it comes
   * to rest, and the pop's anchor is derived from the art's rect, so both follow
   * this without a timing or a scale number moving.
   */
  _selNudge() {
    const S = CONFIG.SELECT || {};
    return S.nudgePx != null ? S.nudgePx : 0;
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
  _drawMenu(ctx, W, H, alpha) {
    const L = this._art();
    if (!L) return;
    /* THEY SLIDE UP FROM UNDER THE FRAME, THEY DO NOT FADE, AND THEY DO IT ON
       THE NAME'S OWN CLOCK. Three asks in one pass on 2026-09-01: *"they should
       slide in from the below, like the title does from the upper part"*, then
       *"they should bounce like the title does"*, then *"the 3 options only come
       afterwards, make the 3 options come at the same time, like syncronized
       with the title."*

       ⚠️ SYNCHRONISED BY SHARING THE CLOCK, NOT BY MATCHING TWO SETS OF NUMBERS.
       The progress value IS `_dropP()` and the bounce is off `_landedAtMs()` --
       the same two expressions `_drawType` uses for the name -- so the blocks
       leave their edges together, travel together and land on the same frame.
       They previously started when the name LANDED and ran 520ms of their own,
       and `menuRiseMs` is now GONE rather than left equal to `titleDropMs`: a
       copied duration drifts the first time either one is retuned.

       ⚠️ SO THE ONLY DIFFERENCE IS THE SIGN. `_travel` is the screen-height the
       name falls from; this ADDS it where the name subtracts it, and the bounce
       is negated for the same reason -- a thing overshoots PAST its resting place
       in the direction it was moving, so the name dips down on landing and these
       ride up. `titleBouncePx: 0` still turns both off at once.

       ⚠️ AND THE BOUNCE COMES FOR FREE FROM THE SHARED CLOCK. `_dropP` picks the
       ACCELERATING approach (`p * p`) whenever `titleBouncePx` is set, because an
       eased-out arrival cannot bounce: it is already slowing to a stop, and a
       wobble after it reads as a separate twitch. Approach and bounce are ONE
       choice, and sharing the clock means this list cannot make it differently.

       ⚠️ NO FADE AT ALL, WHICH WAS THE POINT OF THE SECOND ASK. A slide that also
       fades reads as a fade with some drift in it -- the movement has to be the
       whole event. It does take the NAME's alpha, so if the title is ever faded
       rather than dropped the two still agree. `menuFadeMs` no longer touches
       this list; it still fades the options and credits screens, which arrive
       rather than move.

       ⚠️ THE LIST MOVES AS ONE BLOCK. Staggering the three would be juice, and it
       would also be three things arriving where the design has one -- the name
       and its gloss already fall together for the same reason. */
    const p = this._dropP();
    const a = (alpha == null) ? 1 : alpha;
    const cy = H * this._lcfg('menuYRel', 0.55) + this._nudge()
             + this._travel(H) * (1 - p)
             - this._bounce(this.t - this._landedAtMs());
    const gap = H * this._lcfg('menuGapRel', 0.11);
    const keys = this._menu();
    /* THE MENU'S OWN TRIM, UNDER THE PACK'S ONE SCALE -- and the highlight
       MULTIPLIES it rather than replacing it, so the selected item stays 10%
       bigger than its neighbours whatever `menuMul` is set to. */
    const base = this._lcfg('menuMul', 1);
    const pop = this._itemPop();
    /* ⚠️ A PER-ITEM CORRECTION FOR A FRAME DRAWN FOR A DIFFERENT ROLE, and it is
       NOT a licence to even the menu up. MÚSICA is ONE FRAME DOING TWO JOBS --
       the menu item and the heading of the screen it opens -- and the artist
       drew it at HEADING size, to match OPÇÕES-as-a-heading. As a menu item it
       therefore arrives a third too big, which is what the user saw.

       ⚠️ IT STARTED DERIVED FROM CAP HEIGHTS. Median per-column ink extent in
       the packed atlas: COMEÇAR 65.0, OPÇÕES 64.5, MÚSICA 89.0, so 64.75/89.0
       = 0.73. ⚠️ SABOROSA IS 54.0 AND WAS DELIBERATELY NOT IN THAT AVERAGE --
       the artist drew the three menu items at three sizes, and SABOROSA being
       the small one is THEIR drawing, not an error to correct.

       ⚠️⚠️ AND IT IS 0.69 NOW, BY THEIR EYE, IN TWO PASSES ON THE RUNNING
       SCREEN (-10%, then +5%). The measurement was the right place to start and
       is not the answer; see the config note before "correcting" it back.

       ⚠️ AND IT IS SCOPED TO THE MENU. The same frame still draws at the pack's
       own scale as the MÚSICA screen's heading, where heading size is right. A
       correction in `Letters.draw` would have shrunk both. */
    const per = this._lcfg('menuItemMul', null) || {};
    for (let i = 0; i < keys.length; i++) {
      const on = (i === this.menu);
      const fix = per[keys[i]] != null ? per[keys[i]] : 1;
      L.draw(ctx, keys[i], W / 2, cy + (i - 1) * gap,
             { alpha: a,
               mul: base * fix * (on ? this._lcfg('selectedMul', 1.10) * pop : 1) });
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
  /**
   * SABOROSA: who made it -- and then who made the music.
   *
   * ⚠️ IT IS A COLUMN OF TWO CARDS THAT SCROLLS, NOT TWO SCREENS THAT SWAP.
   * Asked for 2026-10-09: *"after clicking credits and the credits part fading
   * in, roll the letters upward and show the first 2 rows"*. So: the first
   * credit fades up and sits for `credHoldMs`, then everything on screen
   * travels up by `credRollRel` of the canvas over `credRollMs` -- which takes
   * the names off the top and brings MÚSICA POR / SAMURAIO up from below the
   * bottom edge, where they have been waiting all along.
   *
   * ⚠️ THE SECOND CARD IS DRAWN FROM THE FIRST FRAME, OFF SCREEN. It is not
   * spawned when the roll starts: both cards are always drawn, and the only
   * thing that changes is the offset. A card that appeared at the moment it was
   * needed would have to agree with the scroll about where "just off the bottom"
   * is, which is one number in two places.
   *
   * ⚠️ AND THE ROLL IS EASED, NOT LINEAR. A credits crawl at constant speed that
   * then stops dead reads as the screen being yanked; `_ease` here is the same
   * cosine the rest of this screen moves on.
   */
  _drawCredits(ctx, W, H) {
    const L = this._art();
    if (!L) return;
    const fade = this._lcfg('menuFadeMs', 320);
    const a = fade > 0 ? Math.min(1, this.stageT / fade) : 1;

    /* THE ROLL'S OWN CLOCK, which starts where the fade's ends. ⚠️ MEASURED FROM
       THE END OF THE HOLD rather than from the stage opening, so re-timing the
       fade or the hold cannot eat into the roll. */
    const hold = this._lcfg('credHoldMs', 1300);
    const rollMs = Math.max(1, this._lcfg('credRollMs', 1000));
    const p = Math.max(0, Math.min(1, (this.stageT - hold) / rollMs));
    const e = 0.5 - 0.5 * Math.cos(Math.PI * p);        // 0 -> 1, eased both ends
    const dy = H * this._lcfg('credRollRel', 0.82) * e;

    /* CARD 1: who made the game. It ends up above the top edge. */
    L.draw(ctx, 'credTitle', W / 2,
           H * this._lcfg('credTitleYRel', 0.32) - dy, { alpha: a });
    L.draw(ctx, 'credNames', W / 2,
           H * this._lcfg('credNamesYRel', 0.58) - dy, { alpha: a });

    /* CARD 2: who made the music. Its `YRel`s are where it COMES TO REST, so it
       is drawn one whole roll BELOW them until the roll has run.
       ⚠️ IT TAKES THE SAME `a` AS THE FIRST CARD even though it is off screen
       during the fade -- the alpha is the SCREEN arriving, not a card arriving,
       and giving the second one its own would be a fade nobody can see. */
    const roll = H * this._lcfg('credRollRel', 0.82);
    L.draw(ctx, 'credMusic', W / 2,
           H * this._lcfg('credMusicYRel', 0.38) + roll - dy, { alpha: a });
    L.draw(ctx, 'credSamuraio', W / 2,
           H * this._lcfg('credSamuraioYRel', 0.50) + roll - dy, { alpha: a });
  }

  /**
   * MÚSICA: the heading, and the soundtrack as a list you can play.
   *
   * ⚠️ TWO CUES, AND THEY ARE INDEPENDENT BECAUSE A ROW CAN BE BOTH. The CURSOR
   * is a scale bump (`selectedMul`, the menu's own idiom); PLAYING is full
   * alpha against `restAlpha` for everything else. The row you are pointing at
   * and the row you are hearing start out as the same row and stop being it the
   * moment you move -- so one highlight serving both would make the screen lie
   * about one of them.
   *
   * ⚠️ "PLAYING" IS ASKED OF `Sound`, NOT REMEMBERED HERE. `_wantedKey()` is
   * what that object actually has playing; a flag kept on this screen would be a
   * second copy of it, and the two would part company the first time anything
   * else changed the track -- which, since COCO NHA NHA is also the title
   * theme, is true before the player presses anything at all.
   */
  _drawMusic(ctx, W, H) {
    const L = this._art();
    if (!L) return;
    const J = this._jcfg();
    const fade = this._lcfg('menuFadeMs', 320);
    const a = fade > 0 ? Math.min(1, this.stageT / fade) : 1;
    L.draw(ctx, 'menuMusic', W / 2, H * (J.titleYRel != null ? J.titleYRel : 0.17),
           { alpha: a });
    /* WHO MADE THE MUSIC, under the heading. Asked for 2026-10-09: *"somewhere
       inside the music menu, we also want to add the letters SAMURAIO"*.
       ⚠️ IT IS THE CREDITS ROLL'S OWN FRAME, not a second cutting of the same
       word -- the artist drew SAMURAIO once and both screens read it.
       ⚠️ AND IT NEEDS `samuraioMul` BECAUSE THE WORD IS HEADING-SIZED. Measured
       in the packed atlas, its cap height is 60.9 against the MÚSICA heading's
       60.2 -- the artist drew the two at the same letter size, so at the pack's
       own scale this would be a SECOND HEADING rather than a by-line under the
       first. 0.62 makes it plainly secondary; see the config note.
       ⚠️ DRAWN ONLY IF THE PACK HAS IT, the same bargain every other use of this
       pack strikes -- an older `batidao-letters` simply has no by-line rather
       than a hole where one was assumed. */
    if (L.has('credSamuraio')) {
      L.draw(ctx, 'credSamuraio', W / 2,
             H * (J.samuraioYRel != null ? J.samuraioYRel : 0.285),
             { alpha: a, mul: (J.samuraioMul != null ? J.samuraioMul : 0.62) });
    }

    const songs = this._songs();
    const gap = H * (J.rowGapRel != null ? J.rowGapRel : 0.105);
    const y0 = H * (J.rowYRel != null ? J.rowYRel : 0.40);
    const base = J.rowMul != null ? J.rowMul : 0.80;
    const selMul = J.selectedMul != null ? J.selectedMul : 1.10;
    const rest = J.restAlpha != null ? J.restAlpha : 0.55;
    const playing = (this.sound && this.sound._wantedKey) ? this.sound._wantedKey() : null;
    const pop = this._itemPop();
    for (let i = 0; i < songs.length; i++) {
      const on = (i === this.juke);
      const live = (songs[i].key === playing);
      L.draw(ctx, songs[i].letter, W / 2, y0 + i * gap,
             { alpha: a * (live ? 1 : rest),
               mul: base * (on ? selMul * pop : 1) });
    }
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
    const y = H * this._lcfg('pickNameYRel', 0.90) + this._selNudge();
    const mul = this._lcfg('selectedMul', 1.10);
    const names = ['pickLEBRON', 'pickIPANEIMA'];
    for (let i = 0; i < names.length; i++) {
      /* THE PICKED ONE IS BIGGER, the same 10% the menu uses -- the two screens
         are asking the same kind of question and should answer it the same way.
         At `pick` -1 neither grows, which is the state where nobody is chosen. */
      L.draw(ctx, names[i], W / 2 + (i ? dx : -dx), y,
             { alpha: a, mul: (this.pick === i || this.pick2 === i) ? mul : 1 });
    }
  }

  _drawType(ctx, W, H) {
    if (this.stage === 'options') { this._drawOptions(ctx, W, H); return; }
    if (this.stage === 'music') { this._drawMusic(ctx, W, H); return; }
    if (this.stage === 'credits') { this._drawCredits(ctx, W, H); return; }
    const ns = CONFIG.titleNameSize || 74;
    const ss = CONFIG.titleSubSize || 30;
    /* THE TYPED FALLBACK TAKES THE NUDGE TOO -- see `_nudge`. A failed download
       already costs the lettering's look; it must not also move the layout. */
    const cy = H * (CONFIG.titleNameY != null ? CONFIG.titleNameY : 0.30)
             + this._nudge();
    const travel = this._travel(H);

    if (this.stage === 'ask' || this.stage === 'chosen') {
      const size = this._sel('promptSize', 58);
      const py = H * this._sel('promptYRel', 0.11) + this._selNudge();
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
        L.draw(ctx, 'choose', W / 2,
               H * this._lcfg('chooseYRel', 0.11) + this._selNudge() + dy);
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
      L.draw(ctx, 'title', W / 2,
             H * this._lcfg('titleYRel', 0.20) + this._nudge() + dy);
      L.draw(ctx, 'subtitle', W / 2,
             H * this._lcfg('subtitleYRel', 0.31) + this._nudge() + dy);
      ctx.restore();
      /* THE MENU ARRIVES WITH THE NAME, FROM THE OTHER EDGE -- one gesture on
         one clock; see _drawMenu. In `lift` it is gone already: the question is
         on its way in. */
      if (this.stage === 'name') this._drawMenu(ctx, W, H, a);
      return;
    }
    this._block(ctx, W, H, lines, cy, dy, a);
  }
}
