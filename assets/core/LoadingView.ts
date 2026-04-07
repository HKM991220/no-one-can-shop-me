import { _decorator, Button, Label, Node } from "cc";
import { UIBase } from "../common/ui/UIBase";
import EventMng from "../common/EventMng";
import { TTMinis } from "../common/sdk/TTMinis";

const { ccclass, menu, property } = _decorator;

@ccclass("LoadingView")
export default class Loading extends UIBase {
	/** 快捷方式奖励领取成功事件（业务层可监听后发奖） */
	public static readonly EVENT_REWARD_SHORTCUT = "reward:shortcut";
	/** 个人主页侧边栏奖励领取成功事件（业务层可监听后发奖） */
	public static readonly EVENT_REWARD_PROFILE_SIDEBAR = "reward:profileSidebar";

	@property(Label)
	protected tipsLabel: Label | null = null;

	@property(Button)
	protected startButton: Button | null = null;

	@property(Node)
	btnLogin: Node = null!;

	@property(Node)
	btnRewardedAd: Node = null!;

	@property(Node)
	btnInterstitialAd: Node = null!;

	@property(Node)
	btnShare: Node = null!;

	@property(Node)
	btnPay: Node = null!;

	@property({ tooltip: "loading 最短显示时长（秒）" })
	protected minShowTime: number = 0.5;

	@property({ tooltip: "付费示例：价格（分），正式环境请与后台商品一致" })
	protected defaultPayAmountFen: number = 10;

	@property({ tooltip: "付费示例：道具名（≤10 字）" })
	protected defaultPayGoodName: string = "道具";

	private canStart: boolean = false;
	private onStartCallback: (() => void) | null = null;

	// 绑定所有按钮
	addButtonListeners() {
		this.btnLogin?.on(Button.EventType.CLICK, this.onLoginClick, this);
		this.btnRewardedAd?.on(
			Button.EventType.CLICK,
			this.onRewardedAdClick,
			this,
		);
		this.btnInterstitialAd?.on(
			Button.EventType.CLICK,
			this.onInterstitialClick,
			this,
		);
		this.btnShare?.on(Button.EventType.CLICK, this.onShareClick, this);
		this.btnPay?.on(Button.EventType.CLICK, this.onPayClick, this);
	}

	protected onEnable(): void {
		this.canStart = false;
		if (this.startButton) {
			this.startButton.interactable = false;
		}
		if (this.tipsLabel) {
			this.tipsLabel.string = "Loading...";
		}
		this.addButtonListeners();
	}

	protected onDisable(): void {}

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
			this.tipsLabel.string = ready ? "Click Start" : "Loading...";
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

	// 登录
	onLoginClick() {
		TTMinis.inst.toast("正在登录...");

		TTMinis.inst
			.login()
			.then((code) => {
				console.log("登录成功 code:", code);
				TTMinis.inst.toast("登录成功");
			})
			.catch((err) => {
				console.log("登录失败", err);
				TTMinis.inst.toast("登录失败");
			});
	}

	// 激励视频
	onRewardedAdClick() {
		TTMinis.inst.showRewarded(
			() => {
				console.log("✅ 广告看完，发奖励！");
				TTMinis.inst.toast("奖励已发放");
			},
			() => {
				console.log("用户跳过广告");
				TTMinis.inst.toast("未看完广告，无奖励");
			},
		);
	}

	// 插屏广告
	onInterstitialClick() {
		TTMinis.inst.showInterstitial();
	}

	// 分享
	onShareClick() {
		// TTMinis.inst.share("这个游戏超好玩！", "https://xxx.com/你的分享图.jpg");
		TTMinis.inst.toast("分享已打开");
	}

	// 支付
	onPayClick() {}

	// 按钮点击事件：桌面奖励
	async onClickShortcutReward() {
		await TTMinis.inst.checkAndGetShortcutReward(() => {
			// 发放奖励，例如：
			// playerData.coin += 100;
			console.log("发放桌面奖励：+100金币");
		});
	}

	// 按钮点击事件：侧边栏奖励
	async onClickEntranceReward() {
		await TTMinis.inst.checkAndGetEntranceReward(() => {
			// 发放奖励，例如：
			// playerData.diamond += 50;
			console.log("发放侧边栏奖励：+50钻石");
		});
	}
}
