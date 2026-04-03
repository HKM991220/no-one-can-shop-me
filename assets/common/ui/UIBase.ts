import {_decorator, Asset, Component} from 'cc';
import {UIContext} from './UIManager';
import {UIEventHandler, UIEventModule} from './UIEventModule';
import {UIResModule} from './UIResModule';

const {ccclass} = _decorator;

/**
 * UI 基类
 * - 统一 open/close 生命周期
 * - 提供事件监听与资源管理便捷方法
 */
@ccclass('UIBase')
export class UIBase extends Component {
    /** 事件子模块：跟随 UI 生命周期自动清理 */
    private readonly eventModule = new UIEventModule();
    /** 资源子模块：跟随 UI 生命周期自动释放 */
    private readonly resModule = new UIResModule();

    /** 打开 UI */
    public open(ctx?: UIContext): void {
        this.node.active = true;
        this.onOpen(ctx);
    }

    /** 关闭 UI */
    public close(ctx?: UIContext): void {
        this.onClose(ctx);
        this.node.active = false;
    }

    /** 子类按需覆盖：打开回调 */
    protected onOpen(_ctx?: UIContext): void {}

    /** 子类按需覆盖：关闭回调 */
    protected onClose(_ctx?: UIContext): void {}

    /** 自动清理监听与资源 */
    protected onDestroy(): void {
        this.eventModule.clear(this);
        this.resModule.releaseAll();
    }

    /** 绑定常驻事件监听 */
    protected listenEvent(type: string, handler: UIEventHandler): void {
        this.eventModule.on(type, handler, this);
    }

    /** 绑定一次性事件监听 */
    protected listenOnce(type: string, handler: UIEventHandler): void {
        this.eventModule.once(type, handler, this);
    }

    /** 移除指定事件监听 */
    protected unlistenEvent(type: string, handler: UIEventHandler): void {
        this.eventModule.off(type, handler, this);
    }

    /** 派发事件 */
    protected emitEvent(type: string, ...args: unknown[]): void {
        this.eventModule.emit(type, ...args);
    }

    /** 加载 UI 资源（自动缓存） */
    protected async loadUIAsset<T extends Asset>(bundleName: string, path: string, type: new (...args: never[]) => T): Promise<T> {
        return this.resModule.load(bundleName, path, type);
    }

    /** 释放单个 UI 资源 */
    protected releaseUIAsset(bundleName: string, path: string, typeName: string): void {
        this.resModule.release(bundleName, path, typeName);
    }
}
