/**
 * Game Engine - Core game loop and rendering
 */
class Game {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        // alpha:false = opaque canvas. The game fills the full frame every
        // tick, so page-show-through is never used — declaring it lets the
        // browser skip blending the canvas over the page when presenting,
        // which is a real cost on software-rendered (no-GPU) machines.
        this.ctx = this.canvas.getContext('2d', { alpha: false });

        this.width = 1280;
        this.height = 720;
        this.targetFPS = 60;
        this.backgroundColor = '#c2956b'; // Desert sand

        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.scaleCanvas();
        window.addEventListener('resize', () => this.scaleCanvas());

        // Timing
        this.lastTime = 0;
        this.deltaTime = 0;
        this.frameTime = 1000 / this.targetFPS;
        this.accumulator = 0;

        // FPS
        this.fps = 0;
        this.frameCount = 0;
        this.fpsTime = 0;

        // State
        this.running = false;
        this.showDebug = false;

        // Input
        this.input = new InputHandler();

        // Audio
        this.audio = new AudioManager();

        // Sheet-pixel scale of the GAME's sheet files relative to the defs'
        // authoring coordinates. The defs JSONs (and the map editor) stay at
        // full author resolution; the game ships downscaled '-game' sheets
        // (tools/downscale-sheets.py), so crop rects are multiplied by this
        // factor at draw time: getSheetScale(key). Keep in sync with the
        // factors in that script.
        this.sheetScales = {
            block_sheet: 0.25,
            mapobjects_sheet: 0.45,
            coconut_sheet: 0.45
        };

