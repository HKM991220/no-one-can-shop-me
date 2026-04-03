/**
 * 全局 UI 中枢：预制体表、加载/实例化、显隐、销毁、弹窗置顶；业务只使用导出的 UI.open / UI.close。
 */
import {instantiate, Node, Prefab} from 'cc';
import {BundleName, UIId, UIPrefabPath} from '../Enum';
import {GameBootstrap} from '../GameBootstrap';
import {UIHandler, UIManager, UIOpenOptions} from './UIManager';
import Loading from '../../core/LoadingView';

// ---------------------------------------------------------------------------
// 预制体目录（内联原 UIPanelCatalog）
// ---------------------------------------------------------------------------

export interface PrefabPanelConfig {
    bundle: string;
    path: string;
}

const PANEL_PREFABS: Partial<Record<UIId, PrefabPanelConfig>> = {
    [UIId.LOADING]: {bundle: BundleName.RESOURCES, path: UIPrefabPath.LOADING_VIEW},
    [UIId.GAME]: {bundle: BundleName.RESOURCES, path: UIPrefabPath.GAME_VIEW},
    [UIId.SETTING]: {bundle: BundleName.RESOURCES, path: UIPrefabPath.Setting_View},
};

const prefabOverrides: Partial<Record<UIId, PrefabPanelConfig>> = {};

function getAllPrefabConfigs(): Partial<Record<UIId, PrefabPanelConfig>> {
    return {...PANEL_PREFABS, ...prefabOverrides};
}

// ---------------------------------------------------------------------------
// 内部状态
// ---------------------------------------------------------------------------

export type UIKey = UIId | string;

const pinnedNodes = new Map<string, Node>();
const prefabNodes = new Map<string, Node>();
const launchDynamicIds = new Set<string>();
const overlayDynamicIds = new Set<string>();
const loadPromises = new Map<string, Promise<Node | null>>();

let overlayParent: Node | null = null;

export interface LaunchMountContext {
    defaultParent: Node | null;
    byId?: Partial<Record<UIId, Node | null>>;
}

let launchMount: LaunchMountContext = {defaultParent: null};

function isLaunchPanelId(id: string): boolean {
    return id === UIId.LOADING || id === UIId.GAME;
}

function resolveLaunchParent(id: UIId): Node | null {
    const specific = launchMount.byId?.[id];
    if (specific?.isValid) {
        return specific;
    }
    return launchMount.defaultParent?.isValid ? launchMount.defaultParent : null;
}

function getPanelParent(id: string): Node | null {
    if (isLaunchPanelId(id)) {
        return resolveLaunchParent(id as UIId);
    }
    return overlayParent?.isValid ? overlayParent : null;
}

function toUppercaseTail(path: string): string {
    const idx = path.lastIndexOf('/');
    if (idx < 0 || idx >= path.length - 1) {
        return path;
    }
    const head = path.slice(0, idx + 1);
    const tail = path.slice(idx + 1);
    return head + tail.charAt(0).toUpperCase() + tail.slice(1);
}

function toLowercaseTail(path: string): string {
    const idx = path.lastIndexOf('/');
    if (idx < 0 || idx >= path.length - 1) {
        return path;
    }
    const head = path.slice(0, idx + 1);
    const tail = path.slice(idx + 1);
    return head + tail.charAt(0).toLowerCase() + tail.slice(1);
}

function pathCandidates(path: string): string[] {
    const base = [path, toUppercaseTail(path), toLowercaseTail(path)];
    const idx = path.lastIndexOf('/');
    const dir = idx >= 0 ? path.slice(0, idx + 1) : '';
    const tail = idx >= 0 ? path.slice(idx + 1) : path;
    const lower = tail.toLowerCase().replace(/\.prefab$/i, '');
    const extra: string[] = [];
    if (lower === 'loading') {
        extra.push(`${dir}LoadingView`, `${dir}loadingView`);
    }
    if (lower === 'game') {
        extra.push(`${dir}GameView`, `${dir}gameView`);
    }
    return Array.from(new Set([...base, ...extra].filter((v) => !!v)));
}

async function loadPrefab(bundle: string, path: string): Promise<Prefab | null> {
    const boot = GameBootstrap.root;
    if (!boot) {
        console.warn('[UIService] GameBootstrap 未就绪');
        return null;
    }
    let lastErr: unknown = null;
    for (const p of pathCandidates(path)) {
        try {
            return await boot.res.load(bundle, p, Prefab);
        } catch (e) {
            lastErr = e;
        }
    }
    console.error('[UIService] 预制体加载失败', bundle, path, lastErr);
    return null;
}

function getResolvedNode(id: string): Node | null {
    const pin = pinnedNodes.get(id);
    if (pin?.isValid) {
        return pin;
    }
    const cached = prefabNodes.get(id);
    if (cached?.isValid) {
        return cached;
    }
    return null;
}

