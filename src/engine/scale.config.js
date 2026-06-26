/**
 * scale.config.js — single source of truth for art → world scaling.
 *
 * Historically each art source had its own scale: the map/placement art used
 * one factor (~0.6 → 0.3), the character another, the sheets others still
 * (0.25 / 0.45). The new art pipeline authors EVERY drawing at the same aspect
 * ratio, so one global knob can size them all consistently.
 *
 * This file is the place that knob lives. Until the new uniform-aspect art
 * fully lands, the per-source values below reproduce today's exact sizes (so
 * nothing shifts visually). NEW-ART SWAP: once every sheet is re-authored at the
 * shared aspect ratio, fold the per-source factors into `scale` and delete them.
 */
window.ART = {
    // Global art→world scale. 1 = draw authored art at its native size. This is
    // the one knob the new uniform art will hang off of.
    scale: 1,

    // Per-source downscale of each shipped '-game' sheet relative to its defs'
    // author-resolution coordinates (crop rects are multiplied by these at draw
    // time — see Game.getSheetScale). Temporary: collapses into `scale` once the
    // sheets are uniform.
    sheetScales: {
        block_sheet: 0.25,
        mapobjects_sheet: 0.45,
        coconut_sheet: 0.45,
    },

    // Character pack render sizes (the sprite bounding box, in world px). The
    // collision footprint is derived from these via collision-config.json ratios,
    // so changing a size here rescales the hitbox with it. Coconut width is
    // derived per-frame from the source aspect; only its height is pinned.
    character: { width: 145, height: 109 },
    coconut:   { width: 203, height: 164 },
};
