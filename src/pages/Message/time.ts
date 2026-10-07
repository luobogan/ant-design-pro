import dayjs from 'dayjs';

const CN_DAY = ['日', '一', '二', '三', '四', '五', '六'];

/**
 * 消息分组时间分隔条文案（按当前时间动态计算）：
 *   今天        → HH:mm
 *   昨天        → 昨天 HH:mm
 *   7 天内      → 周X HH:mm
 *   今年其他    → MM月DD日 HH:mm
 *   跨年        → YYYY年MM月DD日 HH:mm
 */
export function formatGroupTime(createTime?: string): string {
  if (!createTime) return '';
  const t = dayjs(createTime);
  if (!t.isValid()) return String(createTime);
  const now = dayjs();
  if (t.isSame(now, 'day')) return t.format('HH:mm');
  if (t.isSame(now.subtract(1, 'day'), 'day')) return `昨天 ${t.format('HH:mm')}`;
  if (now.diff(t, 'day') < 7) return `周${CN_DAY[t.day()]} ${t.format('HH:mm')}`;
  if (t.isSame(now, 'year')) return t.format('MM月DD日 HH:mm');
  return t.format('YYYY年MM月DD日 HH:mm');
}

/**
 * 气泡下的单条消息时间（完整年月日 + 时间精度，仅当天的消息省略日期）：
 *   今天   → HH:mm
 *   昨天   → 昨天 HH:mm
 *   今年   → MM月DD日 HH:mm
 *   跨年   → YYYY年MM月DD日 HH:mm
 * 悬浮 Tooltip 始终展示秒级完整时间（见 formatFullTime）。
 */
export function formatBubbleTime(createTime?: string): string {
  if (!createTime) return '--:--';
  const t = dayjs(createTime);
  if (!t.isValid()) return String(createTime);
  const now = dayjs();
  if (t.isSame(now, 'day')) return t.format('HH:mm');
  if (t.isSame(now.subtract(1, 'day'), 'day')) return `昨天 ${t.format('HH:mm')}`;
  if (t.isSame(now, 'year')) return t.format('MM月DD日 HH:mm');
  return t.format('YYYY年MM月DD日 HH:mm');
}

/** 秒级完整时间（数据存储的原始精度，YYYY-MM-DD HH:mm:ss） */
export function formatFullTime(createTime?: string): string {
  if (!createTime) return '';
  const t = dayjs(createTime);
  return t.isValid() ? t.format('YYYY-MM-DD HH:mm:ss') : String(createTime);
}

/**
 * 是否需要插入时间分组条：与上一条消息间隔 ≥5 分钟或跨天。
 * 历史分页前置插入后，分页边界两侧同样按此规则自然衔接。
 */
export function needGroupSeparator(
  prevCreateTime?: string,
  curCreateTime?: string,
): boolean {
  if (!curCreateTime) return false;
  if (!prevCreateTime) return true;
  const prev = dayjs(prevCreateTime);
  const cur = dayjs(curCreateTime);
  if (!prev.isValid() || !cur.isValid()) return false;
  return !cur.isSame(prev, 'day') || cur.diff(prev, 'minute') >= 5;
}
