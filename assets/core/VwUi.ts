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
import { SimpleUIManager } from '../common/ui/SimpleUIManager';
import { UIPanelId } from '../common/ui/UIPanelRegistry';
import { GlobalPlayerData } from '../common/GlobalPlayerData';
import TutorialGuide from './TutorialGuide';
import { EventName } from '../common/Enum';

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

    /** 场景内挂载的兑换层（非预制体注册，走 show/hide） */
    @property(VwExchange)
    public exchangeView: VwExchange;

    /** 场景内挂载的加杯层（非预制体注册，走 show/hide） */
    @property(VwAddGlass)
    public addGlassView: VwAddGlass;

    @property(Button)
    protected settingButton: Button;

    @property(Node)
    protected bottomNode: Node | null = null;

    @property(TutorialGuide)
    protected tutorialGuide: TutorialGuide | null = null;

    @property({ type: Label, tooltip: '限时关卡剩余时间，未绑定则仅逻辑倒计时无显示' })
    protected timeLabel: Label | null = null;

    @property({ type: Node, tooltip: '倒计时区域根节点，限时>0 时显示' })
    protected timePanel: Node | null = null;

    private timeRemainingSec = 0;

    protected onEnable(): void {
        if (this.settingButton?.isValid) {
            this.settingButton.node.on(Button.EventType.CLICK, this.onSettingClick, this);
        }
    }

    protected onDisable(): void {
        if (this.settingButton?.isValid) {
            this.settingButton.node.off(Button.EventType.CLICK, this.onSettingClick, this);
        }
    }

    private colorBottleTarget: Record<number, number> = {};

    public reset(info: CwgStateInfo) {
        this.stopLevelTimer();
        if (this.bottomNode?.isValid) {
            this.bottomNode.active = info.level !== 0;
        }
        GlobalPlayerData.instance.load();
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
        if (!this.tutorialGuide) {
            this.tutorialGuide = this.getComponentInChildren(TutorialGuide);
        }
        this.tutorialGuide?.bindFunlandView(this.funlandView);
        if (GlobalPlayerData.instance.level === 0) {
            this.tutorialGuide?.beginIfNeeded();
        }
        this.setupLevelTimeLimit();
    }

    protected onDestroy() {
        this.stopLevelTimer();
        EventMng.offTarget(this);
    }

    private setupLevelTimeLimit(): void {
        const limit = Math.max(0, Math.floor(this.funlandView?.funland?.timeLimitSec ?? 0));
        const active = limit > 0;
        if (this.timePanel?.isValid) {
            this.timePanel.active = active;
        }
        if (!active) {
            if (this.timeLabel?.isValid) {
                this.timeLabel.string = '';
            }
            return;
        }
        this.timeRemainingSec = limit;
        this.refreshTimeLabel();
        this.schedule(this.onLevelTimeTick, 1);
    }

    private stopLevelTimer(): void {
        this.unschedule(this.onLevelTimeTick);
    }

    private onLevelTimeTick(): void {
        if (!this.funlandView?.isValid || this.funlandView.finished) {
            this.stopLevelTimer();
            return;
        }
        this.timeRemainingSec -= 1;
        this.refreshTimeLabel();
        if (this.timeRemainingSec <= 0) {
            this.stopLevelTimer();
            this.triggerLevelFail();
        }
    }

    private refreshTimeLabel(): void {
        if (!this.timeLabel?.isValid) {
            return;
        }
        const s = Math.max(0, this.timeRemainingSec);
        const m = Math.floor(s / 60);
        const r = s % 60;
        const rs = r < 10 ? `0${r}` : `${r}`;
        this.timeLabel.string = `${m}:${rs}`;
    }

    private triggerLevelFail(): void {
        if (!this.funlandView?.isValid || this.funlandView.finished) {
            return;
        }
        this.funlandView.finished = true;
        console.log('[LevelFail] 时间到，未完成');
        EventMng.emit(EventName.LEVEL_FAILED);
        void SimpleUIManager.instance
            .open(UIPanelId.CONCLUDE, { success: false }, { pushToStack: false })
            .then((ok) => {
                if (!ok) {
                    console.warn('[VwUi] 打开结算失败：Conclude 未注册或 SimpleUIManager 未就绪');
                }
            });
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
        this.stopLevelTimer();
        this.funlandView.finished = true;
        console.log('[LevelPass] 通关！可进入下一关');
        const levelBeforePass = GlobalPlayerData.instance.level;
        EventMng.emit('levelPassed');
        GlobalPlayerData.instance.load();
        /** 教程首通在 levelPassed 里已从 0→1，结算「下一关」不应再 +1 */
        const skipAdvanceOnNext =
            levelBeforePass === 0 && GlobalPlayerData.instance.level > levelBeforePass;
        const coinReward = Math.max(0, Math.floor(this.funlandView?.funland?.coinReward ?? 0));
        void SimpleUIManager.instance
            .open(
                UIPanelId.CONCLUDE,
                { success: true, skipAdvanceOnNext, coinReward },
                { pushToStack: false },
            )
            .then((ok) => {
                if (!ok) {
                    console.warn('[VwUi] 打开结算失败：Conclude 未注册或 SimpleUIManager 未就绪');
                }
            });
    }

    protected handleProp(_, propName: string) {
        if (propName === 'exchange') {
            this.exchangeView?.show();
        } else if (propName === 'undo') {
            this.funlandView.handleUndo();
            this.updateUndoDisplayState();
        } else if (propName === 'addEmptyGlass') {
            this.addGlassView?.show();
        }
    }

    protected onSettingClick(): void {
        // 使用新UI框架打开设置界面
        void SimpleUIManager.instance.open(UIPanelId.SETTING, undefined, { pushToStack: false }).then((ok) => {
            if (!ok) {
                console.warn('[VwUi] 打开设置失败：Setting 未注册或 SimpleUIManager 未就绪');
            }
        });
    }
}
