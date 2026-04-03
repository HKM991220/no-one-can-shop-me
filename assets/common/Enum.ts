/**
 * 资源 Bundle 名称
 */
export enum BundleName {
    RESOURCES = 'resources',
}

/**
 * 全局 UI 唯一标识（业务脚本只使用 UI.open(UIId) / UI.close(UIId)）
 */
export enum UIId {
    LOADING = 'loading',
    GAME = 'game',
    SETTING = 'setting',
    EXCHANGE = 'exchange',
    ADD_EMPTY_GLASS = 'addEmptyGlass',
}

/**
 * UI 预制体路径（相对 Bundle）；集中配置见 UIService 内 PANEL_PREFABS
 */
export enum UIPrefabPath {
    LOADING_VIEW = 'prefab/LoadingView',
    GAME_VIEW = 'prefab/GameView',
    Setting_View = 'prefab/SettingView',
}
