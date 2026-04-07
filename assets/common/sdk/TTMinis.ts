import { _decorator, Component } from "cc";
const { ccclass } = _decorator;

declare const tt: any;

@ccclass("TTMinis")
export class TTMinis extends Component {
	public static inst: TTMinis;
	private isInTT = false;

	// 广告实例
	private rewardedVideoAd: any = null;
	private interstitialAd: any = null;

	onLoad() {
		if (TTMinis.inst) {
			this.destroy();
			return;
		}
		TTMinis.inst = this;
		this.isInTT = typeof tt !== "undefined";
		console.log("✅ TTMinis 初始化完成");

		TTMinis.inst.initRewarded("ad7623758078475110418");
		TTMinis.inst.initInterstitial("ad7625865283080603666");
	}

	// ==============================================
	// 1. 基础功能（已通过）
	// ==============================================
	login() {
		return new Promise((resolve, reject) => {
			if (!this.isInTT) return reject("非抖音环境");
			tt.login({ success: (res) => resolve(res.code), fail: reject });
		});
	}

	initRewarded(adId: string) {
		if (!this.isInTT) return;
		this.rewardedVideoAd = tt.createRewardedVideoAd({ adUnitId: adId });
	}

	showRewarded(onSuccess: () => void, p0: () => void) {
		if (!this.rewardedVideoAd) return;
		this.rewardedVideoAd.offClose();
		this.rewardedVideoAd.onClose((res) => {
			if (res.isEnded) onSuccess();
		});
		this.rewardedVideoAd.show().catch(() => {});
	}

	initInterstitial(adId: string) {
		if (!this.isInTT) return;
		this.interstitialAd = tt.createInterstitialAd({ adUnitId: adId });
	}

	showInterstitial() {
		if (!this.interstitialAd) return;
		this.interstitialAd.show().catch(() => {});
	}

	toast(msg: string) {
		if (!this.isInTT) return;
		tt.showToast({ title: msg, icon: "none" });
	}

	// ==============================================
	// 2. 桌面快捷方式（含审核API）
	// ==============================================
	addShortcut(): Promise<boolean> {
		return new Promise((resolve) => {
			if (!this.isInTT) return resolve(false);
			tt.addShortcut({
				success: () => resolve(true),
				fail: () => resolve(false),
			});
		});
	}

	// ✅ 【审核API】获取桌面快捷方式奖励
	getShortcutMissionReward(): Promise<{ canReceive: boolean }> {
		return new Promise((resolve) => {
			if (!this.isInTT) return resolve({ canReceive: false });
			tt.getShortcutMissionReward({
				success: (res) => resolve({ canReceive: res.canReceive }),
				fail: () => resolve({ canReceive: false }),
			});
		});
	}

	// 一键完成：添加桌面 + 领奖励（审核标准流程）
	async checkAndGetShortcutReward(onReward: () => void) {
		const { canReceive } = await this.getShortcutMissionReward();
		if (!canReceive) {
			this.toast("桌面奖励已领取");
			return;
		}

		const added = await this.addShortcut();
		if (added) {
			onReward?.();
			this.toast("桌面奖励领取成功！");
		} else {
			this.toast("添加桌面失败，请重试");
		}
	}

	// ==============================================
	// 3. 侧边栏复访（含审核API）
	// ==============================================
	// ✅ 【审核API】跳转到个人主页侧边栏
	startEntranceMission(): Promise<boolean> {
		return new Promise((resolve) => {
			if (!this.isInTT) return resolve(false);
			tt.startEntranceMission({
				success: () => resolve(true),
				fail: () => resolve(false),
			});
		});
	}

	// ✅ 【审核API】获取侧边栏奖励
	getEntranceMissionReward(): Promise<{ canReceive: boolean }> {
		return new Promise((resolve) => {
			if (!this.isInTT) return resolve({ canReceive: false });
			tt.getEntranceMissionReward({
				success: (res) => resolve({ canReceive: res.canReceive }),
				fail: () => resolve({ canReceive: false }),
			});
		});
	}

	// 一键完成：引导侧边栏 + 领奖励（审核标准流程）
	async checkAndGetEntranceReward(onReward: () => void) {
		const { canReceive } = await this.getEntranceMissionReward();
		if (canReceive) {
			onReward?.();
			this.toast("侧边栏奖励领取成功！");
			return;
		}

		const goSuccess = await this.startEntranceMission();
		if (goSuccess) {
			this.toast("请从侧边栏重新进入领取奖励");
		} else {
			this.toast("跳转失败，请重试");
		}
	}
}
