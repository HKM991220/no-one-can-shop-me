/**
 * 多语言：从 resources/i18n/{locale}.json 加载，与 GlobalPlayerData.language 同步。
 *
 * - 初始化：`await I18n.instance.init()`（在 GameBootstrap.ensureReady 之后）
 * - 切换语言：`await I18n.instance.setLocale('en')`
 * - 取文案：`I18n.instance.t('settings.title')`，支持 `t('common.hello', { name: 'Tom' })` → `Hello {name}`
 * - 监听刷新：`I18n.instance.on(I18n.EVENT_LANGUAGE_CHANGED, (locale) => { ... }, this)`
 */
import {EventTarget, JsonAsset} from 'cc';
import {GameBootstrap} from '../GameBootstrap';
import {GlobalPlayerData} from '../GlobalPlayerData';

const BUNDLE = 'resources';
const I18N_DIR = 'i18n';

function getByPath(obj: unknown, path: string): unknown {
    const parts = path.split('.').filter((p) => p.length > 0);
    let cur: unknown = obj;
    for (const p of parts) {
        if (cur === null || typeof cur !== 'object') {
            return undefined;
        }
        cur = (cur as Record<string, unknown>)[p];
    }
    return cur;
}

/** 逻辑语言码 → i18n 目录下文件名（不含 .json） */
const LOCALE_FILE: Record<string, string> = {
    'zh-Hans': 'zh-Hans',
    zh: 'zh-Hans',
    'zh-CN': 'zh-Hans',
    'zh-Hant': 'zh-Hant',
    'zh-TW': 'zh-Hant',
    'zh-HK': 'zh-Hant',
    en: 'en',
    'en-US': 'en',
    ja: 'ja',
    jp: 'ja',
    vi: 'vi',
    vn: 'vi',
};

export class I18n {
    public static readonly EVENT_LANGUAGE_CHANGED = 'i18n-language-changed';

    private static _instance: I18n | null = null;

    public static get instance(): I18n {
        if (!this._instance) {
            this._instance = new I18n();
        }
        return this._instance;
    }

    private readonly events = new EventTarget();
    private _table: Record<string, unknown> = {};
    private _locale = 'zh-Hans';
    private _ready: Promise<void> | null = null;

    public get locale(): string {
        return this._locale;
    }

    /** 在 GameBootstrap.ensureReady() 与 GlobalPlayerData.load() 之后调用 */
    public async init(): Promise<void> {
        if (this._ready) {
            return this._ready;
        }
        this._ready = (async () => {
            const lang = GlobalPlayerData.instance.language;
            await this.loadLocaleInternal(this.canonicalLocale(lang), false);
        })();
        return this._ready;
    }

    /**
     * 切换语言：写入 GlobalPlayerData、重载 JSON、派发 EVENT_LANGUAGE_CHANGED
     */
    public async setLocale(locale: string): Promise<void> {
        const canonical = this.canonicalLocale(locale);
        GlobalPlayerData.instance.setLanguage(canonical);
        await this.loadLocaleInternal(canonical, true);
    }

    /**
     * 取文案；缺失时返回 key。占位符：`"你好 {name}"` + `params: { name: 'A' }`
     */
    public t(key: string, params?: Record<string, string | number>): string {
        const raw = getByPath(this._table, key);
        let s = typeof raw === 'string' ? raw : key;
        if (params && s !== key) {
            for (const k of Object.keys(params)) {
                const v = params[k as keyof typeof params];
                s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
            }
        }
        return s;
    }

    public on(
        type: typeof I18n.EVENT_LANGUAGE_CHANGED,
        callback: (locale: string) => void,
        target?: object,
    ): void {
        this.events.on(type, callback as (...args: unknown[]) => void, target);
    }

    public off(
        type: typeof I18n.EVENT_LANGUAGE_CHANGED,
        callback: (locale: string) => void,
        target?: object,
    ): void {
        this.events.off(type, callback as (...args: unknown[]) => void, target);
    }

    private canonicalLocale(locale: string): string {
        const t = (locale || '').trim();
        if (!t) {
            return 'zh-Hans';
        }
        const lower = t.toLowerCase();
        if (lower === 'zh-hans' || lower === 'zh-cn' || lower === 'zh') {
            return 'zh-Hans';
        }
        if (lower === 'en' || lower === 'en-us' || lower === 'en-gb') {
            return 'en';
        }
        if (lower === 'zh-hant' || lower === 'zh-hk' || lower === 'zh-tw') {
            return 'zh-Hant';
        }
        if (lower === 'ja' || lower === 'jp') {
            return 'ja';
        }
        if (lower === 'vi' || lower === 'vn') {
            return 'vi';
        }
        if (LOCALE_FILE[t]) {
            return t;
        }
        return t;
    }

    private fileIdForLocale(canonical: string): string {
        return LOCALE_FILE[canonical] ?? 'zh-Hans';
    }

    private async loadLocaleInternal(canonical: string, notify: boolean): Promise<void> {
        const fileId = this.fileIdForLocale(canonical);
        const path = `${I18N_DIR}/${fileId}`;
        this._locale = canonical;

        const boot = GameBootstrap.root;
        if (!boot) {
            console.warn('[I18n] GameBootstrap 未就绪');
            this._table = {};
            return;
        }

        try {
            const asset = await boot.res.load(BUNDLE, path, JsonAsset);
            const json = asset?.json;
            this._table =
                json && typeof json === 'object' && !Array.isArray(json)
                    ? (json as Record<string, unknown>)
                    : {};
        } catch (e) {
            console.error('[I18n] 加载语言包失败', path, e);
            if (fileId !== 'zh-Hans') {
                await this.loadFallbackZhHans(boot);
            } else {
                this._table = {};
            }
        }

        if (notify) {
            this.events.emit(I18n.EVENT_LANGUAGE_CHANGED, this._locale);
        }
    }

    private async loadFallbackZhHans(boot: GameBootstrap): Promise<void> {
        try {
            const asset = await boot.res.load(BUNDLE, `${I18N_DIR}/zh-Hans`, JsonAsset);
            const json = asset?.json;
            this._table =
                json && typeof json === 'object' && !Array.isArray(json)
                    ? (json as Record<string, unknown>)
                    : {};
            this._locale = 'zh-Hans';
        } catch {
            this._table = {};
        }
    }
}
