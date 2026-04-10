import { _decorator, Node } from "cc";
import { SimpleUIBase } from "../common/ui/SimpleUIBase";
import { SimpleUIManager } from "../common/ui/SimpleUIManager";
import { UIPanelId } from "../common/ui/UIPanelRegistry";
import { TTMinis } from "../common/sdk/TTMinis";
import EventMng from "../common/EventMng";
import { EventName } from "../common/Enum";
import { VwPlay } from "./VwPlay";
import { GlobalPlayerData } from "../common/GlobalPlayerData";

const { ccclass, menu, property } = _decorator;

/** SimpleUIManager.open(Conclude, data) 传入 */
export type ConcludeViewOpenData = {
    success?: boolean;
    /** 教程首通已在 levelPassed 中提升关卡，点「下一关」时不应再执行 nextLevel */
    skipAdvanceOnNext?: boolean;
    /** 本关通关金币奖励（来自关卡 JSON `coinReward`，打开结算成功页时发放） */
    coinReward?: number;
};

@ccclass("ConcludeView")
@menu("cwg/ConcludeView")
export default class ConcludeView extends SimpleUIBase {
    /** 结算成功时显示的彩带节点（Inspector 手动挂载） */
    @property(Node)
    public caidaiNode: Node | null = null;

    /** 结算成功标题节点（通常是 "level complete"，Inspector 手动挂载） */
    @property(Node)
    public winNode: Node | null = null;

    /** 结算失败标题节点（通常是 "challenge failed"，Inspector 手动挂载） */
    @property(Node)
    public failedNode: Node | null = null;

    /** 成功结算时显示的「下一关」按钮节点（Inspector 手动挂载） */
    @property(Node)
    public NextNode: Node | null = null;

    /** 失败结算时显示的「重试」按钮节点（Inspector 手动挂载） */
    @property(Node)
    public retryNode: Node | null = null;

    private outcomeSuccess = true;
    private skipAdvanceOnNext = false;

    protected onUIOpen(data?: ConcludeViewOpenData): void {
        super.onUIOpen(data);
        this.outcomeSuccess = data?.success !== false;
        this.skipAdvanceOnNext = data?.skipAdvanceOnNext === true;
        this.applyOutcome(this.outcomeSuccess);
        if (this.outcomeSuccess) {
            const raw = data?.coinReward;
            const coin =
                typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
            if (coin > 0) {
                GlobalPlayerData.instance.addCoins(coin);
                EventMng.emit(EventName.PLAYER_RESOURCE_CHANGED, {
                    coins: GlobalPlayerData.instance.coins,
                    stamina: GlobalPlayerData.instance.stamina,
                });
            }
        }
    }

    private applyOutcome(success: boolean): void {
        const caidai = this.caidaiNode;
        if (caidai?.isValid) {
            caidai.active = success;
        }

        const winTitle = this.winNode;
        if (winTitle?.isValid) {
            winTitle.active = success;
        }

        const nextNode = this.NextNode;
        if (nextNode?.isValid) {
            nextNode.active = success;
        }

        const retryNode = this.retryNode;
        if (retryNode?.isValid) {
            retryNode.active = !success;
        }

        if (success) {
            const fail = this.failedNode;
            if (fail?.isValid) {
                fail.active = false;
            }
            return;
        }

        const fail = this.failedNode;
        if (fail?.isValid) {
            fail.active = true;
        }
    }

    protected async openSala(): Promise<void> {
        SimpleUIManager.instance.close(UIPanelId.CONCLUDE);
        await SimpleUIManager.instance.open(UIPanelId.SALA, undefined, { pushToStack: false });
    }

    // 分享
    protected onShareClick() {
        const sdk = TTMinis.inst;
        sdk
            .share("这个游戏超好玩！", undefined, "from=share_test")
            .then(() => {
                console.log("分享调用成功");
                sdk.toast("已拉起分享");
            })
            .catch((err) => {
                console.log("分享调用失败", err);
                sdk.toast("分享调用失败");
            });
    }

    /**
     * 「下一关」：通关且非教程首通时先进关再重开；失败时同关重开。
     * 预制体里方法名保持 onNxetLevelClick（拼写与按钮绑定一致）。
     * 优先直接驱动 VwPlay：Game 常处于 active，与仅 emit 相比更可靠；找不到 Game 时回退事件。
     */
    protected onNxetLevelClick(): void {
        SimpleUIManager.instance.close(UIPanelId.CONCLUDE);
        const advance = this.outcomeSuccess && !this.skipAdvanceOnNext;

        const gameRoot = SimpleUIManager.instance.getNode(UIPanelId.GAME);
        const vw = gameRoot?.getComponentInChildren(VwPlay);
        if (vw?.isValid) {
            vw.applyConcludeNext(advance);
            return;
        }
        EventMng.emit(EventName.GAME_CONCLUDE_NEXT, { advance });
    }

    // 重开
    protected onRestartClick(): void {
        const gameRoot = SimpleUIManager.instance.getNode(UIPanelId.GAME);
        const vw = gameRoot?.getComponentInChildren(VwPlay);
        if (vw?.isValid) {
            if (!vw.canStartRound()) {
                TTMinis.ensureInitialized().toast("体力不足");
                return;
            }
            SimpleUIManager.instance.close(UIPanelId.CONCLUDE);
            vw.startRound();
            return;
        }
    }
}
