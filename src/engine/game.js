/**
 * Game Engine - Core game loop and rendering
 */
class Game {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

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

        // Assets
        this.assets = { images: {}, json: {}, loaded: false };
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
        return fetch(src)
            .then(r => { if (!r.ok) throw new Error(`Failed: ${src}`); return r.json(); })
            .then(data => { this.assets.json[key] = data; return data; });
    }

    getJSON(key) {
        return this.assets.json[key] || null;
    }

    async loadAssets() {
        try {
            await Promise.all([
                this.loadImage('facing_down', 'assets/sprites/facing_down.png'),
                this.loadImage('facing_up', 'assets/sprites/facing_up.png'),
                this.loadImage('facing_right', 'assets/sprites/facing_right.png'),
                this.loadImage('facing_left', 'assets/sprites/facing_left.png'),
                this.loadImage('rock1', 'assets/rock1.png'),
                this.loadImage('rock2', 'assets/rock2.png'),
                this.loadImage('rock3', 'assets/rock3.png')
            ]);
            this.assets.loaded = true;
            console.log('Assets loaded');
        } catch (err) {
            console.error('Asset load error:', err);
            this.assets.loaded = true;
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

        this.deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

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
        while (this.accumulator >= this.frameTime) {
            if (this.onUpdate) this.onUpdate(this.frameTime / 1000);
            this.accumulator -= this.frameTime;
            didUpdate = true;
        }
        if (didUpdate) this.input.clearFrameState();

        // Render
        this.ctx.fillStyle = this.backgroundColor;
        this.ctx.fillRect(0, 0, this.width, this.height);
        if (this.onRender) this.onRender(this.ctx);

        requestAnimationFrame((t) => this.gameLoop(t));
    }
}

window.Game = Game;
