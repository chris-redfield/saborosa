/**
 * Input — keyboard AND gamepad, for the beat 'em up.
 *
 * Ported from flying-dungeon/src/input.js. The MOVEMENT half is unchanged and
 * so is the reason it is shaped this way; what differs is the verbs. A shooter
 * holds one button; a brawler PRESSES several:
 *
 *     attack   J / Z / pad `lift`      an EDGE. Punches are pressed, never
 *                                      held — a held punch would either mash
 *                                      the combo on its own or eat the press.
 *     jump     K / X / pad `jump`      an edge, same reason
 *
 * KEYBOARD AND PAD ARE TRACKED SEPARATELY AND OR'D TOGETHER, exactly as in
 * the flying dungeon, and for exactly the same reason: the keyboard writes its
 * flags on key EVENTS while the pad rewrites them every frame from a POLL, so
 * one shared set would have the pad's "nothing held" clear a key the player is
 * still holding — the stick would cancel the keyboard several times a second.
 *
 * `poll()` MUST BE CALLED ONCE PER FRAME. The Gamepad API fires no button
 * events; reading a fresh snapshot is the only way to see a press, so that call
 * IS the controller.
 */
/*
   TWO PLAYERS, TWO DEVICES (2026-10-09).
   ======================================
   One `Input` is now ONE PLAYER'S HANDS, not "the controls". Which physical
   devices it reads is decided by an OWNERSHIP TABLE kept on the class
   (`Input.OWNERS`), keyed by a device id: 'kb' for the keyboard, 'pad:0',
   'pad:1', ... for each gamepad slot the browser reports.

   SLOT 0 OWNS EVERYTHING THAT NOBODY ELSE HAS CLAIMED, and that is what keeps
   the one-player game exactly as it was: with an empty table, `ownerOf` answers
   0 for every device, so P1 reads the keyboard and every pad -- which is a
   superset of the old behaviour (it read the keyboard and the FIRST pad) and
   indistinguishable from it unless two pads are plugged in.

   A SECOND PLAYER JOINS BY CLAIMING ONE DEVICE, and the rule for which is in
   `scanJoin`: whatever is being pressed that P1 is demonstrably not playing on.
   That covers both of the arrangements asked for -- two controllers, or one
   player on the keyboard and one on a pad -- in either order, and without
   anybody having to be told which is which.

   WHY OWNERSHIP AND NOT TWO HARD-CODED KEY SETS. Splitting the keyboard (WASD
   for one, the arrows for the other) is the obvious design and it is the wrong
   one here: the ask was two controllers OR keyboard-and-controller, both halves
   of the keyboard already drive P1 today, and every key in this file is bound
   twice over (J/Z/Space all punch) precisely so a player does not have to learn
   a layout. Taking half of that away from P1 to give it to a player who may
   never join is a cost paid by the one-player game.
*/
class Input {
  /** Device id -> player slot. A device missing from here belongs to slot 0. */
  static ownerOf(id) {
    const o = Input.OWNERS[id];
    return (o == null) ? 0 : o;
  }

  /**
   * Give a device to a slot.
   *
   * EVERY INSTANCE DROPS ITS HELD STATE, and that is not tidiness: the join
   * press is made on a device slot 0 is at that moment still reading, so
   * without this P1 keeps a direction or a button latched from the last frame
   * before it changed hands -- the stuck-key bug, arriving by a new door.
   */
  static claim(id, slot) {
    Input.OWNERS[id] = slot;
    /* AND EVERY QUEUE IS DROPPED, NOT JUST THE HELD STATE -- see swallowHeld.
       The press that bought the joiner in was read by slot 0 a moment earlier
       (it owned the device until this line), so without this P1 answers the
       join with a punch he did not throw. The cost is that P1 loses anything he
       had queued on the frame somebody joined: one press, once per run. */
    for (const i of Input.ALL) i.swallowHeld();
  }

  /** Hand every device back to slot 0 -- what the end of a run does. */
  static resetOwners() {
    Input.OWNERS = {};
    for (const i of Input.ALL) i.releaseAll();
  }

  /**
   * HAND BACK EVERY DEVICE OWNED BY A SLOT THAT NO LONGER EXISTS.
   *
   * ⚠️ THIS IS THE BUG THAT MADE A CONTROLLER GO DEAD FOR THE REST OF A RUN.
   * Ownership lived longer than the party did: once P2 had joined, `pad:1` was
   * his until the title screen -- but the party is REBUILT by a restart and by
   * every DEV room jump, and a rebuild that produced one slot left the pad
   * belonging to a slot 1 that did not exist. Nothing read it, so the second
   * controller did nothing at all; and `scanJoin` refuses a device somebody
   * owns, so it could not even be rejoined with. Reported as *"I cant join the
   * game with player 2 at stage 2"*.
   *
   * SO EVERY REBUILD OF THE PARTY CALLS THIS. The rule it enforces is simply
   * that a device cannot belong to a player who is not in the game.
   */
  static releaseAbove(slots) {
    let changed = false;
    for (const k of Object.keys(Input.OWNERS)) {
      if (Input.OWNERS[k] >= slots) { delete Input.OWNERS[k]; changed = true; }
    }
    if (changed) for (const i of Input.ALL) i.releaseAll();
  }

