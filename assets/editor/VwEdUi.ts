/**
 * @Descripttion:
 * @version: 1.0
 * @Author: Lioesquieu
 * @Date: 2025-07-20
 * @LastEditors: Lioesquieu
 * @LastEditTime: 2024-08-08
 */
import { _decorator, EditBox, instantiate, Label, Node, UITransform } from 'cc';
import UiEdColumnCount from './UiEdColumnCount';
import EdFunlandInfo, { EdGlassInfo } from './EdFunlandInfo';
import { VwUi } from '../core/VwUi';
import { CwgStateInfo } from '../core/CwgState';
import { LevelStruct } from '../core/FunlandInfo';

const { ccclass, menu, property } = _decorator;

@ccclass('VwEdUi')
@menu('cwg/VwEdUi')
export default class VwEdUi extends VwUi {
    @property(UiEdColumnCount)
    protected colCnt: UiEdColumnCount;

    @property(Node)
    public columnCtrlsContent: Node;

    @property(Node)
    public columnsContent: Node;

    @property(EditBox)
    protected levelDataEditBox: EditBox;

    /** 运行时挂在关卡 JSON 编辑框上方，无需在场景里单独拖引用 */
    private timeLimitEditBox: EditBox | null = null;

    protected onLoad(): void {
        this.ensureTimeLimitEditBox();
    }

    /**
     * 在关卡数据 EditBox 上方生成「限时(秒)」输入行（克隆原 EditBox 以保持样式）
     */
    private ensureTimeLimitEditBox(): void {
        if (this.timeLimitEditBox?.isValid) {
            return;
        }
        const refNode = this.levelDataEditBox?.node;
        if (!refNode?.isValid) {
            return;
        }
        const parent = refNode.parent;
        if (!parent) {
            return;
        }

        const row = new Node('EdTimeLimitRow');
        row.layer = refNode.layer;
        row.parent = parent;
        const rowUt = row.addComponent(UITransform);
        rowUt.setContentSize(420, 52);
        row.setPosition(refNode.position.x, refNode.position.y + 92, refNode.position.z);

        const hint = new Node('TimeLimitHint');
        hint.layer = refNode.layer;
        hint.parent = row;
        const hUt = hint.addComponent(UITransform);
        hUt.setContentSize(160, 44);
        hint.setPosition(-150, 0, 0);
        const hLab = hint.addComponent(Label);
        hLab.string = '限时(秒)';
        hLab.fontSize = 22;
        hLab.lineHeight = 26;

        const boxRoot = instantiate(refNode);
        boxRoot.name = 'TimeLimitEditBox';
        boxRoot.layer = refNode.layer;
        boxRoot.parent = row;
        boxRoot.setPosition(90, 0, 0);
        const boxUt = boxRoot.getComponent(UITransform);
        if (boxUt) {
            boxUt.setContentSize(180, 48);
        }
        const eb = boxRoot.getComponent(EditBox);
        if (eb) {
            eb.string = '0';
            this.timeLimitEditBox = eb;
        }
    }

    private readTimeLimitSec(): number {
        this.ensureTimeLimitEditBox();
        const raw = this.timeLimitEditBox?.string?.trim() ?? '';
        const n = parseInt(raw, 10);
        if (!Number.isFinite(n) || n < 0) {
            return 0;
        }
        return Math.floor(n);
    }

    public reset(info: CwgStateInfo, funlandInfo?: EdFunlandInfo) {
        super.reset(info);
        this.ensureTimeLimitEditBox();
        const sec = funlandInfo?.curLevelData?.timeLimitSec;
        if (this.timeLimitEditBox?.isValid) {
            this.timeLimitEditBox.string = typeof sec === 'number' && sec > 0 ? `${sec}` : '0';
        }
        this.levelDataEditBox.string = JSON.stringify(funlandInfo?.curLevelData);
    }

    public saveLevelData(infos: EdGlassInfo[], funland: EdFunlandInfo) {
        const timeLimitSec = this.readTimeLimitSec();
        const payload: LevelStruct = { level: infos };
        if (timeLimitSec > 0) {
            payload.timeLimitSec = timeLimitSec;
        }
        funland.curLevelData = payload;
        funland.resetLvData(payload);

        const level_str = JSON.stringify(payload);
        console.log(level_str);
        this.levelDataEditBox.string = level_str;
    }
}
