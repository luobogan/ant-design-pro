import React, { Suspense, lazy } from 'react';
import { Empty, Skeleton, Typography } from 'antd';
import type { ElementDataRow, ElementType } from '@/services/portal';

const { Text } = Typography;

/**
 * 六类门户元素组件
 *
 * <p>全部 <b>React.lazy 懒加载</b>：门户首屏是「门面」，图表（@ant-design/plots）与富文本
 * （fluent-editor）体积大，静态 import 会把它们打进首屏包。按需加载后，
 * 只有配置里真正出现的元素类型才会拉取对应 chunk。</p>
 *
 * <p>新增一种门户元素时：① 后端加一个 Provider ② 在 REGISTRY 登记组件，
 * 引擎与页面栅格逻辑无需改动。</p>
 */
const TodoElement = lazy(() => import('../elements/TodoElement'));
const NoticeElement = lazy(() => import('../elements/NoticeElement'));
const MessageElement = lazy(() => import('../elements/MessageElement'));
const ChartElement = lazy(() => import('../elements/ChartElement'));
const LinksElement = lazy(() => import('../elements/LinksElement'));
const RichElement = lazy(() => import('../elements/RichElement'));

/** 元素组件统一入参 */
export interface ElementRendererProps {
  rows: ElementDataRow[];
  perPage?: number;
}

const REGISTRY: Record<string, React.ComponentType<ElementRendererProps>> = {
  todo: TodoElement,
  notice: NoticeElement,
  message: MessageElement,
  chart: ChartElement,
  links: LinksElement,
  rich: RichElement,
};

/** 懒加载占位：与元素卡片外壳一致的骨架屏，避免布局跳动 */
const ElementFallback: React.FC = () => (
  <div style={{ padding: '8px 0' }}>
    <Skeleton active paragraph={{ rows: 4 }} title={false} />
  </div>
);

/**
 * 按元素类型渲染对应组件；未注册类型给出明确兜底（便于发现配置与代码不一致）
 */
const ElementRenderer: React.FC<{
  elementType: ElementType | string;
  rows: ElementDataRow[];
  perPage?: number;
}> = ({ elementType, rows, perPage }) => {
  const Comp = REGISTRY[elementType];
  if (!Comp) {
    return (
      <div style={{ padding: '18px 0' }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Text type="secondary">
              暂不支持的元素类型：<Text code>{elementType}</Text>
            </Text>
          }
        />
      </div>
    );
  }
  return (
    <Suspense fallback={<ElementFallback />}>
      <Comp rows={rows} perPage={perPage} />
    </Suspense>
  );
};

/** 供设计器元素面板使用：已注册的元素类型清单 */
export const REGISTERED_ELEMENT_TYPES = Object.keys(REGISTRY);

export default ElementRenderer;
