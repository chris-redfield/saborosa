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
        // Optional second looping track layered ON TOP of the music, like a
        // stem/channel (e.g. the altitude "beats" layer). Play/stop keeps its
        // position, so re-entering feels like unmuting a channel.
        this.layer = null;
        this.layerScale = 1;
        this._layerOn = false;
        this.muted = false;
        this._started = false;
    }

    _applyVolume() {
        if (this.music) {
            this.music.volume = this.muted ? 0 : this.musicVolume * this.trackScale;
        }
        if (this.layer) {
            this.layer.volume = this.muted ? 0 : this.musicVolume * this.layerScale;
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

    // Swap to a different track (e.g. intro music → gameplay music). Pauses
    // the current one; if playback was already unlocked by a user gesture the
    // new track starts immediately, otherwise it becomes the track that the
    // first-gesture unlock will start. Volume/mute settings carry over.
    // `trackScale` plays this track at a fraction of the music volume.
    switchMusic(src, trackScale = 1) {
        const wasPlaying = this._started;
        if (this.music) this.music.pause();
        this.trackScale = trackScale;
        this.loadMusic(src);
        if (wasPlaying) {
            this._started = false; // re-arm playMusic for the new element
            this.playMusic();
        }
    }

    // Prime the layered track (doesn't play yet — playLayer/stopLayer drive it).
    loadLayer(src, trackScale = 1) {
        const a = new Audio();
        a.src = src;
        a.loop = true;
        a.preload = 'auto';
        this.layer = a;
        this.layerScale = trackScale;
        this._layerOn = false;
        this._applyVolume();
    }

    // Both are cheap to call every frame — they no-op unless the state flips.
    playLayer() {
        if (!this.layer || this._layerOn) return;
        this._layerOn = true;
        const p = this.layer.play();
        if (p && p.catch) p.catch(() => { this._layerOn = false; });
    }

    stopLayer() {
        if (!this.layer || !this._layerOn) return;
        this._layerOn = false;
        this.layer.pause(); // keeps position — resumes where it left off
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
