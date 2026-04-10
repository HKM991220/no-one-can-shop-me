/**
 * @Descripttion:
 * @version: 1.0
 * @Author: Lioesquieu
 * @Date: 2025-07-20
 * @LastEditors: Lioesquieu
 * @LastEditTime: 2025-07-22
 */

export const enum WaterColor {
    None = 0,
    Red,
    Orange,
    Yellow,
    Green,
    Blue,
    Purple,
    /** 关卡数据中的 7（如 level_3） */
    Cyan,
    /** 关卡数据中的 8 */
    Pink,
    /** 隐藏未揭示水块 */
    Black,
}

interface ColorSet {
    base: string;
    surface: string;
}

export const WaterColors: Record<WaterColor, ColorSet> = {
    [WaterColor.None]: { base: '#00000000', surface: '#00000000' },
    [WaterColor.Red]: { base: '#FF0000', surface: '#FF6464' },
    [WaterColor.Orange]: { base: '#FF7F00', surface: '#FFAF5F' },
    [WaterColor.Yellow]: { base: '#EBEB00', surface: '#FFFF69' },
    [WaterColor.Green]: { base: '#00EE00', surface: '#00FF00' },
    [WaterColor.Blue]: { base: '#0085FF', surface: '#359EFF' },
    [WaterColor.Purple]: { base: '#800080', surface: '#B900B9' },
    [WaterColor.Cyan]: { base: '#00E7E7', surface: '#00FFFF' },
    [WaterColor.Pink]: { base: '#FF7E94', surface: '#FFC0CB' },
    [WaterColor.Black]: { base: '#000000FF', surface: '#000000FF' },
};

/** 玩法数值常量（与存档/结算等业务共用） */
export const GameplayConst = {
    /** 默认体力上限/初始体力 */
    DEFAULT_STAMINA_MAX: 10,
    /** 每开一局消耗体力 */
    STAMINA_COST_PER_ROUND: 1,
    /** 自动恢复体力间隔（15 分钟 1 点） */
    STAMINA_RECOVER_INTERVAL_MS: 15 * 60 * 1000,
    /** 看视频恢复体力：每次 +1 */
    STAMINA_PER_REWARDED_AD: 1,
    /** 每名玩家每天最多通过视频恢复体力次数 */
    DAILY_REWARDED_STAMINA_LIMIT: 10,
} as const;

/** 关卡 JSON 等处的原始数字可能超出枚举；取不到配色时用于避免崩溃 */
export function getWaterColorSet(id: number): ColorSet {
    const set = (WaterColors as Record<number, ColorSet | undefined>)[id];
    if (set) {
        return set;
    }
    return WaterColors[WaterColor.Purple];
}