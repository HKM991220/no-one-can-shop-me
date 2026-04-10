import { _decorator, Node, resources, Sprite, SpriteFrame, UITransform } from "cc";
import { SimpleUIBase } from "../common/ui/SimpleUIBase";
import { SimpleUIManager } from "../common/ui/SimpleUIManager";
import { UIPanelId } from "../common/ui/UIPanelRegistry";
import { TTMinis } from "../common/sdk/TTMinis";
import EventMng from "../common/EventMng";
import { EventName } from "../common/Enum";

const { ccclass, menu } = _decorator;

/** SimpleUIManager.open(Conclude, data) 传入 */
export type ConcludeViewOpenData = {
    success?: boolean;
    /** 教程首通已在 levelPassed 中提升关卡，点「下一关」时不应再执行 nextLevel */
    skipAdvanceOnNext?: boolean;
};

const FAIL_TITLE_RES = "images/conclude/challenge failed";

@ccclass("ConcludeView")
@menu("cwg/ConcludeView")
export default class ConcludeView extends SimpleUIBase {
    private failTitleNode: Node | null = null;
    private outcomeSuccess = true;
    private skipAdvanceOnNext = false;

    protected onUIOpen(data?: ConcludeViewOpenData): void {
        super.onUIOpen(data);
        this.outcomeSuccess = data?.success !== false;
        this.skipAdvanceOnNext = data?.skipAdvanceOnNext === true;
        void this.applyOutcome(this.outcomeSuccess);
    }

    private async applyOutcome(success: boolean): Promise<void> {
        const caidai = this.node.getChildByName("caidai");
        if (caidai?.isValid) {
            caidai.active = success;
        }

        const winTitle = this.node.getChildByName("level complete");
        if (winTitle?.isValid) {
            winTitle.active = success;
        }

        if (success) {
            const fail = this.node.getChildByName("challenge failed") ?? this.failTitleNode;
            if (fail?.isValid) {
                fail.active = false;
            }
            return;
        }

        await this.showFailTitle();
    }

    private async showFailTitle(): Promise<void> {
        let node = this.node.getChildByName("challenge failed") ?? this.failTitleNode;
        if (node?.isValid) {
            node.active = true;
            return;
        }

        try {
            const sf = await new Promise<SpriteFrame>((resolve, reject) => {
                resources.load(FAIL_TITLE_RES, SpriteFrame, (err, asset) => {
                    if (err || !asset) {
                        reject(err ?? new Error("empty SpriteFrame"));
                    } else {
                        resolve(asset);
                    }
                });
            });
            node = new Node("challenge failed");
            const ut = node.addComponent(UITransform);
            ut.setContentSize(sf.width, sf.height);
            const sp = node.addComponent(Sprite);
            sp.spriteFrame = sf;
            node.setParent(this.node);
            const win = this.node.getChildByName("level complete");
            if (win?.isValid) {
                node.setPosition(win.position);
            } else {
                node.setPosition(0, -219.706, 0);
            }
            this.failTitleNode = node;
        } catch (e) {
            console.warn("[ConcludeView] 加载失败标题图失败", e);
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
     */
    protected onNxetLevelClick(): void {
        SimpleUIManager.instance.close(UIPanelId.CONCLUDE);
        const advance = this.outcomeSuccess && !this.skipAdvanceOnNext;
        EventMng.emit(EventName.GAME_CONCLUDE_NEXT, { advance });
    }
}
