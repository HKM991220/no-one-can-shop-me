import { _decorator, Button, Label, Node } from "cc";
import { SimpleUIBase } from "../common/ui/SimpleUIBase";
import { SimpleUIManager } from "../common/ui/SimpleUIManager";
import { UIPanelId } from "../common/ui/UIPanelRegistry";
import EventMng from "../common/EventMng";
import { TTMinis } from "../common/sdk/TTMinis";

const { ccclass, menu, property } = _decorator;

@ccclass("LoadingView")
@menu('cwg/LoadingView')
export default class Loading extends SimpleUIBase {
	
}
