import { _decorator, Button, Component, Label, Node, Sprite, Tween, tween, UIOpacity, Vec3, EventTouch, resources, SpriteFrame } from "cc";
import { TTMinis } from "../common/sdk/TTMinis";
import FunlandInfo from "./FunlandInfo";
import { VwFunland } from "./VwFunland";
import { WaterColor, getWaterColorSet } from "./CwgConstant";
import Glass from "./Glass";

const { ccclass, menu, property } = _decorator;

@ccclass("DeliveryManager")
@menu("cwg/DeliveryManager")
export default class DeliveryManager extends Component {
    private static readonly FREE_SLOT_COUNT = 2;
    private static readonly MAX_DELIVERY_COLORS = 6;
    private static readonly GLASS_FLY_DURATION = 0.35;
    private static readonly RIDER_OUT_DURATION = 0.26;

    @property({ type: VwFunland, tooltip: "当前游戏区（用于读取关卡颜色池）" })
    protected funlandView: VwFunland | null = null;

    @property({ type: [Node], tooltip: "4 个坑位根节点，按 1~4 顺序" })
    protected slotNodes: Node[] = [];

    @property({ type: [Node], tooltip: "4 个外卖员节点（可选；未配时自动从 Slot 下找 rider）" })
    protected riderNodes: Node[] = [];

    @property({ type: [Node], tooltip: "4 个锁遮罩（可选；未配时自动从 Slot 下找 ad）" })
    protected lockMasks: Node[] = [];

    @property({ type: [Button], tooltip: "解锁按钮（通常只填 3/4 号位），可为空" })
    protected unlockButtons: Button[] = [];

    @property({ type: Label, tooltip: "待派送数量（可选）" })
    protected pendingLabel: Label | null = null;

    @property({ type: Label, tooltip: "进度（可选）" })
    protected progressLabel: Label | null = null;

    /** 当前关卡可用颜色池（仅来自关卡） */
    private levelColorPool: WaterColor[] = [];
    /** 每个槽位当前外卖员颜色 */
    private riderColors: Array<WaterColor | null> = [];
    /** 每个槽位是否已解锁 */
    private unlockedSlots: boolean[] = [];
    /** 每种颜色剩余待派送数量（按本局满瓶目标计算） */
    private pendingPerColor: Record<number, number> = {};
    /** 待派送订单列表（每个元素代表 1 瓶需要派送的颜色） */
    private remainingOrders: WaterColor[] = [];

    private deliveredCount = 0;
    private totalDeliverTarget = 0;
    private riderFrameCache: Record<string, SpriteFrame | null> = {};
    private autoBoundUnlockButtons: Button[] = [];
    private autoBoundUnlockNodes: Node[] = [];

    protected onEnable(): void {
        for (let i = 0; i < this.unlockButtons.length; i++) {
            const btn = this.unlockButtons[i];
            if (!btn?.node?.isValid) {
                continue;
            }
            btn.node.on(Button.EventType.CLICK, this.onUnlockButtonClick, this);
        }
        this.bindAutoUnlockButtons();
    }

    protected onDisable(): void {
        for (let i = 0; i < this.unlockButtons.length; i++) {
            const btn = this.unlockButtons[i];
            if (!btn?.node?.isValid) {
                continue;
            }
            btn.node.off(Button.EventType.CLICK, this.onUnlockButtonClick, this);
        }
        for (const btn of this.autoBoundUnlockButtons) {
            if (!btn?.node?.isValid) {
                continue;
            }
            btn.node.off(Button.EventType.CLICK, this.onUnlockButtonClick, this);
        }
        for (const n of this.autoBoundUnlockNodes) {
            if (!n?.isValid) {
                continue;
            }
            n.off(Node.EventType.TOUCH_END, this.onUnlockNodeTouch, this);
        }
        this.autoBoundUnlockButtons = [];
        this.autoBoundUnlockNodes = [];
    }

