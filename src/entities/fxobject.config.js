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
    // How many FX are alive on screen at once. THIS is the master "how many /
    // how often" dial — each one lives ~1 cycle then vanishes and is instantly
    // replaced, so a higher count = a busier, more frequent effect.
    //   7  = current (deliberately ridiculous, for dialing in the look)
    //   2  = sparse / occasional
    //   0  = off
    // To make them RARER without fewer-on-screen, also raise the lifetimes below
    // (longer-lived = slower turnover = fewer pop-ins per second).
    count: 7,

    // Fraction of spawns that are the ping-pong ball (the rest are twinkles).
    ballChance: 0.2,

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
        lifeMin: 1.0,       // sec — base lifetime (~one shimmer cycle)
        lifeJitter: 0.6,    // sec — random extra on top (desyncs them)
        speedHz: 1.0,       // shimmer speed
        minOpacity: 0.0,    // opacity floor (0 = can blink fully out)
    },
    ball: {
        fps: 10,            // ping-pong frame rate (grow→shrink→vanish)
        fadeInSec: 0.2,     // quick fade so the pop-in isn't hard (shrink = vanish)
    },
};
