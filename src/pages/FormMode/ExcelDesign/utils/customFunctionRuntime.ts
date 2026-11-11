/**
 * 自定义函数运行时加载（后端 workflow_formula → 公式求值器）。
 *
 * <p>数据流：设计器「自定义函数」弹框保存 → 后端 workflow_formula → 运行期由本模块
 * 拉取并编译成可调用实现 → 公式求值器在遇到非内置函数名时按自定义函数表查找。</p>
 *
 * <p>作用域语义与后端 {@code WorkflowFormulaServiceImpl#getAvailable} 一致：
 * formscope 为空 = 全局（任何表单可用）；否则仅该 formId 的表单可用。
 * 故未拿到 formId 时只加载全局函数（不会把别的表单的私有函数带进来）。</p>
 *
 * <p>注：注册到 Univer 引擎（设计态画布）的适配器在 {@link ./univerCustomFunction}，
 * 单独成模块是为了让它不依赖本文件的 API 依赖（便于单测直接引入）。</p>
 */
import { createContext, useContext, useEffect, useState } from 'react';
import { customFormulaApi } from '@/services/formmode';
import {
  buildCustomFunctionResolver,
  type CustomFunctionResolver,
  type CustomFormula,
} from './formulaUtils';

/** 空解析器：没有任何自定义函数（求值时非内置函数名一律 #NAME?） */
const EMPTY_RESOLVER: CustomFunctionResolver = () => undefined;

/**
 * 自定义函数解析器的 React 上下文。
 *
 * <p>用于**避免多层 props 钻透**：ExcelPreview 顶层加载一次，内部的 useTabbedSheet /
 * 触发动作处理器等深层组件用 {@link useCustomFunctionContext} 直接取用。</p>
 */
export const CustomFunctionContext = createContext<CustomFunctionResolver>(EMPTY_RESOLVER);

/** 消费当前的自定义函数解析器 */
export const useCustomFunctionContext = (): CustomFunctionResolver =>
  useContext(CustomFunctionContext);

/**
 * 拉取并编译指定表单可用的自定义函数。
 * 后端表未就绪 / 请求失败时返回空解析器（不阻断表单，仅公式里的自定义函数不可用）。
 */
export const loadCustomFunctionResolver = async (
  formId?: string | number | null,
): Promise<CustomFunctionResolver> => {
  try {
    const list = (await customFormulaApi.list(
      formId ? String(formId) : undefined,
    )) as CustomFormula[] | null;
    return buildCustomFunctionResolver(list || []);
  } catch {
    return EMPTY_RESOLVER;
  }
};

/**
 * React Hook：按 formId 加载自定义函数解析器。
 *
 * <p>刻意**不做缓存**：设计器里刚保存/删除了自定义函数后，预览必须立刻看到最新定义，
 * 缓存会让这里拿到旧函数表。</p>
 */
export const useCustomFunctionResolver = (
  formId?: string | number | null,
): CustomFunctionResolver => {
  const [resolver, setResolver] = useState<CustomFunctionResolver>(EMPTY_RESOLVER);
  useEffect(() => {
    let alive = true;
    loadCustomFunctionResolver(formId).then((r) => {
      if (alive) setResolver(r);
    });
    return () => {
      alive = false;
    };
  }, [formId]);
  return resolver;
};

export default useCustomFunctionResolver;