    /**
     * 每局开始时调用：重建颜色池、重置坑位、初始化骑手颜色。
     */
    public resetForRound(funland?: FunlandInfo | null): void {
        const info = funland ?? this.funlandView?.funland ?? null;
        this.remainingOrders = this.buildPendingOrders(info);
        this.pendingPerColor = this.buildPendingPerColorFromOrders(this.remainingOrders);
        this.levelColorPool = this.buildLevelColorPool(info);
        this.totalDeliverTarget = this.remainingOrders.length;
        this.deliveredCount = 0;

        const slotCount = Math.max(
            this.slotNodes.length,
            this.riderNodes.length,
            this.lockMasks.length,
            4,
        );
        this.riderColors = new Array(slotCount).fill(null);
        this.unlockedSlots = new Array(slotCount).fill(false);

        for (let i = 0; i < slotCount; i++) {
            this.unlockedSlots[i] = this.isFreeSlot(i);
            if (this.unlockedSlots[i]) {
                const firstFreeColor = this.findFirstFreeSlotColor();
                this.riderColors[i] = firstFreeColor === null
                    ? this.pickRandomPendingColorForSlot(i)
                    : this.pickRandomPendingColorForSlot(i, firstFreeColor);
            } else {
                this.riderColors[i] = null;
            }
        }

        this.refreshAllSlotsView();
        this.refreshProgressView();
        this.debugPrintRoundState();
    }

    /**
     * 尝试派送一个满瓶颜色；匹配到同色外卖员才成功。
     */
    public tryDeliverColor(color: WaterColor): boolean {
        if (!this.isDeliverableColor(color)) {
            return false;
        }
        if ((this.pendingPerColor[color] ?? 0) <= 0) {
            return false;
        }
        const slotIdx = this.findMatchedRiderSlot(color);
        if (slotIdx < 0) {
            return false;
        }
        this.consumeRider(slotIdx, color);
        return true;
    }

    /**
     * 瓶子满水后派送：瓶子飞向外卖员背包，外卖员送走后刷新下一位。
     */
    public async tryDeliverGlass(glass: Glass): Promise<boolean> {
        if (!glass?.node?.isValid || !glass.node.active || !glass.isSealed()) {
            return false;
        }
        const color = glass.waterColorID as WaterColor;
        if (!this.isDeliverableColor(color)) {
            return false;
        }
        if ((this.pendingPerColor[color] ?? 0) <= 0) {
            return false;
        }
        let slotIdx = this.findMatchedRiderSlot(color);
        if (slotIdx < 0) {
            // 兜底：若当前没有同色骑手，先补一个，避免最后一瓶卡死
            this.ensureRiderForColor(color);
            this.refreshAllSlotsView();
            slotIdx = this.findMatchedRiderSlot(color);
        }
        if (slotIdx < 0) {
            return false;
        }
        await this.playDeliverAnimation(glass, slotIdx);
        this.consumeRider(slotIdx, color);
        return true;
    }

    public isRoundCompleted(): boolean {
        return this.totalDeliverTarget > 0 && this.deliveredCount >= this.totalDeliverTarget;
    }

    public hasDeliveryTarget(): boolean {
        return this.totalDeliverTarget > 0;
    }

    /**
     * 看视频解锁下一个付费坑位（第 3/4 位）。
     */
    public async unlockNextPaidSlotByAd(): Promise<boolean> {
        const targetIdx = this.findFirstLockedPaidSlot();
        if (targetIdx < 0) {
            return false;
        }
        const sdk = TTMinis.ensureInitialized();
        return await new Promise<boolean>((resolve) => {
            sdk.showRewarded(
                () => {
                    this.unlockSlot(targetIdx);
                    resolve(true);
                },
                () => resolve(false),
            );
        });
    }

    private onUnlockButtonClick(_event: EventTouch): void {
        void this.unlockNextPaidSlotByAd();
    }

