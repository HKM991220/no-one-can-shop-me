import { _decorator, Component, Label, Node, Tween, tween, Vec3 } from "cc";
import { GlobalPlayerData } from "../common/GlobalPlayerData";
import EventMng from "../common/EventMng";
import { I18n } from "../common/i18n/I18n";
import Glass from "./Glass";
import { VwFunland } from "./VwFunland";
import { EventName } from "../common/Enum";

const { ccclass, menu, property } = _decorator;

enum TutorialStep {
    SelectSource = 0,
    SelectTarget = 1,
    FreePour = 2,
    Finish = 3,
    Done = 4,
}

@ccclass("TutorialGuide")
@menu("cwg/TutorialGuide")
export default class TutorialGuide extends Component {
    @property(Node)
    protected root: Node | null = null;

    @property(Node)
    protected highlightNode: Node | null = null;

    @property(Node)
    protected fingerNode: Node | null = null;

    @property(Node)
    protected tipNode: Node | null = null;

    @property(Label)
    protected tipLabel: Label | null = null;

    @property(VwFunland)
    protected funlandView: VwFunland | null = null;

    @property({ tooltip: "首个引导瓶子索引（基于当前关卡 glasses 顺序）" })
    protected sourceGlassIndex = 0;

    @property({ tooltip: "第二步目标瓶子索引（基于当前关卡 glasses 顺序）" })
    protected targetGlassIndex = 1;

    @property({ tooltip: "调试：忽略关卡判断，强制开启引导" })
    protected forceEnableGuide = false;

    private step: TutorialStep = TutorialStep.Done;
    private sourceGlass: Glass | null = null;
    private targetGlass: Glass | null = null;
    private retryCount = 0;

    protected onLoad(): void {
        this.autoBindNodes();
    }

    protected onEnable(): void {
        EventMng.on("tutorial:selectGlass", this.onSelectGlass, this);
        EventMng.on("tutorial:pour", this.onPour, this);
        EventMng.on("completePour", this.onCompletePour, this);
        EventMng.on("levelPassed", this.onLevelPassed, this);
        I18n.instance.on(I18n.EVENT_LANGUAGE_CHANGED, this.onI18nLanguageChanged, this);
    }

    protected onDisable(): void {
        EventMng.offTarget(this);
        I18n.instance.off(I18n.EVENT_LANGUAGE_CHANGED, this.onI18nLanguageChanged, this);
    }

    private onI18nLanguageChanged(): void {
        if (!this.root?.activeInHierarchy || this.step === TutorialStep.Done) {
            return;
        }
        this.applyStepView();
    }

    public beginIfNeeded(): void {
        GlobalPlayerData.instance.load();
        this.autoBindNodes();
        console.log(
            "[TutorialGuide] begin",
            `level=${GlobalPlayerData.instance.level}`,
            `force=${this.forceEnableGuide}`,
            `root=${this.root?.name ?? "null"}`,
            `funland=${this.funlandView?.node?.name ?? "null"}`,
        );
        if (!this.funlandView) {
            console.warn("[TutorialGuide] funlandView 未绑定，引导无法启动");
            this.hideGuide();
            return;
        }
        const isFirstLevel = this.forceEnableGuide || GlobalPlayerData.instance.level === 0;
        if (!isFirstLevel) {
            console.log("[TutorialGuide] skip: 非首关");
            this.hideGuide();
            return;
        }
        this.resolveGuideGlasses();
        if (!this.sourceGlass || !this.targetGlass) {
            if (this.retryCount < 6) {
                this.retryCount += 1;
                this.scheduleOnce(() => this.beginIfNeeded(), 0);
                return;
            }
            console.warn(
                "[TutorialGuide] 瓶子索引无效",
                `sourceIndex=${this.sourceGlassIndex}`,
                `targetIndex=${this.targetGlassIndex}`,
                `glassCount=${this.funlandView?.glasses?.length ?? 0}`,
            );
            this.hideGuide();
            return;
        }
        this.retryCount = 0;
        this.step = TutorialStep.SelectSource;
        this.showGuide();
        this.applyStepView();
    }

    public bindFunlandView(view: VwFunland | null): void {
        this.funlandView = view;
    }

    /**
     * 自动选择一组教学用瓶子：
     * - 源瓶：有水、未密封、非全隐藏
     * - 目标瓶：不是源瓶、未满，且为空或与源瓶顶层同色
     */
    private resolveGuideGlasses(): void {
        const glasses = this.funlandView?.glasses ?? [];
        this.sourceGlass = null;
        this.targetGlass = null;
        if (glasses.length <= 1) {
            return;
        }

        const validSources = glasses.filter((glass) => !glass.isEmpty && !glass.isSealed() && !glass.isAllHide());
        for (const source of validSources) {
            const target = glasses.find((candidate) => {
                if (candidate === source) {
                    return false;
                }
                if (candidate.isFull) {
                    return false;
                }
                return candidate.isEmpty || candidate.waterColorID === source.waterColorID;
            });
            if (target) {
                this.sourceGlass = source;
                this.targetGlass = target;
                return;
            }
        }

        // 自动匹配失败时，退回为配置索引（便于手工指定）
        this.sourceGlass = glasses[this.sourceGlassIndex] ?? null;
        this.targetGlass = glasses[this.targetGlassIndex] ?? null;
    }

