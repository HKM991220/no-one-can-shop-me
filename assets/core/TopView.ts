import { _decorator, Button, Component, Label, } from "cc";
import { EventName } from "../common/Enum";
import EventMng from "../common/EventMng";
import { GlobalPlayerData } from "../common/GlobalPlayerData";
import { SimpleUIManager } from "../common/ui/SimpleUIManager";
import { UIPanelId } from "../common/ui/UIPanelRegistry";

const { ccclass, menu, property } = _decorator;

/**
 * 主场景入口：使用新UI框架 SimpleUIManager
 */
@ccclass("TopView")
@menu("cwg/TopView")
export class TopView extends Component {
    @property({ type: Button })
    protected btnSetting: Button | null = null;

    @property({ type: Label, tooltip: "金币" })
    protected labelGold: Label | null = null;

    @property({ type: Label, tooltip: "体力" })
    protected labelStamina: Label | null = null;

    protected onEnable(): void {
        this.btnSetting?.node.on(Button.EventType.CLICK, this.onSettingClick, this);
        EventMng.on(EventName.PLAYER_RESOURCE_CHANGED, this.initUI, this);
    }

    protected onDisable(): void {
        this.btnSetting?.node.off(Button.EventType.CLICK, this.onSettingClick, this);
        EventMng.off(EventName.PLAYER_RESOURCE_CHANGED, this.initUI, this);
        this.unschedule(this.onStaminaTick);
    }

    protected async start(): Promise<void> {
        this.initUI();
    }

    initUI(): void {
        const playerData = GlobalPlayerData.instance;
        if (this.labelGold?.isValid) {
            this.labelGold.string = `${playerData.coins}`;
        }
        if (this.labelStamina?.isValid) {
            if (playerData.stamina >= playerData.staminaMax) {
                this.labelStamina.string = `${playerData.stamina}`;
            } else {
                const remainMs = playerData.getNextStaminaRecoverRemainMs();
                this.labelStamina.string = this.formatRemainMs(remainMs);
            }
        }
    }

    private onStaminaTick = (): void => {
        this.initUI();
    };

    private formatRemainMs(ms: number): string {
        const totalSec = Math.max(0, Math.ceil(ms / 1000));
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        const secStr = sec < 10 ? `0${sec}` : `${sec}`;
        return `${min}:${secStr}`;
    }

    private onSettingClick(): void {
        const flag = this.isGameViewVisible();
        console.log('isGameViewVisible', flag);

        void SimpleUIManager.instance.open(UIPanelId.SETTING, flag, {
            pushToStack: false,
        });
    }

    /** 判断 GameView 当前是否显示在层级中 */
    private isGameViewVisible(): boolean {
        const ui = SimpleUIManager.instance;
        const gameVisible = ui.isOpen(UIPanelId.GAME);
        if (!gameVisible) {
            return false;
        }

        // Game 可能因缓存仍处于 active；若大厅/剧情/结算正在显示，则视为“非游戏中打开”
        const blockedByOtherPanels =
            ui.isOpen(UIPanelId.SALA) ||
            ui.isOpen(UIPanelId.STORY_LINE) ||
            ui.isOpen(UIPanelId.CONCLUDE);
        return !blockedByOtherPanels;
    }
}
