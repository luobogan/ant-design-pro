import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Descriptions, Empty, Space, Spin, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { history, useSearchParams } from '@umijs/max';
import dayjs from 'dayjs';
import { portalApi } from '@/services/portal';

const { Title, Paragraph } = Typography;

/** 公告分类（对齐 blade_notice.category） */
const CATEGORY_LABEL: Record<string, string> = {
  '1': '通知',
  '2': '公告',
  '3': '公示',
  '4': '公告',
  '5': '通报',
  '6': '公告',
};

/**
 * 公告详情页
 *
 * 门户「通知公告」元素点击标题后跳转：/portal/noticedetail?id=<noticeId>
 * 数据来源：blade-portal GET /notice/detail（读 blade_notice，与 notice Provider 同源）。
 */
const NoticeDetail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    if (!id) {
      setError('缺少公告ID参数');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await portalApi.getNoticeDetail(id);
      if (data && (data.id || data.title)) {
        setDetail(data);
        setError(undefined);
      } else {
        setDetail(null);
        setError('公告不存在或已删除');
      }
    } catch (e) {
      console.error('[portal] 加载公告详情失败', e);
      setDetail(null);
      setError('公告加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => history.push('/portal/home')}>
          返回门户
        </Button>
      </Space>

      {loading ? (
        <div style={{ padding: 80, textAlign: 'center' }}>
          <Spin size="large" tip="正在加载公告..." />
        </div>
      ) : error ? (
        <Alert type="error" showIcon message={error} />
      ) : !detail ? (
        <Empty description="公告不存在" />
      ) : (
        <Card
          bordered={false}
          style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(31,39,51,.06)' }}
        >
          <Title level={3} style={{ marginBottom: 4 }}>
            {detail.title}
          </Title>
          <Descriptions
            size="small"
            column={2}
            style={{ marginBottom: 16 }}
            items={[
              {
                label: '分类',
                children: CATEGORY_LABEL[String(detail.category ?? '')] || '公告',
              },
              {
                label: '发布时间',
                children: detail.releaseTime
                  ? dayjs(String(detail.releaseTime)).format('YYYY-MM-DD HH:mm')
                  : '-',
              },
            ]}
          />
          <div style={{ borderTop: '1px solid #F0F0F0', paddingTop: 16 }}>
            {detail.content ? (
              <Paragraph>
                <span
                  // 公告正文为后台富文本编辑产物（HTML），此处按受信内容渲染
                  dangerouslySetInnerHTML={{ __html: String(detail.content) }}
                />
              </Paragraph>
            ) : (
              <Empty description="暂无正文" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default NoticeDetail;
