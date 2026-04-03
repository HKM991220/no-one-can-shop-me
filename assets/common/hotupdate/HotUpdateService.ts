import {assetManager, game, resources, sys, TextAsset} from 'cc';

declare const jsb: any;

type ProgressCallback = (message: string) => void;

export interface UpdateFlowResult {
    skipped: boolean;
    updated: boolean;
    restarted: boolean;
    reason?: string;
}

export type HotUpdateStage = 'idle' | 'checking' | 'updating' | 'finished' | 'failed';

export interface HotUpdateOptions {
    maxRetry: number;
}

const DEFAULT_OPTIONS: HotUpdateOptions = {
    maxRetry: 3,
};

/**
 * 原生热更新服务（Web/编辑器自动跳过）。
 * 依赖 assets/resources/hotupdate/project.manifest。
 */
export class HotUpdateService {
    public static readonly instance = new HotUpdateService();

    private readonly storagePath = `${(globalThis as any).jsb?.fileUtils?.getWritablePath?.() ?? ''}hotupdate-assets`;
    private assetsManager: any = null;
    private checking = false;
    private updating = false;
    private retryCount = 0;
    private stage: HotUpdateStage = 'idle';

    private constructor() {
    }

    public getStage(): HotUpdateStage {
        return this.stage;
    }

    public applyStoredSearchPaths(): void {
        if (!this.isNativeAvailable()) {
            return;
        }
        const pathsJson = sys.localStorage.getItem('HotUpdateSearchPaths');
        if (!pathsJson) {
            return;
        }
        try {
            const paths = JSON.parse(pathsJson);
            if (Array.isArray(paths) && paths.length > 0) {
                (globalThis as any).jsb.fileUtils.setSearchPaths(paths);
            }
        } catch (e) {
            console.warn('[HotUpdate] Invalid HotUpdateSearchPaths', e);
        }
    }

    public async runUpdateFlow(onProgress?: ProgressCallback, options?: Partial<HotUpdateOptions>): Promise<UpdateFlowResult> {
        const opts = {...DEFAULT_OPTIONS, ...options};
        if (!this.isNativeAvailable()) {
            onProgress?.('Running local assets');
            return {skipped: true, updated: false, restarted: false, reason: 'non-native platform'};
        }

        this.stage = 'checking';
        onProgress?.('Checking updates...');
        const hasNewVersion = await this.checkForUpdates(onProgress).catch((e: Error) => {
            this.stage = 'failed';
            onProgress?.(`Check failed: ${e.message}`);
            return false;
        });
        if (!hasNewVersion) {
            if (this.stage !== 'failed') {
                this.stage = 'finished';
            }
            onProgress?.('Assets are up to date');
            return {skipped: false, updated: false, restarted: false, reason: this.stage === 'failed' ? 'check failed' : 'already up to date'};
        }

        this.stage = 'updating';
        onProgress?.('Downloading update...');
        const restarted = await this.hotUpdate(onProgress, opts.maxRetry);
        this.stage = restarted ? 'finished' : 'failed';
        return {
            skipped: false,
            updated: true,
            restarted,
            reason: restarted ? 'updated and restarted' : 'update failed',
        };
    }

    private isNativeAvailable(): boolean {
        return !!(sys.isNative && (globalThis as any).jsb?.AssetsManager && (globalThis as any).jsb?.fileUtils);
    }

