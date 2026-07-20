/**
 * Audio Manager - Background music playback.
 *
 * Browsers block audio playback until the user interacts with the page, so
 * the track is primed up front but only started on the first key press / click.
 * A streamed HTMLAudioElement is used (rather than Web Audio decoding) so the
 * mp3 plays progressively without holding the whole decoded buffer in memory.
 */
class AudioManager {
    constructor() {
        this.music = null;
        this.musicVolume = 0.5;
        // Per-track loudness factor on top of musicVolume — lets one song play
        // quieter than another without touching the global volume/mute knobs.
        this.trackScale = 1;
        // Looping tracks layered ON TOP of the music, each its own channel
        // (e.g. the gameplay 'bass' that joins on START, and the altitude
        // 'beats'). Keyed by name; play/stop keeps position, so re-entering
        // feels like unmuting a channel rather than restarting it.
        this.layers = Object.create(null);  // name -> { audio, scale, on }
        this.muted = false;
        this._started = false;
    }

    _applyVolume() {
        if (this.music) {
            this.music.volume = this.muted ? 0 : this.musicVolume * this.trackScale;
        }
        for (const name in this.layers) {
            const L = this.layers[name];
            L.audio.volume = this.muted ? 0 : this.musicVolume * L.scale;
        }
    }

    loadMusic(src) {
        const audio = new Audio();
        audio.src = src;
        audio.loop = true;
        audio.preload = 'auto';
        this.music = audio;
        this._applyVolume();
    }

    // Prime a named layered track (doesn't play yet — playLayer/stopLayer drive
    // it). `scale` plays it at a fraction of the music volume. `playbackRate`
    // < 1 plays it slower (e.g. 0.8 = 20% slower tempo; the browser keeps pitch
    // by default via preservesPitch).
    loadLayer(name, src, scale = 1, playbackRate = 1) {
        const a = new Audio();
        a.src = src;
        a.loop = true;
        a.preload = 'auto';
        a.playbackRate = playbackRate;
        this.layers[name] = { audio: a, scale, on: false };
        this._applyVolume();
    }

    // Hand off from intro to gameplay. The intro theme is ALWAYS cut here — it
    // plays under the title + fruit-select screens and stops the moment gameplay
    // begins.
    // The bass NO LONGER joins here — it starts on the player's first movement
    // after entering the game, and drops out while the batuque (beats) plays
    // (driven from updateGame). This keeps the spawn quiet until the player acts.
    startGameplay() {
        if (this.music) this.music.pause();
    }

    // Return to the title/menu: drop the gameplay layers and resume the theme
    // (MIKE.mp3), which was paused when gameplay began. Used on game-over.
    startMenu() {
        this.stopLayer('bass');
        this.stopLayer('beats');
        if (this.music) {
            const p = this.music.play();
            if (p && p.catch) p.catch(() => {});
        }
    }

    // Both are cheap to call every frame — they no-op unless the state flips.
    playLayer(name) {
        const L = this.layers[name];
        if (!L || L.on) return;
        L.on = true;
        const p = L.audio.play();
        if (p && p.catch) p.catch(() => { L.on = false; });
    }

    stopLayer(name) {
        const L = this.layers[name];
        if (!L || !L.on) return;
        L.on = false;
        L.audio.pause(); // keeps position — resumes where it left off
    }

    // Begin playback. Safe to call repeatedly — only the first successful call
    // (after a user gesture) actually starts the track.
    playMusic() {
        if (!this.music || this._started) return;
        const p = this.music.play();
        if (p && p.catch) {
            p.then(() => { this._started = true; })
             .catch(() => { /* blocked until a user gesture — retry on next one */ });
        } else {
            this._started = true;
        }
    }

    // Wire the first user gesture to kick off playback. Listeners remove
    // themselves once the music is going.
    unlockOnFirstGesture() {
        const tryStart = () => {
            this.playMusic();
            if (this._started) {
                window.removeEventListener('keydown', tryStart);
                window.removeEventListener('pointerdown', tryStart);
            }
        };
        window.addEventListener('keydown', tryStart);
        window.addEventListener('pointerdown', tryStart);
    }

    setVolume(v) {
        this.musicVolume = Math.max(0, Math.min(1, v));
        this._applyVolume();
    }

    toggleMute() {
        return this.setMuted(!this.muted);
    }

    // Explicitly set the muted state (used by the intro's VOLUME OFF/ON).
    setMuted(m) {
        this.muted = !!m;
        this._applyVolume();
        return this.muted;
    }
}

window.AudioManager = AudioManager;