    private onUnlockNodeTouch(_event: EventTouch): void {
        void this.unlockNextPaidSlotByAd();
    }

    private unlockSlot(index: number): void {
        if (index < 0 || index >= this.unlockedSlots.length) {
            return;
        }
        if (this.unlockedSlots[index]) {
            return;
        }
        this.unlockedSlots[index] = true;
        this.riderColors[index] = this.getTotalPending() > 0 ? this.pickRandomPendingColorForSlot(index) : null;
        this.normalizeVisibleRidersByPending(index);
        this.refreshAllSlotsView();
        this.refreshProgressView();
    }

    private consumeRider(slotIdx: number, deliveredColor: WaterColor): void {
        if (slotIdx < 0 || slotIdx >= this.riderColors.length) {
            return;
        }
        this.consumeOneOrder(deliveredColor);
        this.pendingPerColor = this.buildPendingPerColorFromOrders(this.remainingOrders);
        this.deliveredCount = Math.max(0, this.totalDeliverTarget - this.remainingOrders.length);
        // 剩余只需最后 1 瓶时，不再刷新新外卖员，避免多余干扰
        const remainPending = this.getTotalPending();
        if (remainPending > 1) {
            this.riderColors[slotIdx] = this.pickRandomPendingColorForSlot(slotIdx, this.riderColors[slotIdx]);
        } else {
            this.riderColors[slotIdx] = null;
        }
        if (remainPending === 1) {
            // 最后一单必须保证场上至少有 1 个可匹配骑手，否则会出现“最后一瓶无法送走”
            this.ensureSingleRiderForLastPending(slotIdx);
        }
        this.normalizeVisibleRidersByPending(slotIdx);
        this.refreshAllSlotsView();
        this.refreshProgressView();
    }

    private ensureSingleRiderForLastPending(preferredSlot: number): void {
        const remainPending = this.getTotalPending();
        if (remainPending !== 1) {
            return;
        }
        const lastColor = this.findFirstPendingColor();
        if (lastColor === null) {
            return;
        }
        let keepIdx = -1;
        // 优先保留已存在的同色骑手，避免“最后阶段又刷出一个新骑手”的观感
        for (let i = 0; i < this.riderColors.length; i++) {
            if (!this.unlockedSlots[i]) {
                continue;
            }
            if (this.riderColors[i] === lastColor) {
                keepIdx = i;
                break;
            }
        }
        // 其次复用一个当前可见骑手槽位（改色而不是新增显隐）
        if (keepIdx < 0) {
            for (let i = 0; i < this.riderColors.length; i++) {
                if (!this.unlockedSlots[i]) {
                    continue;
                }
                if (this.riderColors[i] !== null) {
                    keepIdx = i;
                    break;
                }
            }
        }
        // 再次才回退到推荐槽位或首个已解锁槽位
        if (keepIdx < 0 && preferredSlot >= 0 && this.unlockedSlots[preferredSlot]) {
            keepIdx = preferredSlot;
        }
        if (keepIdx < 0) {
            keepIdx = this.unlockedSlots.findIndex((u) => u === true);
        }
        if (keepIdx < 0) {
            return;
        }
        for (let i = 0; i < this.riderColors.length; i++) {
            if (!this.unlockedSlots[i]) {
                this.riderColors[i] = null;
                continue;
            }
            this.riderColors[i] = i === keepIdx ? lastColor : null;
        }
    }

    private findFirstPendingColor(): WaterColor | null {
        for (const c of this.levelColorPool) {
            if ((this.pendingPerColor[c] ?? 0) > 0) {
                return c;
            }
        }
        const keys = Object.keys(this.pendingPerColor);
        for (const k of keys) {
            const color = Number(k) as WaterColor;
            if ((this.pendingPerColor[color] ?? 0) > 0) {
                return color;
            }
        }
        return null;
    }

