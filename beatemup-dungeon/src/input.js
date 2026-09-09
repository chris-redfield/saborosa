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
class Input {
  constructor(target) {
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
    const MOVE = {
      ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    };
    t.addEventListener('keydown', e => {
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
        e.preventDefault(); this._pickupQueued = true; this._anyPress = true;
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
      const m = MOVE[e.code];
      if (m) { e.preventDefault(); this._kb[m] = false; return; }
      if (e.code === 'KeyJ' || e.code === 'KeyZ' || e.code === 'Space') this._attackHeld = false;
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
  releaseAll() {
    this._kb.left = this._kb.right = this._kb.up = this._kb.down = false;
    this._pad.left = this._pad.right = this._pad.up = this._pad.down = false;
    this.left = this.right = this.up = this.down = false;
    this._padPrev = {};
    this._attackHeld = false;
    this._padHeldLift = false;
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

  _firstPad() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    if (!pads) return null;
    for (const p of pads) if (p) return p;
    return null;
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
    const gp = this._shouldReadPad() ? this._firstPad() : null;
    if (gp) {
      const ax = this.moveAxis;
      let rx = gp.axes[ax.x] || 0, ry = gp.axes[ax.y] || 0;
      if (ax.invertX) rx = -rx;
      if (ax.invertY) ry = -ry;
      if (rx < -this.deadzone) pad.left = true;
      else if (rx > this.deadzone) pad.right = true;
      if (ry < -this.deadzone) pad.up = true;
      else if (ry > this.deadzone) pad.down = true;

      const btns = gp.buttons || [];
      for (let i = 0; i < btns.length; i++) {
        const down = !!(btns[i] && btns[i].pressed);
        const act = this.padMap[i];
        if (down && !this._padPrev[i]) {
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
        this._padPrev[i] = down;
        if (act === 'lift') padLift = padLift || down;
        if (!down) continue;
        if (act === 'up' || act === 'down' || act === 'left' || act === 'right') {
          pad[act] = true;
        }
      }
    } else {
      this._padPrev = {};
    }
    this._padHeldLift = padLift;

    const kb = this._kb;
    this.left = kb.left || pad.left;
    this.right = kb.right || pad.right;
    this.up = kb.up || pad.up;
    this.down = kb.down || pad.down;
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
  takeJump() { const j = this._jumpQueued; this._jumpQueued = false; return j; }
  takePickup() { const p = this._pickupQueued; this._pickupQueued = false; return p; }
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
    this._pauseQueued = this._anyPress = false;
    this._roomJump = -1;
  }
}

/* HOW MANY TYPED LETTERS ARE REMEMBERED. Only ever compared with `endsWith`, so
   this is a cap on the buffer and not the length of any code -- it needs to be
   at least as long as the longest word `takeCheat` is asked about, and every
   character past that is just room to mistype. */
Input.CHEAT_MAX = 32;
