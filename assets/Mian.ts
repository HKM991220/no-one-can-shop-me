import { _decorator, Component, Node } from 'cc';
import { GameBootstrap } from './common/GameBootstrap';
import { installScreenAdaptation, uninstallScreenAdaptation } from './common/ScreenAdapter';
import { SimpleUIManager } from './common/ui/SimpleUIManager';
import { preloadCommonPanels, registerAllUIPanels, UIPanelId } from './common/ui/UIPanelRegistry';
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

    protected async start(): Promise<void> {
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
        // 与 Loading 并行拉取 Game / Setting / Sala 预制体，避免进游戏后首次点开设置要等资源
        preloadCommonPanels();

        // 预加载并打开Loading界面
        await SimpleUIManager.instance.preload(UIPanelId.LOADING);
        await SimpleUIManager.instance.open(UIPanelId.LOADING, undefined, { pushToStack: false });
    }

    protected onDestroy(): void {
        uninstallScreenAdaptation();
        // 清理UI管理器
        SimpleUIManager.instance.destroyAll();
    }
}
