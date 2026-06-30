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
        // getDrawable: ImageBitmap (decode-once) — sprite records capture this
        // reference and draw it every frame.
        const img = this.game.getDrawable('character_sheet');
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
     * Loads a full-behaviour character pack from one assets-v2 sheet + defs.
     *
     * The JSON is a flat `frames` array in reading order — 5 rows × 9 columns
     * (tools/build-character-defs.py). Rows are directions; columns are poses.
     * Side-facing rows face LEFT, so they mirror to produce the right side.
     * Both playable characters (tomato, coconut) share this exact layout, so
     * the tomato gets the same grab/throw/carry behaviours the coconut had.
     *
     * `worldScale` is world-px per author-px: the new art is drawn in the SAME
     * canvas as the map layers, so applying the map's author→world scale (minus
     * the perspective sizeScale) keeps the character proportional to the map.
     * Every frame renders at its own source size × worldScale, so differently
     * shaped poses (e.g. the flattened heavy-carry frame) stay proportional.
     *
     * `bodyType` ('tan' | 'red' | 'green') selects the body-color test used for
     * feet-baseline alignment below — each character's body is a different hue.
     *
     * Returns { sprites, width, height } where width/height are the idle
     * (row 0, col 0) render dimensions — the pack's bounding box.
     */
    loadCharacterPack(sheetKey, jsonKey, worldScale, bodyType) {
        // getDrawable: ImageBitmap (decode-once). Used both for the bodyBaseline
        // scan below and per-frame draws.
        const img = this.game.getDrawable(sheetKey);
        const data = this.game.getJSON(jsonKey);

        const sprites = {};
        const ANIMS = ['idle', 'walk', 'grab', 'grab_heavy', 'throw', 'action'];
        const DIRS = ['down', 'up', 'right', 'left',
                      'down_right', 'down_left', 'up_right', 'up_left'];
        for (const d of DIRS) for (const a of ANIMS) sprites[`${d}_${a}`] = [];

        if (!img || !data || !data.frames) return { sprites, width: 0, height: 0 };

        // Defs coords are in the shipped sheet's space already (the cropped
        // game PNG is 1:1 with the defs — sheetScale 1.0), but keep the mapping
        // general so a future downscaled sheet still works.
        const S = this.game.getSheetScale(sheetKey);
        const frames = data.frames.map(f =>
            f && { x: f.x * S, y: f.y * S, w: f.w * S, h: f.h * S });

        const NCOLS = data.cols || 9;
        const IDLE_COL = 0; // col 0 is the resting pose (and the lift start)

        // Animation → ordered column sequence within a row.
        //   idle:       col 0 (single frame)
        //   grab:       0 → 1 → 2       (lift; last frame held while carrying)
        //   grab_heavy: 0 → 1 → 2 → 3   (heavy lift; col 3 = flattened carry pose)
        const GRAB_COLS = [0, 1, 2];
        const GRAB_HEAVY_COLS = [0, 1, 2, 3];
        //   throw: 4 → 5 → 6 → 7 → 8   (charged power throw; returns to idle)
        const THROW_COLS = [4, 5, 6, 7, 8];
        //   action: 1   (empty-handed "reach" gesture played when Space is
        //   pressed with nothing in range; col 0 is now idle, so use the first
        //   lift pose as the distinct reach beat)
        const ACTION_COLS = [1];

        // Body-color test for the feet-baseline scan — each character's body is
        // a different hue (tan coconut, red tomato), all far from the yellow
        // arms and white cork that would otherwise skew the centroid.
        const isBody = (R, G, B, A) => {
            if (A <= 128) return false;
            if (bodyType === 'red') return R > 150 && R - G > 70 && R - B > 70;
            if (bodyType === 'green') return G > 90 && G > R + 20 && G > B + 20;
            // 'tan' (default): R>G>B monotonic with a non-trivial blue channel
            // (excludes yellow arms, B≈48) and unequal channels (excludes the
            // white cork / grey, R≈G≈B).
            return R > G + 8 && G > B + 8 && B > 90;
        };

        // Row index → primary direction + (optional) mirrored direction.
        const ROWS = [
            { dir: 'down',      mirror: null },
            { dir: 'down_left', mirror: 'down_right' },
            { dir: 'left',      mirror: 'right' },
            { dir: 'up_left',   mirror: 'up_right' },
            { dir: 'up',        mirror: null }
        ];

        // Single scale factor for ALL frames = world-px per author-px. Applying
        // the same factor to every frame's width AND height preserves both
        // aspect ratio and relative size, and ties the on-screen size directly
        // to the map's scale (see worldScale above), so differently-shaped
        // poses (e.g. the flattened heavy-carry frame) stay proportional.
        const refFrame = frames[IDLE_COL]; // row 0, col 0 (idle)
        const scale = worldScale;
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
                            if (isBody(R, G, B, A)) { sumY += y; count++; low = y; }
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

        for (let r = 0; r < ROWS.length; r++) {
            const { dir, mirror } = ROWS[r];
            const idleBase = bodyBaseline(img, frames[r * NCOLS + IDLE_COL]);
            for (const flipped of (mirror ? [false, true] : [false])) {
                const name = flipped ? mirror : dir;
                const idle = makeSprite(img, frames[r * NCOLS + IDLE_COL], flipped, idleBase);
                if (idle) {
                    sprites[`${name}_idle`].push(idle);
                    // Walk reuses the idle frame until the walk sheet is remade.
                    sprites[`${name}_walk`].push({ ...idle });
                }

                for (const c of GRAB_COLS) {
                    const s = makeSprite(img, frames[r * NCOLS + c], flipped, idleBase);
                    if (s) sprites[`${name}_grab`].push(s);
                }
                for (const c of GRAB_HEAVY_COLS) {
                    const s = makeSprite(img, frames[r * NCOLS + c], flipped, idleBase);
                    if (s) sprites[`${name}_grab_heavy`].push(s);
                }
                for (const c of THROW_COLS) {
                    const s = makeSprite(img, frames[r * NCOLS + c], flipped, idleBase);
                    if (s) sprites[`${name}_throw`].push(s);
                }
                for (const c of ACTION_COLS) {
                    const s = makeSprite(img, frames[r * NCOLS + c], flipped, idleBase);
                    if (s) sprites[`${name}_action`].push(s);
                }
            }
        }

        const width = refFrame ? Math.round(refFrame.w * scale) : 0;
        const height = refFrame ? Math.round(refFrame.h * scale) : 0;
        return { sprites, width, height };
    }
}

window.SpriteSheet = SpriteSheet;
