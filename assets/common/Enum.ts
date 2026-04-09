/**
 * 全局事件名统一注册（EventMng.on/off/emit 使用）
 */
export enum EventName {
    /** 玩家资源（金币/体力）变化 */
    PLAYER_RESOURCE_CHANGED = "player:resourceChanged",
    /** 快捷方式奖励领取成功 */
    REWARD_SHORTCUT = "reward:shortcut",
    /** 侧边栏奖励领取成功 */
    REWARD_PROFILE_SIDEBAR = "reward:profileSidebar",
}