    private ensureRiderForColor(color: WaterColor): void {
        if (!this.isDeliverableColor(color)) {
            return;
        }
        if ((this.pendingPerColor[color] ?? 0) <= 0) {
            return;
        }
        if (this.findMatchedRiderSlot(color) >= 0) {
            return;
        }

        // 优先复用一个已解锁且当前为空的槽位
        let targetIdx = -1;
        for (let i = 0; i < this.unlockedSlots.length; i++) {
            if (!this.unlockedSlots[i]) {
                continue;
            }
            if (this.riderColors[i] === null) {
                targetIdx = i;
                break;
            }
        }
        // 没有空位则覆盖第一个已解锁槽位，确保至少有一个可送骑手
        if (targetIdx < 0) {
            targetIdx = this.unlockedSlots.findIndex((u) => u === true);
        }
        if (targetIdx < 0) {
            return;
        }
        this.riderColors[targetIdx] = color;
    }

    private findMatchedRiderSlot(color: WaterColor): number {
        for (let i = 0; i < this.unlockedSlots.length; i++) {
            if (!this.unlockedSlots[i]) {
                continue;
            }
            if (this.riderColors[i] === color) {
                return i;
            }
        }
        return -1;
    }

    private findFirstLockedPaidSlot(): number {
        for (let i = DeliveryManager.FREE_SLOT_COUNT; i < this.unlockedSlots.length; i++) {
            if (!this.unlockedSlots[i]) {
                return i;
            }
        }
        return -1;
    }

    private isDeliverableColor(color: WaterColor): boolean {
        return color > WaterColor.None && color !== WaterColor.Black;
    }

    /**
     * 选一个可用于该槽位的颜色：
     * - 该色必须还有待派送单量
     * - 同色骑手并发数量不能超过该色剩余单量
     */
    private pickRandomPendingColorForSlot(slotIdx: number, exclude?: WaterColor | null): WaterColor | null {
        if (this.getTotalPending() <= 0) {
            return null;
        }
        const activePool = this.levelColorPool.filter((c) => {
            const pending = this.pendingPerColor[c] ?? 0;
            if (pending <= 0) {
                return false;
            }
            const occupied = this.countRidersWithColor(c, slotIdx);
            return occupied < pending;
        });
        if (activePool.length <= 0) {
            return null;
        }
        const candidates =
            exclude && activePool.length > 1
                ? activePool.filter((c) => c !== exclude)
                : activePool;
        if (candidates.length <= 0) {
            return activePool[0];
        }
        const idx = Math.floor(Math.random() * candidates.length);
        return candidates[idx];
    }

    private countRidersWithColor(color: WaterColor, ignoreSlot: number = -1): number {
        let n = 0;
        for (let i = 0; i < this.riderColors.length; i++) {
            if (i === ignoreSlot) {
                continue;
            }
            if (!this.unlockedSlots[i]) {
                continue;
            }
            if (this.riderColors[i] === color) {
                n += 1;
            }
        }
        return n;
    }

    private buildLevelColorPool(info: FunlandInfo | null): WaterColor[] {
        const set = new Set<WaterColor>();
        const glasses = info?.glasses ?? [];
        for (const glass of glasses) {
            const colors = glass?.colors ?? [];
            for (const c of colors) {
                const color = c as WaterColor;
                if (this.isDeliverableColor(color)) {
                    set.add(color);
                }
            }
        }
        return Array.from(set.values()).slice(0, DeliveryManager.MAX_DELIVERY_COLORS);
    }

