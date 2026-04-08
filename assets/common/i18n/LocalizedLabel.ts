import {_decorator, Component, Label} from 'cc';
import {I18n} from './I18n';

const {ccclass, property} = _decorator;

/**
 * 挂在带 Label 的节点上，填写 i18nKey（如 settings.title），语言切换时自动更新 string。
 */
@ccclass('LocalizedLabel')
export class LocalizedLabel extends Component {
    @property({tooltip: '点分路径，对应 i18n JSON，如 settings.title'})
    i18nKey = '';

    protected onEnable(): void {
        I18n.instance.on(I18n.EVENT_LANGUAGE_CHANGED, this.apply, this);
        this.apply();
    }

    protected onDisable(): void {
        I18n.instance.off(I18n.EVENT_LANGUAGE_CHANGED, this.apply, this);
    }

    public apply(): void {
        if (!this.i18nKey) {
            return;
        }
        const label = this.getComponent(Label);
        if (label?.isValid) {
            label.string = I18n.instance.t(this.i18nKey);
        }
    }
}
