/**
 * Input — keyboard state for the flying dungeon.
 *
 * Held flags (left/right/up/down/firing) are polled each frame; `engaged`
 * latches true on the first movement key (before that the background free-runs).
 * Character-cycle is an edge event, consumed once via takeCycle().
 *
 * The portable classes read a plain object shape { left,right,up,down,firing,
 * engaged } — so in the main game you can feed them its own input just as easily.
 */
class Input {
  constructor(target) {
    this.left = this.right = this.up = this.down = false;
    this.firing = false;
    this.debug = false;       // hold C: show collision boxes + the shot line
    this.engaged = false;
    this._cycleQueued = false;
    this._bind(target || window);
  }

  _bind(t) {
    const MOVE = {
      ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    };
    t.addEventListener('keydown', e => {
      const m = MOVE[e.code];
      if (m) { e.preventDefault(); this[m] = true; this.engaged = true; return; }
      if (e.code === 'Space') { e.preventDefault(); this.firing = true; }
      else if (e.code === 'KeyC') { this.debug = true; }
      else if (e.code === 'Digit1' || e.code === 'Numpad1') { this._cycleQueued = true; }
    });
    t.addEventListener('keyup', e => {
      const m = MOVE[e.code];
      if (m) { e.preventDefault(); this[m] = false; return; }
      if (e.code === 'Space') { e.preventDefault(); this.firing = false; }
      else if (e.code === 'KeyC') { this.debug = false; }
    });
  }

  // True once per character-cycle press.
  takeCycle() { const c = this._cycleQueued; this._cycleQueued = false; return c; }
}
