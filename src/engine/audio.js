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
        this.muted = false;
        this._started = false;
    }

    loadMusic(src) {
        const audio = new Audio();
        audio.src = src;
        audio.loop = true;
        audio.volume = this.musicVolume;
        audio.preload = 'auto';
        this.music = audio;
    }

    // Swap to a different track (e.g. intro music → gameplay music). Pauses
    // the current one; if playback was already unlocked by a user gesture the
    // new track starts immediately, otherwise it becomes the track that the
    // first-gesture unlock will start. Volume/mute settings carry over.
    switchMusic(src) {
        const wasPlaying = this._started;
        if (this.music) this.music.pause();
        this.loadMusic(src);
        this.music.volume = this.muted ? 0 : this.musicVolume;
        if (wasPlaying) {
            this._started = false; // re-arm playMusic for the new element
            this.playMusic();
        }
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
        if (this.music) this.music.volume = this.muted ? 0 : this.musicVolume;
    }

    toggleMute() {
        return this.setMuted(!this.muted);
    }

    // Explicitly set the muted state (used by the intro's VOLUME OFF/ON).
    setMuted(m) {
        this.muted = !!m;
        if (this.music) this.music.volume = this.muted ? 0 : this.musicVolume;
        return this.muted;
    }
}

window.AudioManager = AudioManager;
