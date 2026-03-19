import dayjs from 'dayjs';

/**
 * 格式化日期时间
 */
export const formatDateTime = (dateTime: string | number | Date, format = 'YYYY-MM-DD HH:mm:ss') => {
  if (!dateTime) return '-';
  return dayjs(dateTime).format(format);
};

/**
 * 格式化日期
 */
export const formatDate = (date: string | number | Date) => {
  return formatDateTime(date, 'YYYY-MM-DD');
};

/**
 * 格式化金额
 */
export const formatMoney = (amount: number, currency = '¥') => {
  if (typeof amount !== 'number') return '-';
  return `${currency}${amount.toFixed(2)}`;
};

/**
 * 订单状态映射
 */
export const ORDER_STATUS_MAP: Record<string, { text: string; color: string }> = {
  pending: { text: '待付款', color: 'orange' },
  paid: { text: '已付款', color: 'blue' },
  shipped: { text: '已发货', color: 'cyan' },
  delivered: { text: '已完成', color: 'green' },
  cancelled: { text: '已取消', color: 'red' },
};

/**
 * 获取订单状态文本
 */
export const getOrderStatusText = (status: string) => {
  return ORDER_STATUS_MAP[status]?.text || status;
};

/**
 * 获取订单状态颜色
 */
export const getOrderStatusColor = (status: string) => {
  return ORDER_STATUS_MAP[status]?.color || 'default';
};

/**
 * 用户状态映射
 */
export const USER_STATUS_MAP: Record<string, { text: string; color: string }> = {
  active: { text: '正常', color: 'green' },
  inactive: { text: '禁用', color: 'red' },
};

/**
 * 获取用户状态文本
 */
export const getUserStatusText = (status: string) => {
  return USER_STATUS_MAP[status]?.text || status;
};

/**
 * 获取用户状态颜色
 */
export const getUserStatusColor = (status: string) => {
  return USER_STATUS_MAP[status]?.color || 'default';
};

/**
 * 商品状态映射
 */
export const PRODUCT_STATUS_MAP: Record<string, { text: string; color: string }> = {
  active: { text: '上架', color: 'green' },
  inactive: { text: '下架', color: 'red' },
};

/**
 * 获取商品状态文本
 */
export const getProductStatusText = (status: string) => {
  return PRODUCT_STATUS_MAP[status]?.text || status;
};

/**
 * 获取商品状态颜色
 */
export const getProductStatusColor = (status: string) => {
  return PRODUCT_STATUS_MAP[status]?.color || 'default';
};

/**
 * 评价状态映射
 */
export const REVIEW_STATUS_MAP: Record<string, { text: string; color: string }> = {
  pending: { text: '待审核', color: 'orange' },
  approved: { text: '已通过', color: 'green' },
  rejected: { text: '已拒绝', color: 'red' },
};

/**
 * 获取评价状态文本
 */
export const getReviewStatusText = (status: string) => {
  return REVIEW_STATUS_MAP[status]?.text || status;
};

/**
 * 获取评价状态颜色
 */
export const getReviewStatusColor = (status: string) => {
  return REVIEW_STATUS_MAP[status]?.color || 'default';
};

/**
 * 会员状态映射
 */
export const MEMBER_STATUS_MAP: Record<number, { text: string; color: string }> = {
  0: { text: '禁用', color: 'red' },
  1: { text: '正常', color: 'green' },
};

/**
 * 获取会员状态文本
 */
export const getMemberStatusText = (status: number) => {
  return MEMBER_STATUS_MAP[status]?.text || '未知';
};

/**
 * 获取会员状态颜色
 */
export const getMemberStatusColor = (status: number) => {
  return MEMBER_STATUS_MAP[status]?.color || 'default';
};

/**
 * 会员等级颜色映射
 */
export const getMemberLevelColor = (levelValue: number) => {
  const colors: Record<number, string> = {
    1: 'default',
    2: 'silver',
    3: 'gold',
    4: 'purple',
    5: 'cyan',
  };
  return colors[levelValue] || 'default';
};

/**
 * 格式化文件大小
 */
export const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};
