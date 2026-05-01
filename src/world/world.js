/**
 * World - Seamless world with block-based loading
 *
 * Supports infinite stages (3x3 around player) and finite stages (predefined blocks with lava borders).
 * Camera follows the player. Finite stages get camera clamping.
 */

const BLOCK_W = 1280;
const BLOCK_H = 720;
const LAVA_W = 40;
const STACK_OFFSET = 19; // hsY rounded — height of one cube depth layer

class WorldBlock {
    constructor(xCoord, yCoord) {
        this.xCoord = xCoord;
        this.yCoord = yCoord;
        this.entities = [];
    }

    addEntity(entity) {
        this.entities.push(entity);
    }
}

class World {
    constructor(game, stage) {
        this.game = game;
        this.stage = stage;
        this.blocks = {};
        this.currentBlockX = 0;
        this.currentBlockY = 0;

        this.cameraX = 0;
        this.cameraY = 0;

        // Cache valid block keys for finite stages
        this._validBlocks = null;
        this._walkableBlocks = null;
        if (stage.type === 'finite' && stage.blocks) {
            this._validBlocks = new Set(stage.blocks.map(b => `${b[0]},${b[1]}`));
            if (stage.walkableBlocks) {
                this._walkableBlocks = new Set(stage.walkableBlocks.map(b => `${b[0]},${b[1]}`));
            }
        }
    }

    _isValidBlock(bx, by) {
        if (this.stage.type === 'infinite') return true;
        return this._validBlocks.has(`${bx},${by}`);
    }

    // --- Zone sampling (Phase 1: color-coded terrain zones) ---
    //
    // Reads the stage's background image as the source of truth for terrain
    // behavior. Each colored region classifies into one of the Zone enum values.
    // Classification runs in HSV space to tolerate hand-drawn color variance
    // and anti-aliased edges.

    _ensureZoneData() {
        if (this._zoneData !== undefined) return;
        this._zoneData = null;
        if (!this.stage.backgroundImage) return;
        const img = this.game.getImage(this.stage.backgroundImage);
        if (!img || !img.naturalWidth) return;
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const c = canvas.getContext('2d');
        c.drawImage(img, 0, 0);
        try {
            this._zoneData = c.getImageData(0, 0, canvas.width, canvas.height);
        } catch (err) {
            console.error('Zone data sampling failed:', err);
            this._zoneData = null;
        }
    }

    // World-Y of the image midline. Used as both the "high zone" boundary
    // and the landing Y for fall-behind drops.
    getMidlineWorldY() {
        this._ensureZoneData();
        if (!this._zoneData) return 0;
        const rect = this.stage.backgroundImageRect;
        if (!rect) return 0;
        return rect.y + rect.h * 0.5;
    }

    // Sample the overlay PNG (which already encodes the mountain silhouette
    // as its opaque pixels) once at first use, and compute a per-column
    // boolean: "is column X part of the mountain shadow?"
    //
    // The classifier-based version this replaces was tripping on isolated
    // outline / anti-alias pixels far outside the visible silhouette,
    // trapping the player behind the mountain forever. Here we require a
    // minimum contiguous vertical run of opaque pixels in the column so
    // single stray dots can't mark a column as shadow.
    _ensureMountainSilhouette() {
        if (this._mountainSilhouette !== undefined) return;
        this._mountainSilhouette = null;
        const key = this.stage.backgroundOverlayImage;
        if (!key) return;
        const img = this.game.getImage(key);
        if (!img || !img.naturalWidth) return;

        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        let data;
        try {
            data = ctx.getImageData(0, 0, w, h).data;
        } catch (err) {
            console.error('Mountain silhouette sampling failed:', err);
            return;
        }

        // For each column, find the lowest opaque pixel — i.e. the bottom
        // edge of the silhouette at that column. Concave parts of the
        // silhouette (notches above the midline, peaks where the mountain is
        // only at the very top) have a small bottom-Y; columns where the
        // silhouette "comes down close to the player" have a large bottom-Y.
        const midline = Math.floor(h * 0.5);
        const bottomY = new Int32Array(w);
        for (let x = 0; x < w; x++) bottomY[x] = -1;
        for (let y = 0; y < midline; y++) {
            for (let x = 0; x < w; x++) {
                if (data[(y * w + x) * 4 + 3] > 0) bottomY[x] = y;
            }
        }

        // A column counts as "shadow" only when its silhouette-bottom is
        // within REACH_PX of the midline. This is the value that follows the
        // polygon's actual shape: concave notches and far-up peaks naturally
        // fall outside the threshold so the player can walk past them.
        // 60 image pixels ≈ the player sprite's top half projected into
        // image space — i.e. "the mountain is close enough overhead that it
        // would visually cover the sprite."
        const REACH_PX = 60;
        const minBottom = midline - REACH_PX;
        const cols = new Uint8Array(w);
        let xMin = w, xMax = -1;
        for (let x = 0; x < w; x++) {
            if (bottomY[x] >= minBottom) {
                cols[x] = 1;
                if (x < xMin) xMin = x;
                if (x > xMax) xMax = x;
            }
        }

        this._mountainSilhouette = { cols, imgW: w, imgH: h, xMin, xMax };
    }

    // True if the column at world-x falls inside the mountain silhouette
    // (computed from the overlay PNG). Used to keep the player's
    // behindMountain flag while they remain in the silhouette and clear it
    // the instant they walk past either edge.
    isInMountainShadow(wx) {
        this._ensureMountainSilhouette();
        const sil = this._mountainSilhouette;
        if (!sil) return false;
        const rect = this.stage.backgroundImageRect;
        if (!rect) return false;
        const px = Math.floor((wx - rect.x) / rect.w * sil.imgW);
        if (px < sil.xMin || px > sil.xMax) return false;
        return sil.cols[px] === 1;
    }

