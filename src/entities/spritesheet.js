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
        const ANIMS = ['idle', 'walk', 'grab', 'grab_heavy', 'throw'];
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

        // Build a sprite-data record for (row, col), or null if missing.
        const makeSprite = (row, col, flipped) => {
            const f = data.frames[row * NCOLS + col];
            if (!f) return null;
            return {
                image: img,
                sx: f.x, sy: f.y, sw: f.w, sh: f.h,
                width: Math.round(f.w * scale),
                height: Math.round(f.h * scale),
                flipped
            };
        };

        for (let r = 0; r < ROWS.length; r++) {
            const { dir, mirror } = ROWS[r];
            for (const flipped of (mirror ? [false, true] : [false])) {
                const name = flipped ? mirror : dir;
                const idle = makeSprite(r, IDLE_COL, flipped);
                if (idle) {
                    sprites[`${name}_idle`].push(idle);
                    // Walk reuses idle until walk-cycle frames are authored.
                    sprites[`${name}_walk`].push({ ...idle });
                }
                for (const c of GRAB_COLS) {
                    const s = makeSprite(r, c, flipped);
                    if (s) sprites[`${name}_grab`].push(s);
                }
                for (const c of GRAB_HEAVY_COLS) {
                    const s = makeSprite(r, c, flipped);
                    if (s) sprites[`${name}_grab_heavy`].push(s);
                }
                for (const c of THROW_COLS) {
                    const s = makeSprite(r, c, flipped);
                    if (s) sprites[`${name}_throw`].push(s);
                }
            }
        }

        return { sprites };
    }
}

window.SpriteSheet = SpriteSheet;
