import { _decorator, Component, director, instantiate, isValid, Node, Prefab } from "cc";
import { GameBootstrap } from "../GameBootstrap";

const { ccclass } = _decorator;

/** 兼容 UIBase / SimpleUIBase 等：在根节点组件上查找并调用一次生命周期方法（避免错用 ccclass 名 getComponent("UIBase")）。 */
function invokePanelLifecycle(node: Node, method: "onUIOpen" | "onUIClose", data?: unknown): void {
	for (const comp of node.components) {
		const fn = (comp as any)[method];
		if (typeof fn === "function") {
			fn.call(comp, data);
			return;
		}
	}
}

/**
 * UI配置接口
 */
export interface UIConfig {
	/** 唯一标识 */
	id: string;
	/** bundle名称 */
	bundle: string;
	/** 预制体路径 */
	path: string;
	/** 父节点（可选，默认使用root） */
	parent?: Node;
	/** 是否缓存（默认true） */
	cache?: boolean;
	/** 层级（默认0，越大越在上层） */
	layer?: number;
}

/**
 * UI实例信息
 */
interface UIInstance {
	/** 配置 */
	config: UIConfig;
	/** 节点 */
	node: Node | null;
	/** 是否已加载 */
	loaded: boolean;
	/** 加载Promise */
	loadPromise: Promise<Node> | null;
}

/**
 * 简化版UI管理器
 * 功能：注册、实例化、显示、隐藏、回收
 * 使用：SimpleUIManager.open(id) / SimpleUIManager.close(id)
 */
@ccclass("SimpleUIManager")
export class SimpleUIManager extends Component {
	private static _instance: SimpleUIManager | null = null;
	/** 常驻根节点固定名：热重载后静态 _instance 会丢，靠名字在场景里找回唯一实例，避免重复 addPersistRootNode */
	private static readonly SINGLETON_NODE_NAME = "__SimpleUIManagerRoot__";

	/** UI配置表 */
	private uiConfigs: Map<string, UIConfig> = new Map();
	/** UI实例表 */
	private uiInstances: Map<string, UIInstance> = new Map();
	/** UI栈（用于返回） */
	private uiStack: string[] = [];
	/** 默认父节点 */
	private defaultParent: Node | null = null;
	/** 层级节点映射 */
	private layerParents: Map<number, Node> = new Map();

	public static get instance(): SimpleUIManager {
		if (this._instance?.isValid) {
			return this._instance;
		}
		const resurrected = this.findExistingSingleton();
		if (resurrected) {
			this._instance = resurrected;
			return this._instance;
		}
		const root = new Node(SimpleUIManager.SINGLETON_NODE_NAME);
		const comp = root.addComponent(SimpleUIManager);
		this._instance = comp;
		director.addPersistRootNode(root);
		return this._instance;
	}

	/** 脚本热重载 / 静态丢失后，复用场景里已有的 SimpleUIManager，避免叠一堆常驻节点 */
	private static findExistingSingleton(): SimpleUIManager | null {
		const scene = director.getScene();
		if (!scene?.isValid) {
			return null;
		}
		const found: SimpleUIManager[] = [];
		const visit = (n: Node): void => {
			const c = n.getComponent(SimpleUIManager);
			if (c?.isValid) {
				found.push(c);
			}
			for (const ch of n.children) {
				visit(ch);
			}
		};
		visit(scene);
		if (found.length === 0) {
			return null;
		}
		const byName = found.find((c) => c.node.name === SimpleUIManager.SINGLETON_NODE_NAME);
		if (byName) {
			return byName;
		}
		return found[0];
	}

	/**
	 * 初始化（设置默认父节点）
	 */
	public init(defaultParent: Node): void {
		this.defaultParent = defaultParent;
		// 创建层级节点
		for (let i = 0; i <= 10; i++) {
			const layerNode = new Node(`Layer_${i}`);
			layerNode.parent = defaultParent;
			this.layerParents.set(i, layerNode);
		}
	}