  /**
   * IS SOMEBODY ASKING TO JOIN? Returns the device id being pressed by a hand
   * that is not slot 0's, or null.
   *
   * IT IS DECIDED BY WHAT P1 IS ACTUALLY PLAYING ON (`lastUsed`), not by what
   * he COULD play on. Slot 0 nominally owns every device, so "an unowned device
   * was pressed" would never be true and nobody could ever join; what is really
   * being asked is "is there a second pair of hands here", and the evidence for
   * that is a press on something the first pair is not touching.
   *
   * A PAD IS SCANNED RAW rather than through an Input, because no Input is
   * reading it yet -- it belongs to slot 0, whose own poll would turn the join
   * press into a punch. The keyboard cannot be scanned that way (there is no
   * "is a key down" API), so `rawKeyT` is a timestamp written by a listener
   * that exists for this and nothing else.
   */
  static scanJoin(p1, windowMs) {
    /*
       THE RULE: a device joins if it is being pressed, nobody owns it, and
       SLOT 0 HAS USED A DIFFERENT DEVICE RECENTLY.
       =======================================================================
       Getting here took two wrong turns worth writing down, because both are
       the obvious design and both are unimplementable.

         v1  "an unowned device was pressed". False by construction: slot 0
             owns every device nobody has claimed, which is the whole reason a
             one-player run can be played on anything. Nothing is ever unowned,
             so nobody could ever join.
         v2  "a device P1 is not currently using was pressed". The joiner's own
             press is what makes the device look like P1's -- slot 0 reads it
             first, in its own poll or its own key handler, both of which run
             before anything asks this question. Snapshotting the answer one
             frame earlier does not help either: a key event arrives BEFORE the
             poll that would take the snapshot, so the keyboard half failed
             even when the pad half worked. (It did. The join fired for a pad
             and not for a key, which is exactly the shape of bug that gets
             shipped.)

       SO THE EVIDENCE IS ELSEWHERE: not "is this device P1's" -- which the
       press itself corrupts -- but "is P1's ATTENTION somewhere else". A player
       who punched on the keyboard a second ago is not the player who has just
       pressed a button on a pad. That question cannot be corrupted by the press
       being asked about, because it is a question about a DIFFERENT device.

       THE COST, STATED PLAINLY: a lone player who has been using the keyboard
       and then picks up a controller joins a second player rather than
       switching. There is no way to tell those two apart without a dedicated
       JOIN button, and every word on the screens where this matters is
       hand-drawn -- a "PRESS START" prompt is art, not a line of code. The
       window (`TWO_PLAYER.joinWindowMs`) is what keeps it from firing for
       somebody who put the keyboard down a minute ago.
    */
    if (!p1) return null;
    const T = (typeof CONFIG !== 'undefined' && CONFIG.TWO_PLAYER) || {};
    /*
       `windowMs` OVERRIDES THE CONFIGURED WINDOW, and the fruit select passes
       Infinity. THE WINDOW IS THERE TO CATCH A LONE PLAYER WHO PUT ONE DEVICE
       DOWN AND PICKED ANOTHER UP, and that guess is only needed where the game
       cannot already tell. On the select screen it CAN: that screen's entire
       purpose is the question "who is playing", the first player is
       demonstrably sitting in front of it, and a second pair of hands pressing
       a button there means exactly one thing.

       ⚠️ AND WITHOUT THE OVERRIDE THE SELECT JOIN BARELY WORKED. The window is
       measured from the first player's last press, and on that screen he is
       deliberately STILL -- he has chosen, and he is waiting. Five seconds of
       looking at the picture was enough to close the door, and the join press
       then fell through to the select itself and was read as HIS confirm, so
       the screen advanced into a one-player run. Reported as *"I don't see
       anything different in the player selection screen"*.
    */
    const win = (windowMs != null) ? windowMs
              : ((T.joinWindowMs != null) ? T.joinWindowMs : 5000);
    const can = (id) => Input.ownerOf(id) === 0 && p1.usedOther(id, win);
    /* THE KEYBOARD. `rawKeyT` is written by one capture-phase listener that
       exists for this and nothing else -- there is no "is a key down" API to
       scan the way a pad can be scanned. */
    if (Input.rawKeyT && (Input.now() - Input.rawKeyT) < 150 && can('kb')) return 'kb';
    const pads = (typeof navigator !== 'undefined' && navigator.getGamepads)
               ? navigator.getGamepads() : null;
    if (pads) {
      for (let i = 0; i < pads.length; i++) {
        const g = pads[i];
        if (!g) continue;
        const id = 'pad:' + i;
        if (!can(id)) continue;
        /* BUTTONS ONLY, NEVER THE STICK. A controller lying on a desk with a
           drifting analogue stick would otherwise join a player nobody asked
           for, repeatedly, and there is no way to leave. */
        const b = g.buttons || [];
        for (let k = 0; k < b.length; k++) if (b[k] && b[k].pressed) return id;
      }
    }
    return null;
  }

  /** Note that this player is on this device, now. */
  _used(id) { this.lastUsed = id; this.usedAt[id] = Input.now(); }

  /**
   * HAS THIS PLAYER TOUCHED ANYTHING OTHER THAN `id` in the last `within` ms?
   *
   * THE ONE QUESTION THE JOIN RULE ASKS, and it is deliberately about the OTHER
   * devices: the device being asked about has just been pressed by whoever is
   * joining, so anything this object knows about IT is contaminated. See
   * `scanJoin`.
   */
  usedOther(id, within) {
    const now = Input.now();
    for (const k in this.usedAt) {
      if (k === id) continue;
      if (now - this.usedAt[k] <= within) return true;
    }
    return false;
  }

  static now() {
    return (typeof performance !== 'undefined') ? performance.now() : Date.now();
  }

