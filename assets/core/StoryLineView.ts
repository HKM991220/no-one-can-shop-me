import { _decorator, Button, Sprite, SpriteFrame } from "cc";
import { SimpleUIBase } from "../common/ui/SimpleUIBase";
import { SimpleUIManager } from "../common/ui/SimpleUIManager";
import { UIPanelId } from "../common/ui/UIPanelRegistry";
import { VwPlay } from "./VwPlay";
import { GlobalPlayerData } from "../common/GlobalPlayerData";
import { GameplayConst } from "./CwgConstant";


const { ccclass, menu, property } = _decorator;

@ccclass("StoryLineView")
@menu('cwg/StoryLineView')
export default class StoryLineView extends SimpleUIBase {
    @property(Button)
    protected btnNext: Button | null = null;

    @property({ type: Sprite, tooltip: "剧情图片显示节点（挂 Sprite）" })
    protected storySprite: Sprite | null = null;

    @property({ type: [SpriteFrame], tooltip: "剧情图片列表（按顺序放 5 张）" })
    protected storyFrames: SpriteFrame[] = [];

    private storyIndex = 0;

    protected onEnable(): void {
        this.btnNext?.node.on(Button.EventType.CLICK, this.onClickNext, this);
    }

    protected onDisable(): void {
        this.btnNext?.node.off(Button.EventType.CLICK, this.onClickNext, this);
    }

    protected onUIOpen(data?: any): void {
        super.onUIOpen(data);
        this.storyIndex = 0;
        this.refreshStoryImage();
    }

    private async onClickNext(): Promise<void> {
        const total = this.storyFrames.length;
        if (total <= 0) {
            return;
        }
        if (this.storyIndex >= total - 1) {
            if (GlobalPlayerData.instance.stamina < GameplayConst.STAMINA_COST_PER_ROUND) {
                await SimpleUIManager.instance.open(UIPanelId.SALA, undefined, {
                    pushToStack: false,
                });
                SimpleUIManager.instance.close(UIPanelId.STORY_LINE);
                return;
            }
            SimpleUIManager.instance.close(UIPanelId.STORY_LINE);
            await SimpleUIManager.instance.open(UIPanelId.GAME, undefined, {
                pushToStack: false,
            });
            const gameRoot = SimpleUIManager.instance.getNode(UIPanelId.GAME);
            const started = gameRoot?.getComponentInChildren(VwPlay)?.startRound() !== false;
            if (!started) {
                SimpleUIManager.instance.close(UIPanelId.GAME);
                await SimpleUIManager.instance.open(UIPanelId.SALA, undefined, {
                    pushToStack: false,
                });
            }
            return;
        }
        this.storyIndex += 1;
        this.refreshStoryImage();
    }

    private refreshStoryImage(): void {
        if (!this.storySprite?.isValid) {
            return;
        }
        if (this.storyFrames.length <= 0) {
            this.storySprite.spriteFrame = null;
            return;
        }
        const idx = Math.max(0, Math.min(this.storyIndex, this.storyFrames.length - 1));
        this.storySprite.spriteFrame = this.storyFrames[idx] ?? null;
    }
}
