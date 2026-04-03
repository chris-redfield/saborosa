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

        this.keyMap = {
            'KeyW': 'up', 'ArrowUp': 'up',
            'KeyS': 'down', 'ArrowDown': 'down',
            'KeyA': 'left', 'ArrowLeft': 'left',
            'KeyD': 'right', 'ArrowRight': 'right',
            'Space': 'attack',
            'KeyE': 'interact',
            'ShiftLeft': 'dash', 'ShiftRight': 'dash',
            'KeyR': 'run',
            'KeyP': 'pause',

            'Escape': 'escape',
            'KeyC': 'debug'
        };

        this.gamepadMap = {
            0: 'attack', 3: 'interact',
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

        this.gamepadAxes.x = Math.abs(this.gamepad.axes[0] || 0) > this.deadzone ? this.gamepad.axes[0] : 0;
        this.gamepadAxes.y = Math.abs(this.gamepad.axes[1] || 0) > this.deadzone ? this.gamepad.axes[1] : 0;

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
