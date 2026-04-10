import { _decorator, Button, Label, Node, Sprite, SpriteFrame, Toggle } from 'cc';
import { GlobalPlayerData } from '../common/GlobalPlayerData';
import { SimpleUIBase } from '../common/ui/SimpleUIBase';
import { SimpleUIManager } from '../common/ui/SimpleUIManager';
import { UIPanelId } from '../common/ui/UIPanelRegistry';
import { I18n } from '../common/i18n/I18n';

const { ccclass, menu, property } = _decorator;

/**
 * 设置页：音乐/音效开关；语言通过国旗 Toggle 切换（与 I18n + GlobalPlayerData 同步）。
 */
@ccclass('SettingView')
@menu('cwg/SettingView')
export default class SettingView extends SimpleUIBase {
    @property(Toggle)
    protected soundToggle: Toggle | null = null;

    @property(Toggle)
    protected effectToggle: Toggle | null = null;

    @property(Label)
    protected countryLabel: Label | null = null;

    @property(Sprite)
    protected countrySp: Sprite | null = null;

    @property(SpriteFrame)
    protected flagZhHans: SpriteFrame | null = null;

    @property(SpriteFrame)
    protected flagEn: SpriteFrame | null = null;

    @property(SpriteFrame)
    protected flagJa: SpriteFrame | null = null;

    @property(SpriteFrame)
    protected flagZhHant: SpriteFrame | null = null;

    @property(SpriteFrame)
    protected flagVi: SpriteFrame | null = null;

    @property(Node)
    protected countryNode: Node | null = null;

    /** 绑定 `country/ToggleGroup`（子节点名为 zh-Hans、en、ja、zh-Hant、vi，各挂 Toggle） */
    @property(Node)
    protected languageToggleGroup: Node | null = null;

    /** 绑定 country 下的关闭按钮（可选） */
    @property(Button)
    protected countryCloseButton: Button | null = null;

    @property(Button)
    protected homeButton: Button | null = null;

    private _syncingUi = false;
    private _syncingLang = false;

    protected onEnable(): void {
        I18n.instance.on(I18n.EVENT_LANGUAGE_CHANGED, this.onLanguageChanged, this);
        this.refreshLanguageUi();
    }

    protected onDisable(): void {
        I18n.instance.off(I18n.EVENT_LANGUAGE_CHANGED, this.onLanguageChanged, this);
    }

    private onLanguageChanged(): void {
        this.refreshLanguageUi();
    }

    private refreshLanguageUi(): void {
        this.refreshText();
        this.refreshCountryFlag();
        this.syncLanguageTogglesFromI18n();
    }

    private refreshText(): void {
        if (this.countryLabel?.isValid) {
            this.countryLabel.string = I18n.instance.t('settings.language');
        }
    }

    private refreshCountryFlag(): void {
        if (!this.countrySp?.isValid) {
            return;
        }
        const frame = this.getFlagByLocale(I18n.instance.locale);
        if (frame) {
            this.countrySp.spriteFrame = frame;
        }
    }

    private getFlagByLocale(locale: string): SpriteFrame | null {
        if (locale === 'en') {
            return this.flagEn;
        }
        if (locale === 'ja') {
            return this.flagJa;
        }
        if (locale === 'zh-Hant') {
            return this.flagZhHant;
        }
        if (locale === 'vi') {
            return this.flagVi;
        }
        return this.flagZhHans;
    }

    /** 打开语言面板：可将「语言」行按钮绑到此方法 */
    public showCountry(): void {
        if (this.countryNode?.isValid) {
            this.countryNode.active = true;
            this.syncLanguageTogglesFromI18n();
        }
    }

    public closeCountry(): void {
        if (this.countryNode?.isValid) {
            this.countryNode.active = false;
        }
    }

    /** 关闭语言面板按钮 */
    public onCloseCountryClick(): void {
        this.closeCountry();
    }

    public onCloseClick(): void {
        SimpleUIManager.instance.close(UIPanelId.SETTING);
    }

