import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Col, Empty, Row, Spin, Typography } from 'antd';
import { history, useSearchParams } from '@umijs/max';
import { portalApi } from '@/services/portal';
import ElementRenderer from '../Portal/components/ElementRegistry';
import ElementShell from '../Portal/components/ElementShell';
import type { ElementDataMap, MyPortal, PortalElement } from '@/services/portal';

const { Title, Text } = Typography;

/**
 * 登录前门户（免鉴权公开页 /prelogin）
 * 渲染 page_type=0 的门户内容（公告/链接/富文本/图表等公共元素）；
 * 用户相关元素(todo/message)在未登录下为空。数据来自免鉴权 /pre-login/portal + /pre-login/element-data/batch。
 * 支持 ?code= 精确访问指定登录前门户（对标 E-cology 门户标识 portal-9-5）。
 */
const PreLogin: React.FC = () => {
  const [portal, setPortal] = useState<MyPortal | undefined>(undefined);
  const [dataMap, setDataMap] = useState<ElementDataMap>({});
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  /** URL 上的 code = 登录前门户标识（page_code），不传则取第一个登录前页 */
  const portalCode = searchParams.get('code') || undefined;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await portalApi.getPreLoginPortal(portalCode);
      setPortal(data);
      const els = (data?.elements || []).filter((e) => e.id != null);
      if (els.length) {
        const dm = await portalApi.fetchPreLoginElementData({
          elements: els.map((e) => ({
            elementId: e.id as number,
            type: e.elementType,
            perPage: e.perPage,
          })),
        });
        setDataMap(dm || {});
      } else {
        setDataMap({});
      }
    } catch (e) {
      console.error('[portal] 加载登录前门户失败', e);
      setPortal(undefined);
    } finally {
      setLoading(false);
    }
  }, [portalCode]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const list = [...(portal?.elements || [])].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    );
    const grouped = new Map<number, PortalElement[]>();
    list.forEach((el) => {
      const rowNo = el.rowNo || 1;
      const bucket = grouped.get(rowNo) || [];
      bucket.push(el);
      grouped.set(rowNo, bucket);
    });
    return Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);
  }, [portal?.elements]);

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', padding: 24 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <div>
            <Title level={3} style={{ margin: 0 }}>
              {portal?.pageName || '企业门户'}
            </Title>
            <Text type="secondary">欢迎访问，请登录后可查看个性化内容</Text>
          </div>
          <Button type="primary" onClick={() => history.push('/user/login')}>
            登录系统
          </Button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <Spin size="large" tip="正在加载门户..." />
          </div>
        ) : !portal?.pageId ? (
          <Empty description="暂无登录前门户内容" style={{ padding: 80, background: '#fff', borderRadius: 12 }} />
        ) : (
          rows.map(([rowNo, list]) => (
            <Row key={rowNo} gutter={[16, 16]} align="stretch" style={{ marginBottom: 16 }}>
              {list.map((el) => {
                const vo = dataMap[String(el.id)];
                const failed = !!vo && vo.success === false;
                const rowsData = vo?.data || [];
                return (
                  <Col
                    key={el.id || `${el.elementType}-${el.sortOrder}`}
                    xs={24}
                    md={el.colSpan || 12}
                    lg={el.colSpan || 12}
                    xl={el.colSpan || 12}
                  >
                    <ElementShell
                      title={el.elementName}
                      showTitle={el.showTitle}
                      error={failed ? vo?.message || '该元素数据加载失败' : undefined}
                      empty={!failed && rowsData.length === 0}
                    >
                      <ElementRenderer
                        elementType={el.elementType}
                        rows={rowsData}
                        perPage={el.perPage}
                      />
                    </ElementShell>
                  </Col>
                );
              })}
            </Row>
          ))
        )}
      </div>
    </div>
  );
};

export default PreLogin;
