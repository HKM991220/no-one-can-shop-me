import {Asset, assetManager, AssetManager} from 'cc';

type AssetCtor<T extends Asset> = new (...args: never[]) => T;

/**
 * 资源模块：
 * - 负责 bundle 加载与缓存
 * - 负责资源加载、缓存与释放
 */
export class UIResModule {
    private readonly bundleCache: Map<string, AssetManager.Bundle> = new Map();
    private readonly loadedAssets: Map<string, Asset> = new Map();

    public async loadBundle(bundleName: string): Promise<AssetManager.Bundle> {
        const cache = this.bundleCache.get(bundleName);
        if (cache) {
            return cache;
        }

        const exists = assetManager.getBundle(bundleName);
        if (exists) {
            this.bundleCache.set(bundleName, exists);
            return exists;
        }

        const bundle = await new Promise<AssetManager.Bundle>((resolve, reject) => {
            assetManager.loadBundle(bundleName, (err, loadedBundle) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(loadedBundle);
            });
        });
        this.bundleCache.set(bundleName, bundle);
        return bundle;
    }

    public async load<T extends Asset>(bundleName: string, path: string, type: AssetCtor<T>): Promise<T> {
        const key = `${bundleName}:${path}:${type.name}`;
        const cacheAsset = this.loadedAssets.get(key);
        if (cacheAsset) {
            return cacheAsset as T;
        }

        const bundle = await this.loadBundle(bundleName);
        const asset = await new Promise<T>((resolve, reject) => {
            bundle.load(path, type, (err, loadedAsset) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(loadedAsset);
            });
        });

        this.loadedAssets.set(key, asset);
        return asset;
    }

    public release(bundleName: string, path: string, typeName: string): void {
        const key = `${bundleName}:${path}:${typeName}`;
        const asset = this.loadedAssets.get(key);
        if (!asset) {
            return;
        }
        assetManager.releaseAsset(asset);
        this.loadedAssets.delete(key);
    }

    public releaseAll(): void {
        for (const [, asset] of this.loadedAssets) {
            assetManager.releaseAsset(asset);
        }
        this.loadedAssets.clear();
    }
}
