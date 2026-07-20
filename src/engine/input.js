/**
 * Input Handler - Manages keyboard, mouse, and gamepad input
 */
class InputHandler {
    constructor() {
        this.keys = {};
        this.keysJustPressed = {};
        this.keysJustReleased = {};

        this.mouse = {
            x: 0, y: 0,
            buttons: {},
            buttonsJustPressed: {},
            buttonsJustReleased: {}
        };

        this.gamepad = null;
        this.gamepadButtons = {};
        this.gamepadButtonsJustPressed = {};
        this.gamepadAxes = { x: 0, y: 0 };
        this.deadzone = 0.45;
        // Which stick axes feed movement (left stick on a standard pad).
        // Overridden by a loaded mapping (assets/gamepad-mapping.json).
        this.moveAxis = { x: 0, y: 1, invertX: false, invertY: false };
        this.gamepadId = null;       // id of the pad the mapping was authored for

        this.keyMap = {
            'KeyW': 'up', 'ArrowUp': 'up',
            'KeyS': 'down', 'ArrowDown': 'down',
            'KeyA': 'left', 'ArrowLeft': 'left',
            'KeyD': 'right', 'ArrowRight': 'right',
            'Space': 'lift',
            'Enter': 'confirm', 'NumpadEnter': 'confirm',
            'KeyE': 'interact',
            'ShiftLeft': 'dash', 'ShiftRight': 'dash',
            'KeyR': 'run',
            'KeyP': 'pause',
            'KeyM': 'mute',

            'Escape': 'escape',
            'KeyC': 'debug',
            'Digit1': 'cycleCharacter'
        };

        // Button index -> action. 'lift' is the rock lift/charge/throw on Space
        // (button 0 / south on a standard pad); 'interact' boards the basket.
        this.gamepadMap = {
            0: 'lift', 3: 'interact',
            12: 'up', 13: 'down', 14: 'left', 15: 'right'
        };

        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mousedown', (e) => this.onMouseDown(e));
        window.addEventListener('mouseup', (e) => this.onMouseUp(e));
        window.addEventListener('gamepadconnected', (e) => { this.gamepad = e.gamepad; });
        window.addEventListener('gamepaddisconnected', () => { this.gamepad = null; this.gamepadButtons = {}; this.gamepadAxes = { x: 0, y: 0 }; });
    }

    // Apply a controller mapping authored in tools/gamepad-mapper.html and
    // shipped as assets/gamepad-mapping.json. Tolerant: any missing field keeps
    // its current default, so a partial (or absent) file never breaks input.
    // Accepts `gamepadMap` (index->action) and/or `buttons` (action->index).
    applyMapping(cfg) {
        if (!cfg) return;
        this.gamepadId = cfg.id || null;
        if (typeof cfg.deadzone === 'number') this.deadzone = cfg.deadzone;
        if (cfg.axes) {
            const a = cfg.axes;
            if (Number.isInteger(a.moveX)) this.moveAxis.x = a.moveX;
            if (Number.isInteger(a.moveY)) this.moveAxis.y = a.moveY;
            this.moveAxis.invertX = !!a.invertX;
            this.moveAxis.invertY = !!a.invertY;
        }
        const map = {};
        if (cfg.gamepadMap) {
            for (const [idx, act] of Object.entries(cfg.gamepadMap)) map[idx] = act;
        } else if (cfg.buttons) {
            for (const [act, idx] of Object.entries(cfg.buttons)) map[idx] = act;
        }
        if (Object.keys(map).length) this.gamepadMap = map;
    }

    onKeyDown(event) {
        if (this.keyMap[event.code]) event.preventDefault();
        if (!this.keys[event.code]) this.keysJustPressed[event.code] = true;
        this.keys[event.code] = true;
    }

    onKeyUp(event) {
        this.keys[event.code] = false;
        this.keysJustReleased[event.code] = true;
    }

    onMouseMove(event) {
        const canvas = document.getElementById('game-canvas');
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            this.mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
            this.mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
        }
    }

    onMouseDown(event) {
        if (!this.mouse.buttons[event.button]) this.mouse.buttonsJustPressed[event.button] = true;
        this.mouse.buttons[event.button] = true;
    }

    onMouseUp(event) {
        this.mouse.buttons[event.button] = false;
        this.mouse.buttonsJustReleased[event.button] = true;
    }

    updateGamepad() {
        const gamepads = navigator.getGamepads();
        if (!gamepads) return;
        for (const gp of gamepads) { if (gp) { this.gamepad = gp; break; } }
        if (!this.gamepad) return;

        const ax = this.moveAxis;
        let rx = this.gamepad.axes[ax.x] || 0;
        let ry = this.gamepad.axes[ax.y] || 0;
        if (ax.invertX) rx = -rx;
        if (ax.invertY) ry = -ry;
        this.gamepadAxes.x = Math.abs(rx) > this.deadzone ? rx : 0;
        this.gamepadAxes.y = Math.abs(ry) > this.deadzone ? ry : 0;

        const prev = { ...this.gamepadButtons };
        this.gamepadButtonsJustPressed = {};
        this.gamepad.buttons.forEach((btn, i) => {
            if (btn.pressed && !prev[i]) this.gamepadButtonsJustPressed[i] = true;
            this.gamepadButtons[i] = btn.pressed;
        });
    }

    clearFrameState() {
        this.keysJustPressed = {};
        this.keysJustReleased = {};
        this.mouse.buttonsJustPressed = {};
        this.mouse.buttonsJustReleased = {};
        this.gamepadButtonsJustPressed = {};
    }

    isKeyDown(action) {
        for (const [code, mapped] of Object.entries(this.keyMap)) {
            if (mapped === action && this.keys[code]) return true;
        }
        for (const [btn, mapped] of Object.entries(this.gamepadMap)) {
            if (mapped === action && this.gamepadButtons[btn]) return true;
        }
        return false;
    }

    isKeyJustPressed(action) {
        for (const [code, mapped] of Object.entries(this.keyMap)) {
            if (mapped === action && this.keysJustPressed[code]) return true;
        }
        for (const [btn, mapped] of Object.entries(this.gamepadMap)) {
            if (mapped === action && this.gamepadButtonsJustPressed[btn]) return true;
        }
        return false;
    }

    // True if ANY keyboard key or gamepad button was pressed this frame,
    // regardless of mapping. Used for "press any button to continue" prompts.
    anyJustPressed() {
        return Object.keys(this.keysJustPressed).length > 0
            || Object.keys(this.gamepadButtonsJustPressed).length > 0;
    }

    getMovementVector() {
        let x = 0, y = 0;
        if (this.isKeyDown('left')) x -= 1;
        if (this.isKeyDown('right')) x += 1;
        if (this.isKeyDown('up')) y -= 1;
        if (this.isKeyDown('down')) y += 1;

        if (this.gamepadAxes.x !== 0 || this.gamepadAxes.y !== 0) {
            x = this.gamepadAxes.x;
            y = this.gamepadAxes.y;
        }

        const mag = Math.sqrt(x * x + y * y);
        if (mag > 1) { x /= mag; y /= mag; }
        return { x, y };
    }
}

window.InputHandler = InputHandler;
