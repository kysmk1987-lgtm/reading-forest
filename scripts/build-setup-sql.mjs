// Concatenates supabase/migrations/*.sql into supabase/setup.sql (one file to paste into the SQL Editor),
// and writes supabase/setup_<NNNN>.sql for each migration after the first (incremental paste for existing projects).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, '..', 'supabase', 'migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const header = `-- 독서의숲 Supabase 전체 설정 (자동 생성: npm run build:sql)
-- 새 프로젝트의 SQL Editor에 통째로 붙여넣고 Run 하세요. 포함된 마이그레이션: ${files.join(', ')}
-- 이미 일부를 적용했다면 아직 적용하지 않은 supabase/setup_<번호>.sql 파일만 실행하세요.
`;
const body = files.map((f) => `\n-- ═══════════════ ${f} ═══════════════\n${readFileSync(join(dir, f), 'utf8').trim()}\n`).join('');
writeFileSync(join(dir, '..', 'setup.sql'), header + body);
console.log(`supabase/setup.sql ← ${files.join(', ')}`);

for (const f of files.slice(2)) {
  const num = f.slice(0, 4);
  const out = `-- 독서의숲 증분 설정 ${f} (자동 생성: npm run build:sql)
-- 이미 setup.sql(0001·0002)을 실행한 프로젝트라면 이 파일만 SQL Editor에 붙여넣고 Run 하세요. 한 번만 실행합니다.

${readFileSync(join(dir, f), 'utf8').trim()}
`;
  writeFileSync(join(dir, '..', `setup_${num}.sql`), out);
  console.log(`supabase/setup_${num}.sql ← ${f}`);
}
