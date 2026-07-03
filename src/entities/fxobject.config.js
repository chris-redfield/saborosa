/**
 * Tunable parameters for the ambient FX objects (assets-003) — the shimmering
 * shadows/clippy and ping-ponging balls that randomly pop in around the player.
 *
 * This is the "dial box" for how the FX FEEL: how many, how often, how big, and
 * how they flicker. The STRUCTURE (which sprites exist, their boxes, the ball's
 * frame order) stays in assets/saborosa-assets-003-fx.json — authored in
 * tools/fx-lab.html. Same split as the intro: intro.config.js holds feel,
 * intro.js holds logic. Loaded as a global before fxobject.js (see index.html).
 *
 * Values here are DEFAULTS; main.js may override per-stage via
 * `new FxManager(game, { count, scale, ... })`.
 */
window.FX_JUICE = {
    // ── FREQUENCY ───────────────────────────────────────────────────────────
    // MAX number of FX alive on screen at once (a cap, not a target). 0 = off.
    count: 2,

    // How OFTEN a new one pops in: a random quiet gap between appearances. THIS
    // is what leaves the screen empty between FX — raise it for rarer pop-ins,
    // lower it toward 0 for a constant stream. A pop-in fires every
    //   spawnGapMin .. spawnGapMin+spawnGapJitter  seconds (when under `count`).
    spawnGapMin: 2.0,      // sec — minimum quiet gap
    spawnGapJitter: 3.0,   // sec — random extra on top (so the timing varies)

    // Fraction of spawns that are the ping-pong ball (the rest are twinkles).
    ballChance: 0.2,

    // Which art sheet(s) the in-game FX spawn from:
    //   'faint' = the V2 (faint outline) sheet only
    //   'bold'  = the bold (assets-003) sheet only
    //   'both'  = mix of the two (each spawn picks one at random)   ← default
    // The bold sheet is only loaded by the game when this is 'bold'/'both'
    // (boxes are shared, so only the art style differs). Both sheets always
    // live in tools/fx-lab.html for inspection regardless of this setting.
    // NOTE: the ball (the spiky splash/opening burst) is deliberately kept OFF
    // the bold sheet — it only ever spawns from the faint sheet (see
    // fxobject.js _spawn). Twinkles (shadows + clip) mix both sheets freely.
    sheets: 'both',

    // ── SIZE ────────────────────────────────────────────────────────────────
    // World scale. assets-003 crops are large (tallest shadow streak is 1760px
    // native), so this is small — ~player-sized at 0.15. Note: this is NOT the
    // 0.6 used by the decorative map assets; 0.6 here would be far too big.
    scale: 0.15,
    scaleJitter: 0.5,   // per-instance variety: actual = scale * (0.8 .. 0.8+this)

    // How far across the viewport they scatter, as a fraction of the half-view
    // (scaled by the camera zoom so it tracks what's actually on screen).
    spread: 0.85,

    // ── FLICKER / ANIMATION ───────────────────────────────────────────────────
    // Each FX plays ONCE then vanishes (random per-instance lifetime can come
    // later — bump lifeJitter for a taste of it).
    twinkle: {
        lifeMin: 1.0,       // sec — base lifetime
        lifeJitter: 0.6,    // sec — random extra on top (desyncs them)
        minOpacity: 0.0,    // opacity when unlit (0 = blinks fully out)
        // The transition does NOT fade smoothly — it FLICKERS in and back out,
        // like a faulty bulb sputtering on then dying. On/off is re-rolled every
        // intervalMin..intervalMin+intervalJitter seconds; the odds of being lit
        // rise as it comes in and fall as it leaves (solid through the middle).
        // Smaller intervals = faster, more frantic flicker.
        flicker: {
            intervalMin: 0.0,      // sec — 0 = re-roll basically every frame (strobe)
            intervalJitter: 0.016, // sec — tiny random extra (~1 frame) so it isn't perfectly regular
        },
    },
    ball: {
        fps: 10,            // ping-pong frame rate (grow→shrink→vanish)
        fadeInSec: 0.2,     // quick fade so the pop-in isn't hard (shrink = vanish)
    },
};