function bringOverlayToFront(node: Node): void {
    const p = node.parent;
    if (p?.isValid && p.children.length > 0) {
        node.setSiblingIndex(p.children.length - 1);
    }
}

async function ensurePrefabPanelInstance(id: string, cfg: PrefabPanelConfig): Promise<Node | null> {
    const existing = getResolvedNode(id);
    if (existing) {
        return existing;
    }
    if (loadPromises.has(id)) {
        return loadPromises.get(id)!;
    }
    const promise = (async (): Promise<Node | null> => {
        const parent = getPanelParent(id);
        if (!parent?.isValid) {
            console.warn('[UIService] 父节点未就绪', id);
            return null;
        }
        const prefab = await loadPrefab(cfg.bundle, cfg.path);
        if (!prefab) {
            return null;
        }
        const node = instantiate(prefab);
        node.setParent(parent);
        node.active = false;
        prefabNodes.set(id, node);
        if (isLaunchPanelId(id)) {
            launchDynamicIds.add(id);
        } else {
            overlayDynamicIds.add(id);
        }
        return node;
    })();
    loadPromises.set(id, promise);
    try {
        return await promise;
    } finally {
        loadPromises.delete(id);
    }
}

function showPrefabPanel(id: string, cfg: PrefabPanelConfig): void {
    const existing = getResolvedNode(id);
    if (existing?.isValid) {
        existing.active = true;
        if (!isLaunchPanelId(id)) {
            bringOverlayToFront(existing);
        }
        return;
    }
    void ensurePrefabPanelInstance(id, cfg).then((node) => {
        if (node?.isValid) {
            node.active = true;
            if (!isLaunchPanelId(id)) {
                bringOverlayToFront(node);
            }
        }
    });
}

function createPrefabHandler(id: string, cfg: PrefabPanelConfig): UIHandler {
    return {
        open: () => {
            showPrefabPanel(id, cfg);
        },
        close: () => {
            const node = getResolvedNode(id);
            if (node?.isValid) {
                node.active = false;
            }
        },
    };
}

function registerSinglePrefabHandler(id: string, cfg: PrefabPanelConfig): void {
    UIManager.instance.register(id, createPrefabHandler(id, cfg));
}

/**
 * 将预制体表中的 handler 注册到当前 UIManager。
 * UIManager 可能在 bindInstance 失效后被懒重建，此时须按实例补全，不能依赖模块级「已安装」标记。
 */
function ensurePrefabHandlers(): void {
    const all = getAllPrefabConfigs();
    for (const id of Object.keys(all) as UIId[]) {
        const cfg = all[id];
        if (cfg && !UIManager.instance.has(id)) {
            registerSinglePrefabHandler(id, cfg);
        }
    }
}

async function ensurePanelReady(id: UIKey): Promise<void> {
    const sid = String(id);
    const cfg = getAllPrefabConfigs()[sid as UIId];
    if (cfg) {
        await ensurePrefabPanelInstance(sid, cfg);
    }
}

function releaseOverlayDynamicPanels(): void {
    for (const id of overlayDynamicIds) {
        const n = prefabNodes.get(id);
        if (n?.isValid) {
            n.destroy();
        }
        prefabNodes.delete(id);
    }
    overlayDynamicIds.clear();
}

function releaseLaunchDynamicPanels(): void {
    for (const id of launchDynamicIds) {
        const n = prefabNodes.get(id);
        if (n?.isValid) {
            n.destroy();
        }
        prefabNodes.delete(id);
    }
    launchDynamicIds.clear();
}

function applyLaunchMount(ctx: LaunchMountContext): void {
    launchMount = {
        defaultParent: ctx.defaultParent?.isValid ? ctx.defaultParent : null,
        byId: ctx.byId ? {...ctx.byId} : undefined,
    };
}

function applyGameOverlay(parent: Node | null, pinned?: Partial<Record<UIId, Node | null>>): void {
    overlayParent = parent?.isValid ? parent : null;
    pinnedNodes.clear();
    if (pinned) {
        for (const key of Object.keys(pinned) as UIId[]) {
            const n = pinned[key];
            if (n?.isValid) {
                pinnedNodes.set(key, n);
            }
        }
    }
    ensurePrefabHandlers();
}

function registerPrefabOverride(id: UIId, config: PrefabPanelConfig): void {
    prefabOverrides[id] = config;
    registerSinglePrefabHandler(id, config);
    ensurePrefabHandlers();
}

// ---------------------------------------------------------------------------
// 游戏场景宿主（由 VwUi 在 onEnable 传入，不在此文件外写 register 逻辑）
// ---------------------------------------------------------------------------

