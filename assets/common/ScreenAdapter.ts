import {ResolutionPolicy, screen, view} from 'cc';

/** 与项目设置 `settings/v2/packages/project.json` 中 designResolution 一致 */
export const DESIGN_WIDTH = 750;
export const DESIGN_HEIGHT = 1280;

const DESIGN_ASPECT = DESIGN_WIDTH / DESIGN_HEIGHT;

export type ScreenAdaptMode =
    | 'auto'
    | 'fixed_height'
    | 'fixed_width'
    | 'show_all'
    | 'no_border';

function policyForMode(mode: ScreenAdaptMode): number {
    switch (mode) {
        case 'fixed_width':
            return ResolutionPolicy.FIXED_WIDTH;
        case 'fixed_height':
            return ResolutionPolicy.FIXED_HEIGHT;
        case 'show_all':
            return ResolutionPolicy.SHOW_ALL;
        case 'no_border':
            return ResolutionPolicy.NO_BORDER;
        case 'auto':
        default:
            return pickAutoPolicy();
    }
}

/**
 * 竖屏为主：相对设计稿更「宽」的屏用 FIXED_HEIGHT（优先撑满高度）；
 * 更「窄」的屏用 FIXED_WIDTH（优先撑满宽度），减少裁切与黑边失衡。
 */
function pickAutoPolicy(): number {
    const {width, height} = screen.windowSize;
    const w = Math.max(width, 1);
    const h = Math.max(height, 1);
    const frameAspect = w / h;
    return frameAspect > DESIGN_ASPECT ? ResolutionPolicy.FIXED_HEIGHT : ResolutionPolicy.FIXED_WIDTH;
}

export function applyScreenAdaptation(mode: ScreenAdaptMode = 'auto'): void {
    view.setDesignResolutionSize(DESIGN_WIDTH, DESIGN_HEIGHT, policyForMode(mode));
}

let _resizeHandler: (() => void) | null = null;
let _installedMode: ScreenAdaptMode = 'auto';

/**
 * 首次应用适配，并监听窗口尺寸 / 方向变化后重新应用（与 Cocos 3.8+ screen 事件一致）。
 * 重复调用会先移除上一次监听，避免重复注册。
 */
export function installScreenAdaptation(
    mode: ScreenAdaptMode = 'auto',
    onAfterApply?: () => void,
): void {
    uninstallScreenAdaptation();
    _installedMode = mode;

    const run = (): void => {
        applyScreenAdaptation(_installedMode);
        onAfterApply?.();
    };
    run();

    _resizeHandler = run;
    screen.on('window-resize', _resizeHandler);
    screen.on('orientation-change', _resizeHandler);
}

export function uninstallScreenAdaptation(): void {
    if (_resizeHandler) {
        screen.off('window-resize', _resizeHandler);
        screen.off('orientation-change', _resizeHandler);
        _resizeHandler = null;
    }
}

/** 运行中切换策略（已 install 时后续 resize 也会用新模式） */
export function setScreenAdaptMode(mode: ScreenAdaptMode): void {
    _installedMode = mode;
    applyScreenAdaptation(mode);
}
