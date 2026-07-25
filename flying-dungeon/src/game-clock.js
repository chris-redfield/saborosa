/**
 * GameClock — the run's own sense of time (PORTABLE CORE).
 *
 * Deliberately NOT the wall clock. Two reasons it exists as its own thing
 * rather than a counter in the shell:
 *
 *  1. It ticks at its own RATE. A game second is not a real second — at
 *     gameClockRate 1.1 the run clock gains 10% on the wall, so a minute of
 *     real play reads 01:06.
 *  2. It is meant to be SCRUBBABLE. The planned rewind feature moves the run
 *     backwards through time, so the clock has to be something you can wind
 *     back and read from, not a value that only ever accumulates forward.
 *     rewind()/seek() are here for that; nothing calls them yet.
 *
 * advance() returns the GAME delta for the step it just took, so a caller that
 * wants to run on game time can feed that to its systems instead of the real
 * dt. See the note in game.js about which systems do and don't yet.
 *
 * Dependencies injected (config). No DOM, no globals.
 */
class GameClock {
  constructor(cfg) {
    this.cfg = cfg;
    this.ms = 0;                       // game time elapsed
    this.rate = cfg.gameClockRate;     // game ms per real ms
    this.running = false;
  }

  start()  { this.running = true; }
  pause()  { this.running = false; }
  resume() { this.running = true; }
  reset()  { this.ms = 0; this.running = false; }

  now() { return this.ms; }

  // Step the clock by a REAL delta. Returns the game delta actually applied
  // (0 while paused), so callers can drive game-time systems off the same step
  // instead of recomputing the scaling.
  advance(realDt) {
    if (!this.running) return 0;
    const gameDt = realDt * this.rate;
    this.ms += gameDt;
    return gameDt;
  }

  /* --- Rewind -------------------------------------------------------------
     TIME IS ALLOWED TO GO NEGATIVE. These used to clamp at 0 on the assumption
     that a run cannot start before it started — but shooting coins winds the
     clock back, and winding it back past zero is the point rather than an error
     to guard against. Below zero the HUD reads -HH:MM:SS and the world runs
     backwards.

     Everything downstream already copes: the colour drains clamp their
     progress at 0, so negative time simply means full colour, and the time-over
     test is a `>=` that negative time is nowhere near. */
  rewind(gameMs) { this.ms -= gameMs; return this.ms; }
  seek(gameMs)   { this.ms = gameMs; return this.ms; }

  // Below zero: the run is running backwards.
  isReversed() { return this.ms < 0; }
}
