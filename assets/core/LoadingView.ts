import { _decorator, Button, Label, Node } from "cc";
import { SimpleUIBase } from "../common/ui/SimpleUIBase";
import { SimpleUIManager } from "../common/ui/SimpleUIManager";
import { UIPanelId } from "../common/ui/UIPanelRegistry";
import EventMng from "../common/EventMng";
import { TTMinis } from "../common/sdk/TTMinis";

const { ccclass, menu, property } = _decorator;

@ccclass("LoadingView")
@menu('cwg/LoadingView')
export default class Loading extends SimpleUIBase {
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
	private hasAutoLoginTried = false;

	/** 始终通过 ensureInitialized 取实例，避免入口未先初始化时出现 TTMinis.inst 为 undefined */
	private tt(): TTMinis {
		return TTMinis.ensureInitialized();
	}

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

	protected onUIOpen(data?: any): void {
		// 入口应已调用 TTMinis.ensureInitialized；此处 tt() 仍可兜底
		this.canStart = false;
		if (this.startButton) {
			this.startButton.interactable = false;
		}
		if (this.tipsLabel) {
			this.tipsLabel.string = "Loading...";
		}
		this.addButtonListeners();
		this.tryAutoLogin();
		// 未由外部 bindStartAction 时，默认：进入游戏并关闭 Loading（入口场景只需 register + open）
		if (this.onStartCallback == null) {
			this.onStartCallback = () => {
				void SimpleUIManager.instance.open(UIPanelId.SALA, undefined, { pushToStack: false });
				SimpleUIManager.instance.close(UIPanelId.LOADING);
			};
		}
		void this.playComplete();
	}

	protected onUIClose(data?: any): void {
		this.btnLogin?.off(Button.EventType.CLICK, this.onLoginClick, this);
		this.btnRewardedAd?.off(
			Button.EventType.CLICK,
			this.onRewardedAdClick,
			this,
		);
		this.btnInterstitialAd?.off(
			Button.EventType.CLICK,
			this.onInterstitialClick,
			this,
		);
		this.btnShare?.off(Button.EventType.CLICK, this.onShareClick, this);
		this.btnPay?.off(Button.EventType.CLICK, this.onPayClick, this);
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
			this.tipsLabel.string = ready ? "Click Start" : "Loading...";
		}
	}

	public setTips(tips: string): void {
		if (this.tipsLabel) {
			this.tipsLabel.string = tips;
		}
	}

	/**
	 * 由外部注入"开始游戏"回调
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
		const sdk = this.tt();
		sdk.toast("正在登录...");

		sdk
			.login()
			.then((code) => {
				console.log("登录成功 code:", code);
				sdk.toast("登录成功");
			})
			.catch((err) => {
				console.log("登录失败", err);
				sdk.toast("登录失败");
			});
	}

	private tryAutoLogin(): void {
		if (this.hasAutoLoginTried) {
			return;
		}
		this.hasAutoLoginTried = true;

		this.tt()
			.login()
			.then((code) => {
				console.log("自动登录成功 code:", code);
			})
			.catch((err) => {
				console.log("自动登录失败", err);
			});
	}

	// 激励视频
	onRewardedAdClick() {
		const sdk = this.tt();
		sdk.showRewarded(
			() => {
				console.log("✅ 广告看完，发奖励！");
				sdk.toast("奖励已发放");
			},
			() => {
				console.log("用户跳过广告");
				sdk.toast("未看完广告，无奖励");
			},
		);
	}

	// 插屏广告
	onInterstitialClick() {
		this.tt().showInterstitial();
	}

	// 分享
	onShareClick() {
		const sdk = this.tt();
		sdk
			.share("这个游戏超好玩！", undefined, "from=share_test")
			.then(() => {
				console.log("分享调用成功");
				sdk.toast("已拉起分享");
			})
			.catch((err) => {
				console.log("分享调用失败", err);
				sdk.toast("分享调用失败");
			});
	}

	// 支付
	async onPayClick() {
		const sdk = this.tt();
		try {
			sdk.toast("正在发起支付...");

			// 金额单位：分  10 = 0.1元
			const res = await sdk.requestPayment(10, "金币x10");

			sdk.toast("支付成功！");
			console.log("支付结果", res);
		} catch (err) {
			console.log("支付不支持/失败:", err);
			sdk.toast("暂不支持支付");
		}
	}

	// 按钮点击事件：桌面奖励
	async onClickShortcutReward() {
		await this.tt().checkAndGetShortcutReward(() => {
			// 发放奖励，例如：
			// playerData.coin += 100;
			console.log("发放桌面奖励：+100金币");
		});
	}

	// 按钮点击事件：侧边栏奖励
	async onClickEntranceReward() {
		await this.tt().checkAndGetEntranceReward(() => {
			// 发放奖励，例如：
			// playerData.diamond += 50;
			console.log("发放侧边栏奖励：+50钻石");
		});
	}
}
