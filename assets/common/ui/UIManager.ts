import {_decorator, Component, director, Node} from 'cc';

const {ccclass} = _decorator;

/**
 * UI 打开/关闭时传递的上下文
 * - id: UI 唯一标识
 * - payload: 业务侧透传参数
 */
export interface UIContext<T = unknown> {
    id: string;
    payload?: T;
}

/**
 * UI 处理器接口
 * 由具体业务（如 VwUi）注册 open/close 行为
 */
export interface UIHandler<T = unknown> {
    open: (ctx?: UIContext<T>) => void;
    close?: (ctx?: UIContext<T>) => void;
}

/**
 * 打开 UI 的可选参数
 * pushToStack=false 时，不进入返回栈（例如一次性提示）
 */
export interface UIOpenOptions {
    pushToStack?: boolean;
}

@ccclass('UIManager')
export class UIManager extends Component {
    private static _instance: UIManager | null = null;

    /** 已注册的 UI 行为表（id -> handler） */
    private readonly handlers: Map<string, UIHandler> = new Map();
    /** 简单页面栈，用于 closeTop 等场景 */
    private readonly stack: string[] = [];

    /**
     * 由 GameBootstrap 在常驻根下创建后绑定；未走启动流程时仍可懒创建独立常驻节点。
     */
    public static bindInstance(inst: UIManager): void {
        this._instance = inst;
    }

    /**
     * 全局单例
     * 挂到常驻节点，保证切场景后依旧可用
     */
    public static get instance(): UIManager {
        if (!this._instance || !this._instance.isValid) {
            const root = new Node('UIManager');
            this._instance = root.addComponent(UIManager);
            director.addPersistRootNode(root);
        }
        return this._instance;
    }

    protected onDestroy(): void {
        if (UIManager._instance === this) {
            UIManager._instance = null;
        }
    }

    /** 注册 UI 的打开/关闭行为 */
    public register(id: string, handler: UIHandler): void {
        this.handlers.set(id, handler);
    }

    /** 注销 UI，并从栈中移除同名记录 */
    public unregister(id: string): void {
        this.handlers.delete(id);
        const stackIndex = this.stack.lastIndexOf(id);
        if (stackIndex >= 0) {
            this.stack.splice(stackIndex, 1);
        }
    }

    /** 打开 UI，默认会压入栈顶 */
    public open<T = unknown>(id: string, payload?: T, options?: UIOpenOptions): boolean {
        const handler = this.handlers.get(id);
        if (!handler) {
            return false;
        }

        const pushToStack = options?.pushToStack !== false;
        if (pushToStack) {
            this.stack.push(id);
        }

        handler.open({id, payload});
        return true;
    }

    /** 关闭指定 UI，并同步清理栈记录 */
    public close<T = unknown>(id: string, payload?: T): boolean {
        const handler = this.handlers.get(id);
        if (!handler) {
            return false;
        }
        if (handler.close) {
            handler.close({id, payload});
        }

        const stackIndex = this.stack.lastIndexOf(id);
        if (stackIndex >= 0) {
            this.stack.splice(stackIndex, 1);
        }
        return true;
    }

    /** 关闭当前栈顶 UI */
    public closeTop<T = unknown>(payload?: T): boolean {
        const id = this.stack[this.stack.length - 1];
        if (!id) {
            return false;
        }
        return this.close(id, payload);
    }

    /** 查询是否已注册 */
    public has(id: string): boolean {
        return this.handlers.has(id);
    }
}