  constructor(target, slot) {
    /* WHICH PLAYER THIS IS. The ownership table is read against it on every
       key event and every poll, so an instance with no devices simply produces
       nothing -- which is what slot 1 is until somebody joins. */
    this.slot = slot || 0;
    /* WHAT THIS PLAYER LAST ACTUALLY TOUCHED, 'kb' or 'pad:N'. Written by the
       key handler and by poll(). */
    this.lastUsed = null;
    /* WHEN THIS PLAYER LAST TOUCHED EACH DEVICE, by id. Read only by
       `usedOther`, which is the whole of the join rule -- see `scanJoin`. */
    this.usedAt = {};
    Input.ALL.push(this);
    this.left = this.right = this.up = this.down = false;
    this.debug = false;              // hold C: boxes
    this._attackQueued = false;
    /* ⚠️ HELD, ALONGSIDE THE EDGE, AND THE TWO ARE NOT THE SAME SIGNAL. The
       punch is an EDGE on purpose -- see the header: a held punch would either
       mash or eat the combo. TIME ATTACK's plane needs the opposite, a hitscan
       beam that is on for as long as the button is down, so it reads `firing`
       and the fighting keeps reading `takeAttack()`. Additive: nothing about
       the edge changed when this was put in (2026-09-08).
       ⚠️ `flush()` CLEARS IT TOO, or a pause taken mid-burst would resume with
       the gun stuck on. */
    this._attackHeld = false;
    this.firing = false;
    this._jumpQueued = false;
    this._pauseQueued = false;
    this._muteQueued = false;
    this._swapQueued = false;
    this._pickupQueued = false;
    /* HELD, NOT JUST PRESSED -- the special (punch + lift together) is the only
       thing that asks. See takeSpecial(). */
    this._pickupHeld = false;
    this._padHeldPickup = false;
    this._roomJump = -1;       // dev: room index requested by a number key
    this._anyPress = false;
    /* THE TYPED-LETTER BUFFER, for the dev-mode unlock -- see `armCheat`. It is
       NOT a queued press and `flush()` deliberately leaves it alone: a press is
       an instruction the game owes the player an answer to, and this is a few
       characters of half-finished typing that only one screen is ever listening
       for. Its whole lifetime is `armCheat`. */
    this._typed = '';
    this._cheatArmed = false;

    this._kb = { left: false, right: false, up: false, down: false };
    this._pad = { left: false, right: false, up: false, down: false };
    this._padPrev = {};
    /* ⚠️ IS THE WINDOW FOCUSED -- read by poll() to decide whether the PAD may
       be read at all. See the blur/focus binding, and _shouldReadPad().
       ⚠️ IT STARTS TRUE AND IS ONLY EVER PULLED DOWN BY AN EVENT WE ACTUALLY
       SAW. A browser that fires no focus events at all leaves this true for
       ever, which is exactly today's behaviour -- the failure mode of guessing
       wrong here is a DEAD CONTROLLER, so it is biased to stay live. */
    this._focused = true;
    /* ⚠️ RISING EDGES ON UP AND DOWN, derived in poll() from the MERGED
       direction rather than from either device's own events -- see the note
       there. Only TIME ATTACK reads them (the swoosh on a climb or a dive);
       the fighting reads the HELD directions and always has. */
    this._upPress = false;
    this._downPress = false;
    this._dirPrev = { up: false, down: false };

    this.deadzone = 0.45;
    this.moveAxis = { x: 0, y: 1, invertX: false, invertY: false };
    /* Defaults for a standard-layout pad; a loaded mapping replaces them.
       `lift` is the main game's name for its action button, so a pad already
       set up for Saborosa punches here without being re-authored. There is no
       `jump` action in that file, so button 1 is bound directly as a sensible
       standard-layout default — see applyMapping. */
    this.padMap = { 0: 'lift', 1: 'jump', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };

    this._bind(target || window);
  }

