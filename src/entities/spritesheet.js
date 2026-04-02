/**
 * SpriteSheet - Loads Billy Soco sprites from per-direction strip files.
 *
 * Each strip file (e.g. facing_down.png) contains frames laid out horizontally:
 *   [idle] [walk1] [walk2] [walk3]
 * All frames are FRAME_W x FRAME_H with SPACING px gaps between them.
 */
class SpriteSheet {
    constructor(game) {
        this.game = game;
    }

    loadSprites(targetWidth, targetHeight) {
        const FRAME_W = 55;
        const FRAME_H = 85;
        const SPACING = 10;
        const DIRECTIONS = ['down', 'up', 'right', 'left'];

        const sprites = {
            down_idle: [], down_walk: [],
            up_idle: [], up_walk: [],
            right_idle: [], right_walk: [],
            left_idle: [], left_walk: []
        };

        for (const dir of DIRECTIONS) {
            const img = this.game.getImage(`facing_${dir}`);
            if (!img) continue;

            // Frame 0 = idle, frames 1-3 = walk
            const numFrames = Math.round((img.width + SPACING) / (FRAME_W + SPACING));

            for (let i = 0; i < numFrames; i++) {
                const sx = i * (FRAME_W + SPACING);
                const spriteData = {
                    image: img,
                    sx: sx,
                    sy: 0,
                    sw: FRAME_W,
                    sh: FRAME_H,
                    width: targetWidth,
                    height: targetHeight,
                    flipped: false
                };

                if (i === 0) {
                    sprites[`${dir}_idle`].push(spriteData);
                } else {
                    sprites[`${dir}_walk`].push(spriteData);
                }
            }
        }

        return { sprites };
    }
}

window.SpriteSheet = SpriteSheet;
