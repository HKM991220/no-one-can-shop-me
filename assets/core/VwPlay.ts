/**
 * @Descripttion:
 * @version: 1.0
 * @Author: Lioesquieu
 * @Date: 2025-07-20
 * @LastEditors: Lioesquieu
 * @LastEditTime:2025-07-20
 */
import { _decorator, Component, director, Label, Node } from 'cc';
import { I18n } from '../common/i18n/I18n';
import { VwFunland } from "./VwFunland";
import { VwUi } from "./VwUi";
import CwgState from "./CwgState";
import FunlandInfo from './FunlandInfo';
import { GlobalPlayerData } from '../common/GlobalPlayerData';
import EventMng from '../common/EventMng';
import { EventName } from '../common/Enum';
import { GameplayConst } from './CwgConstant';

const { ccclass, menu, property } = _decorator;

@ccclass('VwPlay')
@menu('cwg/VwPlay')
export class VwPlay extends Component {

    @property(VwFunland)
    protected play: VwFunland;

    @property(VwUi)
    protected ui: VwUi;

    @property(Node)
    protected blockerNode: Node | null = null;

    @property(Node)
    protected exchangeBlockerNode: Node | null = null;

    @property(Node)
    protected exchangeTipsNode: Node | null = null;

    @property(Node)
    protected tipLabel: Node | null = null;

    @property({ tooltip: '兑换提示文案的 i18n 键，对应 resources/i18n/*.json' })
    protected exchangeTipI18nKey = 'game.exchangeTip';

    public funland: FunlandInfo;
    public gameState: CwgState;

    private _restartLevelBusy = false;
    private _restartLevelPending = false;
    private _restartLevelPendingConsumeStamina = false;
    private _pendingStartRound = false;

    protected onEnable(): void {
        EventMng.on(EventName.GAME_CONCLUDE_NEXT, this.onConcludeNext, this);
        EventMng.on(EventName.EXCHANGE_UI_OPENED, this.onExchangeUiOpened, this);
        EventMng.on(EventName.EXCHANGE_UI_CLOSED, this.onExchangeUiClosed, this);
        this.exchangeBlockerNode.on(Node.EventType.TOUCH_END, this.onExchangeUiClosed, this);
        I18n.instance.on(I18n.EVENT_LANGUAGE_CHANGED, this.applyExchangeTipLabel, this);
        this.applyExchangeTipLabel();
        // 面板曾被隐藏再显示时同步存档关卡（教程通关只写了 GlobalPlayerData 时，内存里的 CwgState 可能仍是 0）
        if (this.gameState && this.funland) {
            void this.restartLevel(false);
        }
    }

    protected onDisable(): void {
        EventMng.off(EventName.GAME_CONCLUDE_NEXT, this.onConcludeNext, this);
        EventMng.off(EventName.EXCHANGE_UI_OPENED, this.onExchangeUiOpened, this);
        EventMng.off(EventName.EXCHANGE_UI_CLOSED, this.onExchangeUiClosed, this);
        this.exchangeBlockerNode.off(Node.EventType.TOUCH_END, this.onExchangeUiClosed, this);
        I18n.instance.off(I18n.EVENT_LANGUAGE_CHANGED, this.applyExchangeTipLabel, this);
    }

    private onExchangeUiOpened(): void {
        this.exchangeBlockerNode.active = true;
        this.exchangeTipsNode.active = true;
        this.applyExchangeTipLabel();
    }

    private applyExchangeTipLabel(): void {
        const label = this.tipLabel?.getComponent(Label);
        if (!label?.isValid || !this.exchangeTipI18nKey) {
            return;
        }
        label.string = I18n.instance.t(this.exchangeTipI18nKey);
    }

    private onExchangeUiClosed(): void {
        this.exchangeBlockerNode.active = false;
        this.exchangeTipsNode.active = false;
    }

    /**
     * 从大厅等入口进入游戏时调用：Game 节点可能一直为 active（未走 onDisable/onEnable），
     * 需强制按 GlobalPlayerData 重新拉关并重置场面。
     * 注意：`SimpleUIManager.open` resolve 时 `start()` 可能尚未执行，此时会跳过，由 `start()` 内首次 `restartLevel` 完成加载。
     */
    public syncProgressAndRestart(): void {
        if (!this.canRunRestart()) {
            return;
        }
        void this.restartLevel(false);
    }

