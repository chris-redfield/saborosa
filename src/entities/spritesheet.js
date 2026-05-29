/**
 * SpriteSheet - Loads player sprites from a single sheet + JSON definition.
 *
 * The JSON file defines idle frames per direction (down, up, right, left).
 * Walk frames reuse the idle sprite until dedicated walk frames are available.
 */
class SpriteSheet {
    constructor(game) {
        this.game = game;
    }

    loadSprites(targetWidth, targetHeight) {
        const img = this.game.getImage('character_sheet');
        const data = this.game.getJSON('character_sprites');

        const sprites = {
            down_idle: [], down_walk: [],
            up_idle: [], up_walk: [],
            right_idle: [], right_walk: [],
            left_idle: [], left_walk: [],
            down_right_idle: [], down_right_walk: [],
            down_left_idle: [], down_left_walk: [],
            up_right_idle: [], up_right_walk: [],
            up_left_idle: [], up_left_walk: []
        };

        if (!img || !data) return { sprites };

        const DIRECTIONS = ['down', 'up', 'right', 'left', 'down_right', 'down_left', 'up_right', 'up_left'];

        for (const dir of DIRECTIONS) {
            const idleFrames = data[`${dir}_idle`];
            if (!idleFrames || idleFrames.length === 0) continue;

            const f = idleFrames[0];
            const spriteData = {
                image: img,
                sx: f.x,
                sy: f.y,
                sw: f.w,
                sh: f.h,
                width: targetWidth,
                height: targetHeight,
                flipped: false
            };

            sprites[`${dir}_idle`].push(spriteData);

            // Use walk frames from JSON if available, otherwise reuse idle
            const walkFrames = data[`${dir}_walk`];
            if (walkFrames && walkFrames.length > 0) {
                for (const wf of walkFrames) {
                    sprites[`${dir}_walk`].push({
                        image: img,
                        sx: wf.x,
                        sy: wf.y,
                        sw: wf.w,
                        sh: wf.h,
                        width: targetWidth,
                        height: targetHeight,
                        flipped: false
                    });
                }
            } else {
                // Reuse idle as single walk frame (no animation)
                sprites[`${dir}_walk`].push({ ...spriteData });
            }
        }

        const loaded = DIRECTIONS.filter(d => sprites[`${d}_idle`].length > 0);
        console.log('SpriteSheet loaded directions:', loaded.join(', '));

        return { sprites };
    }

