import { LinkOutlined } from '@ant-design/icons';
import { Button, Empty, Flex, List, Modal, Tabs, Tag, theme } from 'antd';
import { useState } from 'react';
import { listMyRequests, listTodo } from '@/services/workflow';

export interface BizReference {
  bizRefType: 'WF_TASK' | 'WF_INSTANCE';
  bizRefId: string;
  title?: string;
}

interface Props {
  value?: BizReference;
  onChange?: (value?: BizReference) => void;
}

export default function BizReferencePicker({ value, onChange }: Props) {
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      listTodo()
        .then((r) => setTasks((r as any)?.data ?? []))
        .catch(() => setTasks([])),
      listMyRequests({ current: 1, pageSize: 9999 })
        .then((r) =>
          setInstances(
            ((r as any)?.data?.records as any[]) ?? (r as any)?.data ?? [],
          ),
        )
        .catch(() => setInstances([])),
    ]).finally(() => setLoading(false));
  };

  const openModal = () => {
    setOpen(true);
    load();
  };

  const pick = (ref: BizReference) => {
    onChange?.(ref);
    setOpen(false);
  };

  return (
    <>
      <Button
        type="text"
        icon={<LinkOutlined />}
        onClick={openModal}
        style={{ color: token.colorPrimary }}
      >
        引用流程
      </Button>
      {value && (
        <Tag
          color="blue"
          closable
          onClose={() => onChange?.(undefined)}
          style={{ marginLeft: 4 }}
        >
          {value.bizRefType === 'WF_TASK' ? '待办' : '流程'}：
          {value.title || value.bizRefId}
        </Tag>
      )}

      <Modal
        title="选择关联流程"
        open={open}
        // 悬浮消息框容器 zIndex=1100，Modal 默认 1000 会被其盖住，需提层
        zIndex={1200}
        onCancel={() => setOpen(false)}
        footer={null}
        width={560}
      >
        <Tabs
          items={[
            {
              key: 'todo',
              label: '待办任务',
              children: (
                <List
                  loading={loading}
                  dataSource={tasks}
                  locale={{ emptyText: <Empty description="暂无待办" /> }}
                  renderItem={(item) => (
                    <List.Item
                      style={{ cursor: 'pointer' }}
                      onClick={() =>
                        pick({
                          bizRefType: 'WF_TASK',
                          bizRefId: item.id,
                          title: item.title,
                        })
                      }
                    >
                      <List.Item.Meta
                        title={item.title || item.id}
                        description={
                          <Flex gap={6} wrap>
                            <Tag>{item.defName}</Tag>
                            <Tag color="orange">{item.nodeName}</Tag>
                          </Flex>
                        }
                      />
                    </List.Item>
                  )}
                />
              ),
            },
            {
              key: 'mine',
              label: '我发起的',
              children: (
                <List
                  loading={loading}
                  dataSource={instances}
                  locale={{ emptyText: <Empty description="暂无发起的流程" /> }}
                  renderItem={(item) => (
                    <List.Item
                      style={{ cursor: 'pointer' }}
                      onClick={() =>
                        pick({
                          bizRefType: 'WF_INSTANCE',
                          bizRefId: item.id,
                          title: item.title,
                        })
                      }
                    >
                      <List.Item.Meta
                        title={item.title || item.id}
                        description={<Tag>{item.defName}</Tag>}
                      />
                    </List.Item>
                  )}
                />
              ),
            },
          ]}
        />
      </Modal>
    </>
  );
}
