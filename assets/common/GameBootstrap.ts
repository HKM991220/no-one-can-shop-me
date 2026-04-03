import {_decorator, Component, director, Node} from 'cc';
import {GameAudioSettings} from './AudioSetting';
import {AudioManager} from './AudioManager';
import {ResManager} from './ResManager';
import {UIManager} from './ui/UIManager';

const {ccclass} = _decorator;

/**
 * 全局单例根节点：在 `ensureReady()` 内创建常驻节点并挂载
 * ResManager、AudioManager、UIManager，统一初始化顺序。
 * 入口场景（如 Mian）应在任何游戏逻辑前 `await GameBootstrap.ensureReady()`。
 */
@ccclass('GameBootstrap')
export class GameBootstrap extends Component {
    private static _root: GameBootstrap | null = null;
    private static _ready: Promise<GameBootstrap> | null = null;

    private _res!: ResManager;
    private _audio!: AudioManager;

    public get res(): ResManager {
        return this._res;
    }

    public get audio(): AudioManager {
        return this._audio;
    }

    /** 已就绪时返回常驻根上的组件，否则为 null */
    public static get root(): GameBootstrap | null {
        return this._root?.isValid ? this._root : null;
    }

    /** 必须在 ensureReady 之后使用 */
    public static get instance(): GameBootstrap {
        const r = this.root;
        if (!r) {
            throw new Error('请先调用 GameBootstrap.ensureReady()');
        }
        return r;
    }

    public static async ensureReady(): Promise<GameBootstrap> {
        const existing = this.root;
        if (existing) {
            return existing;
        }
        if (!this._ready) {
            this._ready = this.createPersistRoot().catch((err) => {
                this._ready = null;
                throw err;
            });
        }
        return this._ready;
    }

    private static async createPersistRoot(): Promise<GameBootstrap> {
        const node = new Node('GameBootstrap');
        const boot = node.addComponent(GameBootstrap);

        const resNode = new Node('ResManager');
        resNode.setParent(node);
        boot._res = resNode.addComponent(ResManager);

        const audioNode = new Node('AudioManager');
        audioNode.setParent(node);
        boot._audio = audioNode.addComponent(AudioManager);

        const uiNode = new Node('UIManager');
        uiNode.setParent(node);
        UIManager.bindInstance(uiNode.addComponent(UIManager));

        director.addPersistRootNode(node);
        GameBootstrap._root = boot;

        await Promise.all([boot._res.ensureReady(), boot._audio.ensureReady()]);
        GameAudioSettings.registerAudioManager(boot._audio);
        return boot;
    }

    protected onDestroy(): void {
        GameAudioSettings.registerAudioManager(null);
        if (GameBootstrap._root === this) {
            GameBootstrap._root = null;
        }
        GameBootstrap._ready = null;
    }
}
