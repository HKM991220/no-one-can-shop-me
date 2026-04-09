/**
 * TikTok SDK 配置
 * 集中管理所有TT相关的配置项，避免硬编码
 */

export const TTConfig = {
    /**
     * 激励广告位 ID（须与抖音开放平台该小游戏应用下创建的「激励视频」位一致）。
     * 测试包需使用同一应用下的正式/测试广告位；勿留空，否则不会创建广告实例。
     */
    rewardedAdId: "ad7623758078475110418",

    /** 插屏广告位 ID，规则同上 */
    interstitialAdId: "ad7625865283080603666",
    
    /** 默认分享标题 */
    defaultShareTitle: "这个游戏超好玩！",
    
    /** 默认分享查询参数 */
    defaultShareQuery: "from=share",
    
    /** 支付默认货币类型 */
    currencyType: "CNY",
    
    /** 支付默认平台 */
    defaultPlatform: "android",
};

/**
 * 环境类型
 */
export enum TTEnv {
    /** 开发环境 */
    DEV = 0,
    /** 正式环境 */
    PROD = 1,
}

/**
 * 获取当前环境配置
 */
export function getTTConfig(env: TTEnv = TTEnv.PROD) {
    if (env === TTEnv.DEV) {
        return {
            ...TTConfig,
            // 开发环境可以使用测试广告ID
            rewardedAdId: "",
            interstitialAdId: "",
        };
    }
    return TTConfig;
}
