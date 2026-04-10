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

/** 关卡 JSON 等处的原始数字可能超出枚举；取不到配色时用于避免崩溃 */
export function getWaterColorSet(id: number): ColorSet {
    const set = (WaterColors as Record<number, ColorSet | undefined>)[id];
    if (set) {
        return set;
    }
    return WaterColors[WaterColor.Purple];
}