	/**
	 * 注册UI配置
	 */
	public register(config: UIConfig): void {
		if (this.uiConfigs.has(config.id)) {
			console.warn(`[SimpleUIManager] UI ${config.id} 已注册，将被覆盖`);
		}
		this.uiConfigs.set(config.id, config);
		// 初始化实例信息
		this.uiInstances.set(config.id, {
			config,
			node: null,
			loaded: false,
			loadPromise: null,
		});
	}

	/**
	 * 批量注册
	 */
	public registerBatch(configs: UIConfig[]): void {
		configs.forEach((cfg) => this.register(cfg));
	}

	/**
	 * 注销UI
	 */
	public unregister(id: string): void {
		const instance = this.uiInstances.get(id);
		if (instance?.node?.isValid) {
			instance.node.destroy();
		}
		this.uiInstances.delete(id);
		this.uiConfigs.delete(id);
		// 从栈中移除
		const stackIndex = this.uiStack.indexOf(id);
		if (stackIndex >= 0) {
			this.uiStack.splice(stackIndex, 1);
		}
	}

	/**
	 * 打开UI（自动处理加载、实例化、显示）
	 * @param id UI标识
	 * @param data 传递数据（可在UIBase中获取）
	 * @param options 可选参数
	 */
	public async open(
		id: string,
		data?: any,
		options?: {
			/** 是否加入栈（默认true） */
			pushToStack?: boolean;
			/** 强制重新加载（默认false） */
			forceReload?: boolean;
		}
	): Promise<boolean> {
		const config = this.uiConfigs.get(id);
		if (!config) {
			console.error(`[SimpleUIManager] UI ${id} 未注册`);
			return false;
		}

		const pushToStack = options?.pushToStack !== false;

		// 获取或创建实例
		let instance = this.uiInstances.get(id);
		if (!instance) {
			instance = {
				config,
				node: null,
				loaded: false,
				loadPromise: null,
			};
			this.uiInstances.set(id, instance);
		}

		// 如果正在加载，等待加载完成
		if (instance.loadPromise) {
			await instance.loadPromise;
		}

		// 如果需要重新加载，先销毁旧的
		if (options?.forceReload && instance.node?.isValid) {
			instance.node.destroy();
			instance.node = null;
			instance.loaded = false;
		}

		// 加载并实例化
		if (!instance.loaded || !instance.node?.isValid) {
			try {
				instance.loadPromise = this.loadAndInstantiate(config);
				instance.node = await instance.loadPromise;
				instance.loaded = true;
				instance.loadPromise = null;
			} catch (err) {
				console.error(`[SimpleUIManager] 加载UI ${id} 失败`, err);
				instance.loadPromise = null;
				return false;
			}
		}

		// 显示UI
		if (instance.node?.isValid) {
			instance.node.active = true;
			// 设置层级
			const layer = config.layer || 0;
			const layerParent = this.layerParents.get(layer) || this.defaultParent;
			if (layerParent && instance.node.parent !== layerParent) {
				instance.node.parent = layerParent;
			}
			// 置顶
			this.bringToTop(instance.node);

			invokePanelLifecycle(instance.node, "onUIOpen", data);

			// 加入栈
			if (pushToStack) {
				// 如果已在栈中，先移除
				const existingIndex = this.uiStack.indexOf(id);
				if (existingIndex >= 0) {
					this.uiStack.splice(existingIndex, 1);
				}
				this.uiStack.push(id);
			}

			return true;
		}

		return false;
	}

	/**
	 * 关闭UI
	 * @param id UI标识
	 * @param data 传递数据（可在UIBase中获取）
	 */
	public close(id: string, data?: any): boolean {
		const instance = this.uiInstances.get(id);
		if (!instance?.node?.isValid) {
			return false;
		}

		invokePanelLifecycle(instance.node, "onUIClose", data);

		// 隐藏或销毁
		const config = instance.config;
		const cache = config.cache !== false;
		if (cache) {
			// 缓存模式：只隐藏
			instance.node.active = false;
		} else {
			// 非缓存模式：销毁
			instance.node.destroy();
			instance.node = null;
			instance.loaded = false;
		}

		// 从栈中移除
		const stackIndex = this.uiStack.indexOf(id);
		if (stackIndex >= 0) {
			this.uiStack.splice(stackIndex, 1);
		}

		return true;
	}

