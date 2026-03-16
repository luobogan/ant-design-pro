import { sm2 } from 'sm-crypto';
import defaultSettings from '../../config/defaultSettings';

/**
 * sm2 加密方法
 * @param data
 * @returns {*}
 */
export default function encrypt(data: string): string {
  try {
    return sm2.doEncrypt(data, defaultSettings.auth?.publicKey || '', 0);
  } catch {
    return '';
  }
}
