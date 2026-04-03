/**
 * 全局音乐 / 音效：开关与音量（0~1），写入 LocalStorage，并同步到 AudioManager；
 * 场景内 SoundComp 等通过 getSfxPlayScale 与开关保持一致。
 */
import {AudioManager, AudioMixerConfig} from './AudioManager';
import LocalStorage from './LocalStorage';

const K_MUSIC_ON = 'cwg_audio_music_on';
const K_SFX_ON = 'cwg_audio_sfx_on';
const K_MUSIC_VOL = 'cwg_audio_music_vol';
const K_SFX_VOL = 'cwg_audio_sfx_vol';

function clamp01(n: number): number {
    if (Number.isNaN(n)) {
        return 1;
    }
    return Math.min(1, Math.max(0, n));
}

function parseBool(s: string | null, def: boolean): boolean {
    if (s === null || s === undefined || s === '') {
        return def;
    }
    return s !== '0' && s !== 'false';
}

function parseVol(s: string | null, def: number): number {
    if (!s) {
        return def;
    }
    const n = parseFloat(s);
    return clamp01(Number.isNaN(n) ? def : n);
}

export class GameAudioSettings {
    private static _loaded = false;
    private static _musicOn = true;
    private static _sfxOn = true;
    private static _musicVol = 1;
    private static _sfxVol = 1;
    private static _globalAudio: AudioManager | null = null;

    private static loadStorage(): void {
        if (this._loaded) {
            return;
        }
        this._loaded = true;
        this._musicOn = parseBool(LocalStorage.getItem(K_MUSIC_ON), true);
        this._sfxOn = parseBool(LocalStorage.getItem(K_SFX_ON), true);
        this._musicVol = parseVol(LocalStorage.getItem(K_MUSIC_VOL), 1);
        this._sfxVol = parseVol(LocalStorage.getItem(K_SFX_VOL), 1);
    }

    private static persist(): void {
        LocalStorage.setItem(K_MUSIC_ON, this._musicOn ? '1' : '0');
        LocalStorage.setItem(K_SFX_ON, this._sfxOn ? '1' : '0');
        LocalStorage.setItem(K_MUSIC_VOL, String(this._musicVol));
        LocalStorage.setItem(K_SFX_VOL, String(this._sfxVol));
    }

    private static pushToGlobalAudio(): void {
        const am = this._globalAudio;
        if (!am?.isValid) {
            return;
        }
        am.applyMixerConfig(this.getMixerConfig());
    }

    /** 供 AudioManager.applyMixerConfig 使用 */
    public static getMixerConfig(): AudioMixerConfig {
        this.loadStorage();
        return {
            musicEnabled: this._musicOn,
            sfxEnabled: this._sfxOn,
            musicVolume: this._musicVol,
            sfxVolume: this._sfxVol,
        };
    }

    /**
     * 在 GameBootstrap 创建全局 AudioManager 后注册；销毁时传入 null。
     */
    public static registerAudioManager(am: AudioManager | null): void {
        this.loadStorage();
        this._globalAudio = am?.isValid ? am : null;
        this.pushToGlobalAudio();
    }

    public static isMusicEnabled(): boolean {
        this.loadStorage();
        return this._musicOn;
    }

    public static isSfxEnabled(): boolean {
        this.loadStorage();
        return this._sfxOn;
    }

    public static getMusicVolume(): number {
        this.loadStorage();
        return this._musicVol;
    }

    public static getSfxVolume(): number {
        this.loadStorage();
        return this._sfxVol;
    }

    public static setMusicEnabled(on: boolean): void {
        this.loadStorage();
        this._musicOn = on;
        this.persist();
        this.pushToGlobalAudio();
    }

    public static setSfxEnabled(on: boolean): void {
        this.loadStorage();
        this._sfxOn = on;
        this.persist();
        this.pushToGlobalAudio();
    }

    public static setMusicVolume(v: number): void {
        this.loadStorage();
        this._musicVol = clamp01(v);
        this.persist();
        this.pushToGlobalAudio();
    }

    public static setSfxVolume(v: number): void {
        this.loadStorage();
        this._sfxVol = clamp01(v);
        this.persist();
        this.pushToGlobalAudio();
    }

    /**
     * 场景内 AudioSource.playOneShot 使用的最终系数；关闭音效时为 0。
     */
    public static getSfxPlayScale(baseScale = 1): number {
        this.loadStorage();
        if (!this._sfxOn) {
            return 0;
        }
        return baseScale * this._sfxVol;
    }
}