    private buildPendingOrders(info: FunlandInfo | null): WaterColor[] {
        const colorCount: Record<number, number> = {};
        const glasses = info?.glasses ?? [];
        for (const glass of glasses) {
            const colors = glass?.colors ?? [];
            for (const c of colors) {
                const color = c as WaterColor;
                if (!this.isDeliverableColor(color)) {
                    continue;
                }
                colorCount[color] = (colorCount[color] ?? 0) + 1;
            }
        }
        const orders: WaterColor[] = [];
        Object.keys(colorCount).forEach((k) => {
            const color = Number(k) as WaterColor;
            const count = Math.max(0, Math.floor((colorCount[color] ?? 0) / 4));
            for (let i = 0; i < count; i++) {
                orders.push(color);
            }
        });
        return orders;
    }

    private buildPendingPerColorFromOrders(orders: WaterColor[]): Record<number, number> {
        const pending: Record<number, number> = {};
        for (const color of orders) {
            pending[color] = (pending[color] ?? 0) + 1;
        }
        return pending;
    }

    private sumPending(pending: Record<number, number>): number {
        let total = 0;
        Object.keys(pending).forEach((k) => {
            total += Math.max(0, pending[Number(k)] ?? 0);
        });
        return total;
    }

    private getTotalPending(): number {
        return this.remainingOrders.length;
    }

    /**
     * 将可见外卖员数量收敛到「剩余待派送数量」以内，避免最后一瓶时出现多余骑手。
     */
    private normalizeVisibleRidersByPending(preferredSlot: number = -1): void {
        const remainPending = this.getTotalPending();

        // 先清掉已无单量的颜色
        for (let i = 0; i < this.riderColors.length; i++) {
            const c = this.riderColors[i];
            if (c === null) {
                continue;
            }
            if ((this.pendingPerColor[c] ?? 0) <= 0) {
                this.riderColors[i] = null;
            }
        }

        const visibleSlots: number[] = [];
        for (let i = 0; i < this.riderColors.length; i++) {
            if (this.unlockedSlots[i] && this.riderColors[i] !== null) {
                visibleSlots.push(i);
            }
        }

        // 超额时收缩：优先保留 preferredSlot（刚刷新的那个）
        if (visibleSlots.length > remainPending) {
            for (const i of visibleSlots) {
                if (visibleSlots.length <= remainPending) {
                    break;
                }
                if (i === preferredSlot) {
                    continue;
                }
                this.riderColors[i] = null;
                visibleSlots.splice(visibleSlots.indexOf(i), 1);
            }
            // 如果还超额，再去掉 preferredSlot
            while (visibleSlots.length > remainPending) {
                const i = visibleSlots.pop();
                if (i === undefined) {
                    break;
                }
                this.riderColors[i] = null;
            }
        }
    }

    private consumeOneOrder(color: WaterColor): void {
        const idx = this.remainingOrders.findIndex((c) => c === color);
        if (idx >= 0) {
            this.remainingOrders.splice(idx, 1);
        }
    }

    private resolveRiderTintSprite(index: number): Sprite | null {
        const rider = this.getRiderNodeBySlot(index);
        if (!rider?.isValid) {
            return null;
        }
        const selfSp = rider.getComponent(Sprite);
        if (selfSp) {
            return selfSp;
        }
        // 优先找常见主图命名，避免命中 bag 的 Sprite
        const namedMain =
            rider.getChildByName("avatar") ??
            rider.getChildByName("Avatar") ??
            rider.getChildByName("role") ??
            rider.getChildByName("Role") ??
            rider.getChildByName("sprite") ??
            rider.getChildByName("Sprite");
        const namedSp = namedMain?.getComponent(Sprite) ?? null;
        if (namedSp) {
            return namedSp;
        }
        // 兜底：遍历子树但跳过 bag 节点
        const stack: Node[] = [...rider.children];
        while (stack.length > 0) {
            const n = stack.shift()!;
            const lower = (n.name || "").toLowerCase();
            if (lower === "bag" || lower === "beibao" || lower === "backpack") {
                continue;
            }
            const sp = n.getComponent(Sprite);
            if (sp) {
                return sp;
            }
            stack.push(...n.children);
        }
        return null;
    }