    private async checkForUpdates(onProgress?: ProgressCallback): Promise<boolean> {
        if (this.checking) {
            return false;
        }
        this.checking = true;
        try {
            await this.ensureAssetsManagerReady();
            const am = this.assetsManager;
            if (!am) {
                return false;
            }

            return await new Promise<boolean>((resolve, reject) => {
                am.setEventCallback((event: any) => {
                    const code = event?.getEventCode?.();
                    switch (code) {
                        case jsb.EventAssetsManager.ERROR_NO_LOCAL_MANIFEST:
                            onProgress?.('Local manifest is missing');
                            am.setEventCallback(null);
                            resolve(false);
                            break;
                        case jsb.EventAssetsManager.ERROR_DOWNLOAD_MANIFEST:
                        case jsb.EventAssetsManager.ERROR_PARSE_MANIFEST:
                            onProgress?.('Manifest check failed');
                            am.setEventCallback(null);
                            reject(new Error('manifest download/parse failed'));
                            break;
                        case jsb.EventAssetsManager.ALREADY_UP_TO_DATE:
                            am.setEventCallback(null);
                            resolve(false);
                            break;
                        case jsb.EventAssetsManager.NEW_VERSION_FOUND:
                            am.setEventCallback(null);
                            resolve(true);
                            break;
                        default:
                            break;
                    }
                });
                am.checkUpdate();
            });
        } finally {
            this.checking = false;
        }
    }

    private async hotUpdate(onProgress?: ProgressCallback, maxRetry: number): Promise<boolean> {
        if (this.updating || !this.assetsManager) {
            return false;
        }
        this.retryCount = 0;
        this.updating = true;
        try {
            return await new Promise<boolean>((resolve) => {
                this.assetsManager.setEventCallback((event: any) => {
                    const code = event?.getEventCode?.();
                    switch (code) {
                        case jsb.EventAssetsManager.UPDATE_PROGRESSION: {
                            const percent = Math.floor((event?.getPercentByFile?.() ?? 0) * 100);
                            onProgress?.(`Downloading update... ${percent}%`);
                            break;
                        }
                        case jsb.EventAssetsManager.UPDATE_FINISHED:
                            onProgress?.('Update finished, restarting...');
                            this.assetsManager.setEventCallback(null);
                            this.applySearchPathsAndRestart();
                            resolve(true);
                            break;
                        case jsb.EventAssetsManager.UPDATE_FAILED:
                            this.retryCount += 1;
                            if (this.retryCount <= maxRetry) {
                                onProgress?.(`Update failed, retrying (${this.retryCount}/${maxRetry})...`);
                                this.assetsManager.downloadFailedAssets();
                            } else {
                                onProgress?.('Update failed');
                                this.assetsManager.setEventCallback(null);
                                resolve(false);
                            }
                            break;
                        case jsb.EventAssetsManager.ERROR_UPDATING:
                        case jsb.EventAssetsManager.ERROR_DECOMPRESS:
                            onProgress?.('Update file error');
                            break;
                        default:
                            break;
                    }
                });
                this.assetsManager.update();
            });
        } finally {
            this.updating = false;
        }
    }

    private applySearchPathsAndRestart(): void {
        const newPaths = this.assetsManager.getLocalManifest().getSearchPaths();
        const currentPaths = (globalThis as any).jsb.fileUtils.getSearchPaths();
        const mergedPaths = [...newPaths, ...currentPaths];
        (globalThis as any).jsb.fileUtils.setSearchPaths(mergedPaths);
        sys.localStorage.setItem('HotUpdateSearchPaths', JSON.stringify(mergedPaths));
        game.restart();
    }

    private async ensureAssetsManagerReady(): Promise<void> {
        if (this.assetsManager) {
            return;
        }

        (globalThis as any).jsb.fileUtils.createDirectory(this.storagePath);
        const manifestContent = await this.loadLocalManifestContent();
        const manifest = new jsb.Manifest(manifestContent, this.storagePath);
        this.assetsManager = new jsb.AssetsManager('', this.storagePath);
        this.assetsManager.setVerifyCallback(() => true);
        this.assetsManager.loadLocalManifest(manifest, this.storagePath);

        if (sys.os === sys.OS.ANDROID) {
            this.assetsManager.setMaxConcurrentTask(2);
        }
    }

    private async loadLocalManifestContent(): Promise<string> {
        const manifestAsset = await new Promise<TextAsset>((resolve, reject) => {
            resources.load('hotupdate/project.manifest', TextAsset, (err, asset) => {
                if (err || !asset) {
                    reject(err ?? new Error('project.manifest not found'));
                    return;
                }
                resolve(asset);
            });
        });
        return manifestAsset.text;
    }
}
