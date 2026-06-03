import React, { useState, useRef, useEffect } from 'react';
import { Card, Empty } from 'antd';

/**
 * ExcelGrid组件
 * 模拟Excel单元格，支持字段拖拽放置
 * 实际项目中应使用Univer组件替换此模拟实现
 */
interface ExcelGridProps {
  sheetName: string;
  layoutData: any;
  onLayoutChange: (data: any) => void;
}

const ExcelGrid: React.FC<ExcelGridProps> = ({ sheetName, layoutData, onLayoutChange }) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const [cells, setCells] = useState<any>({});
  const [selectedCell, setSelectedCell] = useState<string>('');

  // 模拟Excel网格：20行 x 10列
  const rows = 20;
  const cols = 10;

  useEffect(() => {
    // 加载布局数据
    if (layoutData && layoutData[sheetName]) {
      setCells(layoutData[sheetName]);
    }
  }, [sheetName, layoutData]);

  const handleCellClick = (row: number, col: number) => {
    const cellId = `${row}-${col}`;
    setSelectedCell(cellId);
  };

  const handleCellDoubleClick = (row: number, col: number) => {
    // 双击单元格，可以编辑或放置字段
    const cellId = `${row}-${col}`;
    console.log('双击单元格:', cellId);
  };

  const renderCell = (row: number, col: number) => {
    const cellId = `${row}-${col}`;
    const cellData = cells[cellId];
    const isSelected = selectedCell === cellId;

    return (
      <div
        key={cellId}
        onClick={() => handleCellClick(row, col)}
        onDoubleClick={() => handleCellDoubleClick(row, col)}
        style={{
          border: isSelected ? '2px solid #1890ff' : '1px solid #d9d9d9',
          minHeight: 32,
          padding: 4,
          backgroundColor: isSelected ? '#e6f7ff' : cellData ? '#f0f5ff' : 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: 12,
        }}
      >
        {cellData ? (
          <div style={{ width: '100%', textAlign: 'center' }}>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{cellData.label}</div>
            <div style={{ color: '#666' }}>
              {cellData.type === 'text' && <input type="text" style={{ width: '90%' }} disabled />}
              {cellData.type === 'number' && <input type="number" style={{ width: '90%' }} disabled />}
              {cellData.type === 'date' && <input type="date" style={{ width: '90%' }} disabled />}
              {cellData.type === 'select' && (
                <select style={{ width: '90%' }} disabled>
                  <option>请选择</option>
                </select>
              )}
            </div>
          </div>
        ) : (
          <span style={{ color: '#ccc' }}>{row === 0 ? String.fromCharCode(65 + col) : ''}</span>
        )}
      </div>
    );
  };

  return (
    <Card
      title={`工作表: ${sheetName}`}
      size="small"
      style={{ height: '100%', overflow: 'auto' }}
    >
      <div
        ref={gridRef}
        style={{
          display: 'grid',
          gridTemplateColumns: `40px repeat(${cols}, 1fr)`,
          gap: 0,
          width: 'fit-content',
          minWidth: '100%',
        }}
      >
        {/* 左上角空白单元格 */}
        <div style={{ border: '1px solid #d9d9d9', backgroundColor: '#fafafa', minHeight: 32 }} />

        {/* 列头 */}
        {Array.from({ length: cols }, (_, col) => (
          <div
            key={`header-${col}`}
            style={{
              border: '1px solid #d9d9d9',
              backgroundColor: '#fafafa',
              minHeight: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
            }}
          >
            {String.fromCharCode(65 + col)}
          </div>
        ))}

        {/* 行和单元格 */}
        {Array.from({ length: rows }, (_, row) => (
          <React.Fragment key={`row-${row}`}>
            {/* 行号 */}
            <div
              style={{
                border: '1px solid #d9d9d9',
                backgroundColor: '#fafafa',
                minHeight: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
              }}
            >
              {row + 1}
            </div>

            {/* 单元格 */}
            {Array.from({ length: cols }, (_, col) => renderCell(row, col))}
          </React.Fragment>
        ))}
      </div>
    </Card>
  );
};

export default ExcelGrid;
