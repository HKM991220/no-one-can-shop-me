import {_decorator, Button, Component, Label} from 'cc';
import { UIBase } from '../common/ui/UIBase';

const {ccclass, menu, property} = _decorator;


@ccclass('LoadingView')
export default class Loading extends UIBase {
    @property(Label)
    protected tipsLabel: Label | null = null;

    @property(Button)
    protected startButton: Button | null = null;

    @property({tooltip: 'loading 最短显示时长（秒）'})
    protected minShowTime: number = 0.5;
    private canStart: boolean = false;
    private onStartCallback: (() => void) | null = null;

    protected onEnable(): void {
        this.canStart = false;
        if (this.startButton) {
            this.startButton.interactable = false;
        }
        if (this.tipsLabel) {
            this.tipsLabel.string = 'Loading...';
        }
    }

    /**
     * loading 页完成播放（可用于等待最短展示时间、做简易文本反馈）
     */
    public async playComplete(): Promise<void> {
        await this.wait(this.minShowTime);
        this.setReady(true);
    }

    /**
     * 设置开始按钮是否可点击
     */
    public setReady(ready: boolean): void {
        this.canStart = ready;
        if (this.startButton) {
            this.startButton.interactable = ready;
        }
        if (this.tipsLabel) {
            this.tipsLabel.string = ready ? 'Click Start' : 'Loading...';
        }
    }

    public setTips(tips: string): void {
        if (this.tipsLabel) {
            this.tipsLabel.string = tips;
        }
    }

    /**
     * 由外部注入“开始游戏”回调
     */
    public bindStartAction(callback: () => void): void {
        this.onStartCallback = callback;
    }

    private wait(seconds: number): Promise<void> {
        return new Promise((resolve) => {
            this.scheduleOnce(() => resolve(), seconds);
        });
    }

    public onStartButtonClick(): void {
        if (!this.canStart) {
            return;
        }
        this.onStartCallback?.();
    }
}