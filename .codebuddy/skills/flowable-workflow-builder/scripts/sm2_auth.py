#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""国密 SM2/SM3 自实现 + 向 blade-auth 换取令牌。

仅用 Python 标准库（无第三方依赖）。用于向运行中的 springblade 网关做 SM2 登录，
以便调用需要鉴权的工作流接口（如 /blade-workflow/definition/import）。

关键经验（踩坑记录，务必保留）：
- blade-core 的 SM2Util 用 BouncyCastle `new SM2Engine()`，其默认模式是 **C1C2C3**
  （C3 在密文末尾）。用 C1C3C2 加密时服务端 C3 校验不过，登录会报"用户名或密码错误"。
  因此这里 sm2_encrypt 默认 mode='C1C2C3'。
- 登录还要带 OAuth 客户端 Basic 头（默认 sword:sword_secret）和 userType=web，
  否则会被网关/鉴权拦成 401 / 走错分支。
"""
import json, struct, random, base64, urllib.request, urllib.error

# ---------- SM2 曲线参数 (sm2p256v1) ----------
P  = 0xFFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000FFFFFFFFFFFFFFFF
A  = 0xFFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000FFFFFFFFFFFFFFFC
B  = 0x28E9FA9E9D9F5E344D5A9E4BCF6509A7F39789F515AB8F92DDBCBD414D940E93
N  = 0xFFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFF7203DF6B21C6052B53BBF40939D54123
GX = 0x32C4AE2C1F1981195F9904466A39C9948FE30BBFF2660BE1715A4589334C74C7
GY = 0xBC3736A2F4F6779C59BDCEE36B692153D0A9877CC62A474002DF32E52139F0A0

# 默认 dev 公钥（04 + x + y），来自 blade.auth.public-key。可用 --pub / 环境变量 BLADE_SM2_PUB 覆盖。
PUB = "04ac02fe94f4cac62a57a2335cc96a075a1ee41cea3b211bd7acbb9cf579b7e601b9ece2b0cfab64dca268b6942bf556af67cfe226a5cf28d936039c43e4bb12c1"
# 与上面公钥配对的 dev 私钥，仅用于 selftest 的加解密回路自测。
_PRIV = int("00ac7fde22ecf5a764ea69b7ca8205383d98e7459e765bc1bd092f62c5f85267f9", 16)


def inv(x, m):
    return pow(x, m - 2, m)


def ec_add(Pp, Qq):
    if Pp is None:
        return Qq
    if Qq is None:
        return Pp
    x1, y1 = Pp
    x2, y2 = Qq
    if x1 == x2 and (y1 + y2) % P == 0:
        return None
    if Pp == Qq:
        lam = (3 * x1 * x1 + A) * inv((2 * y1) % P, P) % P
    else:
        lam = (y2 - y1) * inv((x2 - x1) % P, P) % P
    x3 = (lam * lam - x1 - x2) % P
    y3 = (lam * (x1 - x3) - y1) % P
    return (x3, y3)


def ec_mul(k, Pp):
    R = None
    while k:
        if k & 1:
            R = ec_add(R, Pp)
        Pp = ec_add(Pp, Pp)
        k >>= 1
    return R


# ---------- SM3 ----------
IV = [0x7380166F, 0x4914B2B9, 0x172442D7, 0xDA8A0600,
      0xA96F30BC, 0x163138AA, 0xE38DEE4D, 0xB0FB0E4E]


def rotl(x, k):
    k &= 31
    return ((x << k) | (x >> (32 - k))) & 0xFFFFFFFF


def P0(X):
    return X ^ rotl(X, 9) ^ rotl(X, 17)


def P1(X):
    return X ^ rotl(X, 15) ^ rotl(X, 23)


def FF(X, Y, Z, j):
    if j <= 15:
        return X ^ Y ^ Z
    return (X & Y) | (X & Z) | (Y & Z)


def GG(X, Y, Z, j):
    if j <= 15:
        return X ^ Y ^ Z
    return (X & Y) | ((~X & 0xFFFFFFFF) & Z)


def _ext(B):
    # 注意：曾误写成 B[i:i+4]（滑动窗口），导致 W[1..15] 错位重叠、SM3 在非零消息上全错。
    # 正确应为非重叠的 B[i*4:i*4+4]。
    W = [int.from_bytes(B[i * 4:i * 4 + 4], 'big') for i in range(16)]
    for j in range(16, 68):
        W.append((P1(W[j - 16] ^ W[j - 9] ^ rotl(W[j - 3], 15))
                  ^ rotl(W[j - 13], 7) ^ W[j - 6]) & 0xFFFFFFFF)
    return W, [W[j] ^ W[j + 4] for j in range(64)]


def _cf(V, B):
    W, W2 = _ext(B)
    A, Bc, C, D, E, F, G, H = V
    for j in range(64):
        Tj = 0x79CC4519 if j <= 15 else 0x7A879D8A
        SS1 = rotl((rotl(A, 12) + E + rotl(Tj, j)) & 0xFFFFFFFF, 7)
        SS2 = SS1 ^ rotl(A, 12)
        TT1 = (FF(A, Bc, C, j) + D + SS2 + W2[j]) & 0xFFFFFFFF
        TT2 = (GG(E, F, G, j) + H + SS1 + W[j]) & 0xFFFFFFFF
        D = C
        C = rotl(Bc, 9)
        Bc = A
        A = TT1
        H = G
        G = rotl(F, 19)
        F = E
        E = P0(TT2)
    return [A ^ V[0], Bc ^ V[1], C ^ V[2], D ^ V[3],
            E ^ V[4], F ^ V[5], G ^ V[6], H ^ V[7]]


def sm3(data: bytes) -> bytes:
    l = len(data)
    padded = data + b'\x80'
    while len(padded) % 64 != 56:
        padded += b'\x00'
    padded += struct.pack('>Q', l * 8)
    V = IV[:]
    for i in range(0, len(padded), 64):
        V = _cf(V, padded[i:i + 64])
    return b''.join(struct.pack('>I', x) for x in V)


def kdf(z: bytes, klen: int) -> bytes:
    out, ct = b'', 1
    while len(out) < klen:
        out += sm3(z + struct.pack('>I', ct))
        ct += 1
    return out[:klen]


def sm2_decrypt(priv_int, cipher_hex, mode='C1C2C3'):
    c = bytes.fromhex(cipher_hex)
    C1 = c[:65]
    rest = c[65:]
    x1 = int.from_bytes(C1[1:33], 'big')
    y1 = int.from_bytes(C1[33:65], 'big')
    if mode == 'C1C3C2':
        C3 = rest[:32]
        C2 = rest[32:]
    else:
        C2 = rest[:-32]
        C3 = rest[-32:]
    S = ec_mul(priv_int, (x1, y1))
    x2b = S[0].to_bytes(32, 'big')
    y2b = S[1].to_bytes(32, 'big')
    t = kdf(x2b + y2b, len(C2))
    M = bytes(cc ^ tt for cc, tt in zip(C2, t))
    assert C3 == sm3(x2b + M + y2b), "C3 mismatch"
    return M


def sm2_encrypt(pub_hex, msg: bytes, mode='C1C2C3'):
    # blade-core SM2Util 默认 C1C2C3（C3 在末尾），保持一致。
    x = int(pub_hex[2:66], 16)
    y = int(pub_hex[66:130], 16)
    Pp = (x, y)
    k = random.randrange(1, N)
    C1 = ec_mul(k, (GX, GY))
    S = ec_mul(k, Pp)
    x2b = S[0].to_bytes(32, 'big')
    y2b = S[1].to_bytes(32, 'big')
    t = kdf(x2b + y2b, len(msg))
    C2 = bytes(m ^ tt for m, tt in zip(msg, t))
    C3 = sm3(x2b + msg + y2b)
    C1b = b'\x04' + C1[0].to_bytes(32, 'big') + C1[1].to_bytes(32, 'big')
    if mode == 'C1C3C2':
        return (C1b + C3 + C2).hex()
    return (C1b + C2 + C3).hex()


# ---------- 登录 ----------
def selftest():
    assert sm3(b"abc").hex() == "66c7f0f462eeedd9d1f2d46bdc10e4e24167c4875cf2f7a2297da02b8f4ba8e0", "SM3(abc) fail"
    assert sm3(b"").hex() == "1ab21d8355cfa17f8e61194831e81a8f22bec8c728fefb747ed035eb5082aa2b", "SM3('') fail"
    x, y = int(PUB[2:66], 16), int(PUB[66:130], 16)
    assert (y * y - (x * x * x + A * x + B)) % P == 0, "pub not on curve"
    assert ec_mul(N, (GX, GY)) is None, "n*G should be infinity"
    for mode in ("C1C3C2", "C1C2C3"):
        ct = sm2_encrypt(PUB, b"admin", mode)
        pt = sm2_decrypt(_PRIV, ct, mode)
        assert pt == b"admin", f"roundtrip fail {mode}"
    print("[sm2_auth.selftest] SM3/曲线/回路 全部通过")


def _http(method, url, data=None, headers=None):
    if isinstance(data, (dict, list)):
        data = json.dumps(data).encode()
        if headers is None:
            headers = {}
        headers.setdefault("Content-Type", "application/json")
    elif isinstance(data, str):
        data = data.encode()
    r = urllib.request.Request(url, data=data, method=method)
    if headers:
        for k, v in headers.items():
            r.add_header(k, v)
    try:
        resp = urllib.request.urlopen(r, timeout=30)
        return resp.status, resp.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')


def get_token(pub_hex=None, account="admin", password="ant.design", tenant="000000",
              user_type="web", gateway="http://localhost:81",
              client_id="sword", client_secret="sword_secret", scope="all"):
    """用 SM2(C1C2C3) 加密密码，向 /blade-auth/token 换取 accessToken。失败返回 None。"""
    pub_hex = pub_hex or PUB
    basic = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    cipher = sm2_encrypt(pub_hex, password.encode(), "C1C2C3")
    body = ("grantType=password&tenantId=%s&account=%s&password=%s&scope=%s&userType=%s"
            % (tenant, account, cipher, scope, user_type))
    h = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Tenant-Id": tenant,
        "Authorization": "Basic " + basic,
    }
    st, txt = _http("POST", gateway + "/blade-auth/token", data=body, headers=h)
    try:
        j = json.loads(txt)
        data = j.get("data") or {}
        tok = data.get("accessToken") or data.get("access_token")
    except Exception:
        tok = None
    if tok:
        return tok
    print(f"[get_token] 失败 HTTP {st}: {txt[:200]}")
    return None


if __name__ == "__main__":
    selftest()
    tok = get_token()
    if tok:
        print("登录成功, accessToken 前40位:", tok[:40])
    else:
        print("登录失败")
