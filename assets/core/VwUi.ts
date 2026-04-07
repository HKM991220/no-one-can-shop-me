/**
 * @Descripttion:
 * @version: 1.0
 * @Author: Lioesquieu
 * @Date: 2025-07-20
 * @LastEditors: Lioesquieu
 * @LastEditTime: 2024-08-08
 */
import { _decorator, Component, Label, Button, Node, Sprite } from 'cc';
import { CwgStateInfo } from './CwgState';
import { VwFunland } from './VwFunland';
import EventMng from '../common/EventMng';
import { VwExchange } from './prop-anims/VwExchange';
import { VwAddGlass } from './prop-anims/VwAddGlass';
import { UIId } from '../common/Enum';
import { attachGameWorld, detachGameWorld, UI } from '../common/ui/UIService';

const { ccclass, menu, property } = _decorator;

@ccclass('VwUi')
@menu('cwg/VwUi')
export class VwUi extends Component {
    private static readonly GLASS_CAPACITY = 4;

    @property(Label)
    protected levelLabel: Label;

    @property(VwFunland)
    protected funlandView: VwFunland;

    @property(Button)
    protected undoButton: Button;

    /** 由 UIService.attachGameWorld 统一注册，需 public 供宿主接口读取 */
    @property(VwExchange)
    public exchangeView: VwExchange;

    @property(VwAddGlass)
    public addGlassView: VwAddGlass;

    @property(Button)
    protected settingButton: Button;

    @property(Node)
    public settingViewRoot: Node | null = null;

    @property(Node)
    public settingAttachParent: Node | null = null;

    protected onEnable(): void {
        if (this.settingButton?.isValid) {
            this.settingButton.node.on(Button.EventType.CLICK, this.onSettingClick, this);
        }
        attachGameWorld(this);
    }

    protected onDisable(): void {
        if (this.settingButton?.isValid) {
            this.settingButton.node.off(Button.EventType.CLICK, this.onSettingClick, this);
        }
        detachGameWorld();
    }

    private colorBottleTarget: Record<number, number> = {};

    public reset(info: CwgStateInfo) {
        this.levelLabel.string = '第' + (info.level + 1).toString() + '关';
        EventMng.off('completePour', this.handleCompletePour, this);
        EventMng.on('completePour', this.handleCompletePour, this);
        this.colorBottleTarget = this.calculateColorBottleTarget();
        this.printColorBottleTarget();
        if (this.exchangeView) {
            this.exchangeView.node.active = false;
        }
        if (this.addGlassView) {
            this.addGlassView.node.active = false;
        }
    }

    protected onDestroy() {
        EventMng.offTarget(this);
    }

    protected handleCompletePour() {
        this.updateUndoDisplayState();
        this.checkLevelPassed();
    }

    protected updateUndoDisplayState() {
        this.undoButton.interactable = this.funlandView.undoStack != undefined;
        this.undoButton.node.getComponent(Sprite).grayscale = !this.undoButton.interactable;
    }

    protected calculateColorBottleTarget(): Record<number, number> {
        const colorCount: Record<number, number> = {};
        const levelGlasses = this.funlandView?.funland?.glasses ?? [];
        for (const glassInfo of levelGlasses) {
            const colors = glassInfo?.colors ?? [];
            for (const color of colors) {
                if (color <= 0) {
                    continue;
                }
                colorCount[color] = (colorCount[color] ?? 0) + 1;
            }
        }

        const target: Record<number, number> = {};
        Object.keys(colorCount).forEach((key) => {
            const color = Number(key);
            const count = colorCount[color];
            if (count % VwUi.GLASS_CAPACITY !== 0) {
                console.warn(`[LevelCheck] 颜色${color} 数量=${count} 不能整除容量${VwUi.GLASS_CAPACITY}`);
            }
            target[color] = Math.floor(count / VwUi.GLASS_CAPACITY);
        });
        return target;
    }

    protected printColorBottleTarget() {
        const text = Object.keys(this.colorBottleTarget)
            .sort((a, b) => Number(a) - Number(b))
            .map((key) => `颜色${key}: ${this.colorBottleTarget[Number(key)]}瓶`)
            .join(', ');
        console.log(this.colorBottleTarget, 'colorBottleTarget');
        console.log(`[LevelTarget] ${text || '无颜色数据'}`);
    }

    protected checkLevelPassed() {
        const glasses = this.funlandView?.glasses ?? [];
        if (glasses.length <= 0) {
            return;
        }
        const passed = glasses.every((glass) => glass.isEmpty || glass.isSealed());
        if (!passed) {
            return;
        }
        this.funlandView.finished = true;
        console.log('[LevelPass] 通关！可进入下一关');
        EventMng.emit('levelPassed');
    }

    protected handleProp(_, propName: string) {
        if (propName === 'exchange') {
            void UI.openAsync(UIId.EXCHANGE);
        } else if (propName === 'undo') {
            this.funlandView.handleUndo();
            this.updateUndoDisplayState();
        } else if (propName === 'addEmptyGlass') {
            void UI.openAsync(UIId.ADD_EMPTY_GLASS);
        }
    }

    protected onSettingClick(): void {
        void UI.openAsync(UIId.SETTING, undefined, { pushToStack: false }).then((ok) => {
            if (!ok) {
                console.warn('[VwUi] 打开设置失败：UIId.SETTING 未注册或 UIService 未就绪');
            }
        });
    }
}
