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

        if (!img || !data || !data.frames) return { sprites };

        const NCOLS = data.cols || 10;
        const IDLE_COL = NCOLS - 1; // last column of each row holds the idle pose

        // Row index → primary direction + (optional) mirrored direction.
        const ROWS = [
            { dir: 'down',      mirror: null },
            { dir: 'down_left', mirror: 'down_right' },
            { dir: 'left',      mirror: 'right' },
            { dir: 'up_left',   mirror: 'up_right' },
            { dir: 'up',        mirror: null }
        ];

        for (let r = 0; r < ROWS.length; r++) {
            const f = data.frames[r * NCOLS + IDLE_COL];
            if (!f) continue;
            const renderW = Math.round(targetHeight * (f.w / f.h));
            const base = {
                image: img,
                sx: f.x, sy: f.y, sw: f.w, sh: f.h,
                width: renderW, height: targetHeight,
                flipped: false
            };
            sprites[`${ROWS[r].dir}_idle`].push(base);
            // Walk reuses idle until we wire in the walk-cycle frames (cols 0–8).
            sprites[`${ROWS[r].dir}_walk`].push({ ...base });

            if (ROWS[r].mirror) {
                const mir = { ...base, flipped: true };
                sprites[`${ROWS[r].mirror}_idle`].push(mir);
                sprites[`${ROWS[r].mirror}_walk`].push({ ...mir });
            }
        }

        return { sprites };
    }
}

window.SpriteSheet = SpriteSheet;
