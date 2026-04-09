import { _decorator, Component, Node } from "cc";
import { SimpleUIManager } from "./SimpleUIManager";

const { ccclass } = _decorator;

/**
 * 简化版UI基类
 * 子类只需关注业务逻辑，无需处理生命周期
 */
@ccclass("SimpleUIBase")
export class SimpleUIBase extends Component {
	/** UI打开时传入的数据 */
	protected uiData: any = null;

	/**
	 * UI打开回调（子类覆盖）
	 * @param data 打开时传入的数据
	 */
	protected onUIOpen(data?: any): void {
		this.uiData = data;
		// 子类可覆盖此方法处理打开逻辑
	}

	/**
	 * UI关闭回调（子类覆盖）
	 * @param data 关闭时传入的数据
	 */
	protected offButtonListeners(data?: any): void {
		// 子类可覆盖此方法处理关闭逻辑
	}

	/**
	 * 关闭当前UI
	 */
	protected closeSelf(data?: any): void {
		// 获取当前UI的ID（通过节点名或配置）
		// 这里简化处理，子类可覆盖指定具体ID
		const id = this.getUIId();
		if (id) {
			SimpleUIManager.instance.close(id, data);
		}
	}

	/**
	 * 打开其他UI
	 */
	protected openUI(id: string, data?: any): void {
		SimpleUIManager.instance.open(id, data);
	}

	/**
	 * 获取当前UI的ID（子类可覆盖）
	 */
	protected getUIId(): string {
		// 默认返回节点名作为ID
		return this.node.name;
	}
}
