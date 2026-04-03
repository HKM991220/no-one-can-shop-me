import {_decorator, Asset, Component} from 'cc';
import {UIResModule} from './ui/UIResModule';

type AssetCtor<T extends Asset> = new (...args: never[]) => T;

const {ccclass} = _decorator;

/**
 * 全局资源管理：Bundle / 资源缓存与释放，内部委托 UIResModule。
 */
@ccclass('ResManager')
export class ResManager extends Component {
    private readonly module = new UIResModule();

    public async ensureReady(): Promise<void> {
        return Promise.resolve();
    }

    public loadBundle(bundleName: string) {
        return this.module.loadBundle(bundleName);
    }

    public load<T extends Asset>(bundleName: string, path: string, type: AssetCtor<T>): Promise<T> {
        return this.module.load(bundleName, path, type);
    }

    public release(bundleName: string, path: string, typeName: string): void {
        this.module.release(bundleName, path, typeName);
    }

    public releaseAll(): void {
        this.module.releaseAll();
    }
}
