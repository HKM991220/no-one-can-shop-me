import { SimpleUIBase } from "../common/ui/SimpleUIBase";
import { _decorator, Button, Label, Node } from "cc";
import { SimpleUIManager } from "../common/ui/SimpleUIManager";
import { UIPanelId } from "../common/ui/UIPanelRegistry";
import { VwPlay } from "./VwPlay";
import { TTMinis } from "../common/sdk/TTMinis";
import { GlobalPlayerData } from "../common/GlobalPlayerData";
import EventMng from "../common/EventMng";
import { EventName } from "../common/Enum";
import { GameplayConst } from "./CwgConstant";

const { ccclass, menu, property } = _decorator;

@ccclass("SalaView")
@menu("cwg/SalaView")
export default class SalaView extends SimpleUIBase {
	private static readonly VIDEO_STAMINA_DATE_KEY = "stamina_video_reward_date";
	private static readonly VIDEO_STAMINA_COUNT_KEY = "stamina_video_reward_count";
	@property(Button)
	protected startButton: Button | null = null;

	@property(Node)
	btnRewardedAd: Node = null!;

	@property(Node)
	btnInterstitialAd: Node = null!;

	@property(Node)
	btnShare: Node = null!;

	@property(Node)
	btnPay: Node = null!;

	@property(Node)
	btnAddGold: Node = null!;

	@property(Node)
	btnSubGold: Node = null!;

	@property(Node)
	btnAddPower: Node = null!;

