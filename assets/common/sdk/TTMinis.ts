import { _decorator, Component, Node, director, sys } from "cc";
import { TTConfig } from "./TTConfig";
const { ccclass } = _decorator;

declare const tt: any;

@ccclass("TTMinis")
export class TTMinis extends Component {
	public static inst: TTMinis;
	private isInTT = false;
	private static readonly ROOT_NAME = "__TTMinisRoot__";

	/** 登录状态缓存 */
	private loginCode: string | null = null;
	/** 登录过期时间戳 */
	private loginExpireTime: number = 0;
	/** 登录有效期：2小时 */
	private readonly LOGIN_VALID_DURATION = 2 * 60 * 60 * 1000;

	public static ensureInitialized(): TTMinis {
		if (TTMinis.inst?.isValid) {
			return TTMinis.inst;
		}
		const root = new Node(TTMinis.ROOT_NAME);
		const comp = root.addComponent(TTMinis);
		director.addPersistRootNode(root);
		// onLoad 可能晚于当前帧才执行，此处先挂上单例，避免连续 ensure 时重复创建根节点
		if (!TTMinis.inst) {
			TTMinis.inst = comp;
		}
		return TTMinis.inst;
	}

	private rewardedVideoAd: any = null;
	private interstitialAd: any = null;
	private rewardedAdId: string = "";
	private rewardedLoadingPromise: Promise<void> | null = null;
	private rewardedReady = false;
	private rewardedShowing = false;

	onLoad() {
		if (TTMinis.inst != null && TTMinis.inst !== this) {
			this.destroy();
			return;
		}
		TTMinis.inst = this;
		this.isInTT = typeof tt !== "undefined";
		console.log("✅ TTMinis 初始化完成");

		// 使用配置文件中的广告ID
		TTMinis.inst.initRewarded(TTConfig.rewardedAdId);
		TTMinis.inst.initInterstitial(TTConfig.interstitialAdId);
	}

	// ==============================================
	// 登录（增加状态缓存）
	// ==============================================
	/**
	 * 登录并缓存登录态
	 * @param forceRefresh 是否强制刷新登录态
	 */
	login(forceRefresh: boolean = false): Promise<string> {
		return new Promise((resolve, reject) => {
			if (!this.isInTT) return reject("非抖音环境");

			// 检查缓存的登录态是否有效
			if (!forceRefresh && this.loginCode && Date.now() < this.loginExpireTime) {
				console.log("使用缓存的登录态");
				return resolve(this.loginCode);
			}

			tt.login({ 
				success: (res) => {
					this.loginCode = res.code;
					this.loginExpireTime = Date.now() + this.LOGIN_VALID_DURATION;
					resolve(res.code);
				}, 
				fail: reject 
			});
		});
	}

	/**
	 * 清除登录缓存
	 */
	clearLoginCache(): void {
		this.loginCode = null;
		this.loginExpireTime = 0;
	}

	/**
	 * 检查是否已登录
	 */
	isLoggedIn(): boolean {
		return !!this.loginCode && Date.now() < this.loginExpireTime;
	}

	// ==============================================
	// 激励广告（修复：支持无限次调用）
	// ==============================================
	initRewarded(adId: string) {
		if (!this.isInTT) return;
		if (this.rewardedVideoAd) return;
		if (!adId) {
			console.warn("[TTMinis] 激励广告ID为空，跳过初始化");
			return;
		}
		this.rewardedAdId = adId;

		this.rewardedVideoAd = tt.createRewardedVideoAd({ adUnitId: adId });

		this.rewardedVideoAd.onLoad(() => {
			this.rewardedReady = true;
			console.log("✅ 激励广告加载完成");
		});

		this.rewardedVideoAd.onError((err) => {
			this.rewardedReady = false;
			console.error("广告错误", err);
		});

		this.loadRewardedAd().catch(() => {});
	}

	/**
	 * 检查激励广告是否已准备好
	 */
	isRewardedAdReady(): boolean {
		return !!this.rewardedVideoAd;
	}