    /**
     * Loads the coconut character (saborosa-chat-002-2.png).
     *
     * The JSON is a flat `frames` array indexed in reading order — 5 rows ×
     * 10 columns. Rows are directions; the last column of each row is the
     * idle pose, columns 0–8 are walk-cycle frames (wired later).
     * Side-facing rows face LEFT, so they mirror to produce the right side.
     *
     * Render width is computed per-direction from the source aspect ratio so
     * the sprite doesn't distort; render height is uniform = targetHeight.
     */
    loadCoconutSprites(targetHeight) {
        const img = this.game.getImage('coconut_sheet');
        const data = this.game.getJSON('coconut_sprites');

        const sprites = {};
        const ANIMS = ['idle', 'walk', 'grab', 'grab_heavy', 'throw', 'action'];
        const DIRS = ['down', 'up', 'right', 'left',
                      'down_right', 'down_left', 'up_right', 'up_left'];
        for (const d of DIRS) for (const a of ANIMS) sprites[`${d}_${a}`] = [];

        if (!img || !data || !data.frames) return { sprites };

        const NCOLS = data.cols || 10;
        const IDLE_COL = NCOLS - 1; // last column of each row holds the idle pose

        // Animation → ordered column sequence within a row.
        //   idle:       last column (single frame)
        //   grab:       9 → 0 → 1 → 2       (lift; last frame held while carrying)
        //   grab_heavy: 9 → 0 → 1 → 2 → 3   (heavy lift; col 3 = flattened carry pose)
        const GRAB_COLS = [IDLE_COL, 0, 1, 2];
        const GRAB_HEAVY_COLS = [IDLE_COL, 0, 1, 2, 3];
        //   throw: 4 → 5 → 6 → 7 → 8   (charged power throw; returns to idle)
        const THROW_COLS = [4, 5, 6, 7, 8];
        //   action: 0   (first column — the empty-handed "reach" gesture played
        //   when Space is pressed with nothing in range to pick up)
        const ACTION_COLS = [0];

        // Row index → primary direction + (optional) mirrored direction.
        const ROWS = [
            { dir: 'down',      mirror: null },
            { dir: 'down_left', mirror: 'down_right' },
            { dir: 'left',      mirror: 'right' },
            { dir: 'up_left',   mirror: 'up_right' },
            { dir: 'up',        mirror: null }
        ];

        // Single scale factor for ALL frames, derived from the idle column's
        // source height (col 9 is uniform across rows). Applying the same
        // factor to every frame's width AND height preserves both aspect ratio
        // and relative size, so the idle renders exactly targetHeight tall
        // while differently-shaped poses (e.g. the flattened heavy-carry frame)
        // stay proportional instead of being stretched to a fixed height.
        const refFrame = data.frames[IDLE_COL]; // row 0, idle column
        const scale = (refFrame && refFrame.h) ? targetHeight / refFrame.h : 1;
        // Idle source aspect (h/w). A frame much flatter than this is a vertical
        // squish (the heavy-carry crouch) and gets anchored differently — see
        // makeSprite. SQUISH_RATIO 0.85 catches col 3 (~0.62) but not the
        // throw-release frame (~0.71).
        const idleAspect = (refFrame && refFrame.w) ? refFrame.h / refFrame.w : 1;
        const SQUISH_RATIO = 0.85;

        // --- Body-baseline alignment ---------------------------------------
        // Frames are tightly cropped, so a pose where the arms reach down/
        // forward (the grab/action poses on down & side facings) leaves the
        // green body sitting higher inside the box than in the idle pose.
        // Bottom-anchoring the raw frame at render time would then shove the
        // whole body upward. To keep the body planted, locate each frame's
        // green body and store a vertical correction `vAlign` relative to that
        // facing's idle frame; render shifts the frame down by it.
        //
        // The reference is the green CENTROID (centre of mass), not the lowest
        // green pixel: in the grab/action poses a yellow arm crosses in front
        // of the ball's lower edge, so the lowest visible green sits too high
        // and under-corrects (worst on the sides). The centroid is robust to
        // that occlusion. Wrapped in try/catch — if the canvas can't be read
        // (tainted/unsupported), vAlign stays 0 and render falls back to the
        // old raw bottom-anchoring.
        let scanCtx = null;
        try {
            const c = document.createElement('canvas');
            scanCtx = c.getContext('2d', { willReadFrequently: true });
            if (scanCtx) scanCtx._canvas = c;
        } catch (e) { scanCtx = null; }
        // bodyBaseline(image, frame): { centroid, bottom } — scaled px from the
        // green centroid / lowest green pixel to the frame's bottom edge (both
        // 0 if unscannable). Cached per frame by sheet + coordinates so it works
        // across both the main sheet and the walk sheet.
        const baselineCache = {};
        const bodyBaseline = (image, f) => {
            if (!f || !image) return { centroid: 0, bottom: 0 };
            const key = (image === img ? 'a' : 'b') + ':' + f.x + ',' + f.y;
            if (key in baselineCache) return baselineCache[key];
            let res = { centroid: 0, bottom: 0 };
            if (scanCtx) {
                try {
                    const cv = scanCtx._canvas;
                    cv.width = f.w; cv.height = f.h;
                    scanCtx.clearRect(0, 0, f.w, f.h);
                    scanCtx.drawImage(image, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
                    const d = scanCtx.getImageData(0, 0, f.w, f.h).data;
                    let sumY = 0, count = 0, low = -1;
                    for (let y = 0; y < f.h; y++) {
                        for (let x = 0; x < f.w; x++) {
                            const i = (y * f.w + x) * 4;
                            const R = d[i], G = d[i + 1], B = d[i + 2], A = d[i + 3];
                            if (A > 128 && G > 90 && G > R + 20 && G > B + 20) { sumY += y; count++; low = y; }
                        }
                    }
                    if (count > 0) res = { centroid: (f.h - sumY / count) * scale, bottom: (f.h - 1 - low) * scale };
                } catch (e) { res = { centroid: 0, bottom: 0 }; }
            }
            baselineCache[key] = res;
            return res;
        };

        // Build a sprite-data record from any sheet for a given frame, or null.
        // vAlign keeps this frame's body on the same line as the row's idle
        // pose. Upright poses align by the green CENTROID (robust to an arm
        // occluding the ball's lower edge). A frame much flatter than idle is a
        // vertical squish (heavy-carry crouch) and aligns by the body BOTTOM
        // instead — so it compresses onto the ground rather than floating up,
        // which centroid-alignment would do for a shorter body. Scale and the
        // squish/idle references come from the main sheet, so frames from the
        // walk sheet (same drawn resolution) stay consistent in size + baseline.
        const makeSprite = (image, f, flipped, idleBase) => {
            if (!f) return null;
            const base = bodyBaseline(image, f);
            const squished = (f.h / f.w) < SQUISH_RATIO * idleAspect;
            const vAlign = squished
                ? Math.round(base.bottom - idleBase.bottom)
                : Math.round(base.centroid - idleBase.centroid);
            return {
                image,
                sx: f.x, sy: f.y, sw: f.w, sh: f.h,
                width: Math.round(f.w * scale),
                height: Math.round(f.h * scale),
                vAlign,
                flipped
            };
        };

        // Optional walk sheet: 4 cols × 5 rows, same row→direction order. The
        // walk cycle is column 0 → idle → column 2 (per the design), looping.
        const walkImg = this.game.getImage('coconut_walk_sheet');
        const walkData = this.game.getJSON('coconut_walk_sprites');
        const WALK_NCOLS = (walkData && walkData.cols) || 4;
        const WALK_COLS = [0, 2]; // 1st & 3rd columns — the two stride poses
        const walkFrame = (row, col) =>
            (walkData && walkData.frames) ? walkData.frames[row * WALK_NCOLS + col] : null;

        for (let r = 0; r < ROWS.length; r++) {
            const { dir, mirror } = ROWS[r];
            const idleBase = bodyBaseline(img, data.frames[r * NCOLS + IDLE_COL]);
            for (const flipped of (mirror ? [false, true] : [false])) {
                const name = flipped ? mirror : dir;
                const idle = makeSprite(img, data.frames[r * NCOLS + IDLE_COL], flipped, idleBase);
                if (idle) sprites[`${name}_idle`].push(idle);

                // Walk cycle: stride pose (col 0) → idle → stride pose (col 2),
                // from the walk sheet. Falls back to a static idle frame if the
                // walk sheet is missing or a frame can't be built.
                const w0 = makeSprite(walkImg, walkFrame(r, WALK_COLS[0]), flipped, idleBase);
                const w2 = makeSprite(walkImg, walkFrame(r, WALK_COLS[1]), flipped, idleBase);
                if (w0 && idle && w2) {
                    sprites[`${name}_walk`].push(w0, idle, w2);
                } else if (idle) {
                    sprites[`${name}_walk`].push({ ...idle });
                }

                for (const c of GRAB_COLS) {
                    const s = makeSprite(img, data.frames[r * NCOLS + c], flipped, idleBase);
                    if (s) sprites[`${name}_grab`].push(s);
                }
                for (const c of GRAB_HEAVY_COLS) {
                    const s = makeSprite(img, data.frames[r * NCOLS + c], flipped, idleBase);
                    if (s) sprites[`${name}_grab_heavy`].push(s);
                }
                for (const c of THROW_COLS) {
                    const s = makeSprite(img, data.frames[r * NCOLS + c], flipped, idleBase);
                    if (s) sprites[`${name}_throw`].push(s);
                }
                for (const c of ACTION_COLS) {
                    const s = makeSprite(img, data.frames[r * NCOLS + c], flipped, idleBase);
                    if (s) sprites[`${name}_action`].push(s);
                }
            }
        }

        return { sprites };
    }
}

window.SpriteSheet = SpriteSheet;