    protected onUIOpen(): void {
        this.refreshFromSettings();
        this.bindControls();
        this.refreshLanguageUi();
    }

    protected offButtonListeners(): void {
        this.unbindControls();
    }

    private refreshFromSettings(): void {
        this._syncingUi = true;
        try {
            const data = GlobalPlayerData.instance;
            if (this.soundToggle) {
                this.soundToggle.isChecked = data.isMusicEnabled();
            }
            if (this.effectToggle) {
                this.effectToggle.isChecked = data.isSfxEnabled();
            }
        } finally {
            this._syncingUi = false;
        }
    }

    private bindControls(): void {
        if (this.soundToggle) {
            this.soundToggle.node.on(Toggle.EventType.TOGGLE, this.onSoundToggle, this);
        }
        if (this.effectToggle) {
            this.effectToggle.node.on(Toggle.EventType.TOGGLE, this.onEffectToggle, this);
        }
        this.bindLanguageToggles();
        if (this.countryCloseButton?.node?.isValid) {
            this.countryCloseButton.node.on(Button.EventType.CLICK, this.onCloseCountryClick, this);
        }
    }

    private unbindControls(): void {
        if (this.soundToggle?.isValid) {
            this.soundToggle.node.off(Toggle.EventType.TOGGLE, this.onSoundToggle, this);
        }
        if (this.effectToggle?.isValid) {
            this.effectToggle.node.off(Toggle.EventType.TOGGLE, this.onEffectToggle, this);
        }
        this.unbindLanguageToggles();
        if (this.countryCloseButton?.node?.isValid) {
            this.countryCloseButton.node.off(Button.EventType.CLICK, this.onCloseCountryClick, this);
        }
    }

    private bindLanguageToggles(): void {
        const root = this.languageToggleGroup;
        if (!root?.isValid) {
            return;
        }
        for (const child of root.children) {
            const tg = child.getComponent(Toggle);
            if (tg) {
                tg.node.on(Toggle.EventType.TOGGLE, this.onLanguageToggle, this);
            }
        }
    }

    private unbindLanguageToggles(): void {
        const root = this.languageToggleGroup;
        if (!root?.isValid) {
            return;
        }
        for (const child of root.children) {
            const tg = child.getComponent(Toggle);
            if (tg) {
                tg.node.off(Toggle.EventType.TOGGLE, this.onLanguageToggle, this);
            }
        }
    }

    /** 根据当前 I18n 语言勾选对应 Toggle，不触发 setLocale */
    private syncLanguageTogglesFromI18n(): void {
        const root = this.languageToggleGroup;
        if (!root?.isValid) {
            return;
        }
        const locale = I18n.instance.locale;
        this._syncingLang = true;
        try {
            for (const child of root.children) {
                const tg = child.getComponent(Toggle);
                if (tg) {
                    tg.isChecked = child.name === locale;
                }
            }
        } finally {
            this._syncingLang = false;
        }
    }

    private onLanguageToggle(toggle: Toggle): void {
        if (this._syncingLang) {
            return;
        }
        if (!toggle.isChecked) {
            return;
        }
        const localeId = toggle.node.name;
        void I18n.instance.setLocale(localeId).then(() => {
            this.closeCountry();
        });
    }



    private onSoundToggle(toggle: Toggle): void {
        if (this._syncingUi) {
            return;
        }
        GlobalPlayerData.instance.setMusicEnabled(toggle.isChecked);
    }

    private onEffectToggle(toggle: Toggle): void {
        if (this._syncingUi) {
            return;
        }
        GlobalPlayerData.instance.setSfxEnabled(toggle.isChecked);
    }

    private onHomeClick(): void {
        SimpleUIManager.instance.open(UIPanelId.SALA);
        SimpleUIManager.instance.close(UIPanelId.SETTING);
    }


    private closeView(): void {
        SimpleUIManager.instance.close(UIPanelId.SETTING);
    }
}
