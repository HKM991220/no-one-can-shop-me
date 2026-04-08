import { SimpleUIManager, UIConfig } from './SimpleUIManager';

/** 与注册表一致的 id，业务里尽量用常量避免手写字符串 */
export const UIPanelId = {
    LOADING: 'Loading',
    GAME: 'Game',
    SETTING: 'Setting',
    SALA: 'Sala',
} as const;

/**
 * UI 预制体路径（相对 Bundle）；与 `UIPanelRegistry.UI_PANEL_CONFIGS` 保持同步时需手工对齐。
 */
export enum UIPrefabPath {
    LOADING_VIEW = 'prefab/LoadingView',
    GAME_VIEW = 'prefab/GameView',
    SETTING_VIEW = 'prefab/SettingView',
    SALA_VIEW = 'prefab/SalaView',
}

/**
 * 全局 UI 面板注册表（预制体 id / bundle / path / layer）。
 * 新增界面时只改此文件，入口场景调用 registerAllUIPanels() 即可。
 */
export const UI_PANEL_CONFIGS: UIConfig[] = [
    { id: UIPanelId.LOADING, bundle: 'resources', path: UIPrefabPath.LOADING_VIEW, layer: 10 },
    { id: UIPanelId.GAME, bundle: 'resources', path:  UIPrefabPath.GAME_VIEW },
    { id: UIPanelId.SETTING, bundle: 'resources', path:  UIPrefabPath.SETTING_VIEW, layer: 5 },
    { id: UIPanelId.SALA, bundle: 'resources', path:  UIPrefabPath.SALA_VIEW, layer: 5 },
];

/** 在 SimpleUIManager.init(parent) 之后调用 */
export function registerAllUIPanels(): void {
    SimpleUIManager.instance.registerBatch(UI_PANEL_CONFIGS);
}