  _bind(t) {
    /* THE RAW KEY WATCHER, INSTALLED ONCE FOR THE WHOLE CLASS. It records only
       WHEN a key was last pressed, on the capture phase so nothing can stop it,
       and exists for exactly one caller: `scanJoin`, which has no other way to
       ask whether a hand is on the keyboard. It is not input -- nothing reads
       which key it was. */
    if (!Input._rawBound && typeof window !== 'undefined') {
      Input._rawBound = true;
      window.addEventListener('keydown', e => {
        if (!e.repeat) Input.rawKeyT = Input.now();
      }, true);
    }
    const MOVE = {
      ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    };
    t.addEventListener('keydown', e => {
      /* NOT MY KEYBOARD. Every instance binds its own listeners and this is
         what makes them harmless: a slot that does not own the keyboard sees
         every event and acts on none of them. Written as a guard rather than as
         "bind the listeners only if you own it", because ownership CHANGES at
         run time -- the second player joins mid-screen -- and a listener that
         has to be added and removed as that happens is a second thing to keep
         in step with the table. */
      if (Input.ownerOf('kb') !== this.slot) return;
      this.lastUsed = 'kb';
      this.usedAt.kb = Input.now();
      /* THE TYPED CODE, AND IT HAS TO BE READ BEFORE EVERYTHING ELSE IN THIS
         HANDLER. Two of SABOROSA's letters are movement keys -- S is down and A
         is left -- and the MOVE branch below RETURNS, so recording anywhere
         after it would silently drop both of them and the word could never be
         completed. The one place this can live is the top.

         ⚠️ `e.key`, NOT `e.code`, AND THAT IS THE "UPPERCASE ONLY" REQUIREMENT.
         Every other key in this file is read as a `code` -- a physical key,
         layout- and shift-independent, which is what a game control wants. This
         is the opposite: the ask was uppercase, so it has to be the CHARACTER
         the keyboard produced. `KeyS` cannot tell S from s; `e.key` is 'S' only
         with shift held or caps lock on.

         ⚠️ AND `e.repeat` IS CHECKED HERE TOO, not left to the guard below it.
         A finger resting on O autorepeats at the OS rate and would fill the
         buffer with a hundred of them -- harmless for a match, but it is the
         same reason the presses below have the guard. */
      if (this._cheatArmed && !e.repeat && e.key && e.key.length === 1
          && e.key >= 'A' && e.key <= 'Z') {
        this._typed = (this._typed + e.key).slice(-Input.CHEAT_MAX);
      }
      const m = MOVE[e.code];
      if (m) { e.preventDefault(); this._kb[m] = true; return; }
      /* ⚠️ THE HELD FLAG IS SET BEFORE THE `e.repeat` GUARD, and that is the
         point of putting it here: autorepeat is exactly what a HOLD looks like
         to the DOM, so a flag set after the guard would never be re-armed and a
         hold would read as a single frame. The guard still protects the edge
         below, which is what it was written for. */
      if (e.code === 'KeyJ' || e.code === 'KeyZ' || e.code === 'Space') this._attackHeld = true;
      // `e.repeat` is the guard that makes these presses rather than holds:
      // held keys autorepeat at the OS rate, and without this a resting finger
      // would drum the combo out on its own.
      if (e.repeat) return;
      if (e.code === 'KeyJ' || e.code === 'KeyZ' || e.code === 'Space') {
        e.preventDefault(); this._attackQueued = true; this._anyPress = true;
      } else if (e.code === 'KeyK' || e.code === 'KeyX') {
        e.preventDefault(); this._jumpQueued = true; this._anyPress = true;
      } else if (e.code === 'KeyL' || e.code === 'KeyE') {
        e.preventDefault(); this._pickupQueued = true; this._pickupHeld = true;
        this._anyPress = true;
      } else if (e.code === 'KeyC') { this.debug = true; }
      /* DEV: the number keys jump straight to a room -- to the BOSS ROOM, in
         practice, which is what 2 is.

         ⚠️ GATED HERE AS WELL AS AT THE POINT OF ACTION, on request
         (2026-08-22). game.js has always refused to act on it unless
         CONFIG.DEV.on, so the shortcut was never live in a shipping build; this
         stops the request even being RECORDED, so there is no path from a
         number key to a room change that depends on one `if` in the shell being
         right. Two gates for a shortcut that skips most of the game is not
         belt-and-braces, it is the difference between "we check" and "it cannot
         happen".

         ⚠️ `_anyPress` IS STILL SET EITHER WAY, and that is deliberate: every
         end screen in this game is dismissed by pressing ANYTHING, and a number
         key that stopped counting would be a dead key on the game over panel
         for no reason a player could ever work out. */
      else if (e.code.slice(0, 5) === 'Digit' && e.code.length === 6) {
        const n = +e.code[5];
        if (n >= 1 && CONFIG.DEV && CONFIG.DEV.on) this._roomJump = n - 1;
        this._anyPress = true;
      }
      /* ⚠️ ENTER PAUSES *AND* STILL COUNTS AS AN ANY-PRESS, which P and Escape
         beside it deliberately do not. It can afford to: pause is only read in
         the PLAY phase and `_anyPress` is only read on the front and end
         screens, so the two can never both act on one press -- and every end
         screen flushes the queue on entry anyway. Enter is the key a player
         reaches for to dismiss a card, and taking that away to give it a second
         job would be a worse trade than the one M makes. */
      else if (e.code === 'Enter') { this._pauseQueued = true; this._anyPress = true; }
      else if (e.code === 'KeyP' || e.code === 'Escape') { this._pauseQueued = true; }
      /* MUTE, AND DELIBERATELY NOT AN "ANY PRESS". Every end screen in this
         game is dismissed by pressing anything, so a mute that fell through to
         the branch below would skip the board you muted the music to read. */
      else if (e.code === 'KeyM') { this._muteQueued = true; }
      /* TAB SWAPS THE HERO'S SPRITE PACK. A stand-in for the character select
         that is coming: one key, any time, so both coconuts can be looked at
         without a screen being built for them first.
         ⚠️ preventDefault IS NOT OPTIONAL HERE. Tab's default action moves
         focus OFF the canvas, and the very next keypress would go to whatever
         the browser focused instead -- the game would appear to freeze, having
         simply stopped being the thing receiving keys. */
      else if (e.code === 'Tab') { this._swapQueued = true; e.preventDefault(); }
      else { this._anyPress = true; }
    });
    t.addEventListener('keyup', e => {
      if (Input.ownerOf('kb') !== this.slot) return;
      const m = MOVE[e.code];
      if (m) { e.preventDefault(); this._kb[m] = false; return; }
      if (e.code === 'KeyJ' || e.code === 'KeyZ' || e.code === 'Space') this._attackHeld = false;
      if (e.code === 'KeyL' || e.code === 'KeyE') this._pickupHeld = false;
      if (e.code === 'KeyC') this.debug = false;
    });
    /* ⚠️⚠️ THE WINDOW LOST FOCUS, SO EVERY HELD KEY IS NOW A LIE.
       Reported 2026-09-09: *"if I am holding the 'd' key to go right and I press
       volume up on the keyboard, the key gets stuck -- it either makes the
       character move in that direction even when you are not pressing the key,
       or it just stops working."*

       ⚠️ IT IS NOT THE VOLUME KEY, IT IS THE FOCUS. A media key is grabbed by
       the desktop, and an X11 keyboard grab reaches the browser as a real
       `blur` (FocusOut/NotifyGrab) followed by a `focus` when it ends. Key
       events during the grab go to the desktop and NEVER to this page -- so:

         * the KEYUP for a key released during the grab is lost, `_kb.right`
           stays true for ever, and `poll()` ORs it into `this.right` on every
           frame after: he walks right with nothing held. That is the first half.
         * a KEYDOWN pressed during the grab is lost the same way, so the key
           does nothing until it is pressed again. That is the second half, and
           it is the same event missing in the other direction.

       Alt-tab, a notification, the OS volume overlay and a click on another
       window are all the same shape. **Nothing in this game recovered from it:
       there was no blur handler anywhere in this file, in the flying dungeon's
       input.js, or in the main game's.**

       ⚠️ AND `flush()` DOES NOT FIX IT, though it looks like it should. It drops
       `_attackHeld` for exactly this reason and says so -- but it deliberately
       leaves `_kb` alone, and must keep doing so: it runs on every screen
       change, and a player holding a direction through a room fade would have
       their walk cut until autorepeat re-asserted the key half a second later.
       Focus loss is the case where the held state is genuinely unknowable;
       a screen change is not. */
    const releaseAll = () => this.releaseAll();
    if (typeof window !== 'undefined') {
      window.addEventListener('blur', () => { this._focused = false; releaseAll(); });
      window.addEventListener('focus', () => { this._focused = true; });
      window.addEventListener('gamepaddisconnected', () => { this._padPrev = {}; });
    }
    /* ⚠️ AND `visibilitychange` AS WELL AS `blur`, because they are not the same
       event: a tab switched away from, or a phone screen locked, can hide the
       page without the window ever blurring. Both end in the same call, which
       is safe to run twice. */
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) { this._focused = false; releaseAll(); }
        else this._focused = true;
      });
    }
  }

  /**
   * Everything the player is HOLDING, let go of.
   *
   * ⚠️ HELD STATE ONLY -- the queued edges are deliberately left alone. A punch
   * pressed a frame before the window blurred is a press the game still owes an
   * answer to, which is `flush()`'s doctrine and is right here too; what cannot
   * be trusted after a focus change is anything whose truth depends on a keyup
   * that may never arrive.
   *
   * ⚠️ `this.left`/`right`/... ARE CLEARED TOO, not just `_kb`. `poll()` derives
   * them and would do it for us on the next frame -- but only if a frame comes,
   * and the game is very often paused or between phases when focus is lost.
   *
   * ⚠️ THE PAD IS INCLUDED. A pad is polled from scratch every frame so it
   * cannot strictly stick, but `_padPrev` is a rising-edge memory: leaving a
   * button remembered as DOWN across a blur would swallow the first press after
   * the player comes back.
   *
   * ⚠️ `_typed` IS NOT CLEARED, matching flush(): it is half-finished typing
   * that only the pause screen listens for, not an input state.
   */
  /**
   * SWALLOW WHATEVER IS BEING HELD RIGHT NOW, so that none of it can read as a
   * fresh press on the frame after this one.
   *
   * WHY `releaseAll()` + `flush()` IS NOT ENOUGH, AND THIS IS THE BUG IT WAS
   * WRITTEN FOR. A player joins by HOLDING a pad button -- `scanJoin` reads
   * `buttons[k].pressed`, which is a level and not an edge, and a human press
   * lasts a tenth of a second. `releaseAll()` clears `_padPrev`, which is the
   * rising-edge memory; so on the very next poll the button is down, the memory
   * says it was not, and the still-held join press is read as a NEW press. On
   * the fruit select that confirmed the joiner's character for him in the same
   * breath as joining -- he never got to choose.
   *
   * SO THE EDGE MEMORY IS RE-SEEDED FROM THE LIVE SNAPSHOT instead of cleared:
   * a button that is down right now is recorded as already down, and the next
   * press this player makes is the next time it goes down. Nothing is acted on
   * here -- this is the opposite of a poll.
   *
   * THE KEYBOARD NEEDS NO EQUIVALENT: a held key only re-fires through OS
   * autorepeat, and every queued edge in this file sits behind `if (e.repeat)
   * return`.
   */
  swallowHeld() {
    this.releaseAll();
    this.flush();
    for (const [gi, gp] of this._myPads()) {
      const b = gp.buttons || [];
      for (let i = 0; i < b.length; i++) {
        this._padPrev[gi + ':' + i] = !!(b[i] && b[i].pressed);
      }
    }
  }

  releaseAll() {
    this._kb.left = this._kb.right = this._kb.up = this._kb.down = false;
    this._pad.left = this._pad.right = this._pad.up = this._pad.down = false;
    this.left = this.right = this.up = this.down = false;
    this._padPrev = {};
    this._attackHeld = false;
    this._padHeldLift = false;
    this._pickupHeld = false;
    this._padHeldPickup = false;
    this.firing = false;
    /* Hold-C. Same class of bug, and a debug overlay welded on because the
       window blurred is how a "the game is broken" report gets written. */
    this.debug = false;
  }

  /* Apply a mapping authored in the main game's tools/gamepad-mapper.html.
     Tolerant by design: any missing field keeps its default, so a partial file
     — or none at all — can never break input.

     Like the main game's, this REPLACES the button map rather than merging,
     and does not check `cfg.id` against the pad actually plugged in. Deliberate
     (it is what the main game does), but it means a different pad wants its own
     mapping re-authored rather than expecting the shipped one to fit.

     TWO ACTIONS ARE MERGED BACK: `jump` and `pickup`. The main game has
     neither, so a mapping authored over there names no button for them, and a
     straight replace would leave this game unable to jump or pick anything up
     on a pad that works fine everywhere else. Each is put on the first button
     the map has left free, in its own order of preference.

     THOSE ORDERS ARE THE BINDING, so they are a preference and not an
     implementation detail:

       jump    0 first -- the BOTTOM face button, A on a standard pad. That is
               where every player reaches for jump, and it is the first button
               anyone presses when they pick up a controller.
       pickup  1 first -- the RIGHT face button, B. Asked for by name.

     The jump search used to start at 1, which put jump on B and left A doing
     nothing at all. The shipped mapping binds neither button, so the arbitrary
     order was the whole difference. */
  applyMapping(cfg) {
    if (!cfg) return;
    if (typeof cfg.deadzone === 'number') this.deadzone = cfg.deadzone;
    if (cfg.axes) {
      const a = cfg.axes;
      if (Number.isInteger(a.moveX)) this.moveAxis.x = a.moveX;
      if (Number.isInteger(a.moveY)) this.moveAxis.y = a.moveY;
      this.moveAxis.invertX = !!a.invertX;
      this.moveAxis.invertY = !!a.invertY;
    }
    const map = {};
    if (cfg.gamepadMap) {
      for (const [idx, act] of Object.entries(cfg.gamepadMap)) map[idx] = act;
    } else if (cfg.buttons) {
      for (const [act, idx] of Object.entries(cfg.buttons)) map[idx] = act;
    }
    if (!Object.keys(map).length) return;
    for (const [act, prefer] of [['jump', [0, 1, 2, 3]], ['pickup', [1, 3, 2, 0]]]) {
      if (Object.values(map).includes(act)) continue;
      for (const b of prefer) {
        if (map[b] === undefined) { map[b] = act; break; }
      }
    }
    this.padMap = map;
  }

  loadMapping(url) {
    if (!url || typeof fetch !== 'function') return Promise.resolve(false);
    return fetch(url, { cache: 'no-cache' })
      .then(r => (r.ok ? r.json() : null))
      .then(cfg => { if (cfg) { this.applyMapping(cfg); return true; } return false; })
      .catch(() => false);
  }

  /**
   * EVERY PAD THIS SLOT OWNS, as [index, gamepad] pairs.
   *
   * IT REPLACED `_firstPad`, AND THE PLURAL IS THE POINT. The old version took
   * the first pad the browser reported, which is right while there is one
   * player and wrong the moment a second one claims pad 1 -- P1 would have gone
   * on reading it as well, so both heroes would answer to the joiner's stick.
   *
   * SLOT 0 STILL GETS EVERY UNCLAIMED PAD, which is a superset of "the first
   * one" and the reason a one-player run is unchanged: a pad nobody is holding
   * contributes nothing to the merge.
   */
  _myPads() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
    const pads = navigator.getGamepads();
    if (!pads) return [];
    const out = [];
    for (let i = 0; i < pads.length; i++) {
      if (pads[i] && Input.ownerOf('pad:' + i) === this.slot) out.push([i, pads[i]]);
    }
    return out;
  }

  /* ⚠️ `document.hasFocus()` IS CONSULTED AS WELL AS THE FLAG, not instead of
     it. The flag catches the case the events describe; hasFocus() catches a
     page that simply loaded without focus, where no blur was ever fired to
     record. Either saying no is enough. ⚠️ A document that does not implement
     hasFocus leaves the decision to the flag rather than defaulting to "dead". */
  _shouldReadPad() {
    if (!this._focused) return false;
    if (typeof document !== 'undefined' && typeof document.hasFocus === 'function')
      return document.hasFocus();
    return true;
  }

  poll() {
    const pad = this._pad;
    pad.left = pad.right = pad.up = pad.down = false;
    /* ⚠️ RE-DERIVED EVERY POLL, never accumulated: a pad that is unplugged
       mid-hold leaves no button down, and the `else` branch below is reached
       with this already false. */
    let padLift = false;
    let padPickup = false;

    /* ⚠️⚠️ THE PAD IS NOT READ WHILE THE WINDOW IS UNFOCUSED, and this is the
       CONTROLLER half of the stuck-key bug -- asked about directly, 2026-09-09:
       *"does that fix it for when the player is playing in a controller?"*

       The keyboard half cannot happen here: a pad is POLLED, not evented, so
       every direction above is zeroed and rebuilt from the live snapshot each
       frame and there is no keyup to lose. But `requestAnimationFrame` keeps
       running while a window is merely blurred (only HIDING stops it), so the
       game goes on polling a pad the player is not holding -- and whether
       Chrome zeroes or FREEZES the snapshot of an unfocused page is not
       something to rely on either way. If it freezes, a held stick keeps
       walking him after the volume OSD steals focus: the same symptom, a
       different mechanism, and `releaseAll()` cannot fix it because the very
       next poll re-derives the state it just cleared.

       ⚠️ SO THE POINT IS TO MAKE THE BROWSER'S ANSWER NOT MATTER. An unfocused
       window is one the player is not playing; neither input path should
       produce anything, whatever the API returns.

       ⚠️ AND IT ROUTES THROUGH THE EXISTING "no pad" BRANCH ON PURPOSE, which
       already clears `_padPrev` -- so the first press after coming back reads
       as a rising EDGE rather than being swallowed as already-held. */
    /* EVERY PAD THIS SLOT OWNS, OR'd TOGETHER -- see `_myPads`. With one
       player and one pad this loop runs once and is the code it replaced.
       ⚠️ `_padPrev` IS KEYED BY PAD **AND** BUTTON ('1:0'), not by button
       alone. Two pads both have a button 0, and a shared key would let one
       pad's press mask the other's edge -- which with two players is one of
       them silently losing a punch whenever the other presses the same face
       button first. */
    const mine = this._shouldReadPad() ? this._myPads() : [];
    for (const [gi, gp] of mine) {
      const ax = this.moveAxis;
      let rx = gp.axes[ax.x] || 0, ry = gp.axes[ax.y] || 0;
      if (ax.invertX) rx = -rx;
      if (ax.invertY) ry = -ry;
      if (rx < -this.deadzone) pad.left = true;
      else if (rx > this.deadzone) pad.right = true;
      if (ry < -this.deadzone) pad.up = true;
      else if (ry > this.deadzone) pad.down = true;
      if (pad.left || pad.right || pad.up || pad.down) this._used('pad:' + gi);

      const btns = gp.buttons || [];
      for (let i = 0; i < btns.length; i++) {
        const down = !!(btns[i] && btns[i].pressed);
        const act = this.padMap[i];
        const pk = gi + ':' + i;
        if (down) this._used('pad:' + gi);
        if (down && !this._padPrev[pk]) {
          // Every button counts toward "press anything to continue", mapped or
          // not — a player hunting for the button to dismiss a screen should
          // not have to find the right one.
          this._anyPress = true;
          if (act === 'lift') this._attackQueued = true;
          else if (act === 'jump') this._jumpQueued = true;
          else if (act === 'pickup') this._pickupQueued = true;
          /* START. The mapping has named this button since the pad profile was
             written (`pause: 9`) and nothing had ever read it. */
          else if (act === 'pause') this._pauseQueued = true;
        }
        this._padPrev[pk] = down;
        if (act === 'lift') padLift = padLift || down;
        if (act === 'pickup') padPickup = padPickup || down;
        if (!down) continue;
        if (act === 'up' || act === 'down' || act === 'left' || act === 'right') {
          pad[act] = true;
        }
      }
    }
    /* NO PAD TO READ -- unplugged, unowned, or the window is not focused. The
       rising-edge memory is dropped so the first press after it comes back
       reads as an edge rather than being swallowed as already-held. */
    if (!mine.length) this._padPrev = {};
    this._padHeldLift = padLift;
    this._padHeldPickup = padPickup;

    const kb = this._kb;
    this.left = kb.left || pad.left;
    this.right = kb.right || pad.right;
    this.up = kb.up || pad.up;
    this.down = kb.down || pad.down;
    /* ⚠️ THE EDGES ARE TAKEN OFF THE MERGED VALUE, NOT OFF EITHER DEVICE.
       Doing it per-device would mean two mechanisms (a keydown guard on the
       keyboard, a `_padPrev` comparison on the pad) that BOTH fire when someone
       nudges the stick while resting a hand on W -- one press, two swooshes.
       One comparison here cannot double-fire by construction.
       ⚠️ It costs at most a frame of latency, which a held direction cannot
       notice; a tap shorter than one frame is not a thing a stick or a key can
       produce. */
    if (this.up && !this._dirPrev.up) this._upPress = true;
    if (this.down && !this._dirPrev.down) this._downPress = true;
    this._dirPrev.up = this.up;
    this._dirPrev.down = this.down;
    /* ⚠️ THE PAD'S HELD FIRE COMES FROM `padHeld`, NOT FROM THE EDGE ABOVE.
       `_padPrev` is a rising-edge memory; "is the button down right now" is a
       different question and is answered in the button loop. */
    this.firing = this._attackHeld || !!this._padHeldLift;
  }

  // Each true once per press, then consumed — an unread press is PENDING, not
  // stale, so unlike the flying dungeon's movement edges these are queued
  // rather than recomputed. A punch pressed on the frame a hitstop began must
  // still come out when the world resumes.
  takeAttack() { const a = this._attackQueued; this._attackQueued = false; return a; }
  /* ⚠️ CONSUME THESE EVERY FRAME EVEN WHEN THEY ARE NOT ACTED ON. TIME ATTACK
     takes both and then decides whether to play anything (the plane is
     control-locked through the fly-in and the round cards). Reading them only
     when they can be used would leave a press queued across that lock and fire
     a swoosh for a climb the player made a second and a half earlier. */
  takeUpPress() { const a = this._upPress; this._upPress = false; return a; }
  takeDownPress() { const a = this._downPress; this._downPress = false; return a; }
  takeJump() { const j = this._jumpQueued; this._jumpQueued = false; return j; }
  takePickup() { const p = this._pickupQueued; this._pickupQueued = false; return p; }
  /**
   * PUNCH AND LIFT TOGETHER -- the special. True once, and it EATS BOTH presses
   * so neither a punch nor a stoop comes out beside it.
   *
   * ⚠️ IT IS "PRESSED WHILE THE OTHER IS DOWN", NOT "PRESSED WITHIN N ms", and
   * that is the whole design. A time window would have to HOLD every punch back
   * for the length of it to see whether a lift was coming -- 100ms of latency
   * on the button this game is mostly made of, to serve one move. Asking
   * whether the other button is already down costs nothing and delays nothing:
   * a normal punch fires on its own frame exactly as before.
   *
   * ⚠️ BOTH QUEUED IN ONE FRAME COUNTS TOO, and it is not the same test. Two
   * keys pressed in the same 16ms tick arrive as two keydowns with no poll
   * between them, so neither is "held" when the other lands -- without this
   * line a genuinely simultaneous press is the one input that would NOT work.
   *
   * ⚠️ AND IT MUST BE ASKED BEFORE `takeAttack()`, or the punch branch consumes
   * the press first and the special can never see it. Player.update() calls it
   * at the top for that reason.
   */
  takeSpecial() {
    const punch  = this._attackQueued;
    const lift   = this._pickupQueued;
    const punchD = this._attackHeld || !!this._padHeldLift;
    const liftD  = this._pickupHeld || !!this._padHeldPickup;
    const both = (punch && (lift || liftD)) || (lift && (punch || punchD));
    if (!both) return false;
    this._attackQueued = false;
    this._pickupQueued = false;
    return true;
  }
  /** Dev: the room a number key asked for, or -1. Consumed on read. */
  takeRoomJump() { const r = this._roomJump; this._roomJump = -1; return r; }
  takePause() { const p = this._pauseQueued; this._pauseQueued = false; return p; }
  takeMute() { const m = this._muteQueued; this._muteQueued = false; return m; }
  takeSwap() { const w = this._swapQueued; this._swapQueued = false; return w; }
  takeAnyPress() { const a = this._anyPress; this._anyPress = false; return a; }

  /**
   * START OR STOP LISTENING FOR A TYPED CODE, and forget anything half-typed
   * either way.
   *
   * ⚠️ THE ARMING IS WHAT KEEPS THE CODE TO ONE SCREEN. Recording always and
   * checking only on the pause screen would look identical from here and would
   * not be: the letters would accumulate during play, so typing SABOROSA while
   * walking around and pausing afterwards would unlock it. The word has to be
   * typed AT the screen that listens for it, and clearing on every change of
   * state is what makes that literally true.
   *
   * Idempotent, so the caller can hand it a `paused` flag every frame if that
   * ever reads better than calling it on the edge.
   */
  armCheat(on) {
    on = !!on;
    if (on === this._cheatArmed) return;
    this._cheatArmed = on;
    this._typed = '';
  }

  /** True ONCE if `word` has just been typed, and consumed on read like every
      other `take`. Matched on the END of the buffer, so a mistyped run-up does
      not have to be cleared by hand -- SABOROSSABOROSA still lands. */
  takeCheat(word) {
    if (!word || !this._typed.endsWith(word)) return false;
    this._typed = '';
    return true;
  }

  /** Drop anything queued — used when a screen changes, so a key pressed on the
      way out of one state does not act on the state it lands in. */
  flush() {
    this._attackQueued = this._jumpQueued = this._pickupQueued = false;
    /* ⚠️ THE HOLD GOES TOO. A pause taken mid-burst would otherwise resume with
       the gun still on, because no keyup ever arrives for a key released while
       the card was up. Same reason the queued edges are dropped here. */
    this._attackHeld = false; this._padHeldLift = false; this.firing = false;
    this._pickupHeld = this._padHeldPickup = false;
    this._pauseQueued = this._anyPress = false;
    this._roomJump = -1;
    /* ⚠️ AND THE DIRECTION EDGES, WITH `_dirPrev` LEFT ALONE. Dropping the
       queued edge is what flush() is for; resetting `_dirPrev` as well would
       manufacture a NEW edge on the next poll for a direction still being held,
       which is the opposite of dropping it. */
    this._upPress = this._downPress = false;
  }
}