export interface IGameUIPanelHost {
    node: Node;
    settingAttachParent: Node | null;
    settingViewRoot: Node | null;
    exchangeView: {show(): void; hide(): void} | null | undefined;
    addGlassView: {show(): void; hide(): void} | null | undefined;
}

let boundGameHost: IGameUIPanelHost | null = null;

function bindEmbeddedFromHost(host: IGameUIPanelHost): void {
    applyGameOverlay(host.settingAttachParent ?? host.node.parent ?? host.node, host.settingViewRoot ? {[UIId.SETTING]: host.settingViewRoot} : undefined);
    const m = UIManager.instance;
    m.register(UIId.EXCHANGE, {
        open: () => host.exchangeView?.show(),
        close: () => host.exchangeView?.hide(),
    });
    m.register(UIId.ADD_EMPTY_GLASS, {
        open: () => host.addGlassView?.show(),
        close: () => host.addGlassView?.hide(),
    });
    ensurePrefabHandlers();
}

// ---------------------------------------------------------------------------
// 主入口（Mian 调用 bootstrapMainEntry）
// ---------------------------------------------------------------------------

export interface MainEntryConfig {
    viewRoot: Node;
    bundle: string;
    loadingPrefabPath: string;
    gamePrefabPath: string;
}

/**
 * mian 场景完整启动：挂载 Launch、预加载、Loading 流程、进入 Game。
 */
export async function bootstrapMainEntry(c: MainEntryConfig): Promise<void> {
    applyLaunchMount({defaultParent: c.viewRoot});
    registerPrefabOverride(UIId.LOADING, {bundle: c.bundle, path: c.loadingPrefabPath});
    registerPrefabOverride(UIId.GAME, {bundle: c.bundle, path: c.gamePrefabPath});
    await ensurePanelReady(UIId.LOADING);
    await ensurePanelReady(UIId.GAME);

    const loadingComp = getResolvedNode(UIId.LOADING)?.getComponent(Loading) ?? null;
    loadingComp?.bindStartAction(() => {
        UI.open(UIId.GAME, undefined, {pushToStack: false});
        UI.close(UIId.LOADING);
    });

    UI.open(UIId.LOADING, undefined, {pushToStack: false});
    if (loadingComp) {
        await loadingComp.playComplete();
    } else {
        UI.open(UIId.GAME, undefined, {pushToStack: false});
        UI.close(UIId.LOADING);
    }
}

export function shutdownMainEntry(): void {
    UIManager.instance.unregister(UIId.LOADING);
    UIManager.instance.unregister(UIId.GAME);
    releaseLaunchDynamicPanels();
    launchMount = {defaultParent: null};
    delete prefabOverrides[UIId.LOADING];
    delete prefabOverrides[UIId.GAME];
}

/**
 * 游戏界面就绪后由 VwUi.onEnable 调用一次。
 */
export function attachGameWorld(host: IGameUIPanelHost): void {
    boundGameHost = host;
    bindEmbeddedFromHost(host);
}

/**
 * VwUi 销毁时调用。
 */
export function detachGameWorld(): void {
    if (!boundGameHost) {
        return;
    }
    UI.close(UIId.SETTING);
    UIManager.instance.unregister(UIId.EXCHANGE);
    UIManager.instance.unregister(UIId.ADD_EMPTY_GLASS);
    releaseOverlayDynamicPanels();
    pinnedNodes.clear();
    overlayParent = null;
    boundGameHost = null;
}

/** 扩展：运行时登记预制体面板 */
export function registerPrefabPanel(id: UIId, config: PrefabPanelConfig): void {
    registerPrefabOverride(id, config);
}

export function getPanelRoot(id: UIKey): Node | null {
    return getResolvedNode(String(id));
}

export async function preparePanel(id: UIKey): Promise<void> {
    await ensurePanelReady(id);
}

// ---------------------------------------------------------------------------
// 对外唯一推荐 API：open / close
// ---------------------------------------------------------------------------

export const UI = {
    open<T = unknown>(id: UIKey, payload?: T, options?: UIOpenOptions): boolean {
        ensurePrefabHandlers();
        return UIManager.instance.open(id, payload, options);
    },

    async openAsync<T = unknown>(id: UIKey, payload?: T, options?: UIOpenOptions): Promise<boolean> {
        ensurePrefabHandlers();
        await ensurePanelReady(id);
        return UIManager.instance.open(id, payload, options);
    },

    close<T = unknown>(id: UIKey, payload?: T): boolean {
        return UIManager.instance.close(id, payload);
    },

    closeTop<T = unknown>(payload?: T): boolean {
        return UIManager.instance.closeTop(payload);
    },

    has(id: UIKey): boolean {
        return UIManager.instance.has(id);
    },
};