    private applyRiderColorVisual(index: number, color: WaterColor | null, unlocked: boolean): void {
        const tintSprite = this.resolveRiderTintSprite(index);
        const riderNode = this.getRiderNodeBySlot(index);
        const shouldShow = unlocked && color !== null && this.getTotalPending() > 0;
        if (riderNode?.isValid) {
            const opacity = riderNode.getComponent(UIOpacity) ?? riderNode.addComponent(UIOpacity);
            opacity.opacity = 255;
            riderNode.setScale(1, 1, 1);
            riderNode.active = shouldShow;
        }
        if (tintSprite?.isValid) {
            // 人物整图不做染色，避免下一关出现偏色（发蓝/发橙）
            tintSprite.color.fromHEX("#FFFFFFFF");
            tintSprite.node.active = shouldShow;
        }
        if (!riderNode?.isValid || !tintSprite?.isValid) {
            console.warn("[DeliveryManager] rider sprite missing", `slot=${index}`, `rider=${riderNode?.name ?? "null"}`);
            return;
        }
        if (!shouldShow) {
            return;
        }
        const expectColor = color;
        this.loadRiderFrameByColor(color).then((sf) => {
            if (!sf) {
                return;
            }
            if (!riderNode.isValid || !tintSprite.isValid) {
                return;
            }
            if (this.riderColors[index] !== expectColor) {
                return;
            }
            tintSprite.spriteFrame = sf;
            tintSprite.color.fromHEX("#FFFFFFFF");
        });
    }

    private getColorKey(color: WaterColor): string {
        switch (color) {
            case WaterColor.Red:
                return "red";
            case WaterColor.Orange:
                return "orange";
            case WaterColor.Yellow:
                return "yellow";
            case WaterColor.Green:
                return "green";
            case WaterColor.Blue:
                return "blue";
            case WaterColor.Purple:
                return "purple";
            case WaterColor.Cyan:
                return "cyan";
            case WaterColor.Pink:
                return "pink";
            default:
                return "purple";
        }
    }

    /**
     * 命名规范：
     * - resources/images/delivery/rider_<color>.png
     * - Cocos SpriteFrame 子资源路径通常为 images/delivery/rider_<color>/spriteFrame
     */
    private async loadRiderFrameByColor(color: WaterColor): Promise<SpriteFrame | null> {
        const key = this.getColorKey(color);
        if (Object.prototype.hasOwnProperty.call(this.riderFrameCache, key)) {
            return this.riderFrameCache[key];
        }
        const paths = [
            `images/delivery/rider_${key}/spriteFrame`,
            `images/delivery/rider_${key}`,
        ];
        for (const path of paths) {
            const sf = await new Promise<SpriteFrame | null>((resolve) => {
                resources.load(path, SpriteFrame, (err, asset) => {
                    if (err || !asset) {
                        resolve(null);
                        return;
                    }
                    resolve(asset);
                });
            });
            if (sf) {
                this.riderFrameCache[key] = sf;
                return sf;
            }
        }
        console.warn("[DeliveryManager] rider frame load failed", `key=${key}`, "expect resources/images/delivery/rider_<color>.png");
        this.riderFrameCache[key] = null;
        return null;
    }

    private refreshAllSlotsView(): void {
        // 渲染前统一按订单剩余做裁剪，防止末段出现多余骑手
        this.normalizeVisibleRidersByPending(-1);
        if (this.getTotalPending() <= 0) {
            for (let i = 0; i < this.riderColors.length; i++) {
                this.riderColors[i] = null;
            }
        }
        for (let i = 0; i < this.unlockedSlots.length; i++) {
            this.refreshSlotView(i);
        }
    }