        // Assets. `bitmaps` holds ImageBitmap versions of the big stage layers:
        // an ImageBitmap is decoded ONCE and stays GPU-resident, so per-frame
        // drawImage never re-decodes/re-uploads the source — Chrome re-decodes
        // plain <img> sources of large canvases under a moving transform, which
        // tanked FPS (see BUG.md). `bitmapPending` guards duplicate creation.
        this.assets = { images: {}, json: {}, bitmaps: {}, bitmapPending: {}, loaded: false };
    }

    scaleCanvas() {
        const maxW = window.innerWidth - 40;
        const maxH = window.innerHeight - 40;
        const scale = Math.min(maxW / this.width, maxH / this.height, 1);
        this.canvas.style.width = `${this.width * scale}px`;
        this.canvas.style.height = `${this.height * scale}px`;
    }

    loadImage(key, src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => { this.assets.images[key] = img; resolve(img); };
            img.onerror = () => { console.error(`Failed to load: ${src}`); reject(new Error(`Failed: ${src}`)); };
            img.src = src;
        });
    }

    loadJSON(key, src) {
        return fetch(src, { cache: 'no-cache' })
            .then(r => { if (!r.ok) throw new Error(`Failed: ${src}`); return r.json(); })
            .then(data => { this.assets.json[key] = data; return data; });
    }

    getJSON(key) {
        return this.assets.json[key] || null;
    }

    // Factor mapping defs-JSON (author-resolution) crop coordinates onto the
    // game's possibly-downscaled sheet file. 1 for sheets shipped at full res.
    getSheetScale(key) {
        return this.sheetScales[key] || 1;
    }

    // Drawable for the BIG stage layers: returns the ImageBitmap when ready,
    // else the plain image while kicking off bitmap creation in the background
    // (so rarely-used layers, e.g. the map-style toggle's alternates, don't
    // cost ~200MB up front). Callers must size via (naturalWidth || width):
    // ImageBitmap has width/height only.
    getDrawable(key) {
        const bm = this.assets.bitmaps[key];
        if (bm) return bm;
        const img = this.assets.images[key];
        if (img && img.naturalWidth && !this.assets.bitmapPending[key]
            && typeof createImageBitmap === 'function') {
            this.assets.bitmapPending[key] = true;
            createImageBitmap(img)
                .then(b => { this.assets.bitmaps[key] = b; })
                .catch(() => { /* keep drawing the plain image */ });
        }
        return img;
    }

    async loadAssets() {
        try {
            const loads = [
                this.loadImage('character_sheet', 'assets/saborosa-cha-001.png'),
                this.loadJSON('character_sprites', 'assets/saborosa-cha-001-sprites.json'),
                this.loadImage('liverock_sheet', 'assets/saborosa-cha-001.png'),
                this.loadJSON('liverock_sprites', 'assets/saborosa-liverock-sprites.json'),
                this.loadJSON('collision_config', 'assets/collision-config.json'),
                this.loadImage('rock1', 'assets/rock1.png'),
                this.loadImage('rock2', 'assets/rock2.png'),
                this.loadImage('rock3', 'assets/rock3.png'),
                this.loadImage('fruit_basket', 'assets/empty-basket.png'),
                this.loadImage('intro_bg', 'assets/intro-bg.jpg'),
                this.loadImage('intro_title', 'assets/intro-title.png'),
                this.loadImage('intro_start', 'assets/intro-start.png'),
                this.loadImage('intro_options', 'assets/intro-options.png'),
                // Transparent line-art word variants (from saborosa-letras-02),
                // used for UNSELECTED menu items when that toggle is on.
                this.loadImage('intro_start_white', 'assets/intro-start-white.png'),
                this.loadImage('intro_start_red', 'assets/intro-start-red.png'),
                this.loadImage('intro_options_white', 'assets/intro-options-white.png'),
                this.loadImage('intro_options_red', 'assets/intro-options-red.png'),
                this.loadImage('intro_hand', 'assets/intro-hand.png'),
                this.loadImage('intro_title_bw', 'assets/intro-title-bw.png'),
                this.loadImage('intro_start_bw', 'assets/intro-start-bw.png'),
                this.loadImage('intro_options_bw', 'assets/intro-options-bw.png'),
                this.loadImage('intro_hand_bw', 'assets/intro-hand-bw.png'),
                this.loadImage('intro_volume', 'assets/intro-volume.png'),
                this.loadImage('intro_off', 'assets/intro-off.png'),
                this.loadImage('intro_on', 'assets/intro-on.png'),
                this.loadImage('intro_thumb', 'assets/intro-thumb.png'),
                // Stage 3 backgrounds — exactly TWO files:
                //  1. stage3_bg (V2 zone map): never drawn. Colors are sampled
                //     into the Zone map AND drive the mountain-occlusion mask
                //     (island pixels above the midline) — see world.js.
                //  2. stage3_background: the displayed island art, full island +
                //     sand baked in (tools/build-combined-background.py merges
                //     the old lower/overlay halves). The mountain-occlusion layer
                //     is generated from THIS image in memory at stage load
                //     (world._ensureMountainOverlay), so no overlay file ships.
                this.loadImage('stage3_bg', 'assets/saborosa-fundo-base-V2.png'),
                this.loadImage('stage3_background', 'assets/cor-saborosa-fundo-fim-island-01-combined.png'),
                // Pickable/throwable blocks + the placeable "prop" structures
                // (platform/big-stack/tower). One transparent sheet; the defs
                // tag each crop kind:'block' (random-spawned Rock) or 'prop'
                // (hand-placed MapObject). Authored via tools/build-block-defs.py.
                //
                // The GAME loads the '-game' downscaled sheet copies (made by
                // tools/downscale-sheets.py): these draw at small scales, and
                // author-resolution sheets made weak CPUs read 10-50x more
                // source px than rendered (PERFORMANCE.md C8). The defs keep
                // author-res coordinates — mapped via sheetScales below. The
                // editor/tools keep using the original full-res sheets.
                this.loadImage('block_sheet', 'assets/saborosa-assets-002-game.png'),
                this.loadJSON('block_defs', 'assets/saborosa-assets-002-sprites.json'),
                this.loadImage('coconut_sheet', 'assets/saborosa-chat-002-2-game.png'),
                this.loadJSON('coconut_sprites', 'assets/saborosa-chat-002-2-sprites.json'),
                // Decorative map assets (plants/trees/grass/etc.) + their defs
                // and placements, both authored in tools/map-editor.html.
                this.loadImage('mapobjects_sheet', 'assets/saborosa-assets-001-game.png'),
                this.loadJSON('mapobject_defs', 'assets/saborosa-assets-001-sprites.json'),
                this.loadJSON('painted_isle_objects', 'assets/painted-isle-objects.json'),

                // Decorative SABOROSA letters scattered across the scenery (placed
                // in the map editor, spawned as non-colliding Letter entities that
                // bob + flicker). Two small sheets share one coordinate set: the
                // yellow fill and a white-fill copy, crossfaded for the flicker.
                // Authored via tools/build-letter-defs.py.
                this.loadImage('letters_sheet', 'assets/saborosa-letters.png'),
                this.loadImage('letters_white_sheet', 'assets/saborosa-letters-white.png'),
                this.loadJSON('letter_defs', 'assets/saborosa-letters-sprites.json'),

                // Ambient no-collision FX (assets-003) — shadows/clippy twinkle,
                // the ball ping-pongs. Spawned around the player by FxManager;
                // tuned in tools/fx-lab.html. Downscaled 4x for the game; boxes
                // are pre-scaled in the -small defs (which carry a "downscale"
                // factor). Regenerate via tools/downscale-fx.py.
                this.loadImage('fx_sheet_faint', 'assets/saborosa-assets-003-V2-small.png'),
                this.loadJSON('fx_defs', 'assets/saborosa-assets-003-fx-small.json')
            ];

            // FX sheet selection is config-driven (window.FX_JUICE.sheets in
            // fxobject.config.js): 'faint' (default) | 'bold' | 'both'. Only load
            // the bold sheet when the config actually uses it — by default it's
            // off (the faint/V2 sheet only). Both sheets always live in fx-lab.
            const fxSheets = (window.FX_JUICE && window.FX_JUICE.sheets) || 'faint';
            const fxWarm = ['fx_sheet_faint'];
            if (fxSheets === 'bold' || fxSheets === 'both') {
                loads.push(this.loadImage('fx_sheet', 'assets/saborosa-assets-003-small.png'));
                fxWarm.push('fx_sheet');
            }

            await Promise.all(loads);
            // The block sheet (assets-002) is already transparent, so no
            // white-keying is needed (unlike the old cube sheet).
            // Coconut sheet was pre-processed offline (PIL matte extraction)
            // into a PNG with proper anti-aliased alpha, so no runtime keying.

            // The FX sheet's decode + GPU upload is deferred by the browser
            // until the FIRST draw, which otherwise freezes the game ~1s the
            // first time a flicker object renders. Force the decode here, during
            // the load, so that cost is paid up front instead of mid-gameplay.
            await this._warmImages(fxWarm);

            // Pre-build ImageBitmaps for the two DISPLAYED stage-3 layers so the
            // first gameplay frame already draws GPU-resident bitmaps (the toggle
            // alternates upgrade lazily via getDrawable). Decode-once here is the
            // Chrome fix for the moving-camera FPS collapse — see BUG.md.
            if (typeof createImageBitmap === 'function') {
                // Decode-once bitmaps for every image drawn per frame: the two
                // stage layers AND all sprite sheets. Plain <img> sources live
                // in the browser's DISCARDABLE decode cache — on low-memory
                // no-GPU machines the big sheets (assets-001/002 ~132MB,
                // coconut ~104MB decoded) get evicted between frames and
                // re-decoded on EVERY drawImage (~70ms per sprite, measured
                // ~900ms/frame on a test machine — PERFORMANCE.md C7).
                // ImageBitmaps are decoded once and stay raster-ready.
                const WARM = ['stage3_background',
                              'block_sheet', 'mapobjects_sheet', 'coconut_sheet',
                              'character_sheet', 'liverock_sheet',
                              'fx_sheet_faint', 'fruit_basket'];
                // Free the <img> behind the BIG ones (≥100MB decoded) so no
                // duplicate copy stays resident. Small sheets keep their <img>
                // as a fallback. Everything draws via getDrawable().
                const FREE = new Set(['stage3_background',
                                      'block_sheet', 'mapobjects_sheet', 'coconut_sheet']);
                await Promise.all(WARM.map(k => {
                    const img = this.assets.images[k];
                    if (!img) return null;
                    this.assets.bitmapPending[k] = true;
                    return createImageBitmap(img)
                        .then(b => {
                            this.assets.bitmaps[k] = b;
                            if (FREE.has(k)) this.assets.images[k] = null;
                        })
                        .catch(() => {});
                }));
            }

            this.assets.loaded = true;
            console.log('Assets loaded');
        } catch (err) {
            console.error('Asset load error:', err);
            this.assets.loaded = true;
        }
    }

    // Force-decode (and lightly GPU-warm) the given images so their first
    // real draw doesn't hitch. Used for the very large FX sheets.
    async _warmImages(keys) {
        const scratch = document.createElement('canvas');
        scratch.width = scratch.height = 2;
        const sctx = scratch.getContext('2d');
        for (const key of keys) {
            const img = this.getImage(key);
            if (!img) continue;
            try { if (img.decode) await img.decode(); } catch (e) { /* already decoded / unsupported */ }
            // Touch a pixel so the canvas backend prepares the texture too.
            try { sctx.drawImage(img, 0, 0, 1, 1, 0, 0, 1, 1); } catch (e) { /* ignore */ }
        }
    }

    _makeWhiteTransparent(key) {
        const img = this.getImage(key);
        if (!img) return;
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) {
                    data[i + 3] = 0;
                }
            }
            ctx.putImageData(imageData, 0, 0);
            this.assets.images[key] = canvas;
        } catch (err) {
            console.error('Failed to preprocess', key, err);
        }
    }

    getImage(key) {
        return this.assets.images[key] || null;
    }

    start() {
        this.running = true;
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.gameLoop(t));
    }

    gameLoop(currentTime) {
        if (!this.running) return;

        // Perf HUD bookkeeping (hold C to view). Must be the first thing in the
        // frame so rAF-to-rAF time is measured cleanly.
        const PERF = window.PERF;
        if (PERF) PERF.frame(currentTime);

        this.deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        // Clamp the frame delta. The fixed-timestep catch-up below runs one
        // update per `frameTime` of elapsed real time; without a ceiling, a
        // single slow frame (a one-off image decode, getImageData, GC, or a
        // backgrounded tab) inflates the accumulator, runs dozens of updates,
        // slows the next frame further, and spirals to ~1 FPS permanently.
        // Capping the delta means a hitch costs at most a brief stutter that
        // recovers, instead of collapsing the loop.
        if (this.deltaTime > 100) this.deltaTime = 100;

        // FPS
        this.frameCount++;
        this.fpsTime += this.deltaTime;
        if (this.fpsTime >= 500) {
            this.fps = Math.round((this.frameCount * 1000) / this.fpsTime);
            this.frameCount = 0;
            this.fpsTime = 0;
            const el = document.getElementById('fps-counter');
            if (el) el.textContent = `FPS: ${this.fps}`;
        }

        this.input.updateGamepad();
        this.showDebug = this.input.isKeyDown('debug');

        // Fixed timestep
        this.accumulator += this.deltaTime;
        let didUpdate = false;
        let updates = 0;
        if (PERF) PERF.begin('update');
        while (this.accumulator >= this.frameTime) {
            if (this.onUpdate) this.onUpdate(this.frameTime / 1000);
            this.accumulator -= this.frameTime;
            didUpdate = true;
            updates++;
        }
        if (PERF) {
            PERF.end('update');
            // >1 sustained means the machine renders slower than 60Hz and pays
            // for it AGAIN in catch-up updates (cost multiplies on slow machines).
            PERF.note('upd/frame', updates);
        }
        if (didUpdate) this.input.clearFrameState();

        // Render
        if (PERF) PERF.begin('render');
        this.ctx.fillStyle = this.backgroundColor;
        this.ctx.fillRect(0, 0, this.width, this.height);
        if (this.onRender) this.onRender(this.ctx);
        if (PERF) PERF.end('render');

        requestAnimationFrame((t) => this.gameLoop(t));
    }
}

window.Game = Game;