/* HOW MANY TYPED LETTERS ARE REMEMBERED. Only ever compared with `endsWith`, so
   this is a cap on the buffer and not the length of any code -- it needs to be
   at least as long as the longest word `takeCheat` is asked about, and every
   character past that is just room to mistype. */
Input.CHEAT_MAX = 32;

/* THE DEVICE TABLE AND THE INSTANCE REGISTER. Both are per-CLASS rather than
   per-instance because they are statements about the HARDWARE, which the
   players share: "pad 1 belongs to slot 1" is not a fact slot 0 can be allowed
   to hold a different opinion about. See the header. */
Input.OWNERS = {};
Input.ALL = [];
/* WHEN A KEY WAS LAST PRESSED, by anybody, written by one capture-phase
   listener and read only by `scanJoin`. Zero means "no key has ever been
   pressed on this page", which is the honest starting answer. */
Input.rawKeyT = 0;
Input._rawBound = false;

/**
 * InputGroup -- several players' hands, read as one.
 *
 * WHAT IT IS FOR: everything OUTSIDE a fight. The title screen, the pause card,
 * the options meters, CONTINUE?, the game over panel and the results board all
 * belong to the room rather than to a player, and every one of them is
 * dismissed by "press anything" -- so a second player sitting on a second pad
 * being unable to unpause the game would be a bug with no visible cause.
 *
 * THE FIGHT DOES NOT USE IT. Each hero is ticked with his OWN Input (see
 * `inputFor` in game.js); this is for the screens where there is one cursor.
 *
 * EVERY TAKER IS CALLED ON EVERY MEMBER, never short-circuited, and that is the
 * one rule this class has. A queued press is a press the game owes an answer
 * to: `a() || b()` would leave b's press standing, to be spent a frame later on
 * whatever screen the first one handed to -- which is exactly the bug the
 * MUSICA screen was built around (see Title._tickMusic).
 */
