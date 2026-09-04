import React, { useEffect, useState } from 'react';
import { App, Result } from 'antd';
import ExcelPreview from './components/ExcelPreview';

/**
 * 设计器写入、预览页读取的布局数据键。
 *
 * 用 localStorage（而非 sessionStorage）是因为预览在**新标签页**中打开：
 * sessionStorage 按标签页隔离，新标签页读不到；localStorage 同源共享，可稳定传递。
 */
export const EXCEL_PREVIEW_DATA_KEY = 'excelPreviewData';

/**
 * 表单预览独立页面
 *
 * 对齐 ecology 的 excelPreView：预览以独立页面承载（新标签页打开），
 * 而不是只能停留在设计器弹窗里。页面按 Excel 网格还原布局：
 * 合并单元格、列宽行高、字体/颜色/背景/对齐均沿用 Excel 配置，字段渲染为交互控件。
 *
 * 数据由 ExcelDesign 的「预览」按钮写入 localStorage 后 window.open 打开本页。
 */
const ExcelPreviewPageContent: React.FC = () => {
  const [layoutData, setLayoutData] = useState<any>(null);
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(EXCEL_PREVIEW_DATA_KEY);
      setLayoutData(raw ? JSON.parse(raw) : null);
    } catch (e) {
      console.error('[ExcelPreviewPage] 解析预览数据失败:', e);
      setLayoutData(null);
    }
    setLoaded(true);
  }, []);

  // 关闭：由 window.open 打开的页面才能自关闭，否则退回浏览器后退
  const handleClose = () => {
    if (window.opener) {
      window.close();
    } else if (window.history.length > 1) {
      window.history.back();
    }
  };

  if (!loaded) return null;

  // 直接访问本页且没有预览数据时给出明确提示（避免出现"空白页签"）
  if (!layoutData) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Result
          status="info"
          title="没有可预览的数据"
          subTitle="请回到 Excel 设计器，点击「预览」按钮重新打开本页。"
        />
      </div>
    );
  }

  return <ExcelPreview layoutData={layoutData} open standalone onClose={handleClose} title="表单预览" />;
};

const ExcelPreviewPage: React.FC = () => (
  <App>
    <ExcelPreviewPageContent />
  </App>
);

export default ExcelPreviewPage;