	@property(Node)
	btnSubPower: Node = null!;

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
		void (async () => {
			if (GlobalPlayerData.instance.stamina < GameplayConst.STAMINA_COST_PER_ROUND) {
				this.tt().toast("体力不足");
				this.notifyResourceChanged();
				return;
			}
			await SimpleUIManager.instance.open(UIPanelId.GAME, undefined, {
				pushToStack: false,
			});
			// 结算回大厅时 Game 可能一直未失活，onEnable 不会触发；须按存档关卡重新加载（教程通关后进入第 2 关）
			const gameRoot = SimpleUIManager.instance.getNode(UIPanelId.GAME);
			const vw = gameRoot?.getComponentInChildren(VwPlay);
			const started = vw?.startRound() !== false;
			if (!started) {
				this.tt().toast("体力不足");
				SimpleUIManager.instance.close(UIPanelId.GAME);
				return;
			}
			SimpleUIManager.instance.close(UIPanelId.SALA);
		})();
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
		this.btnAddGold?.on(Button.EventType.CLICK, this.onAddGoldClick, this);
		this.btnSubGold?.on(Button.EventType.CLICK, this.onSubGoldClick, this);
		this.btnAddPower?.on(Button.EventType.CLICK, this.onAddPowerClick, this);
		this.btnSubPower?.on(Button.EventType.CLICK, this.onSubPowerClick, this);
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
		this.btnAddGold?.off(Button.EventType.CLICK, this.onAddGoldClick, this);
		this.btnSubGold?.off(Button.EventType.CLICK, this.onSubGoldClick, this);
		this.btnAddPower?.off(Button.EventType.CLICK, this.onAddPowerClick, this);
		this.btnSubPower?.off(Button.EventType.CLICK, this.onSubPowerClick, this);
	}

	private notifyResourceChanged(): void {
		const playerData = GlobalPlayerData.instance;
		EventMng.emit(EventName.PLAYER_RESOURCE_CHANGED, {
			coins: playerData.coins,
			stamina: playerData.stamina,
		});
	}

	/** 增加金币（默认 +100） */
	private onAddGoldClick(): void {
		GlobalPlayerData.instance.addCoins(10);
		this.notifyResourceChanged();
	}

	/** 减少金币（默认 -100，最低到 0） */
	private onSubGoldClick(): void {
		GlobalPlayerData.instance.addCoins(-10);
		this.notifyResourceChanged();
	}

	/** 增加体力（默认 +10，不超过上限） */
	private onAddPowerClick(): void {
		const playerData = GlobalPlayerData.instance;
		playerData.setStamina(playerData.stamina + 10);
		this.notifyResourceChanged();
	}

	/** 减少体力（默认 -10，最低到 0） */
	private onSubPowerClick(): void {
		const playerData = GlobalPlayerData.instance;
		playerData.setStamina(playerData.stamina - 10);
		this.notifyResourceChanged();
	}



	// 激励视频
	// onRewardedAdClick() {
	// 	const player = GlobalPlayerData.instance;
	// 	if (player.stamina >= player.staminaMax) {
	// 		this.tt().toast("体力已满");
	// 		return;
	// 	}
	// 	const remainBefore = this.getTodayVideoRewardRemain();
	// 	if (remainBefore <= 0) {
	// 		this.tt().toast("今日体力视频次数已用完");
	// 		return;
	// 	}
	// 	const sdk = this.tt();
	// 	sdk.showRewarded(
	// 		() => {
	// 			const remain = this.tryGrantStaminaByVideo();
	// 			if (remain < 0) {
	// 				sdk.toast("今日体力视频次数已用完");
	// 				return;
	// 			}
	// 			console.log("✅ 广告看完，恢复体力");
	// 			sdk.toast(`体力+${GameplayConst.STAMINA_PER_REWARDED_AD}（今日剩余${remain}次）`);
	// 		},
	// 		() => {
	// 			console.log("用户跳过广告");
	// 			sdk.toast("未看完广告，无奖励");
	// 		},
	// 	);
	// }

	onRewardedAdClick() {
		const player = GlobalPlayerData.instance;
		const sdk = this.tt();
		sdk.showRewarded(
			() => {
				console.log("广告看完");

			},
			() => {
				console.log("用户跳过广告");
				sdk.toast("未看完广告，无奖励");
			},
		);
	}

	private getTodayKey(): string {
		const d = new Date();
		const y = d.getFullYear();
		const mNum = d.getMonth() + 1;
		const dayNum = d.getDate();
		const m = mNum < 10 ? `0${mNum}` : `${mNum}`;
		const day = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
		return `${y}-${m}-${day}`;
	}

	private getTodayVideoRewardRemain(): number {
		const player = GlobalPlayerData.instance;
		const today = this.getTodayKey();
		const savedDate = player.getSetting<string>(SalaView.VIDEO_STAMINA_DATE_KEY, "");
		let count = Number(player.getSetting<number>(SalaView.VIDEO_STAMINA_COUNT_KEY, 0));
		if (!Number.isFinite(count) || count < 0) {
			count = 0;
		}
		if (savedDate !== today) {
			return GameplayConst.DAILY_REWARDED_STAMINA_LIMIT;
		}
		return Math.max(0, GameplayConst.DAILY_REWARDED_STAMINA_LIMIT - Math.floor(count));
	}

	/**
	 * 发放视频体力奖励
	 * @returns 剩余可领奖次数；返回 -1 表示今日次数已用完或不应发奖
	 */
	private tryGrantStaminaByVideo(): number {
		const player = GlobalPlayerData.instance;
		const today = this.getTodayKey();
		const savedDate = player.getSetting<string>(SalaView.VIDEO_STAMINA_DATE_KEY, "");
		let count = Number(player.getSetting<number>(SalaView.VIDEO_STAMINA_COUNT_KEY, 0));
		if (!Number.isFinite(count) || count < 0) {
			count = 0;
		}
		if (savedDate !== today) {
			count = 0;
			player.setSetting(SalaView.VIDEO_STAMINA_DATE_KEY, today);
		}
		if (count >= GameplayConst.DAILY_REWARDED_STAMINA_LIMIT) {
			return -1;
		}
		if (player.stamina >= player.staminaMax) {
			return -1;
		}
		player.setStamina(player.stamina + GameplayConst.STAMINA_PER_REWARDED_AD);
		count += 1;
		player.setSetting(SalaView.VIDEO_STAMINA_COUNT_KEY, count);
		this.notifyResourceChanged();
		return Math.max(0, GameplayConst.DAILY_REWARDED_STAMINA_LIMIT - count);
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
