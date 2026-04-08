import { SimpleUIBase } from "../common/ui/SimpleUIBase";
import { _decorator, Button, Label, Node } from "cc";
import { SimpleUIManager } from "../common/ui/SimpleUIManager";
import { UIPanelId } from "../common/ui/UIPanelRegistry";

const { ccclass, menu, property } = _decorator;

@ccclass("SalaView")
@menu('cwg/SalaView')
export default class SalaView extends SimpleUIBase {
    @property(Button)
    protected startButton: Button | null = null;

    protected onEnable(): void {
        if (this.startButton?.isValid) {
            this.startButton.node.on(Button.EventType.CLICK, this.onStartClick, this);
        }
    }

    protected onDisable(): void {
        if (this.startButton?.isValid) {
            this.startButton.node.off(Button.EventType.CLICK, this.onStartClick, this);
        }
    }

    onStartClick() {
        void SimpleUIManager.instance.open(UIPanelId.GAME, undefined, { pushToStack: false });
        SimpleUIManager.instance.close(UIPanelId.SALA);
    }
}
