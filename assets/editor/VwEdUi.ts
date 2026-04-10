/**
 * @Descripttion:
 * @version: 1.0
 * @Author: Lioesquieu
 * @Date: 2025-07-20
 * @LastEditors: Lioesquieu
 * @LastEditTime: 2024-08-08
 */
import { _decorator, EditBox, Node } from 'cc';
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

    /** 关卡限时（秒），在 editor 场景中绑定独立 EditBox，与关卡 JSON 大输入框同级即可 */
    @property({ type: EditBox, tooltip: '限时（秒），场景内单独放置 EditBox 并拖入' })
    protected timeLimitEditBox: EditBox | null = null;

    /** 通关金币奖励，在 editor 场景中绑定独立 EditBox */
    @property({ type: EditBox, tooltip: '金币奖励，场景内单独放置 EditBox 并拖入' })
    protected coinRewardEditBox: EditBox | null = null;

    private readTimeLimitSec(): number {
        const raw = this.timeLimitEditBox?.string?.trim() ?? '';
        const n = parseInt(raw, 10);
        if (!Number.isFinite(n) || n < 0) {
            return 0;
        }
        return Math.floor(n);
    }

    private readCoinReward(): number {
        const raw = this.coinRewardEditBox?.string?.trim() ?? '';
        const n = parseInt(raw, 10);
        if (!Number.isFinite(n) || n < 0) {
            return 0;
        }
        return Math.floor(n);
    }

    public reset(info: CwgStateInfo, funlandInfo?: EdFunlandInfo) {
        super.reset(info);
        const sec = funlandInfo?.curLevelData?.timeLimitSec;
        if (this.timeLimitEditBox?.isValid) {
            this.timeLimitEditBox.string = typeof sec === 'number' && sec > 0 ? `${sec}` : '0';
        }
        const coin = funlandInfo?.curLevelData?.coinReward;
        if (this.coinRewardEditBox?.isValid) {
            this.coinRewardEditBox.string = typeof coin === 'number' && coin > 0 ? `${coin}` : '0';
        }
        this.levelDataEditBox.string = JSON.stringify(funlandInfo?.curLevelData);
    }

    public saveLevelData(infos: EdGlassInfo[], funland: EdFunlandInfo) {
        const timeLimitSec = this.readTimeLimitSec();
        const coinReward = this.readCoinReward();
        const payload: LevelStruct = { level: infos };
        if (timeLimitSec > 0) {
            payload.timeLimitSec = timeLimitSec;
        }
        if (coinReward > 0) {
            payload.coinReward = coinReward;
        }
        funland.curLevelData = payload;
        funland.resetLvData(payload);

        const level_str = JSON.stringify(payload);
        console.log(level_str);
        this.levelDataEditBox.string = level_str;
    }
}
