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
        // The character sheets ship cropped 1:1 with their defs (the new art is
        // drawn at small cells in a mostly-empty canvas, so downscaling would
        // only blur it — see tools/build-character-defs.py). 1.0 = no remap.
        coconut_sheet: 1.0,
        tomato_sheet: 1.0,
        eggplant_sheet: 1.0,
        laranja_sheet: 1.0,
        rock_sheet: 1.0,
        bush_sheet: 1.0,
    },

    // === Character sizing — THE knob to tune =================================
    // Both playable characters render at this many world-px per author-px. The
    // character art is drawn in the SAME canvas as the map layers (assets-v2,
    // 5543x4071), so this ties the character size directly to the map:
    //   map draw scale   = backgroundImageRect.w / 5543 = 8815/5543 = 1.5903
    //   perspective bakes a sizeScale of 1.86 (perspective.json) onto sprites
    //   characterWorldScale = 1.5903 / 1.86 = 0.855
    // → the character is exactly map-proportional at the near/bottom (spawn)
    //   plane and shrinks northward via the perspective effect, like the map's
    //   depth. Bump this single number up/down to make BOTH characters (and
    //   their hitboxes, which derive from it) bigger/smaller while keeping them
    //   proportional to each other and the map.
    characterWorldScale: 0.855,

    // Legacy bbox fallbacks (initial frame before the pack loads; also read by
    // tools/main-perspective.html). The live sizes now come from the loader.
    character: { width: 145, height: 109 },
    coconut:   { width: 203, height: 164 },
};
