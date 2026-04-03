import {_decorator, Component, Node} from 'cc';
import {GameBootstrap} from './common/GameBootstrap';
import {installScreenAdaptation, uninstallScreenAdaptation} from './common/ScreenAdapter';
import {bootstrapMainEntry, shutdownMainEntry} from './common/ui/UIService';
import {BundleName, UIPrefabPath} from './common/Enum';
import {HotUpdateService} from './common/hotupdate/HotUpdateService';

const {ccclass, menu, property} = _decorator;

/**
 * 主场景入口：不包含 UI 注册/加载逻辑，仅调用 UIService.bootstrapMainEntry。
 */
@ccclass('Mian')
@menu('cwg/Mian')
export class Mian extends Component {
    @property({type: Node, tooltip: 'UI 挂载根节点（mian 场景下的 view 节点）'})
    protected viewNode: Node | null = null;

    @property({tooltip: '资源 Bundle 名称'})
    protected bundleName: string = BundleName.RESOURCES;

    @property({tooltip: 'loading 预制体路径（相对 bundle）'})
    protected loadingPrefabPath: string = UIPrefabPath.LOADING_VIEW;

    @property({tooltip: 'game 预制体路径（相对 bundle）'})
    protected gamePrefabPath: string = UIPrefabPath.GAME_VIEW;

    protected async start(): Promise<void> {
        installScreenAdaptation('auto');
        HotUpdateService.instance.applyStoredSearchPaths();
        await GameBootstrap.ensureReady();
        await bootstrapMainEntry({
            viewRoot: this.viewNode ?? this.node,
            bundle: this.bundleName,
            loadingPrefabPath: this.loadingPrefabPath,
            gamePrefabPath: this.gamePrefabPath,
        });
    }

    protected onDestroy(): void {
        uninstallScreenAdaptation();
        shutdownMainEntry();
    }
}
