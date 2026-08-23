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
    this._jumpQueued = false;
    this._pauseQueued = false;
    this._muteQueued = false;
    this._pickupQueued = false;
    this._roomJump = -1;       // dev: room index requested by a number key
    this._anyPress = false;

    this._kb = { left: false, right: false, up: false, down: false };
    this._pad = { left: false, right: false, up: false, down: false };
    this._padPrev = {};

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
      const m = MOVE[e.code];
      if (m) { e.preventDefault(); this._kb[m] = true; return; }
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
      else if (e.code === 'KeyP' || e.code === 'Escape') { this._pauseQueued = true; }
      /* MUTE, AND DELIBERATELY NOT AN "ANY PRESS". Every end screen in this
         game is dismissed by pressing anything, so a mute that fell through to
         the branch below would skip the board you muted the music to read. */
      else if (e.code === 'KeyM') { this._muteQueued = true; }
      else { this._anyPress = true; }
    });
    t.addEventListener('keyup', e => {
      const m = MOVE[e.code];
      if (m) { e.preventDefault(); this._kb[m] = false; return; }
      if (e.code === 'KeyC') this.debug = false;
    });
    if (typeof window !== 'undefined') {
      window.addEventListener('gamepaddisconnected', () => { this._padPrev = {}; });
    }
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

  poll() {
    const pad = this._pad;
    pad.left = pad.right = pad.up = pad.down = false;

    const gp = this._firstPad();
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
        }
        this._padPrev[i] = down;
        if (!down) continue;
        if (act === 'up' || act === 'down' || act === 'left' || act === 'right') {
          pad[act] = true;
        }
      }
    } else {
      this._padPrev = {};
    }

    const kb = this._kb;
    this.left = kb.left || pad.left;
    this.right = kb.right || pad.right;
    this.up = kb.up || pad.up;
    this.down = kb.down || pad.down;
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
  takeAnyPress() { const a = this._anyPress; this._anyPress = false; return a; }

  /** Drop anything queued — used when a screen changes, so a key pressed on the
      way out of one state does not act on the state it lands in. */
  flush() {
    this._attackQueued = this._jumpQueued = this._pickupQueued = false;
    this._pauseQueued = this._anyPress = false;
    this._roomJump = -1;
  }
}
