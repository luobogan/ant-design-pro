import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Card, Empty, Input, Spin, Tag } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { listDefinitions, workflowBrowserApi } from '@/services/workflow';
import type { WfProcessDefinition } from '@/services/workflow';
import { pickPayload } from '@/utils/utils';

const { Search } = Input;

/**
 * 新建流程：按「路径类型」分组展示**可发起**流程，点击卡片在新标签页打开发起页。
 *
 * 展示口径：仅「已发布（status=1）且为当前激活版本」的流程；
 * 草稿/停用/测试态(status=3)/历史版本不展示，已删除的由后端逻辑删除（@TableLogic）自动过滤。
 * 测试态流程只在 /formmode/test 可选，不在此正式发起页出现。
 *
 * 发起页为菜单驱动的组件路由（blade_menu: workflow_create_start，
 * category=2 + is_component=1 + path=/workflow/create/start → ./pages/Workflow/Create/Start.tsx）。
 */
const CreateWorkflow: React.FC = () => {
  const [defs, setDefs] = useState<WfProcessDefinition[]>([]);
  const [typeMap, setTypeMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res: any = await listDefinitions();
        const all: WfProcessDefinition[] = pickPayload(res) || [];
        // 激活版本判定与「流程设计」列表一致：锚点 = activeVersionId 非空则取之，否则为自身 id；
        // 仅保留 id 与锚点相等的行（同一版本组只出现当前激活版本）。
        const map = new Map<string, WfProcessDefinition>();
        for (const d of all) {
          if (d.status !== 1) continue;
          const anchor = d.activeVersionId != null ? d.activeVersionId : d.id;
          if (String(anchor) !== String(d.id)) continue;
          map.set(String(d.id), d);
        }
        setDefs(Array.from(map.values()));
      } catch {
        setDefs([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 路径类型（wftype）名称映射：type 存的是 wf_workflow_type.id，分组标题展示类型名称
  useEffect(() => {
    workflowBrowserApi
      .list('wftype')
      .then((res: any) => {
        const list = pickPayload(res) || [];
        const m: Record<string, string> = {};
        list.forEach((o: any) => {
          m[String(o.value)] = o.label || '';
        });
        setTypeMap(m);
      })
      .catch(() => setTypeMap({}));
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, WfProcessDefinition[]>();
    defs
      .filter((d) => !keyword || (d.name || '').includes(keyword))
      .forEach((d) => {
        const key = (d.type && typeMap[String(d.type)]) || d.type || '未分类';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(d);
      });
    return Array.from(map.entries());
  }, [defs, keyword, typeMap]);

  /** 新标签页打开发起页（组件路由由菜单表驱动） */
  const openDef = (d: WfProcessDefinition) => {
    window.open(`/workflow/create/start?defId=${d.id}`, '_blank');
  };

  return (
    <PageContainer header={{ title: '新建流程', subTitle: '选择流程并发起' }}>
      <div style={{ marginBottom: 16, maxWidth: 420 }}>
        <Search placeholder="搜索流程名称" allowClear onSearch={setKeyword} onChange={(e) => setKeyword(e.target.value)} />
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <Spin />
        </div>
      ) : defs.length === 0 ? (
        <Card>
          <Empty description="暂无可发起的流程（仅显示已发布且当前激活的流程）" />
        </Card>
      ) : (
        grouped.map(([type, items]) => (
          <ProCard key={type} title={type} style={{ marginBottom: 16 }} headerBordered>
            <ProCard ghost gutter={16} wrap>
              {items.map((d) => (
                <ProCard key={d.id} colSpan={{ xs: 24, sm: 12, md: 8, lg: 6 }} bordered hoverable style={{ marginBottom: 16 }} onClick={() => openDef(d)}>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{d.name}</div>
                  <div style={{ color: '#8c8c8c', fontSize: 13, minHeight: 40 }}>{d.description || '暂无描述'}</div>
                  <div style={{ marginTop: 8 }}>
                    <Tag color="blue">V{d.version || 1}</Tag>
                    <Tag color="green">已发布</Tag>
                  </div>
                </ProCard>
              ))}
            </ProCard>
          </ProCard>
        ))
      )}
    </PageContainer>
  );
};

export default CreateWorkflow;
