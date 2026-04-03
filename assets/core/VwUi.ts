/**
 * @Descripttion:
 * @version: 1.0
 * @Author: Lioesquieu
 * @Date: 2025-07-20
 * @LastEditors: Lioesquieu
 * @LastEditTime: 2024-08-08
 */
import {_decorator, Component, Label, Button, Sprite} from 'cc';
import { CwgStateInfo } from './CwgState';
import { VwFunland } from './VwFunland';
import EventMng from '../common/EventMng';
import { VwExchange } from './prop-anims/VwExchange';
import { VwAddGlass } from './prop-anims/VwAddGlass';
import { UIManager } from '../common/ui/UIManager';

const {ccclass, menu, property} = _decorator;

@ccclass('VwUi')
@menu('cwg/VwUi')
export class VwUi extends Component {
    private static readonly UI_ID_EXCHANGE = 'exchange';
    private static readonly UI_ID_ADD_EMPTY_GLASS = 'addEmptyGlass';
    private static readonly GLASS_CAPACITY = 4;

    @property(Label)
    protected levelLabel: Label;

    @property(VwFunland)
    protected funlandView: VwFunland;

    @property(Button)
    protected undoButton: Button;

    @property(VwExchange)
    protected exchangeView: VwExchange;

    @property(VwAddGlass)
    protected addGlassView: VwAddGlass;

    private colorBottleTarget: Record<number, number> = {};

    public reset(info: CwgStateInfo) {
        this.levelLabel.string = "第" + (info.level + 1).toString() + "关";
        EventMng.off('completePour', this.handleCompletePour, this);
        EventMng.on('completePour', this.handleCompletePour, this);
        this.registerUI();
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
        UIManager.instance.unregister(VwUi.UI_ID_EXCHANGE);
        UIManager.instance.unregister(VwUi.UI_ID_ADD_EMPTY_GLASS);
        EventMng.offTarget(this);
    }

    protected registerUI() {
        UIManager.instance.register(VwUi.UI_ID_EXCHANGE, {
            open: () => this.exchangeView?.show(),
            close: () => this.exchangeView?.hide(),
        });
        UIManager.instance.register(VwUi.UI_ID_ADD_EMPTY_GLASS, {
            open: () => this.addGlassView?.show(),
            close: () => this.addGlassView?.hide(),
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

    /**
     * 由关卡配置计算：每种颜色最多能装满多少瓶
     * 例：颜色 2 在关卡中总数为 8，容量 4 => 可成 2 瓶
     */
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
        console.log(`[LevelTarget] ${text || '无颜色数据'}`);
    }

    /**
     * 通关判定：所有瓶子都满足“空瓶”或“4层同色密封”
     */
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
        if (propName === "exchange") {
            UIManager.instance.open(VwUi.UI_ID_EXCHANGE);
        } else if (propName === "undo") {
            this.funlandView.handleUndo();
            this.updateUndoDisplayState();
        } else if (propName === "addEmptyGlass") {
            UIManager.instance.open(VwUi.UI_ID_ADD_EMPTY_GLASS);
        }
    }
}