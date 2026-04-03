import {_decorator, Component, instantiate, Node, Prefab} from 'cc';
import {UIManager, UIHandler} from './UIManager';
import {UIResModule} from './UIResModule';

const {ccclass, property, menu} = _decorator;

/**
 * UI 启动流程控制器
 * 启动顺序：
 * 1) 打开 loading 预制体
 * 2) 预加载 game 预制体
 * 3) 打开 game 预制体
 * 4) 关闭 loading
 */
@ccclass('UILaunchFlow')
@menu('cwg/UILaunchFlow')
    export class UILaunchFlow extends Component {
    private static readonly UI_ID_LOADING = 'loading';
    private static readonly UI_ID_GAME = 'game';

    @property({tooltip: '资源 Bundle 名称，默认 resources'})
    protected bundleName: string = 'resources';

    @property({tooltip: 'loading 预制体路径（相对 bundle）'})
    protected loadingPrefabPath: string = 'prefab/loading';

    @property({tooltip: 'game 预制体路径（相对 bundle）'})
    protected gamePrefabPath: string = 'prefab/game';

    @property(Node)
    protected loadingRoot: Node | null = null;

    @property(Node)
    protected gameRoot: Node | null = null;

    private readonly resModule = new UIResModule();
    private loadingNode: Node | null = null;
    private gameNode: Node | null = null;
    private loadingPrefab: Prefab | null = null;
    private gamePrefab: Prefab | null = null;

    protected async start(): Promise<void> {
        this.registerUIHandlers();
        await this.runLaunchFlow();
    }

    protected onDestroy(): void {
        UIManager.instance.unregister(UILaunchFlow.UI_ID_LOADING);
        UIManager.instance.unregister(UILaunchFlow.UI_ID_GAME);
        this.resModule.releaseAll();
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
        UIManager.instance.register(UILaunchFlow.UI_ID_LOADING, loadingHandler);
        UIManager.instance.register(UILaunchFlow.UI_ID_GAME, gameHandler);
    }

    private async runLaunchFlow(): Promise<void> {
        // 1) 显示 loading 页面
        UIManager.instance.open(UILaunchFlow.UI_ID_LOADING, undefined, {pushToStack: false});

        // 2) 预加载资源（这里先预加载 game 预制体，可扩展更多初始化资源）
        await this.preloadGameResources();

        // 3) 打开 game 页面
        UIManager.instance.open(UILaunchFlow.UI_ID_GAME, undefined, {pushToStack: false});

        // 4) 关闭 loading 页面
        UIManager.instance.close(UILaunchFlow.UI_ID_LOADING);
    }

    private async preloadGameResources(): Promise<void> {
        this.loadingPrefab = await this.resModule.load(this.bundleName, this.loadingPrefabPath, Prefab);
        this.gamePrefab = await this.resModule.load(this.bundleName, this.gamePrefabPath, Prefab);
    }

    private openLoading(): void {
        const root = this.loadingRoot ?? this.node;
        if (!this.loadingPrefab) {
            return;
        }
        if (!this.loadingNode || !this.loadingNode.isValid) {
            this.loadingNode = instantiate(this.loadingPrefab);
            this.loadingNode.parent = root;
        }
        this.loadingNode.active = true;
    }

    private closeLoading(): void {
        if (this.loadingNode && this.loadingNode.isValid) {
            this.loadingNode.active = false;
        }
    }

    private openGame(): void {
        const root = this.gameRoot ?? this.node;
        if (!this.gamePrefab) {
            return;
        }
        if (!this.gameNode || !this.gameNode.isValid) {
            this.gameNode = instantiate(this.gamePrefab);
            this.gameNode.parent = root;
        }
        this.gameNode.active = true;
    }

    private closeGame(): void {
        if (this.gameNode && this.gameNode.isValid) {
            this.gameNode.active = false;
        }
    }
}
