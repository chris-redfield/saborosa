/**
 * Input — keyboard AND gamepad state for the flying dungeon.
 *
 * Held flags (left/right/up/down/firing) are polled each frame; `engaged`
 * latches true on the first movement input (before that the background
 * free-runs). Character-cycle is an edge event, consumed once via takeCycle().
 *
 * The portable classes read a plain object shape { left,right,up,down,firing,
 * engaged } — so in the main game you can feed them its own input just as easily.
 * That shape is exactly why the gamepad needed no changes anywhere else: the
 * fruit select, the plane and the shell all read those five fields and neither
 * knows nor cares which device set them.
 *
 * ⚠️ KEYBOARD AND PAD ARE TRACKED SEPARATELY AND OR'D TOGETHER. They cannot
 * share the public fields: the keyboard writes them on key events while the pad
 * rewrites them every frame from a poll, so a single set of flags would have the
 * pad's "nothing held" clear a key the player is still holding down — the stick
 * would cancel the keyboard several times a second.
 *
 * GAMEPAD ACTIONS are the main game's, so one mapping file serves both:
 *   up/down/left/right   d-pad, plus the left stick through a deadzone
 *   lift                 FIRE (the same action Space is bound to over there)
 *   cycleCharacter       swap fruit
 * Anything else in the mapping is simply not looked at here.
 *
 * `poll()` MUST BE CALLED ONCE PER FRAME. The Gamepad API has no events for
 * buttons — the only way to see one is to read a fresh snapshot — so nothing
 * about the pad works without it.
 */
class Input {
  constructor(target) {
    this.left = this.right = this.up = this.down = false;
    this.firing = false;
    this.debug = false;       // hold C: show collision boxes + the shot line
    this.engaged = false;
    this._cycleQueued = false;

    // The two halves that get OR'd into the fields above. See the header.
    this._kb = { left: false, right: false, up: false, down: false, firing: false };
    this._pad = { left: false, right: false, up: false, down: false, firing: false };
    this._padPrev = {};       // button index -> was down last frame, for edges
    this._anyPress = false;   // any pad button went down this frame

    // Defaults for a standard-layout pad; a loaded mapping replaces them.
    this.deadzone = 0.45;
    this.moveAxis = { x: 0, y: 1, invertX: false, invertY: false };
    this.padMap = {
      0: 'lift',
      12: 'up', 13: 'down', 14: 'left', 15: 'right',
    };

    this._bind(target || window);
  }

  _bind(t) {
    const MOVE = {
      ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    };
    t.addEventListener('keydown', e => {
      const m = MOVE[e.code];
      if (m) { e.preventDefault(); this._kb[m] = true; this.engaged = true; return; }
      if (e.code === 'Space') { e.preventDefault(); this._kb.firing = true; }
      else if (e.code === 'KeyC') { this.debug = true; }
      else if (e.code === 'Digit1' || e.code === 'Numpad1') { this._cycleQueued = true; }
    });
    t.addEventListener('keyup', e => {
      const m = MOVE[e.code];
      if (m) { e.preventDefault(); this._kb[m] = false; return; }
      if (e.code === 'Space') { e.preventDefault(); this._kb.firing = false; }
      else if (e.code === 'KeyC') { this.debug = false; }
    });
    // Not needed to READ a pad — poll() finds whatever is connected — but
    // dropping the edge state on disconnect stops a button that was held as the
    // cable came out from reading as still down when it comes back.
    if (typeof window !== 'undefined') {
      window.addEventListener('gamepaddisconnected', () => { this._padPrev = {}; });
    }
  }

  /* Apply a controller mapping authored in the main game's
     tools/gamepad-mapper.html and shipped as assets/gamepad-mapping.json —
     the SAME file, not a copy, so a pad set up once works in both.

     Tolerant by design: any missing field keeps its current default, so a
     partial file — or no file at all — can never break input. Accepts either
     `gamepadMap` (index -> action) or `buttons` (action -> index).

     ⚠️ Like the main game's, this REPLACES the button map rather than merging
     into it, and it does not check that `cfg.id` matches the pad actually
     plugged in. So a mapping authored for one controller is applied to whatever
     is connected. That is deliberate — it is what the main game does, and
     matching it was the point — but it is why a different pad may want its own
     mapping re-authored rather than expecting the shipped one to fit. */
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
    if (Object.keys(map).length) this.padMap = map;
  }

  // Fetch and apply a mapping. Never rejects: no file, bad JSON or no network
  // all leave the defaults in place, which is a working standard-layout pad.
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

  /* Read the pad and fold it into the public flags. Once per frame, from the
     shell's loop — the Gamepad API fires no button events, so this poll IS the
     input as far as a controller is concerned. */
  poll() {
    const pad = this._pad;
    pad.left = pad.right = pad.up = pad.down = pad.firing = false;
    this._anyPress = false;

    const gp = this._firstPad();
    if (gp) {
      // Left stick, through the deadzone, as four directions rather than an
      // analogue vector: the plane's own movement is already a normalised
      // eight-way, so there is nothing here that could use the magnitude.
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
        if (down && !this._padPrev[i]) {
          // Edge. Every button counts toward "press anything to continue",
          // mapped or not — a player hunting for the button to skip a screen
          // should not have to find the RIGHT one.
          this._anyPress = true;
          if (this.padMap[i] === 'cycleCharacter') this._cycleQueued = true;
        }
        this._padPrev[i] = down;
        if (!down) continue;
        const act = this.padMap[i];
        if (act === 'lift') pad.firing = true;
        else if (act === 'up' || act === 'down' || act === 'left' || act === 'right') {
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
    this.firing = kb.firing || pad.firing;
    if (pad.left || pad.right || pad.up || pad.down) this.engaged = true;
  }

  // True once per character-cycle press (Digit1, or the mapped pad button).
  takeCycle() { const c = this._cycleQueued; this._cycleQueued = false; return c; }

  /* True once for "any pad button just went down" — the controller's answer to
     the keydown/mousedown listeners the skip and restart screens use, which a
     gamepad does not fire. Consumed, so one press cannot be handled twice in a
     frame. */
  takeAnyPress() { const a = this._anyPress; this._anyPress = false; return a; }
}
