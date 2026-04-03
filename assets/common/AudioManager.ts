import {_decorator, AudioClip, AudioSource, Component} from 'cc';

const {ccclass} = _decorator;

/** 与 GameAudioSettings 同步的混音参数 */
export interface AudioMixerConfig {
    musicEnabled: boolean;
    sfxEnabled: boolean;
    musicVolume: number;
    sfxVolume: number;
}

/**
 * 全局音频：音效 one-shot 与 BGM，常驻节点下初始化 AudioSource。
 */
@ccclass('AudioManager')
export class AudioManager extends Component {
    private sfx: AudioSource | null = null;
    private bgm: AudioSource | null = null;

    private musicEnabled = true;
    private sfxEnabled = true;
    private musicVolume = 1;
    private sfxVolume = 1;
    /** 最近一次 playMusic 传入的音量系数（未乘全局音乐音量） */
    private lastMusicVolumeArg = 1;

    public async ensureReady(): Promise<void> {
        if (!this.sfx) {
            this.sfx = this.node.addComponent(AudioSource);
            this.sfx.playOnAwake = false;
        }
        if (!this.bgm) {
            this.bgm = this.node.addComponent(AudioSource);
            this.bgm.loop = true;
            this.bgm.playOnAwake = false;
        }
    }

    public applyMixerConfig(cfg: AudioMixerConfig): void {
        this.musicEnabled = cfg.musicEnabled;
        this.sfxEnabled = cfg.sfxEnabled;
        this.musicVolume = cfg.musicVolume;
        this.sfxVolume = cfg.sfxVolume;
        this.refreshBgmPlayback();
    }

    private refreshBgmPlayback(): void {
        if (!this.bgm) {
            return;
        }
        const clip = this.bgm.clip;
        if (!clip) {
            return;
        }
        if (!this.musicEnabled) {
            this.bgm.volume = 0;
            this.bgm.pause();
            return;
        }
        const gain = Math.min(1, this.lastMusicVolumeArg * this.musicVolume);
        this.bgm.volume = gain;
        if (!this.bgm.playing) {
            this.bgm.play();
        }
    }

    public playOneShot(clip: AudioClip | null | undefined, volumeScale = 1): void {
        if (!this.sfxEnabled || !clip || !this.sfx) {
            return;
        }
        const v = volumeScale * this.sfxVolume;
        if (v <= 0) {
            return;
        }
        this.sfx.playOneShot(clip, v);
    }

    public playMusic(clip: AudioClip | null | undefined, volume = 1): void {
        if (!this.bgm) {
            return;
        }
        if (!clip) {
            return;
        }
        this.lastMusicVolumeArg = volume;
        this.bgm.stop();
        this.bgm.clip = clip;
        const gain = this.musicEnabled ? Math.min(1, volume * this.musicVolume) : 0;
        this.bgm.volume = gain;
        if (gain > 0) {
            this.bgm.play();
        }
    }

    public stopMusic(): void {
        this.bgm?.stop();
    }
}
