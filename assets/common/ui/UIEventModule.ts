import EventMng from '../EventMng';

export type UIEventHandler = (...args: unknown[]) => void;

/** 记录监听项，便于统一卸载 */
interface UIEventRecord {
    type: string;
    handler: UIEventHandler;
    target: object;
}

/**
 * UI 事件模块
 * - 封装项目公共事件中心 EventMng
 * - 提供 UI 生命周期友好的监听清理能力
 */
export class UIEventModule {
    private readonly listeners: UIEventRecord[] = [];

    /** 绑定常驻监听，并记录到本地列表 */
    public on(type: string, handler: UIEventHandler, target: object): void {
        EventMng.on(type, handler, target);
        this.listeners.push({type, handler, target});
    }

    /** 绑定一次性监听（触发后由 EventTarget 自动移除） */
    public once(type: string, handler: UIEventHandler, target: object): void {
        EventMng.once(type, handler, target);
    }

    /** 主动移除某一条监听 */
    public off(type: string, handler: UIEventHandler, target: object): void {
        EventMng.off(type, handler, target);
        const idx = this.listeners.findIndex((v) => v.type === type && v.handler === handler && v.target === target);
        if (idx >= 0) {
            this.listeners.splice(idx, 1);
        }
    }

    /** 派发事件，最多透传 4 个参数（与现有 EventMng 保持一致） */
    public emit(type: string, ...args: unknown[]): void {
        EventMng.emit(type, args[0], args[1], args[2], args[3]);
    }

    /**
     * 清理监听
     * - 传 target：仅清理该目标对象上的监听
     * - 不传 target：清理模块内全部监听
     */
    public clear(target?: object): void {
        if (target) {
            EventMng.offTarget(target);
            for (let i = this.listeners.length - 1; i >= 0; i--) {
                if (this.listeners[i].target === target) {
                    this.listeners.splice(i, 1);
                }
            }
            return;
        }

        for (const item of this.listeners) {
            EventMng.off(item.type, item.handler, item.target);
        }
        this.listeners.length = 0;
    }
}
