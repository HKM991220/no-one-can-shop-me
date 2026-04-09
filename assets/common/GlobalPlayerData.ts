/**
 * 全局玩家数据：语言、金币、体力、扩展设置等，与 LocalStorage 同步。
 * 音频开关/音量仍由 GameAudioSettings 持久化；此处提供委托方法便于统一入口。
 */
import LocalStorage from './LocalStorage';
import { GameAudioSettings } from './AudioSetting';

export const GLOBAL_PLAYER_STORAGE_KEY = 'cwg_global_player_data_v1';

/** 可序列化进存档的扩展设置（震动、画质等按需扩展） */
export type PlayerExtraSettings = Record<string, string | number | boolean | null | undefined>;

export interface GlobalPlayerDataSnapshotV1 {
    version: 1;
    /** BCP-47，如 zh-Hans、en */
    language: string;
    level: number;
    coins: number;
    stamina: number;
    staminaMax: number;
    /** 可选：用于体力随时间恢复（毫秒时间戳） */
    lastStaminaUtc?: number;
    /** 非音频类偏好 */
    settings: PlayerExtraSettings;
}

const DEFAULT_SNAPSHOT: Omit<GlobalPlayerDataSnapshotV1, 'version'> = {
    language: 'zh-Hans',
    coins: 0,
    level: 0,
    stamina: 100,
    staminaMax: 100,
    settings: {},
};

function clampInt(n: number, min: number, max: number): number {
    if (!Number.isFinite(n)) {
        return min;
    }
    return Math.min(max, Math.max(min, Math.floor(n)));
}

export class GlobalPlayerData {
    private static _instance: GlobalPlayerData | null = null;

    public static get instance(): GlobalPlayerData {
        if (!this._instance) {
            this._instance = new GlobalPlayerData();
        }
        return this._instance;
    }

    private _language = DEFAULT_SNAPSHOT.language;
    private _level = DEFAULT_SNAPSHOT.level;
    private _coins = DEFAULT_SNAPSHOT.coins;
    private _stamina = DEFAULT_SNAPSHOT.stamina;
    private _staminaMax = DEFAULT_SNAPSHOT.staminaMax;
    private _lastStaminaUtc: number | undefined;
    private _settings: PlayerExtraSettings = { ...DEFAULT_SNAPSHOT.settings };
    private _loaded = false;

    private constructor() { }

    /**
     * 从本地读取；应在 GameBootstrap.ensureReady() 之后调用一次（已在 GameBootstrap 内调用）。
     */
    public load(): void {
        if (this._loaded) {
            return;
        }
        this._loaded = true;
        const raw = LocalStorage.getJson(GLOBAL_PLAYER_STORAGE_KEY) as Partial<GlobalPlayerDataSnapshotV1> | null;
        const merged = this.mergeSnapshot(raw);
        this.applySnapshot(merged);
    }

    /** 强制重新从磁盘合并（一般不需要） */
    public reloadFromStorage(): void {
        this._loaded = true;
        const raw = LocalStorage.getJson(GLOBAL_PLAYER_STORAGE_KEY) as Partial<GlobalPlayerDataSnapshotV1> | null;
        this.applySnapshot(this.mergeSnapshot(raw));
    }

    public save(): void {
        const snap = this.buildSnapshot();
        LocalStorage.setJson(GLOBAL_PLAYER_STORAGE_KEY, snap);
    }

    private mergeSnapshot(raw: Partial<GlobalPlayerDataSnapshotV1> | null): GlobalPlayerDataSnapshotV1 {
        const s = raw ?? {};
        const staminaMax = clampInt(
            typeof s.staminaMax === 'number' ? s.staminaMax : DEFAULT_SNAPSHOT.staminaMax,
            1,
            999999,
        );
        let stamina = clampInt(
            typeof s.stamina === 'number' ? s.stamina : DEFAULT_SNAPSHOT.stamina,
            0,
            staminaMax,
        );
        const coins = Math.max(0, typeof s.coins === 'number' && Number.isFinite(s.coins) ? Math.floor(s.coins) : DEFAULT_SNAPSHOT.coins);
        const level = Math.max(0, typeof s.level === 'number' && Number.isFinite(s.level) ? Math.floor(s.level) : DEFAULT_SNAPSHOT.level);
        const language = typeof s.language === 'string' && s.language.length > 0 ? s.language : DEFAULT_SNAPSHOT.language;
        const settings =
            s.settings && typeof s.settings === 'object' && !Array.isArray(s.settings)
                ? { ...s.settings }
                : { ...DEFAULT_SNAPSHOT.settings };
        const lastStaminaUtc =
            typeof s.lastStaminaUtc === 'number' && Number.isFinite(s.lastStaminaUtc) ? s.lastStaminaUtc : undefined;

        return {
            version: 1,
            language,
            level,
            coins,
            stamina,
            staminaMax,
            lastStaminaUtc,
            settings,
        };
    }