	showRewarded(onSuccess: () => void, onSkipped?: () => void) {
		if (!this.rewardedVideoAd) {
			this.toast("广告未初始化");
			return;
		}
		if (this.rewardedShowing) {
			this.toast("广告播放中，请稍候");
			return;
		}

		// 清空旧事件
		this.rewardedVideoAd.offClose();
		this.rewardedVideoAd.offError();

		// 关闭后自动重新加载（关键修复）
		this.rewardedVideoAd.onClose((res) => {
			this.rewardedShowing = false;
			this.rewardedReady = false;
			this.loadRewardedAd().catch(() => {});
			if (res?.isEnded) onSuccess?.();
			else onSkipped?.();
		});

		this.rewardedVideoAd.onError((err) => {
			this.rewardedShowing = false;
			this.rewardedReady = false;
			// 某些错误下实例会进入不可用状态，重建后可恢复二次播放
			if (err?.errCode === 1004 || err?.errCode === 1005 || err?.errCode === 1008) {
				this.recreateRewardedAd();
			}
			this.loadRewardedAd().catch(() => {});
		});

		this.loadRewardedAd()
			.then(() => {
				this.rewardedShowing = true;
				return this.rewardedVideoAd.show();
			})
			.catch((err) => {
				this.rewardedShowing = false;
				console.log("广告播放失败", err);
				this.toast("广告加载失败，请稍后重试");
			});
	}

	private loadRewardedAd(): Promise<void> {
		if (!this.rewardedVideoAd) {
			return Promise.reject(new Error("rewarded ad not initialized"));
		}
		if (this.rewardedReady) {
			return Promise.resolve();
		}
		if (this.rewardedLoadingPromise) {
			return this.rewardedLoadingPromise;
		}
		this.rewardedLoadingPromise = this.rewardedVideoAd
			.load()
			.then(() => {
				this.rewardedReady = true;
			})
			.catch((err) => {
				this.rewardedReady = false;
				throw err;
			})
			.finally(() => {
				this.rewardedLoadingPromise = null;
			});
		return this.rewardedLoadingPromise;
	}

	private recreateRewardedAd() {
		if (!this.isInTT || !this.rewardedAdId) return;
		this.rewardedVideoAd = null;
		this.rewardedReady = false;
		this.rewardedLoadingPromise = null;
		this.initRewarded(this.rewardedAdId);
	}

	// ==============================================
	// 插屏广告（增加错误处理）
	// ==============================================
	initInterstitial(adId: string) {
		if (!this.isInTT) return;
		if (this.interstitialAd) return;
		if (!adId) {
			console.warn("[TTMinis] 插屏广告ID为空，跳过初始化");
			return;
		}

		this.interstitialAd = tt.createInterstitialAd({ adUnitId: adId });

		// 增加错误监听
		this.interstitialAd.onError((err) => {
			console.error("[TTMinis] 插屏广告错误:", err);
		});

		// 增加加载完成监听
		this.interstitialAd.onLoad(() => {
			console.log("✅ 插屏广告加载完成");
		});
	}

	/**
	 * 检查插屏广告是否已准备好
	 */
	isInterstitialAdReady(): boolean {
		return !!this.interstitialAd;
	}

	/**
	 * 显示插屏广告（增加错误处理和回调）
	 * @param onSuccess 显示成功回调
	 * @param onFail 显示失败回调
	 */
	showInterstitial(onSuccess?: () => void, onFail?: (err: any) => void) {
		if (!this.interstitialAd) {
			console.warn("[TTMinis] 插屏广告未初始化");
			onFail?.({ errMsg: "插屏广告未初始化" });
			return;
		}

		this.interstitialAd
			.show()
			.then(() => {
				console.log("[TTMinis] 插屏广告显示成功");
				onSuccess?.();
			})
			.catch((err) => {
				console.error("[TTMinis] 插屏广告显示失败:", err);
				this.toast("广告显示失败");
				onFail?.(err);
			});
	}