    private autoBindNodes(): void {
        if (!this.root) {
            this.root = this.node;
        }
        if (!this.root) {
            return;
        }
        if (this.root === this.node) {
            const guideRoot = this.root.getChildByName("TutorialGuide");
            if (guideRoot) {
                this.root = guideRoot;
            }
        }

        if (!this.funlandView) {
            this.funlandView =
                this.node.getComponent(VwFunland) ??
                this.node.getComponentInChildren(VwFunland) ??
                this.node.parent?.getComponentInChildren(VwFunland) ??
                null;
        }
    }

    private onSelectGlass(glass: Glass): void {
        console.log("[TutorialGuide] select", `step=${this.step}`, `glass=${glass?.node?.name ?? "null"}`);
        if (this.step === TutorialStep.SelectSource && glass === this.sourceGlass) {
            this.step = TutorialStep.SelectTarget;
            this.applyStepView();
        }
    }

    private onPour(payload: { source: Glass; target: Glass }): void {
        console.log("[TutorialGuide] pour", `step=${this.step}`);
        if (this.step !== TutorialStep.SelectTarget) {
            return;
        }
        if (payload?.source === this.sourceGlass && payload?.target === this.targetGlass) {
            this.step = TutorialStep.FreePour;
            this.applyStepView();
        }
    }

    private onCompletePour(): void {
        console.log("[TutorialGuide] completePour", `step=${this.step}`);
        if (this.step === TutorialStep.FreePour) {
            this.step = TutorialStep.Finish;
            this.applyStepView();
        }
    }

    private onLevelPassed(): void {
        if (GlobalPlayerData.instance.level !== 0) {
            return;
        }
        GlobalPlayerData.instance.setSetting("tutorial_done", true);
        GlobalPlayerData.instance.setLevel(1);
        this.step = TutorialStep.Done;
        this.hideGuide();
        GlobalPlayerData.instance.addCoins(10);
        EventMng.emit(EventName.PLAYER_RESOURCE_CHANGED);
    }

    private applyStepView(): void {
        if (!this.root?.isValid) {
            console.warn("[TutorialGuide] root 无效，无法显示引导");
            return;
        }
        console.log("[TutorialGuide] applyStep", this.step);
        if (this.step === TutorialStep.SelectSource) {
            this.setTipByKey("tutorial.step1");
            this.followTarget(this.sourceGlass);
            this.followHighlight(this.targetGlass);
            this.funlandView?.setSelectValidator((glass) => glass === this.sourceGlass);
            return;
        }
        if (this.step === TutorialStep.SelectTarget) {
            this.setTipByKey("tutorial.step2");
            this.followTarget(this.targetGlass);
            this.followHighlight(this.targetGlass);
            this.funlandView?.setSelectValidator((glass) => glass === this.targetGlass);
            return;
        }
        if (this.step === TutorialStep.FreePour) {
            this.setTipByKey("tutorial.step3");
            this.hideFinger();
            this.hideHighlight();
            this.funlandView?.setSelectValidator(null);
            return;
        }
        if (this.step === TutorialStep.Finish) {
            this.setTipByKey("tutorial.step4");
            this.hideFinger();
            this.hideHighlight();
            this.funlandView?.setSelectValidator(null);
            return;
        }
        this.hideGuide();
    }

    private setTip(text: string): void {
        if (this.tipLabel?.isValid) {
            this.tipLabel.string = text;
        }
    }

    private setTipByKey(key: string): void {
        this.setTip(I18n.instance.t(key));
    }

    private followTarget(glass: Glass | null): void {
        if (!this.fingerNode?.isValid || !glass?.node?.isValid) {
            return;
        }
        this.fingerNode.active = true;
        const targetPos = glass.node.worldPosition.clone().add(new Vec3(60, 100, 0));
        this.fingerNode.setWorldPosition(targetPos);
        this.playFingerIdleAnim();
    }

    private followHighlight(glass: Glass | null): void {
        if (!this.highlightNode?.isValid || !glass?.node?.isValid) {
            return;
        }
        this.highlightNode.active = true;
        const targetPos = glass.node.worldPosition.clone().add(new Vec3(0, -40, 0));
        this.highlightNode.setWorldPosition(targetPos);
    }

    private playFingerIdleAnim(): void {
        if (!this.fingerNode?.isValid) {
            return;
        }
        Tween.stopAllByTarget(this.fingerNode);
        tween(this.fingerNode)
            .to(0.35, { scale: new Vec3(0.92, 0.92, 1) })
            .to(0.35, { scale: new Vec3(1, 1, 1) })
            .union()
            .repeatForever()
            .start();
    }

    private hideFinger(): void {
        if (!this.fingerNode?.isValid) {
            return;
        }
        Tween.stopAllByTarget(this.fingerNode);
        this.fingerNode.active = false;
        this.fingerNode.setScale(1, 1, 1);
    }

    private hideHighlight(): void {
        if (!this.highlightNode?.isValid) {
            return;
        }
        this.highlightNode.active = false;
    }


    private showGuide(): void {
        if (this.root?.isValid) {
            this.root.active = true;
        }
    }

    private hideGuide(): void {
        this.funlandView?.setSelectValidator(null);
        this.hideFinger();
        this.hideHighlight();
        if (this.root?.isValid) {
            this.root.active = false;
        }
    }
}