	/**
	 * 关闭栈顶UI
	 */
	public closeTop(data?: any): boolean {
		const id = this.uiStack[this.uiStack.length - 1];
		if (!id) {
			return false;
		}
		return this.close(id, data);
	}

	/**
	 * 关闭所有UI
	 */
	public closeAll(data?: any): void {
		// 从栈顶开始关闭
		while (this.uiStack.length > 0) {
			this.closeTop(data);
		}
	}

	/**
	 * 获取UI节点
	 */
	public getNode(id: string): Node | null {
		return this.uiInstances.get(id)?.node || null;
	}

	/**
	 * 检查UI是否已打开
	 */
	public isOpen(id: string): boolean {
		const instance = this.uiInstances.get(id);
		return instance?.node?.active === true;
	}

	/**
	 * 检查UI是否已注册
	 */
	public has(id: string): boolean {
		return this.uiConfigs.has(id);
	}

	/**
	 * 获取当前UI栈
	 */
	public getStack(): string[] {
		return [...this.uiStack];
	}

	/**
	 * 预加载UI（不显示）
	 */
	public async preload(id: string): Promise<boolean> {
		const config = this.uiConfigs.get(id);
		if (!config) {
			console.error(`[SimpleUIManager] UI ${id} 未注册`);
			return false;
		}

		const instance = this.uiInstances.get(id);
		if (!instance) {
			return false;
		}

		if (instance.loaded && instance.node?.isValid) {
			return true;
		}

		if (instance.loadPromise) {
			await instance.loadPromise;
			return true;
		}

		try {
			instance.loadPromise = this.loadAndInstantiate(config);
			instance.node = await instance.loadPromise;
			instance.loaded = true;
			instance.loadPromise = null;
			instance.node.active = false;
			return true;
		} catch (err) {
			console.error(`[SimpleUIManager] 预加载UI ${id} 失败`, err);
			instance.loadPromise = null;
			return false;
		}
	}

	/**
	 * 销毁所有UI（清理缓存）
	 */
	public destroyAll(): void {
		this.uiInstances.forEach((instance, id) => {
			if (instance.node?.isValid) {
				instance.node.destroy();
			}
			instance.node = null;
			instance.loaded = false;
		});
		this.uiStack = [];
	}

	/**
	 * 加载并实例化预制体
	 */
	private async loadAndInstantiate(config: UIConfig): Promise<Node> {
		const boot = GameBootstrap.root;
		if (!boot) {
			throw new Error("GameBootstrap 未就绪");
		}

		// 加载预制体
		const prefab = await boot.res.load(config.bundle, config.path, Prefab);
		if (!prefab || !isValid(prefab)) {
			throw new Error(`预制体加载失败: ${config.bundle}/${config.path}`);
		}

		// 实例化
		const node = instantiate(prefab);
		if (!node) {
			throw new Error("预制体实例化失败");
		}

		// 设置父节点
		const parent = config.parent || this.defaultParent;
		if (parent) {
			node.parent = parent;
		}

		node.active = false;
		return node;
	}

	/**
	 * 将节点置顶
	 */
	private bringToTop(node: Node): void {
		const parent = node.parent;
		if (parent?.isValid && parent.children.length > 0) {
			node.setSiblingIndex(parent.children.length - 1);
		}
	}

	protected onDestroy(): void {
		if (SimpleUIManager._instance === this) {
			SimpleUIManager._instance = null;
		}
	}
}

/** 勿在模块顶层调用 `SimpleUIManager.instance`，否则每次脚本重载都会多造一个常驻节点；请在使用处再取 instance。 */