	// ==============================================
	// 工具
	// ==============================================
	toast(msg: string) {
		if (!this.isInTT) return;
		tt.showToast({ title: msg, icon: "none" });
	}

	share(title?: string, imageUrl?: string, query?: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.isInTT) return reject("非抖音环境");
			if (!tt.shareAppMessage) return reject("不支持分享");
			tt.shareAppMessage({ 
				title: title || TTConfig.defaultShareTitle, 
				imageUrl, 
				query: query || TTConfig.defaultShareQuery, 
				success: () => resolve(), 
				fail: reject 
			});
		});
	}

	// ==============================================
	// 支付（使用配置）
	// ==============================================
	requestPayment(orderAmount: number, goodName: string, zoneId = "1", platform?: string): Promise<any> {
		return new Promise((resolve, reject) => {
			if (!this.isInTT) return reject("非抖音环境");
			if (!tt.canIUse?.("requestGamePayment.object.goodType")) {
				return reject("不支持支付");
			}

			const safeAmount = Math.max(1, Math.floor(orderAmount));
			const customId = `order_${Date.now()}_${Math.random()}`;

			// 自动检测平台
			const targetPlatform = platform || this.detectPlatform();

			tt.requestGamePayment({
				mode: "game",
				env: 0,
				platform: targetPlatform,
				currencyType: TTConfig.currencyType,
				zoneId,
				customId,
				goodType: 2,
				orderAmount: safeAmount,
				goodName: (goodName || "道具").slice(0, 10),
				success: resolve,
				fail: reject,
			});
		});
	}

	/**
	 * 自动检测运行平台
	 */
	private detectPlatform(): string {
		// 优先使用配置，后续可根据运行环境动态判断
		return TTConfig.defaultPlatform;
	}

	// ==============================================
	// 桌面快捷方式 + 奖励
	// ==============================================
	addShortcut(): Promise<boolean> {
		return new Promise((resolve) => {
			if (!this.isInTT) return resolve(false);
			tt.addShortcut({ success: () => resolve(true), fail: () => resolve(false) });
		});
	}

	getShortcutMissionReward(): Promise<{ canReceive: boolean }> {
		return new Promise((resolve) => {
			if (!this.isInTT) return resolve({ canReceive: false });
			tt.getShortcutMissionReward({
				success: (res) => resolve({ canReceive: res.canReceive }),
				fail: () => resolve({ canReceive: false }),
			});
		});
	}

	async checkAndGetShortcutReward(onReward: () => void) {
		const { canReceive } = await this.getShortcutMissionReward();
		if (!canReceive) {
			this.toast("桌面奖励已领取");
			return;
		}
		const added = await this.addShortcut();
		if (added) {
			onReward?.();
			this.toast("✅ 奖励已发放");
		} else {
			this.toast("添加失败");
		}
	}

	// ==============================================
	// 侧边栏复访 + 奖励
	// ==============================================
	startEntranceMission(): Promise<boolean> {
		return new Promise((resolve) => {
			if (!this.isInTT) return resolve(false);
			tt.startEntranceMission({ success: () => resolve(true), fail: () => resolve(false) });
		});
	}

	getEntranceMissionReward(): Promise<{ canReceive: boolean }> {
		return new Promise((resolve) => {
			if (!this.isInTT) return resolve({ canReceive: false });
			tt.getEntranceMissionReward({
				success: (res) => resolve({ canReceive: res.canReceive }),
				fail: () => resolve({ canReceive: false }),
			});
		});
	}

	async checkAndGetEntranceReward(onReward: () => void) {
		const { canReceive } = await this.getEntranceMissionReward();
		if (canReceive) {
			onReward?.();
			this.toast("✅ 侧边栏奖励领取成功");
			return;
		}
		await this.startEntranceMission();
		this.toast("请从侧边栏重新进入领取");
	}
}
