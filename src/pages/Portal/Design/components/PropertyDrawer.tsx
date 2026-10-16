import {
  Button,
  Col,
  Divider,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Typography,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { ELEMENT_TYPE_META } from '@/services/portal';
import { COL_SPAN_OPTIONS, type DesignerElement } from '../types';

const { Text } = Typography;

interface PropertyDrawerProps {
  element?: DesignerElement;
  open: boolean;
  onClose: () => void;
  onChange: (uid: string, patch: Partial<DesignerElement>) => void;
  onRemove: (uid: string) => void;
}

/**
 * 设计器右侧属性抽屉
 * 分组：基础（标题/显示标题）→ 布局（行号/栅格宽度/排序号）→ 类型私有配置（条数/链接/图表/富文本）
 */
const PropertyDrawer: React.FC<PropertyDrawerProps> = ({
  element,
  open,
  onClose,
  onChange,
  onRemove,
}) => {
  if (!element) {
    return (
      <Drawer open={open} onClose={onClose} width={340} title="元素属性">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请先在画布中选择一个元素" />
      </Drawer>
    );
  }

  const meta = ELEMENT_TYPE_META[element.elementType];
  const config = element.config || {};
  const patchConfig = (next: Record<string, any>) =>
    onChange(element.uid, { config: { ...config, ...next } });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={340}
      title={
        <Space size={6}>
          <span>{meta?.icon}</span>
          <span>{meta?.label} 属性</span>
        </Space>
      }
      extra={
        <Button danger size="small" icon={<DeleteOutlined />} onClick={() => onRemove(element.uid)}>
          删除元素
        </Button>
      }
    >
      <Form layout="vertical" size="small">
        <Text strong>基础</Text>
        <Form.Item label="元素标题" style={{ marginTop: 8 }}>
          <Input
            data-testid="prop-title-input"
            value={element.elementName}
            onChange={(e) => onChange(element.uid, { elementName: e.target.value })}
            placeholder="显示在卡片上的标题"
          />
        </Form.Item>
        <Form.Item label="显示卡片标题">
          <Switch
            checked={element.showTitle !== 0}
            onChange={(checked) => onChange(element.uid, { showTitle: checked ? 1 : 0 })}
          />
        </Form.Item>

        <Divider style={{ margin: '10px 0' }} />
        <Text strong>布局</Text>
        <Row gutter={8} style={{ marginTop: 8 }}>
          <Col span={12}>
            <Form.Item label="所在行">
              <InputNumber
                min={1}
                max={20}
                style={{ width: '100%' }}
                value={element.rowNo}
                onChange={(v) => onChange(element.uid, { rowNo: Number(v) || 1 })}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="排序号">
              <InputNumber
                min={0}
                max={999}
                style={{ width: '100%' }}
                value={element.sortOrder}
                onChange={(v) => onChange(element.uid, { sortOrder: Number(v) || 0 })}
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="栅格宽度（24 栅格）">
          <Select
            style={{ width: '100%' }}
            value={element.colSpan}
            options={COL_SPAN_OPTIONS}
            onChange={(v) => onChange(element.uid, { colSpan: v })}
          />
        </Form.Item>

        <Divider style={{ margin: '10px 0' }} />
        <Text strong>类型私有配置</Text>

        {['todo', 'notice', 'message'].includes(element.elementType) ? (
          <Form.Item label="显示条数（perPage）" style={{ marginTop: 8 }}>
            <InputNumber
              min={1}
              max={50}
              style={{ width: '100%' }}
              value={config.perPage ?? 5}
              onChange={(v) => patchConfig({ perPage: Number(v) || 5 })}
            />
          </Form.Item>
        ) : null}

        {element.elementType === 'links' ? (
          <Form.Item label="快捷入口（名称 / 图标 / 地址）">
            <Space direction="vertical" style={{ width: '100%' }} size={6}>
              {(config.links || []).map((link: any, index: number) => (
                <Row key={link?.uid || `link-${index}`} gutter={4}>
                  <Col span={7}>
                    <Input
                      size="small"
                      value={link.name}
                      placeholder="名称"
                      onChange={(e) => {
                        const next = [...(config.links || [])];
                        next[index] = { ...next[index], name: e.target.value };
                        patchConfig({ links: next });
                      }}
                    />
                  </Col>
                  <Col span={5}>
                    <Input
                      size="small"
                      value={link.icon}
                      placeholder="图标"
                      onChange={(e) => {
                        const next = [...(config.links || [])];
                        next[index] = { ...next[index], icon: e.target.value };
                        patchConfig({ links: next });
                      }}
                    />
                  </Col>
                  <Col span={10}>
                    <Input
                      size="small"
                      value={link.url}
                      placeholder="地址"
                      onChange={(e) => {
                        const next = [...(config.links || [])];
                        next[index] = { ...next[index], url: e.target.value };
                        patchConfig({ links: next });
                      }}
                    />
                  </Col>
                  <Col span={2}>
                    <Button
                      size="small"
                      type="text"
                      danger
                      onClick={() =>
                        patchConfig({ links: (config.links || []).filter((_: any, i: number) => i !== index) })
                      }
                    >
                      ×
                    </Button>
                  </Col>
                </Row>
              ))}
              <Button
                size="small"
                icon={<PlusOutlined />}
                block
                onClick={() =>
                  patchConfig({
                    links: [
                      ...(config.links || []),
                      { uid: `lk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: '新入口', icon: '🔗', url: '/' },
                    ],
                  })
                }
              >
                添加入口
              </Button>
            </Space>
          </Form.Item>
        ) : null}

        {element.elementType === 'chart' ? (
          <>
            <Form.Item label="图表类型">
              <Select
                style={{ width: '100%' }}
                value={config.chartType || 'column'}
                options={[
                  { label: '柱状图', value: 'column' },
                  { label: '条形图（横向）', value: 'bar' },
                  { label: '折线图', value: 'line' },
                  { label: '面积图', value: 'area' },
                  { label: '饼图', value: 'pie' },
                ]}
                onChange={(v) => patchConfig({ chartType: v })}
              />
            </Form.Item>
            <Form.Item label="横轴字段">
              <Input value={config.xField || 'x'} onChange={(e) => patchConfig({ xField: e.target.value })} />
            </Form.Item>
            <Form.Item label="纵轴字段">
              <Input value={config.yField || 'y'} onChange={(e) => patchConfig({ yField: e.target.value })} />
            </Form.Item>
            <Form.Item label="静态数据（JSON 数组）">
              <Input.TextArea
                rows={6}
                value={JSON.stringify(config.data || [], null, 2)}
                onChange={(e) => {
                  try {
                    patchConfig({ data: JSON.parse(e.target.value) });
                  } catch (err) {
                    console.error('[portal] 图表数据 JSON 解析失败', err);
                  }
                }}
              />
            </Form.Item>
          </>
        ) : null}

        {element.elementType === 'rich' ? (
          <Form.Item label="富文本 HTML">
            <Input.TextArea
              rows={10}
              value={config.html || ''}
              onChange={(e) => patchConfig({ html: e.target.value })}
              placeholder="支持 HTML 片段"
            />
          </Form.Item>
        ) : null}
      </Form>
    </Drawer>
  );
};

export default PropertyDrawer; 