    /**
     * 开始一局新游戏（消耗体力并重置关卡）。
     * @returns false 表示体力不足，true 表示已启动或已进入启动队列
     */
    public startRound(): boolean {
        this.exchangeBlockerNode.active = false;
        if (!this.canStartRound()) {
            this.emitResourceChanged();
            return false;
        }
        if (!this.canRunRestart()) {
            this._pendingStartRound = true;
            return true;
        }
        void this.restartLevel(true);
        return true;
    }

    public canStartRound(): boolean {
        return GlobalPlayerData.instance.stamina >= GameplayConst.STAMINA_COST_PER_ROUND;
    }

    /**
     * 结算「下一关」：通关且需进关时先 nextLevel，再按存档重置场面（与 ConcludeView 按钮共用逻辑）。
     */
    public applyConcludeNext(advance: boolean): void {
        if (!this.canRunRestart()) {
            return;
        }
        if (advance) {
            this.funland.nextLevel();
        }
        void this.restartLevel(true);
    }

    /** `start()` 创建 gameState 之前不能重置，否则 `gameState.reset` 会报错 */
    private canRunRestart(): boolean {
        return !!(
            this.gameState &&
            this.funland &&
            this.play?.isValid &&
            this.ui?.isValid
        );
    }

    private onConcludeNext(payload?: { advance?: boolean }): void {
        this.applyConcludeNext(payload?.advance === true);
    }

    start() {
        this.gameState = new CwgState();
        this.funland = new FunlandInfo();
        this.funland.init(this.gameState);
        if (this._pendingStartRound) {
            this._pendingStartRound = false;
            void this.restartLevel(true);
            return;
        }
        void this.restartLevel(false);
    }

    /**
     * 重新开始当前关卡
     * 重置游戏状态、关卡数据，并重新初始化视图
     */
    protected async restartLevel(consumeStamina: boolean) {
        if (!this.canRunRestart()) {
            return;
        }
        if (this._restartLevelBusy) {
            this._restartLevelPending = true;
            this._restartLevelPendingConsumeStamina =
                this._restartLevelPendingConsumeStamina || consumeStamina;
            return;
        }
        this._restartLevelBusy = true;
        try {
            do {
                const needConsumeStaminaNow = consumeStamina || this._restartLevelPendingConsumeStamina;
                this._restartLevelPending = false;
                this._restartLevelPendingConsumeStamina = false;
                if (needConsumeStaminaNow && !GlobalPlayerData.instance.tryConsumeStamina(GameplayConst.STAMINA_COST_PER_ROUND)) {
                    this.emitResourceChanged();
                    break;
                }
                if (needConsumeStaminaNow) {
                    this.emitResourceChanged();
                }
                // 重置游戏状态
                this.gameState.reset();
                // 重置关卡数据（内部 getData 会 syncLevelFromGlobal）
                await this.funland.reset();

                this.play.reset(this.funland);
                this.ui.reset(this.gameState.info);
                this.applyTutorialBlocker();

                // 开始游戏
                this.play.playStart();
                this.applyExchangeTipLabel();
                consumeStamina = false;
            } while (this._restartLevelPending);
        } finally {
            this._restartLevelBusy = false;
        }
    }

    private applyTutorialBlocker(): void {
        if (!this.blockerNode?.isValid) {
            return;
        }
        this.blockerNode.active = GlobalPlayerData.instance.level === 0;
    }

    private emitResourceChanged(): void {
        EventMng.emit(EventName.PLAYER_RESOURCE_CHANGED, {
            coins: GlobalPlayerData.instance.coins,
            stamina: GlobalPlayerData.instance.stamina,
        });
    }

    /**
     * 切换到上一个或下一个关卡
     * @param _ - 事件对象（未使用）
     * @param direction - 切换方向，'-1'表示上一关，其他值表示下一关
     */
    protected switchLevel(_, direction: string) {
        if (direction == '-1') {
            this.funland.preLevel();
        } else {
            this.funland.nextLevel();
        }
        this.restartLevel(false);
    }

    protected openLevelEditor() {
        director.loadScene('editor');
    }
}