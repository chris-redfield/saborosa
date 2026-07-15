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
        // factor at draw time: getSheetScale(key). Sourced from the single
        // scale knob (scale.config.js); keep in sync with the downscale script.
        this.sheetScales = (window.ART && window.ART.sheetScales) || {
            block_sheet: 0.25,
            mapobjects_sheet: 0.45,
            // Character sheets ship cropped 1:1 with their defs (not downscaled).
            coconut_sheet: 1.0,
            tomato_sheet: 1.0,
            eggplant_sheet: 1.0,
            eggplant_dead_sheet: 1.0,
            laranja_sheet: 1.0,
            rock_sheet: 1.0,
            bush_sheet: 1.0,
            phone_sheet: 1.0
        };

        // Assets. `bitmaps` holds ImageBitmap versions of the big stage layers:
        // an ImageBitmap is decoded ONCE and stays GPU-resident, so per-frame
        // drawImage never re-decodes/re-uploads the source — Chrome re-decodes
        // plain <img> sources of large canvases under a moving transform, which
        // tanked FPS (see BUG.md). `bitmapPending` guards duplicate creation.
        this.assets = { images: {}, json: {}, bitmaps: {}, bitmapPending: {}, loaded: false };

        // Bounded-concurrency + retry gate for asset loading. Firing every asset
        // request at once worked locally but made deploy hosts reset connections
        // (ERR_CONNECTION_RESET) on the bigger PNGs — under HTTP/2 the ~30 loads
        // become dozens of streams on one connection and the host drops it.
        // We cap in-flight requests and retry transient drops so loads recover.
        this._netMax = 4;
        this._netActive = 0;
        this._netQueue = [];
    }

    // Acquire/release a network slot so at most `_netMax` asset requests are in
    // flight at once (queued FIFO).
    _acquireSlot() {
        if (this._netActive < this._netMax) { this._netActive++; return Promise.resolve(); }
        return new Promise(res => this._netQueue.push(res)).then(() => { this._netActive++; });
    }
    _releaseSlot() {
        this._netActive--;
        const next = this._netQueue.shift();
        if (next) next();
    }

    // Run a slot-gated request with retries + backoff. `make(attempt)` issues the
    // request; attempt>0 cache-busts so a poisoned connection isn't reused. The
    // slot is released between attempts so a backing-off load doesn't hog a slot.
    async _withRetry(retries, make, src) {
        for (let attempt = 0; ; attempt++) {
            await this._acquireSlot();
            let result, ok = false, err;
            try { result = await make(attempt); ok = true; }
            catch (e) { err = e; }
            this._releaseSlot();
            if (ok) return result;
            if (attempt >= retries) { console.error(`Failed to load: ${src}`); throw err; }
            await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
        }
    }

    scaleCanvas() {
        const maxW = window.innerWidth - 40;
        const maxH = window.innerHeight - 40;
        const scale = Math.min(maxW / this.width, maxH / this.height, 1);
        this.canvas.style.width = `${this.width * scale}px`;
        this.canvas.style.height = `${this.height * scale}px`;
    }

    _bust(src, attempt) {
        return attempt ? src + (src.includes('?') ? '&' : '?') + '_r=' + attempt : src;
    }

    loadImage(key, src, retries = 3) {
        return this._withRetry(retries, (attempt) => new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => { this.assets.images[key] = img; resolve(img); };
            img.onerror = () => reject(new Error(`Failed: ${src}`));
            img.src = this._bust(src, attempt);
        }), src);
    }

    loadJSON(key, src, retries = 3) {
        return this._withRetry(retries, (attempt) =>
            fetch(this._bust(src, attempt), { cache: 'no-cache' })
                .then(r => { if (!r.ok) throw new Error(`Failed: ${src}`); return r.json(); })
                .then(data => { this.assets.json[key] = data; return data; }),
            src);
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
                this.loadImage('fruit_basket', 'assets/empty-basket.png'),
                this.loadImage('intro_bg', 'assets/intro-bg.jpg'),
                this.loadImage('intro_title', 'assets/intro-title.png'),
                this.loadImage('intro_start', 'assets/intro-start.png'),
                this.loadImage('intro_options', 'assets/intro-options.png'),
                // Character-select screen: 3-frame looping idle. Base frames
                // (04-06) show every fruit in gray line-art; the parallel colored
                // frames (01-03) are clipped to the highlighted panel so only the
                // fruit under the cursor lights up (see screens/select.js). The
                // "-low" base frames add a per-frame wobble to the "SELECT FRUIT"
                // title letters, so the title now shakes along with the idle loop
                // (letters live only in the base frames — the colored twins are
                // clipped below the title band and never show them).
                this.loadImage('select_gray_1', 'assets/fruit-select-04-low.png'),
                this.loadImage('select_gray_2', 'assets/fruit-select-05-low.png'),
                this.loadImage('select_gray_3', 'assets/fruit-select-06-low.png'),
                this.loadImage('select_color_1', 'assets/fruit-select-01.png'),
                this.loadImage('select_color_2', 'assets/fruit-select-02.png'),
                this.loadImage('select_color_3', 'assets/fruit-select-03.png'),
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
                this.loadImage('intro_thumb_bw', 'assets/intro-thumb-bw.png'),

                // Dungeon interior background (fell-down-a-hole view).
                this.loadImage('dungeon_bg', 'assets/saborosa-dungeon-fundo-novo.png'),
                // Wooden seals ("tampa") painted at each hole's map position — a
                // full-map-aligned overlay, drawn clipped over a hole once it's
                // completed (letter collected) so it can't be fallen into again.
                this.loadImage('holes_lid', 'assets/cor-saborosa-holes-tampa.png'),
                // Cat statue on the dungeon's back wall — a 3-frame flame loop,
                // full-canvas overlays pre-aligned to the background (see dungeon.js).
                this.loadImage('dungeon_gato_1', 'assets/saborosa-dungeon-gato-01.png'),
                this.loadImage('dungeon_gato_2', 'assets/saborosa-dungeon-gato-02.png'),
                this.loadImage('dungeon_gato_3', 'assets/saborosa-dungeon-gato-03.png'),
                // "Infinite" tiled dungeon floor — one square tile repeated
                // forever, top-down, constant character scale (see tiledungeon.js).
                this.loadImage('dungeon_tile', 'assets-v2/rafe-saborosa-escaladalow-01.png'),
                // Per-tile collision grid for that floor (skulls + bushes = solid),
                // authored/auto-detected in tools/tile-collision.html.
                this.loadJSON('dungeon_tile_collision', 'assets-v2/rafe-saborosa-escaladalow-01-collision.json'),
                // Tileable twisted-rope segment (one vertical twist period, from
                // the vecteezy rope .eps) for the dungeon's taut-wire rope.
                this.loadImage('rope_segment', 'assets-v2/saborosa-rope-segment.png'),

                // Explosion effect played at the spot the player falls into a hole.
                this.loadImage('boom_sheet', 'assets-v2/saborosa-boom.png'),
                this.loadJSON('boom_defs', 'assets-v2/saborosa-boom.json'),
                // Full 12-frame version (grow→peak→fade) — used by the dungeon
                // furnace blast; the hole keeps the shorter tail-only boom_defs.
                this.loadJSON('boom_full_defs', 'assets-v2/saborosa-boom-full.json'),
                // Stage 3 — 4-LAYER MAP (assets-v2/mapa/, all aligned 5543x4075):
                //   zoning    — never drawn; sampled for terrain zones AND the
                //               mountain-occlusion mask. Transparent outside the
                //               island (alpha = "off the island"); see world.js.
                //   sand      — base ground image (drawn first).
                //   mountains — "ilhas" island/mountain art above the sand; also
                //               the source the pass-behind occlusion is built from.
                //   overlays  — trees / holes / structures, feet-split foreground.
                this.loadImage('stage3_zoning', 'assets-v2/mapa/saborosa-elementos-zoning-000.png'),
                // sand is now a flat colour (layers.sand.color) — no image loaded.
                this.loadImage('stage3_mountains', 'assets-v2/mapa/saborosa-elementos-ilhas.png'),
                this.loadImage('stage3_ovl_arvores', 'assets-v2/mapa/saborosa-elementos-arvores.png'),
                this.loadImage('stage3_ovl_buracos', 'assets-v2/mapa/saborosa-elementos-buracos.png'),
                this.loadImage('stage3_ovl_estruturas1', 'assets-v2/mapa/saborosa-elementos-estruturas-01.png'),
                this.loadImage('stage3_ovl_estruturas2', 'assets-v2/mapa/saborosa-elementos-estruturas-02.png'),
                // Per-object placements for the depth-sorted overlays (trees,
                // holes) recovered from the baked layers by build-overlay-objects.py.
                this.loadJSON('overlay_objects', 'assets-v2/mapa/overlay-objects.json'),
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
                // Playable characters — full-behaviour packs from the assets-v2
                // sheets (9-col x 5-row layout), extracted + cropped 1:1 by
                // tools/build-character-defs.py. Tomato is the default pack; the
                // 1 key cycles tomato -> coconut -> eggplant -> laranja.
                this.loadImage('tomato_sheet', 'assets/saborosa-elementos-tomato-game.png'),
                this.loadJSON('tomato_sprites', 'assets/saborosa-elementos-tomato-sprites.json'),
                this.loadImage('coconut_sheet', 'assets/saborosa-elementos-coconut-game.png'),
                this.loadJSON('coconut_sprites', 'assets/saborosa-elementos-coconut-sprites.json'),
                this.loadImage('eggplant_sheet', 'assets/saborosa-elementos-eggplant-game.png'),
                this.loadJSON('eggplant_sprites', 'assets/saborosa-elementos-eggplant-sprites.json'),
                // ERKPA's beaten-up skin — swapped in after his first death.
                this.loadImage('eggplant_dead_sheet', 'assets/saborosa-elementos-eggplant-dead-game.png'),
                this.loadJSON('eggplant_dead_sprites', 'assets/saborosa-elementos-eggplant-dead-sprites.json'),
                this.loadImage('laranja_sheet', 'assets/saborosa-elementos-laranja-game.png'),
                this.loadJSON('laranja_sprites', 'assets/saborosa-elementos-laranja-sprites.json'),
                // Sleeper enemy packs (rockenemy.js / bushenemy.js).
                this.loadImage('rock_sheet', 'assets/saborosa-elementos-rock-game.png'),
                this.loadJSON('rock_sprites', 'assets/saborosa-elementos-rock-sprites.json'),
                this.loadImage('bush_sheet', 'assets/saborosa-elementos-bush-game.png'),
                this.loadJSON('bush_sprites', 'assets/saborosa-elementos-bush-sprites.json'),
                // Telephone enemy pack (phoneenemy.js) — a sand-roaming, non-sleeping
                // enemy: 8 facings x 3 states (normal/nervous/hurt), no walk cycle.
                this.loadImage('phone_sheet', 'assets/saborosa-elementos-phone-game.png'),
                this.loadJSON('phone_sprites', 'assets/saborosa-elementos-phone-sprites.json'),
                // Hand-placed enemies + live rocks (tools/enemy-placement.html). The
                // four dynamic enemies spawn from here in main.js; liverock entries
                // are static obstacles spawned into world blocks (see world.js).
                this.loadJSON('enemy_placements', 'assets/enemy-placements.json'),
                // The old decorative map assets (mapobjects_sheet / assets-001,
                // painted_isle_objects, mapobject_defs) were REMOVED — the
                // 4-layer map + OverlayObjects replaced the hand-placed trees.
                //
                // SABOROSA letters DO still appear: yellow sheet + white-fill
                // copy crossfaded for the flicker, spawned as non-colliding
                // Letter entities from `letters_placements` (assets-v2/mapa).
                this.loadImage('letters_sheet', 'assets/saborosa-letters.png'),
                this.loadImage('letters_white_sheet', 'assets/saborosa-letters-white.png'),
                this.loadJSON('letter_defs', 'assets/saborosa-letters-sprites.json'),
                this.loadJSON('letters_placements', 'assets-v2/mapa/letters.json'),

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

            // allSettled (not all): a single failed asset must NOT skip the
            // ImageBitmap warming below. If warming is skipped, every layer
            // draws as a plain <img> that Chrome re-decodes each frame under the
            // moving camera — the BUG.md FPS collapse, and exactly why a flaky
            // DEPLOY (some loads reset) ran at ~26fps while local ran at 60.
            const results = await Promise.allSettled(loads);
            const failed = results.filter(r => r.status === 'rejected').length;
            if (failed) console.warn(`${failed} asset(s) failed to load — continuing`);

            // Optional character perspective config authored in
            // tools/main-perspective.html ("Save perspective.json"). Best-effort:
            // a missing file just leaves the main stage without depth scaling.
            try {
                const res = await fetch('assets-v2/mapa/perspective.json', { cache: 'no-cache' });
                if (res.ok) this.assets.json['perspective'] = await res.json();
            } catch (e) { /* no perspective file — stage renders flat */ }

            // Optional controller mapping authored in tools/gamepad-mapper.html.
            // Best-effort: a 404 / parse error just leaves input.js on its
            // built-in defaults, so the file is purely additive.
            try {
                const res = await fetch('assets/gamepad-mapping.json', { cache: 'no-cache' });
                if (res.ok) {
                    this.input.applyMapping(await res.json());
                    console.log('Gamepad mapping loaded:', this.input.gamepadId || '(no id)');
                }
            } catch (e) { /* no mapping file — keep defaults */ }

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
                const WARM = ['stage3_mountains',
                              'stage3_ovl_arvores', 'stage3_ovl_buracos',
                              'stage3_ovl_estruturas1', 'stage3_ovl_estruturas2',
                              'block_sheet', 'coconut_sheet', 'tomato_sheet',
                              'character_sheet', 'liverock_sheet', 'rock_sheet',
                              'bush_sheet', 'phone_sheet',
                              'fx_sheet_faint', 'fx_sheet', 'fruit_basket'];
                // Free the <img> behind the BIG ones (≥100MB decoded) so no
                // duplicate copy stays resident. Small sheets keep their <img>
                // as a fallback. Everything draws via getDrawable().
                const FREE = new Set(['stage3_mountains',
                                      'stage3_ovl_arvores', 'stage3_ovl_buracos',
                                      'stage3_ovl_estruturas1', 'stage3_ovl_estruturas2',
                                      'block_sheet', 'coconut_sheet']);
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
        // The on-screen FPS readout is a debug aid — only show it while C (debug)
        // is held, alongside the canvas perf panel.
        const fpsEl = document.getElementById('fps-counter');
        if (fpsEl) fpsEl.style.display = this.showDebug ? 'block' : 'none';

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
