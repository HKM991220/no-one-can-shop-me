import { _decorator, Component, Node } from 'cc';
import { GameBootstrap } from './common/GameBootstrap';
import { installScreenAdaptation, uninstallScreenAdaptation } from './common/ScreenAdapter';
import { SimpleUIManager } from './common/ui/SimpleUIManager';
import { registerAllUIPanels, UI_PANEL_PRELOAD_IDS, UIPanelId } from './common/ui/UIPanelRegistry';
import { HotUpdateService } from './common/hotupdate/HotUpdateService';
import { TTMinis } from './common/sdk/TTMinis';
import { I18n } from './common/i18n/I18n';

const { ccclass, menu, property } = _decorator;

/**
 * 主场景入口：使用新UI框架 SimpleUIManager
 */
@ccclass('Mian')
@menu('cwg/Mian')
export class Mian extends Component {
    @property({ type: Node, tooltip: 'UI 挂载根节点（mian 场景下的 view 节点）' })
    protected viewNode: Node | null = null;

    /** 由 SimpleUIManager 挂入 __TopMount__，永远盖过 Layer_0～Layer_10 内各面板 */
    @property({ type: Node, tooltip: '全局置顶 UI（如金币条）；须在编辑器绑定场景中的节点' })
    protected topNode: Node | null = null;

    /** 场景内首屏遮罩（如 Canvas 下 loading 节点），核心与分包资源就绪后关闭 */
    @property({ type: Node, tooltip: '首屏 Loading 节点，资源与常用 UI 预加载完成后自动 active=false' })
    protected loadingNode: Node | null = null;

    /**
     * 除 `resources`（已在 GameBootstrap / ResManager.ensureReady 中加载）外，
     * 首屏需 `loadBundle` 完成的包名，与 assets 里勾选为 Asset Bundle 的文件夹名一致。
     */
    private static readonly ENTRY_BUNDLE_NAMES: readonly string[] = [];

    /** 与 LoadingView.tryAutoLogin 一致：加载阶段静默登录；非抖音/失败不阻塞进游戏 */
    private static async autoLoginDuringLoad(): Promise<void> {
        try {
            await TTMinis.ensureInitialized().login();
            console.log('[Mian] 加载阶段自动登录成功');
        } catch (err) {
            console.log('[Mian] 加载阶段自动登录跳过或失败', err);
        }
    }

    protected async start(): Promise<void> {
        if (this.loadingNode?.isValid) {
            this.loadingNode.active = true;
        }
        installScreenAdaptation('auto');
        HotUpdateService.instance.applyStoredSearchPaths();
        await GameBootstrap.ensureReady();
        await I18n.instance.init();
        // 须在任何 UI（如 Loading）里调用 TT 能力之前完成，否则 TTMinis.inst 尚未赋值
        TTMinis.ensureInitialized();

        // 初始化新UI框架
        const root = this.viewNode ?? this.node;
        SimpleUIManager.instance.init(root);
        SimpleUIManager.instance.mountPersistentTopNode(this.topNode);
        registerAllUIPanels();

        const res = GameBootstrap.instance.res;
        await Promise.all([
            ...Mian.ENTRY_BUNDLE_NAMES.map((name) => res.loadBundle(name)),
            ...UI_PANEL_PRELOAD_IDS.map((id) => SimpleUIManager.instance.preload(id)),
            Mian.autoLoginDuringLoad(),
        ]);

        if (this.loadingNode?.isValid) {
            this.loadingNode.active = false;
            await SimpleUIManager.instance.open(UIPanelId.SALA, undefined, { pushToStack: false });
        }
    }

    protected onDestroy(): void {
        uninstallScreenAdaptation();
        // 清理UI管理器
        SimpleUIManager.instance.destroyAll();
    }
}
