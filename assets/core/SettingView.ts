import {_decorator, Component, Slider, Toggle} from 'cc';
import {GameAudioSettings} from '../common/AudioSetting';
import {UIId} from '../common/Enum';
import {UI} from '../common/ui/UIService';
import { UIBase } from '../common/ui/UIBase';

const {ccclass, menu, property} = _decorator;

/**
 * 设置页：音乐（背景音）与音效开关，可选音量滑条；读写 GameAudioSettings（本地持久化 + 同步 AudioManager）。
 */
@ccclass('SettingView')
@menu('cwg/SettingView')
export default class SettingView extends UIBase {
    /** 音乐 / 背景音开关 */
    @property(Toggle)
    protected soundToggle: Toggle | null = null;

    /** 音效开关 */
    @property(Toggle)
    protected effectToggle: Toggle | null = null;

    @property({type: Slider, tooltip: '可选：音乐音量 0~1' })
    protected musicVolumeSlider: Slider | null = null;

    @property({type: Slider, tooltip: '可选：音效音量 0~1' })
    protected sfxVolumeSlider: Slider | null = null;

    /** 是否正在用代码回写 UI，避免触发保存逻辑 */
    private _syncingUi = false;

    /**
     * 供关闭按钮在编辑器里绑定：关闭设置面板（UI.close）。
     */
    public onCloseClick(): void {
        UI.close(UIId.SETTING);
    }

    /** 启用时：从存档刷新界面并绑定控件事件 */
    protected onEnable(): void {
        this.refreshFromSettings();
        this.bindControls();
    }

    /** 禁用时：移除事件监听 */
    protected onDisable(): void {
        this.unbindControls();
    }

    /** 从全局音频设置同步到 Toggle / Slider 显示 */
    private refreshFromSettings(): void {
        this._syncingUi = true;
        try {
            if (this.soundToggle) {
                this.soundToggle.isChecked = GameAudioSettings.isMusicEnabled();
            }
            if (this.effectToggle) {
                this.effectToggle.isChecked = GameAudioSettings.isSfxEnabled();
            }
            if (this.musicVolumeSlider) {
                this.musicVolumeSlider.progress = GameAudioSettings.getMusicVolume();
            }
            if (this.sfxVolumeSlider) {
                this.sfxVolumeSlider.progress = GameAudioSettings.getSfxVolume();
            }
        } finally {
            this._syncingUi = false;
        }
    }

    /** 注册开关与滑条的监听 */
    private bindControls(): void {
        if (this.soundToggle) {
            this.soundToggle.node.on(Toggle.EventType.TOGGLE, this.onSoundToggle, this);
        }
        if (this.effectToggle) {
            this.effectToggle.node.on(Toggle.EventType.TOGGLE, this.onEffectToggle, this);
        }
        if (this.musicVolumeSlider) {
            this.musicVolumeSlider.node.on('slide', this.onMusicVolumeSlide, this);
        }
        if (this.sfxVolumeSlider) {
            this.sfxVolumeSlider.node.on('slide', this.onSfxVolumeSlide, this);
        }
    }

    /** 取消注册，防止节点复用时重复监听 */
    private unbindControls(): void {
        if (this.soundToggle?.isValid) {
            this.soundToggle.node.off(Toggle.EventType.TOGGLE, this.onSoundToggle, this);
        }
        if (this.effectToggle?.isValid) {
            this.effectToggle.node.off(Toggle.EventType.TOGGLE, this.onEffectToggle, this);
        }
        if (this.musicVolumeSlider?.isValid) {
            this.musicVolumeSlider.node.off('slide', this.onMusicVolumeSlide, this);
        }
        if (this.sfxVolumeSlider?.isValid) {
            this.sfxVolumeSlider.node.off('slide', this.onSfxVolumeSlide, this);
        }
    }

    /** 音乐开关变更：写入全局并持久化 */
    private onSoundToggle(toggle: Toggle): void {
        if (this._syncingUi) {
            return;
        }
        GameAudioSettings.setMusicEnabled(toggle.isChecked);
    }

    /** 音效开关变更：写入全局并持久化 */
    private onEffectToggle(toggle: Toggle): void {
        if (this._syncingUi) {
            return;
        }
        GameAudioSettings.setSfxEnabled(toggle.isChecked);
    }

    /** 音乐音量滑条拖动：更新全局音乐音量 */
    private onMusicVolumeSlide(slider: Slider): void {
        if (this._syncingUi) {
            return;
        }
        GameAudioSettings.setMusicVolume(slider.progress);
    }

    /** 音效音量滑条拖动：更新全局音效音量 */
    private onSfxVolumeSlide(slider: Slider): void {
        if (this._syncingUi) {
            return;
        }
        GameAudioSettings.setSfxVolume(slider.progress);
    }
}
