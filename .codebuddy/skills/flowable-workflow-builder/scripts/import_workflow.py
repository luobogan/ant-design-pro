#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把本地生成的 BPMN 文件导入运行中的 springblade 工作流服务，并做"重复导入幂等"回归。

用法:
  python import_workflow.py <path-to-.bpmn20.xml> [--repeats 3] [--name 流程名]
                           [--gateway http://localhost:81] [--pub <sm2公钥>]
                           [--account admin] [--password ant.design] [--tenant 000000]

依赖: 同目录下的 sm2_auth.py（SM2 登录取 token）。

说明:
- 导入接口 POST /blade-workflow/definition/import，JSON 体 {"name":..., "bpmnXml":<原文或base64>}。
  bpmnXml 可接受原文，服务端会识别；这里直接传原文。
- 幂等回归: 连续导入同一 processKey 多次，每次都应 200。后端 importNewDefinition 在 insert
  前会物理删除同 procKey+version=1 的旧行（含逻辑删除的幽灵行），故不会撞唯一键。
  若后端未修复，第 2 次必 500（唯一键冲突）。
"""
import argparse, json, os, sys, urllib.request, urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sm2_auth import get_token, selftest  # noqa: E402


def _http(method, url, data=None, headers=None):
    if isinstance(data, (dict, list)):
        data = json.dumps(data).encode()
    r = urllib.request.Request(url, data=data, method=method)
    if headers:
        for k, v in headers.items():
            r.add_header(k, v)
    try:
        resp = urllib.request.urlopen(r, timeout=30)
        return resp.status, resp.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("bpmn", help=".bpmn20.xml 文件路径")
    ap.add_argument("--repeats", type=int, default=3, help="重复导入次数（幂等回归），默认3")
    ap.add_argument("--name", default=None, help="流程名称，缺省回退为 BPMN process id")
    ap.add_argument("--gateway", default="http://localhost:81")
    ap.add_argument("--pub", default=None, help="SM2 公钥，缺省用 dev 默认")
    ap.add_argument("--account", default="admin")
    ap.add_argument("--password", default="ant.design")
    ap.add_argument("--tenant", default="000000")
    args = ap.parse_args()

    selftest()

    with open(args.bpmn, encoding="utf-8") as f:
        bpmn = f.read()
    body = {"name": args.name or "", "bpmnXml": bpmn}

    tok = get_token(pub_hex=args.pub, account=args.account, password=args.password,
                    tenant=args.tenant, gateway=args.gateway)
    if not tok:
        print("无法获取 token，导入终止")
        sys.exit(1)

    h = {"Blade-Auth": "bearer " + tok, "Tenant-Id": args.tenant,
         "Content-Type": "application/json"}
    ok = True
    for i in range(1, args.repeats + 1):
        st, txt = _http("POST", args.gateway + "/blade-workflow/definition/import",
                        data=body, headers=h)
        print(f"\nIMPORT #{i}: HTTP {st}")
        print("  ", txt[:400])
        if st != 200:
            ok = False
            print("  >>> 非 200，导入/修复异常")
            break
        try:
            j = json.loads(txt)
            code = j.get("code")
            msg = j.get("msg")
            def_id = str(j.get("data"))[:40]
            print(f"  >>> code={code} msg={msg} data(defId)={def_id}")
            if code not in (200, 0, None):
                ok = False
                print("  >>> 业务返回非成功")
                break
        except Exception:
            pass

    print("\n[结果]", "幂等导入全部成功 OK" if ok else "存在失败 FAIL")


if __name__ == "__main__":
    main()
