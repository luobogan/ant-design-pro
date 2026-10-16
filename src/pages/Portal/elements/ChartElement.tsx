import { useMemo } from 'react';
import { Empty } from 'antd';
import { Area, Bar, Column, Line, Pie } from '@ant-design/plots';

export interface ChartElementProps {
  rows: any[];
}

/**
 * 统计图表元素（@ant-design/plots）
 * 数据来自元素私有配置（Provider 零 IO 回显 config：chartType/data/xField/yField），
 * 按 chartType 渲染柱状/条形/折线/面积/饼图。接入统计服务后由后端 Provider 改为真实查询，前端零改动。
 */
const ChartElement: React.FC<ChartElementProps> = ({ rows }) => {
  const row = rows[0] || {};
  const chartType = (row.chartType as string) || 'column';
  const raw = Array.isArray(row.data) ? row.data : [];
  const xKey = (row.xField as string) || 'x';
  const yKey = (row.yField as string) || 'y';

  const data = useMemo(
    () =>
      raw.map((item: any, idx: number) => ({
        ...item,
        [xKey]: item?.[xKey] ?? `#${idx + 1}`,
        [yKey]: Number(item?.[yKey] ?? 0),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(raw), xKey, yKey],
  );

  if (!data.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无统计数据" />;
  }

  const height = 260;
  switch (chartType) {
    case 'line':
      return <Line data={data} xField={xKey} yField={yKey} height={height} autoFit smooth />;
    case 'area':
      return <Area data={data} xField={xKey} yField={yKey} height={height} autoFit />;
    case 'bar':
      // 横向条形：值轴作 x，类别轴作 y
      return <Bar data={data} xField={yKey} yField={xKey} height={height} autoFit />;
    case 'pie':
      return (
        <Pie
          data={data}
          colorField={xKey}
          angleField={yKey}
          height={height}
          autoFit
          label={{ type: 'outer' }}
        />
      );
    case 'column':
    default:
      return <Column data={data} xField={xKey} yField={yKey} height={height} autoFit />;
  }
};

export default ChartElement;
