/**
 * @Descripttion:
 * 使用交换道具：先显示一层选择特效，提示用户选择一个瓶子。选择瓶子后，完成选中瓶子内水层的随机交换
 * @version: 1.0
 * @Author: Lioesquieu
 * @Date: 2025-08-07
 * @LastEditors: Lioesquieu
 * @LastEditTime: 2025-08-07
 */
import {
    _decorator,
    BlockInputEvents,
    Component,
    instantiate,
    Node,
    Prefab,
    UITransform,
    Widget,
} from 'cc';
import { VwFunland } from '../VwFunland';
import { EventName } from '../../common/Enum';
import EventMng from '../../common/EventMng';

const { ccclass, menu, property } = _decorator;

@ccclass('VwExchange')
@menu('cwg/VwExchange')
export class VwExchange extends Component {

    @property(Node)
    protected contentNode: Node;

    @property(Prefab)
    protected dmNode: Prefab;

    @property(VwFunland)
    protected funlandView: VwFunland;

    /** 铺在 contentNode 最底层；点到非选瓶区域时 hide → 派发 EXCHANGE_UI_CLOSED */
    private addOutsideChoiceBackdrop(): void {
        const backdrop = new Node('VwExchangeOutsideChoice');
        const ui = backdrop.addComponent(UITransform);
        ui.setContentSize(4000, 4000);
        const widget = backdrop.addComponent(Widget);
        widget.isAlignTop = true;
        widget.isAlignBottom = true;
        widget.isAlignLeft = true;
        widget.isAlignRight = true;
        widget.top = widget.bottom = widget.left = widget.right = 0;
        widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;
        backdrop.addComponent(BlockInputEvents);
        backdrop.parent = this.contentNode;
        backdrop.setSiblingIndex(0);
        backdrop.on(Node.EventType.TOUCH_END, this.onOutsideChoiceTouchEnd, this);
    }

    private onOutsideChoiceTouchEnd(): void {
        this.hide();
    }

    public show() {
        if (!this.dmNode) {
            console.error('[VwExchange] dmNode 未绑定，无法实例化选择特效');
            this.hide();
            return;
        }
        this.node.active = true;
        this.contentNode.removeAllChildren();
        this.addOutsideChoiceBackdrop();
        let showCount = 0;
        this.funlandView.glasses.forEach((glass) => {
            if (glass.isAd() || glass.isEmpty || glass.isSealed() || glass.isAllHide()) {
                return;
            }
            const node = instantiate(this.dmNode);
            node.active = true;
            node.parent = this.contentNode;
            node.worldPosition = glass.node.worldPosition;

            node.once(Node.EventType.TOUCH_END, () => {
                this.funlandView.handleRandExchangeColors(glass, () => {
                    if (this.isValid) {
                        this.hide();
                    }
                });
            }, this);
            showCount++;
        });
        if (showCount === 0) {
            this.hide();
        }
    }

    public hide() {
        this.contentNode.removeAllChildren();
        this.node.active = false;
        EventMng.emit(EventName.EXCHANGE_UI_CLOSED);
    }
}