    private refreshSlotView(index: number): void {
        const unlocked = this.unlockedSlots[index] === true;
        const riderNode = this.getRiderNodeBySlot(index);
        const lockMask = this.getLockMaskBySlot(index);
        const slotNode = this.slotNodes[index];

        if (slotNode?.isValid) {
            slotNode.active = true;
        }
        if (lockMask?.isValid) {
            lockMask.active = !unlocked;
            const btn = lockMask.getComponent(Button);
            if (btn) {
                btn.interactable = !unlocked;
            }
        }
        if (riderNode?.isValid) {
            riderNode.active = unlocked && this.riderColors[index] !== null && this.getTotalPending() > 0;
        }
        const color = this.riderColors[index];
        this.applyRiderColorVisual(index, color, unlocked);
    }

    private refreshProgressView(): void {
        const pending = this.getTotalPending();
        if (this.pendingLabel?.isValid) {
            this.pendingLabel.string = `待派送：${pending}`;
        }
        if (this.progressLabel?.isValid) {
            this.progressLabel.string = `${this.deliveredCount}/${this.totalDeliverTarget}`;
        }
    }

    private getLockMaskBySlot(slotIndex: number): Node | null {
        const slot = this.slotNodes[slotIndex];
        if (slot?.isValid) {
            const adNode =
                slot.getChildByName("ad") ??
                slot.getChildByName("Ad") ??
                slot.getChildByName("guanggao");
            if (adNode?.isValid) {
                return adNode;
            }
        }
        if (this.isFreeSlot(slotIndex)) {
            return this.lockMasks[slotIndex] ?? null;
        }
        const paidIdx = this.getPaidSlotOrder(slotIndex);
        const direct = this.lockMasks[paidIdx] ?? this.lockMasks[slotIndex] ?? null;
        if (direct?.isValid) {
            return direct;
        }
        return null;
    }

    private getRiderNodeBySlot(slotIndex: number): Node | null {
        const slot = this.slotNodes[slotIndex];
        if (slot?.isValid) {
            const rider =
                slot.getChildByName("rider") ??
                slot.getChildByName("Rider") ??
                slot.getChildByName("role") ??
                slot.getChildByName("Role");
            if (rider?.isValid) {
                return rider;
            }
        }
        return this.riderNodes[slotIndex] ?? null;
    }

    private resolveRiderBagTargetNode(slotIdx: number): Node | null {
        const rider = this.getRiderNodeBySlot(slotIdx);
        const slot = this.slotNodes[slotIdx];
        if (!rider?.isValid) {
            return null;
        }
        const candidateNames = ["bag", "Bag", "beibao", "backpack", "背包"];
        if (slot?.isValid) {
            for (const n of candidateNames) {
                const hit = slot.getChildByName(n);
                if (hit?.isValid) {
                    return hit;
                }
            }
        }
        for (const n of candidateNames) {
            const hit = rider.getChildByName(n);
            if (hit?.isValid) {
                return hit;
            }
        }
        return rider;
    }

    private async playDeliverAnimation(glass: Glass, slotIdx: number): Promise<void> {
        const rider = this.getRiderNodeBySlot(slotIdx);
        const bagTarget = this.resolveRiderBagTargetNode(slotIdx);
        if (!rider?.isValid || !bagTarget?.isValid || !glass.node?.isValid) {
            return;
        }

        const glassNode = glass.node;
        const startPos = glassNode.worldPosition.clone();
        const startScale = glassNode.scale.clone();
        const targetPos = bagTarget.worldPosition.clone().add3f(0, -20, 0);
        const flyScale = new Vec3(startScale.x * 0.38, startScale.y * 0.38, startScale.z);

        Tween.stopAllByTarget(glassNode);
        await new Promise<void>((resolve) => {
            tween(glassNode)
                .to(DeliveryManager.GLASS_FLY_DURATION, {
                    worldPosition: targetPos,
                    scale: flyScale,
                })
                .call(() => resolve())
                .start();
        });

        glass.reset([]);
        glass.hide();
        glassNode.setWorldPosition(startPos);
        glassNode.setScale(startScale);

        const riderStartPos = rider.position.clone();
        const opacity = rider.getComponent(UIOpacity) ?? rider.addComponent(UIOpacity);
        opacity.opacity = 255;

        Tween.stopAllByTarget(rider);
        Tween.stopAllByTarget(opacity);
        await new Promise<void>((resolve) => {
            tween(rider)
                .to(DeliveryManager.RIDER_OUT_DURATION, {
                    position: riderStartPos.clone().add3f(0, 80, 0),
                    scale: new Vec3(0.9, 0.9, 1),
                })
                .call(() => resolve())
                .start();
            tween(opacity).to(DeliveryManager.RIDER_OUT_DURATION, { opacity: 0 }).start();
        });

        rider.setPosition(riderStartPos);
        rider.setScale(1, 1, 1);
        opacity.opacity = 255;
    }

