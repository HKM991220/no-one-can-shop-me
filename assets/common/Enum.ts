/**
 * 全局事件名统一注册（EventMng.on/off/emit 使用）
 */
export enum EventName {
    /** 结算页「下一关/重试」：payload `{ advance: boolean }`，advance 为 true 时先进入下一关再重开 */
    GAME_CONCLUDE_NEXT = "game:concludeNext",
    /** 限时内未完成关卡 */
    LEVEL_FAILED = "level:failed",
    /** 玩家资源（金币/体力）变化 */
    PLAYER_RESOURCE_CHANGED = "player:resourceChanged",
    /** 快捷方式奖励领取成功 */
    REWARD_SHORTCUT = "reward:shortcut",
    /** 侧边栏奖励领取成功 */
    REWARD_PROFILE_SIDEBAR = "reward:profileSidebar",
    /** 兑换道具选择 UI 打开 */
    EXCHANGE_UI_OPENED = "exchange:opened",
    /** 兑换道具选择 UI 关闭 */
    EXCHANGE_UI_CLOSED = "exchange:closed",
}
