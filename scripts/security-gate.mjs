// 泛微E9 落地护栏 CI 门禁（ant-design-pro 前端）
// 对应《泛微E9风险-SpringBlade落地护栏清单》§5：token/密钥进 URL、可枚举文件 id 进 URL
// 用法：node scripts/security-gate.mjs   （CI 中非零退出即阻断）
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');
const violations = [];

// 白名单：WebSocket 握手透传 JWT（WS 无法设 header，标准做法且已 encodeURIComponent）
const ALLOW_FILES = [/messageSocket\.ts$/];

const PATTERNS = [
  { id: 'token-in-url', re: /[?&]token=/i },
  { id: 'secret-in-url', re: /[?&](secret|password|apikey|access[_-]?token)=/i },
  { id: 'imagefileid-in-url', re: /imagefileid=/i },
  { id: 'fileid-sequential-in-url', re: /[?&]fileid=\d+/i },
];

function scan(file) {
  if (ALLOW_FILES.some((re) => re.test(file))) return;
  const text = readFileSync(file, 'utf8');
  text.split('\n').forEach((line, i) => {
    for (const { id, re } of PATTERNS) {
      if (re.test(line)) violations.push({ file, line: i + 1, id, text: line.trim() });
    }
  });
}

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.umi' || name === 'dist') continue;
      walk(p);
    } else if (/\.(ts|tsx)$/.test(name)) {
      scan(p);
    }
  }
}

walk(ROOT);

if (violations.length) {
  console.error('SECURITY GATE FAILED (frontend):');
  for (const v of violations) console.error(`  [${v.id}] ${v.file}:${v.line}  ${v.text}`);
  process.exit(1);
}
console.log('SECURITY GATE PASSED (frontend)');
