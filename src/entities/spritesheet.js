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
}

window.SpriteSheet = SpriteSheet;
