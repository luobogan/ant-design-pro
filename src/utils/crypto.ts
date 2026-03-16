import CryptoJS from 'crypto-js';
import { sm2 } from 'sm-crypto';
import Settings from '../../config/defaultSettings';

export default class Crypto {
  // 使用AesUtil.genAesKey()生成,需和后端配置保持一致
  static aesKey = 'Zgv18ZV6Dn0XkROgh4fHo7ft3jqZSFyO';

  // 使用DesUtil.genDesKey()生成,需和后端配置保持一致
  static desKey = '';

  // SM2公钥，从配置文件读取
  static publicKey = Settings.auth?.publicKey || '';

  /**
   * aes 加密方法
   * @param data
   * @returns {*}
   */
  static encrypt(data: string): string {
    return Crypto.encryptAES(data, Crypto.aesKey);
  }

  /**
   * aes 解密方法
   * @param data
   * @returns {*}
   */
  static decrypt(data: string): string {
    return Crypto.decryptAES(data, Crypto.aesKey);
  }

  /**
   * aes 加密方法，同java：AesUtil.encryptToBase64(text, aesKey);
   */
  static encryptAES(data: string, key: string): string {
    const dataBytes = CryptoJS.enc.Utf8.parse(data);
    const keyBytes = CryptoJS.enc.Utf8.parse(key);
    const encrypted = CryptoJS.AES.encrypt(dataBytes, keyBytes, {
      iv: keyBytes,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    return CryptoJS.enc.Base64.stringify(encrypted.ciphertext);
  }

  /**
   * aes 解密方法，同java：AesUtil.decryptFormBase64ToString(encrypt, aesKey);
   */
  static decryptAES(data: string, key: string): string {
    const keyBytes = CryptoJS.enc.Utf8.parse(key);
    const decrypted = CryptoJS.AES.decrypt(data, keyBytes, {
      iv: keyBytes,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    return CryptoJS.enc.Utf8.stringify(decrypted);
  }

  /**
   * des 加密方法，同java：DesUtil.encryptToBase64(text, desKey)
   */
  static encryptDES(data: string, key: string): string {
    const keyHex = CryptoJS.enc.Utf8.parse(key);
    const encrypted = CryptoJS.DES.encrypt(data, keyHex, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.Pkcs7,
    });
    return encrypted.toString();
  }

  /**
   * des 解密方法，同java：DesUtil.decryptFormBase64(encryptBase64, desKey);
   */
  static decryptDES(data: string, key: string): string {
    const keyHex = CryptoJS.enc.Utf8.parse(key);
    const ciphertext = CryptoJS.enc.Base64.parse(data);
    const decrypted = CryptoJS.DES.decrypt(
      {
        ciphertext: ciphertext as any,
      } as any,
      keyHex,
      {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7,
      },
    );
    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  /**
   * SM2 加密方法，同java：Sm2Util.encryptToBase64
   * @param data
   * @param publicKey
   * @returns {string}
   */
  static encryptSM2(data: string, publicKey?: string): string {
    try {
      const sm2PublicKey = publicKey || Crypto.publicKey;
      if (!sm2PublicKey) {
        throw new Error('SM2 public key is not configured');
      }
      // 使用sm-crypto库的doEncrypt方法，参数为(data, publicKey, 0)
      // 1表示使用C1C2C3格式，与后端保持一致
      const encrypted = sm2.doEncrypt(data, sm2PublicKey, 0);
      console.log('SM2 encryption result:', encrypted);
      return encrypted;
    } catch (e) {
      console.error('SM2 encryption error:', e);
      return data;
    }
  }

  /**
   * SM2 解密方法，同java：Sm2Util.decryptFormBase64
   * @param data
   * @param privateKey
   * @returns {string}
   */
  static decryptSM2(data: string, privateKey: string): string {
    try {
      return sm2.doDecrypt(data, privateKey, 1);
    } catch (e) {
      console.error('SM2 decryption error:', e);
      return data;
    }
  }

  /**
   * 生成SM2密钥对
   * @returns {{privateKey: string, publicKey: string}}
   */
  static generateSM2KeyPair(): { privateKey: string; publicKey: string } {
    // 注意：sm-crypto库的类型定义可能不包含generateKeyPairHex方法
    // 实际使用时需要确保该方法存在
    try {
      // @ts-expect-error - 忽略类型检查，因为sm-crypto库的类型定义可能不完整
      const keyPair = (sm2 as any).generateKeyPairHex();
      return {
        privateKey: keyPair.privateKey,
        publicKey: keyPair.publicKey,
      };
    } catch (e) {
      console.error('Generate SM2 key pair error:', e);
      return {
        privateKey: '',
        publicKey: '',
      };
    }
  }

  /**
   * 加密密码（使用SM2）
   * @param password
   * @returns {string}
   */
  static encryptPassword(password: string): string {
    return Crypto.encryptSM2(password);
  }
}
