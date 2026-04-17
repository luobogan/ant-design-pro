import { useEffect, useState } from 'react';
import { getSavedFormData } from '@/requestErrorConfig';

interface SavedFormData {
  url: string;
  method: string;
  data: any;
  timestamp: number;
}

/**
 * 表单数据恢复 Hook
 * 用于在会话超时后恢复用户提交的表单数据
 * 
 * @param currentUrl 当前页面的URL路径
 * @param formInstance Ant Design Form 实例
 * @returns { hasSavedData, restoreData, clearData }
 */
export const useFormDataRestore = (
  currentUrl: string,
  formInstance?: any
) => {
  const [hasSavedData, setHasSavedData] = useState(false);
  const [savedData, setSavedData] = useState<SavedFormData | null>(null);

  useEffect(() => {
    const formData = getSavedFormData();
    if (formData && formData.url === currentUrl) {
      setSavedData(formData);
      setHasSavedData(true);
      
      // 如果提供了表单实例，自动填充表单数据
      if (formInstance && formData.data) {
        formInstance.setFieldsValue(formData.data);
      }
    }
  }, [currentUrl, formInstance]);

  const restoreData = () => {
    if (savedData && savedData.data) {
      if (formInstance) {
        formInstance.setFieldsValue(savedData.data);
      }
      return savedData.data;
    }
    return null;
  };

  const clearData = () => {
    setHasSavedData(false);
    setSavedData(null);
    sessionStorage.removeItem('blade_pending_form_data');
  };

  return {
    hasSavedData,
    savedData,
    restoreData,
    clearData,
  };
};