class InputGroup {
  constructor(list) { this.list = list || []; }

  /* The held directions, OR'd. Read as properties because that is how every
     caller already reads an Input, and a getter keeps this a drop-in. */
  get left()  { return this.list.some(i => i.left); }
  get right() { return this.list.some(i => i.right); }
  get up()    { return this.list.some(i => i.up); }
  get down()  { return this.list.some(i => i.down); }
  get debug() { return this.list.some(i => i.debug); }
  get firing() { return this.list.some(i => i.firing); }

  _any(fn) {
    let out = false;
    for (const i of this.list) if (fn(i)) out = true;   // never short-circuit
    return out;
  }
  _all(fn) { for (const i of this.list) fn(i); }

  poll() { this._all(i => i.poll()); }
  flush() { this._all(i => i.flush()); }
  releaseAll() { this._all(i => i.releaseAll()); }
  applyMapping(cfg) { this._all(i => i.applyMapping(cfg)); }
  loadMapping(url) {
    /* ONE FETCH, APPLIED TO BOTH. Loading it per instance would ask the network
       for the same file once per player, and the second answer would race the
       first for no reason -- the mapping is a property of the pad profile, not
       of who is holding it. */
    const first = this.list[0];
    if (!first) return Promise.resolve(false);
    return first.loadMapping(url).then(ok => {
      if (ok) for (let k = 1; k < this.list.length; k++) {
        this.list[k].applyMapping({ deadzone: first.deadzone,
                                    axes: { moveX: first.moveAxis.x, moveY: first.moveAxis.y,
                                            invertX: first.moveAxis.invertX,
                                            invertY: first.moveAxis.invertY },
                                    gamepadMap: first.padMap });
      }
      return ok;
    });
  }

