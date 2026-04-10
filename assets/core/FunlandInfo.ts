/**
 * @Descripttion:
 * @version: 1.0
 * @Author: Lioesquieu
 * @Date: 2025-07-20
 * @LastEditors: Lioesquieu
 * @LastEditTime: 2025-07-20
 */
import CwgState from "./CwgState";

export type GlassInfo = {
    position: { x: number; y: number };
    colors: number[],
    hideCnt: number,       // 隐藏的个数
    ad: boolean,            // 是否广告
}

export type LevelStruct = {
    level: GlassInfo[]
    /**
     * 通关限时（秒）。缺省或 ≤0 表示不限时（兼容旧关卡）。
     */
    timeLimitSec?: number
}

export default class FunlandInfo {

    public static debug: boolean = false;

    public glasses: GlassInfo[];

    /** 当前关卡限时（秒），0 表示不限时 */
    public timeLimitSec = 0;

    public state: CwgState;

    public init(state: CwgState) {
        this.state = state;
    }

    public async reset() {
        const data = await this.state.getData().catch(() => {
            return null;
        });
        if (data) {
            this.resetLvData(data as LevelStruct);
        } else {
        }
    }

    /**
     * 切换到上一关卡
     * @remarks 当关卡数≤0时不执行操作
     */
    public preLevel() {
        if (this.state.getLevel() <= 0) {
            return;
        }
        this.state.setLevel(this.state.getLevel() - 1);
        this.state.save();
    }

    /**
     * 切换到下一关卡
     * @todo 实现关卡循环逻辑
     */
    public nextLevel() {
        this.state.setLevel(this.state.getLevel() + 1);
        this.state.save();
    }

    public resetLvData(save: LevelStruct) {
        const t = save.timeLimitSec;
        this.timeLimitSec = typeof t === 'number' && t > 0 ? Math.floor(t) : 0;
        this.glasses = save.level;
        // 重新排序，根据position.y
        this.glasses.sort((a: GlassInfo, b: GlassInfo) => {
            return b.position.y - a.position.y;
        });
    }

}