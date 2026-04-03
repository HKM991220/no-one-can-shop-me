
import {_decorator, Component, instantiate, Node, Prefab} from 'cc';
import {UIHandler, UIManager} from './common/ui/UIManager';
import {UIResModule} from './common/ui/UIResModule';
import Loading from './core/Loading';
import {BundleName, UIId, UIPrefabPath} from './common/Enum';

const {ccclass, menu, property} = _decorator;

@ccclass('Mian')
export class Mian extends Component {
    @property({type: Node, tooltip: 'UI 挂载根节点（mian 场景下的 view 节点）'})
    protected viewNode: Node | null = null;

    @property({tooltip: '资源 Bundle 名称'})
    protected bundleName: string = BundleName.RESOURCES;

    @property({tooltip: 'loading 预制体路径（相对 bundle）'})
    protected loadingPrefabPath: string = UIPrefabPath.LOADING;

    @property({tooltip: 'game 预制体路径（相对 bundle）'})
    protected gamePrefabPath: string = UIPrefabPath.GAME;

    private readonly resModule = new UIResModule();
    private loadingPrefab: Prefab | null = null;
    private gamePrefab: Prefab | null = null;
    private loadingNode: Node | null = null;
    private gameNode: Node | null = null;

    protected async start(): Promise<void> {
        await this.prepareLoadingPage();
        this.registerUIHandlers();
        await this.runFlow();
    }

    protected onDestroy(): void {
        UIManager.instance.unregister(UIId.LOADING);
        UIManager.instance.unregister(UIId.GAME);
        this.resModule.releaseAll();
    }

    private async runFlow(): Promise<void> {
        UIManager.instance.open(UIId.LOADING, undefined, {pushToStack: false});
        const loadingComp = this.loadingNode?.getComponent(Loading);
        loadingComp?.bindStartAction(() => this.enterGame());

        await this.preloadGamePage();
        if (loadingComp) {
            await loadingComp.playComplete();
        } else {
            // 若 loading 组件未挂载，兜底直接进入游戏
            this.enterGame();
        }
    }

    private enterGame(): void {
        UIManager.instance.open(UIId.GAME, undefined, {pushToStack: false});
        UIManager.instance.close(UIId.LOADING);
    }

    private async prepareLoadingPage(): Promise<void> {
        this.loadingPrefab = await this.loadUIPrefab(UIId.LOADING);
    }

    private async preloadGamePage(): Promise<void> {
        this.gamePrefab = await this.loadUIPrefab(UIId.GAME);
    }

    /**
     * 统一 UI 资源加载入口（封装 bundle + 路径兜底）
     */
    private async loadUIPrefab(uiId: UIId): Promise<Prefab> {
        const {inspectorPath, enumPath} = this.getUIPrefabPathConfig(uiId);
        return this.loadBundlePrefab(inspectorPath, enumPath);
    }

    /**
     * UI 页面路径配置：
     * - inspectorPath：可在编辑器里覆盖
     * - enumPath：默认枚举路径
     */
    private getUIPrefabPathConfig(uiId: UIId): { inspectorPath: string; enumPath: string } {
        if (uiId === UIId.LOADING) {
            return {inspectorPath: this.loadingPrefabPath, enumPath: UIPrefabPath.LOADING};
        }
        return {inspectorPath: this.gamePrefabPath, enumPath: UIPrefabPath.GAME};
    }

    /**
     * 兼容历史大小写路径配置：
     * - 先尝试 Inspector 当前配置
     * - 失败后再尝试首字母大写/小写路径
     */
    private async loadBundlePrefab(pathFromInspector: string, pathFromEnum: string): Promise<Prefab> {
        const candidates = Array.from(new Set([
            pathFromInspector,
            pathFromEnum,
            this.toUppercaseTail(pathFromInspector),
            this.toLowercaseTail(pathFromInspector),
            this.toUppercaseTail(pathFromEnum),
            this.toLowercaseTail(pathFromEnum),
        ])).filter((v) => !!v);

        let lastErr: unknown = null;
        for (const path of candidates) {
            try {
                return await this.resModule.load(this.bundleName, path, Prefab);
            } catch (err) {
                lastErr = err;
            }
        }

        throw lastErr ?? new Error(`load prefab failed: ${pathFromInspector}`);
    }

    private toUppercaseTail(path: string): string {
        const idx = path.lastIndexOf('/');
        if (idx < 0 || idx >= path.length - 1) {
            return path;
        }
        const head = path.slice(0, idx + 1);
        const tail = path.slice(idx + 1);
        return head + tail.charAt(0).toUpperCase() + tail.slice(1);
    }

    private toLowercaseTail(path: string): string {
        const idx = path.lastIndexOf('/');
        if (idx < 0 || idx >= path.length - 1) {
            return path;
        }
        const head = path.slice(0, idx + 1);
        const tail = path.slice(idx + 1);
        return head + tail.charAt(0).toLowerCase() + tail.slice(1);
    }

    private registerUIHandlers(): void {
        const loadingHandler: UIHandler = {
            open: () => this.openLoading(),
            close: () => this.closeLoading(),
        };
        const gameHandler: UIHandler = {
            open: () => this.openGame(),
            close: () => this.closeGame(),
        };
        UIManager.instance.register(UIId.LOADING, loadingHandler);
        UIManager.instance.register(UIId.GAME, gameHandler);
    }

    private openLoading(): void {
        if (!this.loadingPrefab) {
            return;
        }
        const root = this.viewNode ?? this.node;
        if (!this.loadingNode || !this.loadingNode.isValid) {
            this.loadingNode = instantiate(this.loadingPrefab);
            this.loadingNode.setParent(root);
        }
        this.loadingNode.active = true;
    }

    private closeLoading(): void {
        if (this.loadingNode && this.loadingNode.isValid) {
            this.loadingNode.active = false;
        }
    }

    private openGame(): void {
        if (!this.gamePrefab) {
            return;
        }
        const root = this.viewNode ?? this.node;
        if (!this.gameNode || !this.gameNode.isValid) {
            this.gameNode = instantiate(this.gamePrefab);
            this.gameNode.setParent(root);
        }
        this.gameNode.active = true;
    }

    private closeGame(): void {
        if (this.gameNode && this.gameNode.isValid) {
            this.gameNode.active = false;
        }
    }
}