/**
 * 金额大写（对齐 E9 `numberChangeToChinese` / `formcalculate_wev8.js` 的中文大写转换）。
 *
 * <p>E9 在金额字段「值改变」时把数值转成人民币大写另存到大小写字段。本项目提供同等能力：
 * ① 公式函数 {@code RMB(x)} 直接返回大写字符串；② 公式格配置 {@code chinese:true} 时，
 * 运行期显示为中文大写（存入目标字段的仍是数值）。</p>
 */

/** 数字汉字（人民币大写用） */
const CN_DIGITS = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
/** 位权 */
const CN_UNITS = ['', '拾', '佰', '仟'];
/** 节权（万/亿/兆） */
const CN_BIG_UNITS = ['', '万', '亿', '兆'];

/** 整数部分 → 中文（不含「元」等单位） */
export const integerToChinese = (num: number): string => {
  if (!Number.isFinite(num) || num <= 0) return '零';
  const groups: number[] = [];
  let n = Math.floor(num);
  while (n > 0) {
    groups.push(n % 10000);
    n = Math.floor(n / 10000);
  }
  let out = '';
  for (let g = groups.length - 1; g >= 0; g--) {
    const val = groups[g];
    if (val === 0) {
      // 整节为 0：留一个「零」（后面若还有非零节才生效）
      if (out && !out.endsWith('零')) out += '零';
      continue;
    }
    const s = String(val).padStart(4, '0');
    let part = '';
    let pendingZero = false;
    for (let i = 0; i < 4; i++) {
      const d = Number(s[i]);
      if (d === 0) {
        pendingZero = true;
        continue;
      }
      if (pendingZero && part) part += '零';
      pendingZero = false;
      part += CN_DIGITS[d] + CN_UNITS[3 - i];
    }
    out += part + CN_BIG_UNITS[g];
  }
  return out.replace(/零+/g, '零').replace(/零$/, '') || '零';
};

/**
 * 数值 → 人民币大写。
 *
 * @param value  数值（字符串数字亦可）
 * @param opts.prefix 前缀（默认「人民币」）；传 '' 则不加前缀
 * @param opts.suffix 后缀（默认「元」）
 */
export const numberToChineseCapital = (
  value: number | string | null | undefined,
  opts: { prefix?: string; suffix?: string } = {},
): string => {
  const prefix = opts.prefix === undefined ? '人民币' : opts.prefix;
  const suffix = opts.suffix === undefined ? '元' : opts.suffix;
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/,/g, ''));
  if (!Number.isFinite(n)) return '';
  const negative = n < 0;
  const abs = Math.abs(n);
  const fixed = abs.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const intVal = Number(intPart || '0');
  const jiao = Number(decPart?.[0] || '0');
  const fen = Number(decPart?.[1] || '0');

  let out = `${prefix}${integerToChinese(intVal)}${suffix}`;
  if (jiao === 0 && fen === 0) {
    out += '整';
  } else {
    if (jiao > 0) {
      out += `${CN_DIGITS[jiao]}角`;
    }
    if (fen > 0) {
      if (jiao === 0) out += '零';
      out += `${CN_DIGITS[fen]}分`;
    } else {
      out += '整';
    }
  }
  return negative ? `负${out}` : out;
};

export default numberToChineseCapital;