  takeAttack()   { return this._any(i => i.takeAttack()); }
  takeUpPress()  { return this._any(i => i.takeUpPress()); }
  takeDownPress(){ return this._any(i => i.takeDownPress()); }
  takeJump()     { return this._any(i => i.takeJump()); }
  takePickup()   { return this._any(i => i.takePickup()); }
  takeSpecial()  { return this._any(i => i.takeSpecial()); }
  takePause()    { return this._any(i => i.takePause()); }
  takeMute()     { return this._any(i => i.takeMute()); }
  takeSwap()     { return this._any(i => i.takeSwap()); }
  takeAnyPress() { return this._any(i => i.takeAnyPress()); }

  /** A number key names a ROOM, so the merge is the first real answer rather
      than a boolean -- but every member is still read, for the rule above. */
  takeRoomJump() {
    let out = -1;
    for (const i of this.list) { const r = i.takeRoomJump(); if (out < 0) out = r; }
    return out;
  }

  /* THE TYPED CHEAT IS THE KEYBOARD'S AND ONLY THE KEYBOARD'S, so it is asked
     of whichever member owns it. Arming every member is harmless -- an instance
     with no keyboard records nothing. */
  armCheat(on) { this._all(i => i.armCheat(on)); }
  takeCheat(word) { return this._any(i => i.takeCheat(word)); }
}
