import { _decorator, Component, Node, assetManager, AssetManager, log } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('LoadRemoteBundle')
export class LoadRemoteBundle extends Component {
    async start() {
        // 1. 设置远程资源根路径（和构建时填的一致，也可以在构建面板直接填，这里可省略）
        // assetManager.downloader.setBaseUrl('https://your-cdn.com/game/');

        // 2. 加载远程Bundle（bundle名和你配置的一致）
        try {
            const bundle = await this.loadBundle('resources'); // 你的Bundle名称
            log('远程Bundle加载成功:', bundle.name);
            
            // 3. 加载Bundle里的资源（例：加载场景、预制体、图片）
            // 加载场景
            // bundle.loadScene('GameScene', (err, scene) => { ... });
            // 加载预制体
            // bundle.load('prefabs/UI', (err, prefab) => { ... });
        } catch (err) {
            log('远程Bundle加载失败:', err);
        }
    }

    // 封装异步加载Bundle
    loadBundle(bundleName: string): Promise<AssetManager.Bundle> {
        return new Promise((resolve, reject) => {
            assetManager.loadBundle(bundleName, (err, bundle) => {
                if (err) reject(err);
                else resolve(bundle);
            });
        });
    }
}