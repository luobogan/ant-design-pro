// sm-crypto 模块类型声明
declare module 'sm-crypto' {
  export const sm2: {
    doEncrypt: (data: string, publicKey: string, cipherMode: number) => string;
    doDecrypt: (
      encryptedData: string,
      privateKey: string,
      cipherMode: number,
    ) => string;
  };
  export const sm3: {
    hash: (data: string) => string;
  };
  export const sm4: {
    encrypt: (data: string, key: string) => string;
    decrypt: (encryptedData: string, key: string) => string;
  };
}