    // Mountain-silhouette overlay (transparent below the midline). Drawn on
    // top of the player when fall-behind detection fires.
    renderOverlay(ctx) {
        if (!this.stage.backgroundOverlayImage) return;
        const img = this.game.getImage(this.stage.backgroundOverlayImage);
        if (!img || !img.naturalWidth) return;
        const rect = this.stage.backgroundImageRect;
        if (!rect) return;
        ctx.drawImage(img,
            Math.round(rect.x - this.cameraX),
            Math.round(rect.y - this.cameraY),
            rect.w, rect.h);
    }

    getZoneAt(wx, wy) {
        this._ensureZoneData();
        if (!this._zoneData) return Zone.WALKABLE;
        const rect = this.stage.backgroundImageRect;
        if (!rect) return Zone.WALKABLE;
        const imgW = this._zoneData.width;
        const imgH = this._zoneData.height;
        const data = this._zoneData.data;

        const readClassified = (px, py) => {
            if (px < 0 || py < 0 || px >= imgW || py >= imgH) return null;
            const i = (py * imgW + px) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            if (Math.max(r, g, b) < 46) return null; // black outline
            return classifyZoneColor(r, g, b);
        };

        const px = Math.floor((wx - rect.x) / rect.w * imgW);
        const py = Math.floor((wy - rect.y) / rect.h * imgH);

        const z = readClassified(px, py);
        if (z !== null) return z;

        // Fallback: caller pointed at a black outline pixel. Check the 4
        // cardinal neighbors a few pixels out and return the first hit.
        const OFFSETS = [[0, -3], [3, 0], [0, 3], [-3, 0], [0, -6], [6, 0], [0, 6], [-6, 0]];
        for (const [ox, oy] of OFFSETS) {
            const z2 = readClassified(px + ox, py + oy);
            if (z2 !== null) return z2;
        }
        return Zone.NONE;
    }

    _isWalkableBlock(bx, by) {
        if (!this._walkableBlocks) return this._isValidBlock(bx, by);
        return this._walkableBlocks.has(`${bx},${by}`);
    }

    _getDiamondGeometry(bx, by) {
        const cb = this.stage.checkerboard;
        if (!cb) return null;
        const hs = cb.tileSize / 2;
        const yRatio = (cb.style === 'perspective') ? (cb.yRatio || 0.5) : 1;
        const hsY = hs * yRatio;

        // Global diamond spans the bounding box of all walkable blocks
        let minBx, minBy, maxBx, maxBy;
        if (this._walkableBlocks && this._walkableBlocks.size > 0) {
            minBx = Infinity; minBy = Infinity; maxBx = -Infinity; maxBy = -Infinity;
            for (const key of this._walkableBlocks) {
                const parts = key.split(',');
                const wbx = parseInt(parts[0], 10);
                const wby = parseInt(parts[1], 10);
                if (wbx < minBx) minBx = wbx;
                if (wby < minBy) minBy = wby;
                if (wbx > maxBx) maxBx = wbx;
                if (wby > maxBy) maxBy = wby;
            }
        } else {
            minBx = bx; minBy = by; maxBx = bx; maxBy = by;
        }

        const cx = (minBx + maxBx + 1) * BLOCK_W / 2;
        const cy = (minBy + maxBy + 1) * BLOCK_H / 2;
        const spanW = (maxBx - minBx + 1) * BLOCK_W;
        const spanH = (maxBy - minBy + 1) * BLOCK_H;

        const maxRW = Math.floor((spanW / 2) / hs);
        const maxRH = Math.floor((spanH / 2) / hsY);
        const R = this.stage.diamondRadius || Math.min(maxRW, maxRH) - 1;
        const hw = R * hs;
        const hh = R * hsY;

        return { cx, cy, hw, hh };
    }

    /**
     * Check if a world position is on walkable terrain (not sand).
     * Accounts for diamond-aligned visual inset on sand stages.
     */
    isOnWalkableTerrain(x, y) {
        if (!this._walkableBlocks) return true;
        const bx = Math.floor(x / BLOCK_W);
        const by = Math.floor(y / BLOCK_H);

        if (this._walkableBlocks.has(`${bx},${by}`)) {
            if (this.stage.terrainShape === 'diamond') {
                const d = this._getDiamondGeometry(bx, by);
                const normDist = Math.abs(x - d.cx) / d.hw + Math.abs(y - d.cy) / d.hh;
                if (normDist <= 1) return true;
                // Depth area below bottom edges
                if (this.stage.terrainDepth) {
                    const ddx = x - d.cx;
                    const ddy = y - d.cy;
                    if (ddy > 0 && Math.abs(ddx) <= d.hw) {
                        const yEdge = ddx <= 0
                            ? d.cy + ((x - d.cx + d.hw) / d.hw) * d.hh
                            : d.cy + ((d.cx + d.hw - x) / d.hw) * d.hh;
                        if (y >= yEdge && y - yEdge < STACK_OFFSET * 2 + 25) return true;
                    }
                }
                return false;
            }
            // On the walkable block — check visual inset edges
            if (this.stage.sandColor && this.stage.checkerboard) {
                const ox = bx * BLOCK_W;
                const oy = by * BLOCK_H;
                const hs = this.stage.checkerboard.tileSize / 2;
                let aLeft = Math.ceil(ox / hs);
                if (((aLeft % 2) + 2) % 2 === 0) aLeft++;
                if (x < aLeft * hs) return false;
                if (y - oy < LAVA_W) return false;
            }
            return true;
        }

        // Off the walkable block — check if still within depth face area below
        if (this.stage.terrainDepth && this.stage.sandColor) {
            const aboveBy = by - 1;
            if (this._walkableBlocks.has(`${bx},${aboveBy}`)) {
                const blockBottom = aboveBy * BLOCK_H + BLOCK_H;
                if (y - blockBottom < STACK_OFFSET * 2 + 25) return true;
            }
        }

        return false;
    }

