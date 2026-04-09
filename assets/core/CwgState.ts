/**
 * @Descripttion:
 * @version: 1.0
 * @Author: Lioesquieu
 * @Date: 2025-07-20
 * @LastEditors: Lioesquieu
 * @LastEditTime: 2024-08-10
 */
import LocalStorage from "../common/LocalStorage";
import ResLoader from "../common/ResLoader";
import { GlobalPlayerData } from "../common/GlobalPlayerData";

export interface CwgStateInfo {
    level: number,
    time: number,
    step: number,
    width: number,
    height: number
}

export default class CwgState {

    public info: CwgStateInfo = {level: 0, time: 0, step: 0, width: 3, height: 3};

    constructor() {
        this.info = LocalStorage.getJson("CwgState");
        if (!this.info) {
            this.info = {level: 0, time: 1000, step: 2, width: 2, height: 2};
        }
        this.syncLevelFromGlobal();
        // this.info = {level: 2, time: 1000, step: 2, width: 2, height: 2};
    }

    public reset() {
    }

    public getData() {
        this.syncLevelFromGlobal();
        return ResLoader.loadJson('resources', `level/level_${this.info.level + 1}`);
    }

    public setLevel(level: number) {
        const nextLevel = Math.max(0, Math.floor(Number.isFinite(level) ? level : 0));
        this.info.level = nextLevel;
        GlobalPlayerData.instance.setLevel(nextLevel);
    }

    public getLevel(): number {
        this.syncLevelFromGlobal();
        return this.info.level;
    }

    private syncLevelFromGlobal() {
        GlobalPlayerData.instance.load();
        this.info.level = Math.max(0, Math.floor(GlobalPlayerData.instance.level));
    }

    public save() {
        GlobalPlayerData.instance.setLevel(this.info.level);
        LocalStorage.setJson("CwgState", this.info);
    }
}