    private applySnapshot(s: GlobalPlayerDataSnapshotV1): void {
        this._language = s.language;
        this._level = s.level;
        this._coins = s.coins;
        this._stamina = s.stamina;
        this._staminaMax = s.staminaMax;
        this._lastStaminaUtc = s.lastStaminaUtc;
        this._settings = { ...s.settings };
    }

    private buildSnapshot(): GlobalPlayerDataSnapshotV1 {
        return {
            version: 1,
            language: this._language,
            level: this._level,
            coins: this._coins,
            stamina: this._stamina,
            staminaMax: this._staminaMax,
            lastStaminaUtc: this._lastStaminaUtc,
            settings: { ...this._settings },
        };
    }

    // --- 语言 ---
    public get language(): string {
        return this._language;
    }

    public setLanguage(code: string): void {
        const v = (code || '').trim() || DEFAULT_SNAPSHOT.language;
        if (v === this._language) {
            return;
        }
        this._language = v;
        this.save();
    }

    // --- 关卡 ---
    public get level(): number {
        return this._level;
    }

    public setLevel(value: number): void {
        this._level = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
        this.save();
    }

    // --- 金币 ---
    public get coins(): number {
        return this._coins;
    }

    public setCoins(amount: number): void {
        this._coins = Math.max(0, Math.floor(Number.isFinite(amount) ? amount : 0));
        this.save();
    }

    public addCoins(delta: number): void {
        if (!Number.isFinite(delta) || delta === 0) {
            return;
        }
        this._coins = Math.max(0, this._coins + Math.floor(delta));
        this.save();
    }

    // --- 体力 ---
    public get stamina(): number {
        return this._stamina;
    }

    public get staminaMax(): number {
        return this._staminaMax;
    }

    public get lastStaminaUtc(): number | undefined {
        return this._lastStaminaUtc;
    }

    public setStaminaMax(max: number): void {
        const m = clampInt(max, 1, 999999);
        if (m === this._staminaMax) {
            return;
        }
        this._staminaMax = m;
        this._stamina = Math.min(this._stamina, m);
        this.save();
    }

    /** 直接设置当前体力（不超过上限） */
    public setStamina(value: number): void {
        const v = clampInt(value, 0, this._staminaMax);
        if (v === this._stamina) {
            return;
        }
        this._stamina = v;
        this.save();
    }

    /**
     * 消耗体力；不足时返回 false 且不扣减
     */
    public tryConsumeStamina(cost: number): boolean {
        const c = Math.max(1, Math.floor(Number.isFinite(cost) ? cost : 1));
        if (this._stamina < c) {
            return false;
        }
        this._stamina -= c;
        this._lastStaminaUtc = Date.now();
        this.save();
        return true;
    }

    /**
     * 补满体力（或加到上限）
     */
    public refillStamina(): void {
        if (this._stamina >= this._staminaMax) {
            return;
        }
        this._stamina = this._staminaMax;
        this.save();
    }

    // --- 扩展设置（非音频）---
    public getSetting<T>(key: string, defaultValue: T): T {
        if (!Object.prototype.hasOwnProperty.call(this._settings, key)) {
            return defaultValue;
        }
        return this._settings[key] as T;
    }

    public setSetting(key: string, value: string | number | boolean | null | undefined): void {
        this._settings[key] = value;
        this.save();
    }

    public removeSetting(key: string): void {
        if (!Object.prototype.hasOwnProperty.call(this._settings, key)) {
            return;
        }
        delete this._settings[key];
        this.save();
    }

    // --- 音频：委托 GameAudioSettings，不写进本快照，避免双份数据源 ---
    public isMusicEnabled(): boolean {
        return GameAudioSettings.isMusicEnabled();
    }

    public isSfxEnabled(): boolean {
        return GameAudioSettings.isSfxEnabled();
    }

    public setMusicEnabled(on: boolean): void {
        GameAudioSettings.setMusicEnabled(on);
    }

    public setSfxEnabled(on: boolean): void {
        GameAudioSettings.setSfxEnabled(on);
    }

    public getMusicVolume(): number {
        return GameAudioSettings.getMusicVolume();
    }

    public getSfxVolume(): number {
        return GameAudioSettings.getSfxVolume();
    }

    public setMusicVolume(v: number): void {
        GameAudioSettings.setMusicVolume(v);
    }

    public setSfxVolume(v: number): void {
        GameAudioSettings.setSfxVolume(v);
    }
}