    private bindAutoUnlockButtons(): void {
        this.autoBoundUnlockButtons = [];
        this.autoBoundUnlockNodes = [];
        for (let i = 0; i < this.slotNodes.length; i++) {
            if (this.isFreeSlot(i)) {
                continue;
            }
            const slot = this.slotNodes[i];
            if (!slot?.isValid) {
                continue;
            }
            const adNode =
                slot.getChildByName("ad") ??
                slot.getChildByName("Ad") ??
                slot.getChildByName("guanggao");
            const btn = adNode?.getComponent(Button) ?? null;
            if (!btn?.node?.isValid) {
                continue;
            }
            // 已在手动配置里绑定过的按钮不重复绑定
            if (this.unlockButtons.indexOf(btn) >= 0) {
                continue;
            }
            if (btn?.node?.isValid) {
                btn.node.on(Button.EventType.CLICK, this.onUnlockButtonClick, this);
                this.autoBoundUnlockButtons.push(btn);
                continue;
            }
            if (adNode?.isValid) {
                adNode.on(Node.EventType.TOUCH_END, this.onUnlockNodeTouch, this);
                this.autoBoundUnlockNodes.push(adNode);
            }
        }
    }

    private findFirstFreeSlotColor(): WaterColor | null {
        for (let i = 0; i < this.riderColors.length; i++) {
            if (!this.isFreeSlot(i)) {
                continue;
            }
            const c = this.riderColors[i];
            if (c !== null) {
                return c;
            }
        }
        return null;
    }

    private debugPrintRoundState(): void {
        const slots: string[] = [];
        for (let i = 0; i < this.slotNodes.length; i++) {
            const name = this.slotNodes[i]?.name ?? `slot_${i}`;
            slots.push(
                `${name}(unlocked=${this.unlockedSlots[i] === true},color=${this.riderColors[i] ?? "null"})`,
            );
        }
        console.log(
            "[DeliveryManager] reset",
            `pool=${this.levelColorPool.join(",") || "empty"}`,
            `pending=${JSON.stringify(this.pendingPerColor)}`,
            slots.join(" | "),
        );
    }

    private isFreeSlot(index: number): boolean {
        const slot = this.slotNodes[index];
        const name = slot?.name ?? "";
        const match = name.match(/(\d+)/);
        if (match) {
            const no = Number(match[1]);
            if (Number.isFinite(no) && no > 0) {
                return no <= DeliveryManager.FREE_SLOT_COUNT;
            }
        }
        return index < DeliveryManager.FREE_SLOT_COUNT;
    }

    private getPaidSlotOrder(index: number): number {
        const slot = this.slotNodes[index];
        const name = slot?.name ?? "";
        const match = name.match(/(\d+)/);
        if (match) {
            const no = Number(match[1]);
            if (Number.isFinite(no) && no > DeliveryManager.FREE_SLOT_COUNT) {
                return no - DeliveryManager.FREE_SLOT_COUNT - 1;
            }
        }
        return Math.max(0, index - DeliveryManager.FREE_SLOT_COUNT);
    }
}

