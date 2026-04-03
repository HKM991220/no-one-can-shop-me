import {_decorator, Prefab, instantiate, Node} from 'cc';
import {UIBase} from './UIBase';
import {UIContext} from './UIManager';

const {ccclass, property, menu} = _decorator;

/**
 * UI 框架示例（案例）
 *
 * 用法：
 * 1. 挂到任意 UI 节点（例如弹窗根节点）
 * 2. 在检查器里设置 bundleName / prefabPath
 * 3. 调用 open() 后会：
 *    - 监听示例事件 `ui:refresh`
 *    - 加载并实例化一个 Prefab 到 contentRoot
 * 4. 调用 close() 或节点销毁时会自动清理事件与资源
 */
@ccclass('UIFrameworkExample')
@menu('cwg/UIFrameworkExample')
export class UIFrameworkExample extends UIBase {
    @property({tooltip: '资源所在 Bundle 名称，例如 resources'})
    protected bundleName: string = 'resources';

    @property({tooltip: 'Prefab 路径（相对 Bundle），例如 prefab/AddEmptyGlass'})
    protected prefabPath: string = '';

    @property(Node)
    protected contentRoot: Node | null = null;

    private previewNode: Node | null = null;

    protected onOpen(ctx?: UIContext): void {
        // 1) 监听业务刷新事件
        this.listenEvent('ui:refresh', this.onRefreshEvent);

        // 2) 派发一个示例事件（可被其他系统监听）
        this.emitEvent('ui:opened', ctx?.payload);

        // 3) 异步加载并展示示例 Prefab
        this.loadAndShowPrefab();
    }

    protected onClose(): void {
        // 关闭时手动移除预览节点（资源释放由 UIBase.onDestroy 统一处理）
        if (this.previewNode && this.previewNode.isValid) {
            this.previewNode.destroy();
        }
        this.previewNode = null;
    }

    private onRefreshEvent = () => {
        // 收到刷新事件时重新加载一次预览
        this.loadAndShowPrefab();
    };

    private async loadAndShowPrefab() {
        if (!this.prefabPath || !this.contentRoot) {
            return;
        }

        if (this.previewNode && this.previewNode.isValid) {
            this.previewNode.destroy();
            this.previewNode = null;
        }

        try {
            const prefab = await this.loadUIAsset(this.bundleName, this.prefabPath, Prefab);
            this.previewNode = instantiate(prefab);
            this.previewNode.parent = this.contentRoot;
        } catch (err) {
            console.error('[UIFrameworkExample] load prefab failed:', err);
        }
    }
}
