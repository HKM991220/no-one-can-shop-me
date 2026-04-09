import { SimpleUIBase } from "../common/ui/SimpleUIBase";
import { _decorator, Button, Label, Node } from "cc";
import { SimpleUIManager } from "../common/ui/SimpleUIManager";
import { UIPanelId } from "../common/ui/UIPanelRegistry";
import { TTMinis } from "../common/sdk/TTMinis";

const { ccclass, menu, property } = _decorator;

@ccclass("SalaView")
@menu("cwg/SalaView")
export default class SalaView extends SimpleUIBase {
	@property(Button)
	protected startButton: Button | null = null;

	/** 快捷方式奖励领取成功事件（业务层可监听后发奖） */
	public static readonly EVENT_REWARD_SHORTCUT = "reward:shortcut";
	/** 个人主页侧边栏奖励领取成功事件（业务层可监听后发奖） */
	public static readonly EVENT_REWARD_PROFILE_SIDEBAR = "reward:profileSidebar";

	@property(Node)
	btnRewardedAd: Node = null!;

	@property(Node)
	btnInterstitialAd: Node = null!;

	@property(Node)
	btnShare: Node = null!;

	@property(Node)
	btnPay: Node = null!;

	@property({ tooltip: "付费示例：价格（分），正式环境请与后台商品一致" })
	protected defaultPayAmountFen: number = 10;

	@property({ tooltip: "付费示例：道具名（≤10 字）" })
	protected defaultPayGoodName: string = "道具";

	/** 始终通过 ensureInitialized 取实例，避免入口未先初始化时出现 TTMinis.inst 为 undefined */
	private tt(): TTMinis {
		return TTMinis.ensureInitialized();
	}

	protected onEnable(): void {
		if (this.startButton?.isValid) {
			this.startButton.node.on(Button.EventType.CLICK, this.onStartClick, this);
		}
		this.addButtonListeners();
	}

	protected onDisable(): void {
		if (this.startButton?.isValid) {
			this.startButton.node.off(
				Button.EventType.CLICK,
				this.onStartClick,
				this,
			);
		}
		this.offButtonListeners();
	}

	onStartClick() {
		void SimpleUIManager.instance.open(UIPanelId.GAME, undefined, {
			pushToStack: false,
		});
		SimpleUIManager.instance.close(UIPanelId.SALA);
	}

	// 绑定所有按钮
	addButtonListeners() {
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

	protected offButtonListeners(): void {
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
