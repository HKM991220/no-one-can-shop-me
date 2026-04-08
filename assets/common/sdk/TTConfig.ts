/**
 * TikTok SDK 配置
 * 集中管理所有TT相关的配置项，避免硬编码
 */

export const TTConfig = {
    /** 激励广告ID */
    rewardedAdId: "ad7623758078475110418",
    
    /** 插屏广告ID */
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