    /**
     * Load the 3x3 grid around a block coordinate (only valid blocks). Unload
     * anything outside. Finite stages load every valid block once and never
     * unload — otherwise entities (e.g. cubes pushed across block boundaries)
     * would vanish when the player walks far enough to cycle the origin block.
     */
    loadSurrounding(bx, by) {
        this.currentBlockX = bx;
        this.currentBlockY = by;

        if (this.stage.type === 'finite') {
            for (const key of this._validBlocks) {
                if (!this.blocks[key]) {
                    const [nbx, nby] = key.split(',').map(Number);
                    this.blocks[key] = this._generateBlock(nbx, nby);
                }
            }
            return;
        }

        const needed = new Set();
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const nbx = bx + dx;
                const nby = by + dy;
                if (!this._isValidBlock(nbx, nby)) continue;
                const key = `${nbx},${nby}`;
                needed.add(key);
                if (!this.blocks[key]) {
                    this.blocks[key] = this._generateBlock(nbx, nby);
                }
            }
        }

        // Unload blocks outside the 3x3 (infinite stages only)
        for (const key of Object.keys(this.blocks)) {
            if (!needed.has(key)) {
                delete this.blocks[key];
            }
        }
    }

    /**
     * Update camera to follow player and check if we need to load new blocks.
     */
    update(player) {
        this.cameraX = player.x + player.width / 2 - this.game.width / 2;
        this.cameraY = player.y + player.height / 2 - this.game.height / 2;

        // Clamp camera for finite stages
        if (this.stage.type === 'finite') {
            const b = this._getStageBounds();
            if (b.w >= this.game.width) {
                this.cameraX = Math.max(b.x, Math.min(this.cameraX, b.x + b.w - this.game.width));
            } else {
                this.cameraX = b.x + (b.w - this.game.width) / 2;
            }
            if (b.h >= this.game.height) {
                this.cameraY = Math.max(b.y, Math.min(this.cameraY, b.y + b.h - this.game.height));
            } else {
                this.cameraY = b.y + (b.h - this.game.height) / 2;
            }
        }

        const bx = Math.floor(player.x / BLOCK_W);
        const by = Math.floor(player.y / BLOCK_H);

        if (bx !== this.currentBlockX || by !== this.currentBlockY) {
            this.loadSurrounding(bx, by);
        }
    }

    _getStageBounds() {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const [bx, by] of this.stage.blocks) {
            minX = Math.min(minX, bx * BLOCK_W);
            minY = Math.min(minY, by * BLOCK_H);
            maxX = Math.max(maxX, (bx + 1) * BLOCK_W);
            maxY = Math.max(maxY, (by + 1) * BLOCK_H);
        }
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }

    /**
     * Get all obstacles from all loaded blocks.
     */
    getObstacles() {
        const obstacles = [];
        for (const block of Object.values(this.blocks)) {
            for (const e of block.entities) {
                if (e.isObstacle) obstacles.push(e);
            }
        }
        return obstacles;
    }

    /**
     * Get all entities that render in the entity layer (excludes ground-layer like lava).
     */
    getAllEntities() {
        const all = [];
        for (const block of Object.values(this.blocks)) {
            for (const e of block.entities) {
                if (e.renderLayer !== 'ground') all.push(e);
            }
        }
        return all;
    }

    /**
     * Check if the player overlaps a portal. Returns the portal or null.
     */
    getPortalAt(player) {
        for (const block of Object.values(this.blocks)) {
            for (const e of block.entities) {
                if (e.entityType === 'portal') {
                    if (player.x < e.x + e.width &&
                        player.x + player.width > e.x &&
                        player.y < e.y + e.height &&
                        player.y + player.height > e.y) {
                        return e;
                    }
                }
            }
        }
        return null;
    }

    /**
     * Render the ground for all loaded blocks, then ground-layer entities (lava).
     */
    renderGround(ctx) {
        const cx = this.cameraX;
        const cy = this.cameraY;

        if (this.stage.backgroundImage) {
            // Lower layer (sand + small islands + sand-above-midline). The
            // upper mountain layer is drawn separately by main.js so it can
            // sit on either side of the player.
            const lowerKey = this.stage.backgroundLowerImage || this.stage.backgroundImage;
            const img = this.game.getImage(lowerKey);
            if (img) {
                let rect = this.stage.backgroundImageRect;
                if (!rect) {
                    const b = this._getStageBounds();
                    rect = { x: b.x, y: b.y, w: b.w, h: b.h };
                }
                ctx.drawImage(img,
                    Math.round(rect.x - cx), Math.round(rect.y - cy),
                    rect.w, rect.h);
            }

            if (this.game.showDebug) {
                for (const block of Object.values(this.blocks)) {
                    const screenX = Math.round(block.xCoord * BLOCK_W - cx);
                    const screenY = Math.round(block.yCoord * BLOCK_H - cy);
                    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(screenX, screenY, BLOCK_W, BLOCK_H);
                    ctx.fillStyle = 'rgba(255,255,255,0.5)';
                    ctx.font = '14px monospace';
                    ctx.fillText(`(${block.xCoord},${block.yCoord})`, screenX + 8, screenY + 20);
                }
            }
            return;
        }

        for (const block of Object.values(this.blocks)) {
            const screenX = Math.round(block.xCoord * BLOCK_W - cx);
            const screenY = Math.round(block.yCoord * BLOCK_H - cy);

            if (screenX + BLOCK_W < 0 || screenX > this.game.width ||
                screenY + BLOCK_H < 0 || screenY > this.game.height) continue;

            // Non-walkable blocks: fill with sand color, skip checkerboard
            if (this._walkableBlocks && !this._walkableBlocks.has(`${block.xCoord},${block.yCoord}`)) {
                ctx.fillStyle = this.stage.sandColor || this.stage.groundColor;
                ctx.fillRect(screenX, screenY, BLOCK_W + 1, BLOCK_H + 1);
                continue;
            }

            // Sand stages: clip walkable block
            let groundClipped = false;
            if (this.stage.sandColor && this.stage.checkerboard) {
                // Fill full block with sand first
                ctx.fillStyle = this.stage.sandColor;
                ctx.fillRect(screenX, screenY, BLOCK_W + 1, BLOCK_H + 1);

                ctx.save();
                if (this.stage.terrainShape === 'diamond') {
                    // Diamond terrain: clip to diamond shape
                    const d = this._getDiamondGeometry(block.xCoord, block.yCoord);
                    ctx.beginPath();
                    ctx.moveTo(Math.round(d.cx - d.hw - cx), Math.round(d.cy - cy));
                    ctx.lineTo(Math.round(d.cx - cx), Math.round(d.cy - d.hh - cy));
                    ctx.lineTo(Math.round(d.cx + d.hw - cx), Math.round(d.cy - cy));
                    ctx.lineTo(Math.round(d.cx - cx), Math.round(d.cy + d.hh - cy));
                    ctx.closePath();
                    ctx.clip();
                } else {
                    // Rectangular terrain: clip to diamond-aligned boundary
                    const _hs = this.stage.checkerboard.tileSize / 2;
                    const _ox = block.xCoord * BLOCK_W;
                    let aLeft = Math.ceil(_ox / _hs);
                    if (((aLeft % 2) + 2) % 2 === 0) aLeft++;
                    const alignedLeft = Math.round(aLeft * _hs - cx);
                    ctx.beginPath();
                    ctx.rect(alignedLeft, screenY + LAVA_W, screenX + BLOCK_W - alignedLeft + 1, BLOCK_H - LAVA_W + 1);
                    ctx.clip();
                }
                groundClipped = true;
            }

            // +1 overlap to prevent sub-pixel seams between blocks
            ctx.fillStyle = this.stage.groundColor;
            ctx.fillRect(screenX, screenY, BLOCK_W + 1, BLOCK_H + 1);

            // Checkerboard pattern (world-coordinate aligned for seamless tiling)
            // style: 'standard' = axis-aligned, 'diagonal' = diamonds, 'perspective' = squashed diamonds
            // Remove checkerboard from stage config for no pattern
            if (this.stage.checkerboard) {
                const cb = this.stage.checkerboard;
                const ts = cb.tileSize;
                const style = cb.style || 'standard';
                const ox = block.xCoord * BLOCK_W;
                const oy = block.yCoord * BLOCK_H;

                ctx.fillStyle = cb.color;

                if (style === 'diagonal' || style === 'perspective') {
                    // Diamond tiles: diagonal (yRatio=1) or perspective (yRatio<1)
                    // Uses rotated grid: a=iu+iv (X axis), b=iu-iv (Y axis)
                    const hs = ts / 2;
                    const yRatio = style === 'perspective' ? (cb.yRatio || 0.5) : 1;
                    const hsY = hs * yRatio;
                    const dh = 2 * hsY;
                    const gw = this.game.width;
                    const gh = this.game.height;

                    const aMin = Math.floor(ox / hs) - 2;
                    const aMax = Math.ceil((ox + BLOCK_W) / hs) + 1;
                    const bMin = Math.floor(oy / hsY) - 2;
                    const bMax = Math.ceil((oy + BLOCK_H) / hsY) + 1;

                    ctx.beginPath();
                    for (let a = aMin; a <= aMax; a++) {
                        if (a % 2 === 0) continue; // checkerboard: alternate columns
                        for (let b = bMin; b <= bMax; b++) {
                            if ((a + b) % 2 !== 0) continue; // ensure integer iu,iv

                            // Screen bounding box check
                            const sx = a * hs - cx;
                            const sy = (b - 1) * hsY - cy;
                            if (sx + ts < 0 || sx > gw || sy + dh < 0 || sy > gh) continue;

                            // Diamond vertices (screen coords)
                            const lx = Math.round(a * hs - cx);
                            const ly = Math.round(b * hsY - cy);
                            ctx.moveTo(lx, ly);
                            ctx.lineTo(Math.round(lx + hs), Math.round(ly + hsY));
                            ctx.lineTo(Math.round(lx + ts), ly);
                            ctx.lineTo(Math.round(lx + hs), Math.round(ly - hsY));
                            ctx.closePath();
                        }
                    }
                    ctx.fill();
                } else if (style === 'standard-perspective') {
                    // Standard grid with vertical compression
                    const yRatio = cb.yRatio || 0.5;
                    const tileH = ts * yRatio;
                    const startTX = Math.floor(ox / ts);
                    const startTY = Math.floor(oy / tileH);
                    const endTX = Math.ceil((ox + BLOCK_W) / ts);
                    const endTY = Math.ceil((oy + BLOCK_H) / tileH);

                    for (let ty = startTY; ty < endTY; ty++) {
                        for (let tx = startTX; tx < endTX; tx++) {
                            if ((tx + ty) % 2 === 0) continue;
                            const drawX = Math.max(tx * ts, ox);
                            const drawY = Math.max(ty * tileH, oy);
                            const drawW = Math.min(tx * ts + ts, ox + BLOCK_W) - drawX;
                            const drawH = Math.min(ty * tileH + tileH, oy + BLOCK_H) - drawY;
                            if (drawW <= 0 || drawH <= 0) continue;
                            ctx.fillRect(Math.round(drawX - cx), Math.round(drawY - cy), drawW, drawH);
                        }
                    }
                } else {
                    // Standard axis-aligned checkerboard (square tiles)
                    const startTX = Math.floor(ox / ts);
                    const startTY = Math.floor(oy / ts);
                    const endTX = Math.ceil((ox + BLOCK_W) / ts);
                    const endTY = Math.ceil((oy + BLOCK_H) / ts);

                    for (let ty = startTY; ty < endTY; ty++) {
                        for (let tx = startTX; tx < endTX; tx++) {
                            if ((tx + ty) % 2 === 0) continue;
                            const drawX = Math.max(tx * ts, ox);
                            const drawY = Math.max(ty * ts, oy);
                            const drawW = Math.min(tx * ts + ts, ox + BLOCK_W) - drawX;
                            const drawH = Math.min(ty * ts + ts, oy + BLOCK_H) - drawY;
                            if (drawW <= 0 || drawH <= 0) continue;
                            ctx.fillRect(Math.round(drawX - cx), Math.round(drawY - cy), drawW, drawH);
                        }
                    }
                }
            }

            if (this.game.showDebug) {
                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                ctx.lineWidth = 1;
                ctx.strokeRect(screenX, screenY, BLOCK_W, BLOCK_H);
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.font = '14px monospace';
                ctx.fillText(`(${block.xCoord},${block.yCoord})`, screenX + 8, screenY + 20);
            }

            if (groundClipped) ctx.restore();
        }

        // Ground-layer entities (lava/sand)
        for (const block of Object.values(this.blocks)) {
            for (const e of block.entities) {
                if (e.renderLayer === 'ground') {
                    const esx = e.x - cx;
                    const esy = e.y - cy;
                    if (esx + e.width < 0 || esx > this.game.width ||
                        esy + e.height < 0 || esy > this.game.height) continue;
                    e.render(ctx, this.game, cx, cy);
                }
            }
        }

        // 3D depth effect — cube faces extending from diamond grid
        if (this.stage.terrainDepth && this._walkableBlocks && this.stage.checkerboard) {
            const depth = this.stage.terrainDepth;
            const cb = this.stage.checkerboard;
            const hs = cb.tileSize / 2;
            const ts = cb.tileSize;
            const yRatio = (cb.style === 'perspective') ? (cb.yRatio || 0.5) : 1;
            const hsY = hs * yRatio;

            // Face colors: each diamond's front/side faces use darker versions of its color
            const gc = this.stage.groundColor;
            const cc = cb.color;
            const fLeftG  = this._darkenColor(gc, 0.6);
            const fRightG = this._darkenColor(gc, 0.7);
            const fLeftC  = this._darkenColor(cc, 0.6);
            const fRightC = this._darkenColor(cc, 0.7);

            let diamondDepthDrawn = false;
            for (const block of Object.values(this.blocks)) {
                const key = `${block.xCoord},${block.yCoord}`;
                if (!this._walkableBlocks.has(key)) continue;

                const ox = block.xCoord * BLOCK_W;
                const oy = block.yCoord * BLOCK_H;

                // Diamond terrain depth — global geometry, draw once
                if (this.stage.terrainShape === 'diamond') {
                    if (diamondDepthDrawn) continue;
                    diamondDepthDrawn = true;
                    const d = this._getDiamondGeometry(block.xCoord, block.yCoord);
                    const dsx = Math.round(d.cx - cx);
                    const dsy = Math.round(d.cy - cy);
                    const faceDepth = hsY;

                    const dAMin = Math.floor((d.cx - d.hw) / hs) - 3;
                    const dAMax = Math.ceil((d.cx + d.hw) / hs) + 3;
                    const dBMin = Math.floor(d.cy / hsY) - 3;
                    const dBMax = Math.ceil((d.cy + d.hh + faceDepth * 2) / hsY) + 3;

                    // Clip: area below bottom two edges of the diamond
                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(Math.round(dsx - d.hw), Math.round(dsy));
                    ctx.lineTo(Math.round(dsx), Math.round(dsy + d.hh));
                    ctx.lineTo(Math.round(dsx + d.hw), Math.round(dsy));
                    ctx.lineTo(Math.round(dsx + d.hw), Math.round(dsy + d.hh + 4 * hsY));
                    ctx.lineTo(Math.round(dsx - d.hw), Math.round(dsy + d.hh + 4 * hsY));
                    ctx.closePath();
                    ctx.clip();


                    // Cube faces along the bottom edges
                    for (let a = dAMin; a <= dAMax; a++) {
                        if (((a % 2) + 2) % 2 === 0) continue;
                        for (let b = dBMin; b <= dBMax; b++) {
                            const isCB = ((a + b) % 2) === 0;
                            const lx = Math.round(a * hs - cx);
                            const ly = Math.round(b * hsY - cy);
                            const bvx = Math.round(a * hs + hs - cx);
                            const bvy = Math.round(b * hsY + hsY - cy);
                            const rx = Math.round(a * hs + ts - cx);

                            // Only render near the diamond boundary
                            const tileCX = a * hs + hs;
                            const tileCY = b * hsY;
                            const ndist = Math.abs(tileCX - d.cx) / d.hw + Math.abs(tileCY - d.cy) / d.hh;
                            if (ndist < 0.9 || ndist > 1.15) continue;

                            // Front-left face
                            ctx.fillStyle = isCB ? fLeftC : fLeftG;
                            ctx.beginPath();
                            ctx.moveTo(lx, ly);
                            ctx.lineTo(bvx, bvy);
                            ctx.lineTo(bvx, bvy + faceDepth);
                            ctx.lineTo(lx, ly + faceDepth);
                            ctx.closePath();
                            ctx.fill();

                            // Front-right face
                            ctx.fillStyle = isCB ? fRightC : fRightG;
                            ctx.beginPath();
                            ctx.moveTo(bvx, bvy);
                            ctx.lineTo(rx, ly);
                            ctx.lineTo(rx, ly + faceDepth);
                            ctx.lineTo(bvx, bvy + faceDepth);
                            ctx.closePath();
                            ctx.fill();
                        }
                    }

                    ctx.restore();
                    continue;
                }

                const sx = Math.round(ox - cx);
                const sy = Math.round(oy - cy);
                const blockBottom = sy + BLOCK_H;
                const blockRight = sx + BLOCK_W;

                // Adjust clip to match visible checkerboard (account for sand barriers)
                const hasLeftBarrier = !this._isWalkableBlock(block.xCoord - 1, block.yCoord);
                const clipLeft = hasLeftBarrier ? sx + LAVA_W : sx;
                const clipWidth = BLOCK_W - (hasLeftBarrier ? LAVA_W : 0);

                const aMin = Math.floor(ox / hs) - 3;
                const aMax = Math.ceil((ox + BLOCK_W) / hs) + 3;
                const bMin = Math.floor(oy / hsY) - 3;
                const bMax = Math.ceil((oy + BLOCK_H + depth) / hsY) + 3;

                // --- Shaded ground: darken ground areas in the last row ---
                // Fill with dark ground color, then redraw CB diamonds on top
                const shadeHeight = 8;
                ctx.save();
                ctx.beginPath();
                ctx.rect(clipLeft, blockBottom - shadeHeight, clipWidth, shadeHeight);
                ctx.clip();

                ctx.fillStyle = this._darkenColor(gc, 0.75);
                ctx.fillRect(clipLeft, blockBottom - shadeHeight, clipWidth, shadeHeight);

                // Restore CB diamonds with their original color
                for (let a = aMin; a <= aMax; a++) {
                    if (((a % 2) + 2) % 2 === 0) continue;
                    for (let b = bMin; b <= bMax; b++) {
                        if (((a + b) % 2 + 2) % 2 !== 0) continue; // only CB diamonds

                        const lx = Math.round(a * hs - cx);
                        const ly = Math.round(b * hsY - cy);

                        ctx.fillStyle = cc;
                        ctx.beginPath();
                        ctx.moveTo(lx, ly);
                        ctx.lineTo(Math.round(lx + hs), Math.round(ly + hsY));
                        ctx.lineTo(Math.round(lx + ts), ly);
                        ctx.lineTo(Math.round(lx + hs), Math.round(ly - hsY));
                        ctx.closePath();
                        ctx.fill();
                    }
                }

                ctx.restore();

                // --- Bottom face: front faces of cubes, clipped below block bottom ---
                // Use hsY as face depth so bottom edge zigzags naturally
                const faceDepth = hsY;
                ctx.save();
                ctx.beginPath();
                ctx.rect(clipLeft, blockBottom, clipWidth, 4 * hsY);
                ctx.clip();

                for (let a = aMin; a <= aMax; a++) {
                    if (((a % 2) + 2) % 2 === 0) continue; // diamond grid at odd a only
                    for (let b = bMin; b <= bMax; b++) {
                        const isCB = ((a + b) % 2) === 0;

                        // Diamond vertices (screen coords)
                        const lx = Math.round(a * hs - cx);
                        const ly = Math.round(b * hsY - cy);
                        const bvx = Math.round(a * hs + hs - cx);
                        const bvy = Math.round(b * hsY + hsY - cy);
                        const rx = Math.round(a * hs + ts - cx);

                        // First two rows: diamonds straddling the block bottom + one below
                        if (ly > blockBottom + faceDepth || bvy + faceDepth < blockBottom) continue;

                        // Front-left face: left→bottom vertex, dropped by faceDepth
                        ctx.fillStyle = isCB ? fLeftC : fLeftG;
                        ctx.beginPath();
                        ctx.moveTo(lx, ly);
                        ctx.lineTo(bvx, bvy);
                        ctx.lineTo(bvx, bvy + faceDepth);
                        ctx.lineTo(lx, ly + faceDepth);
                        ctx.closePath();
                        ctx.fill();

                        // Front-right face: bottom→right vertex, dropped by faceDepth
                        ctx.fillStyle = isCB ? fRightC : fRightG;
                        ctx.beginPath();
                        ctx.moveTo(bvx, bvy);
                        ctx.lineTo(rx, ly);
                        ctx.lineTo(rx, ly + faceDepth);
                        ctx.lineTo(bvx, bvy + faceDepth);
                        ctx.closePath();
                        ctx.fill();
                    }
                }

                // Surface-colored triangles at the zigzag edge — seamless
                // continuation of the checkerboard. Both halves same color = no seam.
                for (let a = aMin; a <= aMax; a++) {
                    if (((a % 2) + 2) % 2 === 0) continue;
                    for (let b = bMin; b <= bMax; b++) {
                        const isCB = ((a + b) % 2) === 0;
                        const lx = Math.round(a * hs - cx);
                        const ly = Math.round(b * hsY - cy);
                        const bvx = Math.round(a * hs + hs - cx);
                        const bvy = Math.round(b * hsY + hsY - cy);
                        const rx = Math.round(a * hs + ts - cx);

                        if (bvy <= blockBottom || ly > blockBottom) continue;

                        ctx.fillStyle = isCB ? cc : gc;
                        ctx.beginPath();
                        ctx.moveTo(lx, ly);
                        ctx.lineTo(bvx, bvy);
                        ctx.lineTo(rx, ly);
                        ctx.closePath();
                        ctx.fill();
                    }
                }

                ctx.restore();
            }
        }
    }

    _darkenColor(hex, factor) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgb(${Math.floor(r * factor)},${Math.floor(g * factor)},${Math.floor(b * factor)})`;
    }

    // --- Block generation ---

    _generateBlock(bx, by) {
        const block = new WorldBlock(bx, by);
        const ox = bx * BLOCK_W;
        const oy = by * BLOCK_H;

        // Non-walkable blocks get filled entirely with sand (walkable, not an obstacle)
        if (!this._isWalkableBlock(bx, by)) {
            if (this.stage.sandColor) {
                const sand = new Sand(this.game, ox, oy, BLOCK_W, BLOCK_H, this.stage.sandColor);
                sand.isObstacle = false;
                block.addEntity(sand);
            }
            return block;
        }

        // Seeded random based on block coords (deterministic)
        let seed = ((bx * 73856093) ^ (by * 19349663)) >>> 0;
        if (seed === 0) seed = 1;
        function rand() {
            seed = (seed * 16807 + 0) % 2147483647;
            return (seed - 1) / 2147483646;
        }

        // Safe zone
        const sz = this.stage.safeZone;
        const safeRadius = sz ? sz.radius : 0;

        // Rocks
        const [minRocks, maxRocks] = this.stage.rockCount;
        const rockCount = minRocks + Math.floor(rand() * (maxRocks - minRocks + 1));
        const margin = this.stage.type === 'finite' ? 60 : 30;

        const MAX_ATTEMPTS = 30;
        for (let i = 0; i < rockCount; i++) {
            let placed = false;
            for (let attempt = 0; attempt < MAX_ATTEMPTS && !placed; attempt++) {
                const type = Math.floor(rand() * 6) + 1;
                const scale = 0.25 + rand() * 0.35;
                const size = Math.floor(100 * scale);
                const x = ox + margin + rand() * (BLOCK_W - margin * 2 - size);
                const y = oy + margin + rand() * (BLOCK_H - margin * 2 - size);

                // Skip if in safe zone
                if (safeRadius > 0 && sz) {
                    const dx = (x + size / 2) - sz.x;
                    const dy = (y + size / 2) - sz.y;
                    if (Math.sqrt(dx * dx + dy * dy) < safeRadius) continue;
                }

                // Skip if outside diamond terrain boundary
                if (this.stage.terrainShape === 'diamond') {
                    const d = this._getDiamondGeometry(bx, by);
                    if (Math.abs(x + size / 2 - d.cx) / d.hw + Math.abs(y + size / 2 - d.cy) / d.hh > 0.85) continue;
                }

                // Zone-gated stages: footprint must be fully on gray (dense sand).
                // Sample center + 4 corners of the collision box; reject if any
                // point is not DENSE_SAND. Prevents stray placements on walls
                // when the single-center sample hits a black outline pixel.
                if (this.stage.backgroundImage) {
                    const fx = x + size / 2;
                    const fTop = y + size * 0.5;
                    const fBot = y + size * 1.0;
                    const fLeft = x + size * 0.1;
                    const fRight = x + size * 0.9;
                    const samples = [
                        [fx, (fTop + fBot) / 2],
                        [fLeft, fTop], [fRight, fTop],
                        [fLeft, fBot], [fRight, fBot]
                    ];
                    let allGray = true;
                    for (const [sx, sy] of samples) {
                        if (this.getZoneAt(sx, sy) !== Zone.DENSE_SAND) { allGray = false; break; }
                    }
                    if (!allGray) continue;
                }

                // Skip if overlapping a portal position
                let overlapsPortal = false;
                if (this.stage.portals) {
                    for (const p of this.stage.portals) {
                        const pbx = Math.floor(p.x / BLOCK_W);
                        const pby = Math.floor(p.y / BLOCK_H);
                        if (pbx === bx && pby === by) {
                            const dx = (x + size / 2) - (p.x + 24);
                            const dy = (y + size / 2) - (p.y + 32);
                            if (Math.sqrt(dx * dx + dy * dy) < 80) {
                                overlapsPortal = true;
                                break;
                            }
                        }
                    }
                }
                if (overlapsPortal) continue;

                block.addEntity(new Rock(this.game, x, y, size, type));
                placed = true;
            }
        }

        // Fixed live rocks defined in stage config
        if (this.stage.liveRocks) {
            for (const lr of this.stage.liveRocks) {
                const lrBx = Math.floor(lr.x / BLOCK_W);
                const lrBy = Math.floor(lr.y / BLOCK_H);
                if (lrBx === bx && lrBy === by) {
                    block.addEntity(new LiveRock(this.game, lr.x, lr.y));
                }
            }
        }

        // Test: add a big rock (too heavy to push) in walkable blocks
        if (this.stage.sandColor && this._isWalkableBlock(bx, by)) {
            block.addEntity(new Rock(this.game, ox + BLOCK_W / 2 + 200, oy + BLOCK_H / 2 - 40, 80, 1));
        }

        // Add portals that belong to this block
        if (this.stage.portals) {
            for (const p of this.stage.portals) {
                const pbx = Math.floor(p.x / BLOCK_W);
                const pby = Math.floor(p.y / BLOCK_H);
                if (pbx === bx && pby === by) {
                    block.addEntity(new Portal(this.game, p.x, p.y, p.targetStage, p.label));
                }
            }
        }

        // Add boundaries for finite stages
        if (this.stage.type === 'finite') {
            if (!this.stage.sandColor) {
                // Lava stages: full obstacle barriers
                if (!this._isWalkableBlock(bx, by - 1)) {
                    block.addEntity(new Lava(this.game, ox, oy, BLOCK_W, LAVA_W));
                }
                if (!this._isWalkableBlock(bx, by + 1)) {
                    block.addEntity(new Lava(this.game, ox, oy + BLOCK_H - LAVA_W, BLOCK_W, LAVA_W));
                }
                if (!this._isWalkableBlock(bx - 1, by)) {
                    block.addEntity(new Lava(this.game, ox, oy, LAVA_W, BLOCK_H));
                }
                if (!this._isWalkableBlock(bx + 1, by)) {
                    block.addEntity(new Lava(this.game, ox + BLOCK_W - LAVA_W, oy, LAVA_W, BLOCK_H));
                }
            }
        }

        return block;
    }
}

// Zone enum — physical behavior encoded by background color.
// See PLAN.md and README.md "Color-Coded Terrain Zones".
const Zone = {
    WALKABLE:   'WALKABLE',    // black outline fallback / uncategorized
    SAND:       'SAND',        // beige background — sinks + slows (regular sand)
    RAMP_LEFT:  'RAMP_LEFT',   // yellow — pushes player left
    RAMP_RIGHT: 'RAMP_RIGHT',  // blue   — pushes player right
    DENSE_SAND: 'DENSE_SAND',  // gray   — slower walk, no sink
    WALL:       'WALL',        // green & red — climbed slowly; fall off edge
    NONE:       'NONE'         // outside the background image
};

// RGB → Zone classification. Hue buckets for saturated colors, value check for
// neutrals. Hand-drawn art has edge variance; buckets are generous.
function classifyZoneColor(r, g, b) {
    const rf = r / 255, gf = g / 255, bf = b / 255;
    const max = Math.max(rf, gf, bf);
    const min = Math.min(rf, gf, bf);
    const delta = max - min;
    const v = max;
    const s = max === 0 ? 0 : delta / max;
    let h = 0;
    if (delta > 0) {
        if (max === rf)      h = ((gf - bf) / delta) % 6;
        else if (max === gf) h = (bf - rf) / delta + 2;
        else                 h = (rf - gf) / delta + 4;
        h *= 60;
        if (h < 0) h += 360;
    }

    // Black outlines → treat as walkable (don't want thin lines to block movement)
    if (v < 0.18) return Zone.WALKABLE;

    // Low-saturation: gray vs. beige background, separated by value
    if (s < 0.18) {
        if (v < 0.70) return Zone.DENSE_SAND; // mid gray
        return Zone.SAND;                     // beige/off-white — regular sand
    }

    // Saturated: classify by hue
    if (h < 20 || h >= 340) return Zone.WALKABLE;    // red — plain walkable
    if (h >= 40  && h < 80)  return Zone.RAMP_LEFT;  // yellow
    if (h >= 90  && h < 170) return Zone.WALL;       // green
    if (h >= 180 && h < 260) return Zone.RAMP_RIGHT; // blue

    return Zone.WALKABLE;
}

// Zone → per-frame drift vector. Pure function so rocks, player, and any
// future entity all get the same physics. Add new cases here when we handle
// more zones (e.g. DENSE_SAND speed mod, WALL fall-on-edge).
function getZoneDrift(zone) {
    switch (zone) {
        case Zone.RAMP_LEFT:  return { dx: -1.2, dy:  0.6 };
        case Zone.RAMP_RIGHT: return { dx:  1.2, dy:  0.6 };
        default:              return { dx:  0,   dy:  0   };
    }
}

// Move an obstacle by (dx, dy), rejecting each axis independently if it
// collides with another obstacle or the player. Used for ramp drift —
// a soft nudge that stops on contact rather than transferring force.
// Stack children are dragged along with their parent. Passing the player
// as a collider prevents drift from pushing a rock back through the
// pusher's body (which would make pushing uphill feel broken).
function applyObstacleDrift(obs, dx, dy, obstacles, player) {
    const overlapsOther = (r, other) => {
        if (other === obs || !other.isObstacle) return false;
        if (other === obs.stackChild || other === obs.stackParent) return false;
        const o = other.getRect();
        return r.x < o.x + o.width && r.x + r.width > o.x &&
               r.y < o.y + o.height && r.y + r.height > o.y;
    };
    const overlapsPlayer = (r) => {
        if (!player) return false;
        const p = player.getRect();
        return r.x < p.x + p.width && r.x + r.width > p.x &&
               r.y < p.y + p.height && r.y + r.height > p.y;
    };

    if (dx !== 0) {
        const origX = obs.x;
        obs.x += dx;
        const rect = obs.getRect();
        let blocked = overlapsPlayer(rect);
        if (!blocked) {
            for (const other of obstacles) {
                if (overlapsOther(rect, other)) { blocked = true; break; }
            }
        }
        if (blocked) obs.x = origX;
    }
    if (dy !== 0) {
        const origY = obs.y;
        obs.y += dy;
        const rect = obs.getRect();
        let blocked = overlapsPlayer(rect);
        if (!blocked) {
            for (const other of obstacles) {
                if (overlapsOther(rect, other)) { blocked = true; break; }
            }
        }
        if (blocked) obs.y = origY;
    }
    if (obs.stackChild) {
        obs.stackChild.x = obs.x + (obs.width - obs.stackChild.width) / 2;
        obs.stackChild.y = obs.y - STACK_OFFSET;
    }
}

window.Zone = Zone;
window.classifyZoneColor = classifyZoneColor;
window.getZoneDrift = getZoneDrift;
window.applyObstacleDrift = applyObstacleDrift;
window.World = World;
window.BLOCK_W = BLOCK_W;
window.BLOCK_H = BLOCK_H;
window.STACK_OFFSET = STACK_OFFSET;
