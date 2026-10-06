// Concatenates supabase/migrations/*.sql into supabase/setup.sql (one file to paste into the SQL Editor).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, '..', 'supabase', 'migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const header = `-- 독서의숲 Supabase 전체 설정 (자동 생성: npm run build:sql)
-- 새 프로젝트의 SQL Editor에 통째로 붙여넣고 Run 하세요. 포함된 마이그레이션: ${files.join(', ')}
-- 이미 일부를 적용했다면 아직 적용하지 않은 supabase/migrations/*.sql 파일만 실행하세요.
`;
const body = files.map((f) => `\n-- ═══════════════ ${f} ═══════════════\n${readFileSync(join(dir, f), 'utf8').trim()}\n`).join('');
writeFileSync(join(dir, '..', 'setup.sql'), header + body);
console.log(`supabase/setup.sql ← ${files.join(', ')}`);
