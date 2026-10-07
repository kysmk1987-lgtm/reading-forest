// Pushes the Korean auth e-mail subjects + templates (supabase/templates) to the hosted project via the
// Supabase Management API. Touches ONLY mailer_subjects_{confirmation,recovery} and
// mailer_templates_{confirmation,recovery}_content — never SMTP, rate limits or other auth settings.
//
//   $env:SUPABASE_ACCESS_TOKEN = '<personal access token from supabase.com/dashboard/account/tokens>'
//   node scripts/apply-auth-templates.mjs            # dry run: shows what would be sent
//   node scripts/apply-auth-templates.mjs --apply    # sends it
import { readFileSync } from 'node:fs';

const REF = process.env.SUPABASE_PROJECT_REF ?? 'ucftmqkmjwwasknanimz';
const dir = new URL('../supabase/templates/', import.meta.url);
const read = (name) => readFileSync(new URL(name, dir), 'utf8');
const subjects = JSON.parse(read('subjects.json'));

const body = {
  mailer_subjects_confirmation: subjects.confirmation,
  mailer_subjects_recovery: subjects.recovery,
  mailer_templates_confirmation_content: read('confirmation.html'),
  mailer_templates_recovery_content: read('recovery.html'),
};

console.log(`project ${REF}`);
for (const [key, value] of Object.entries(body)) console.log(`  ${key}: ${key.includes('subjects') ? value : `${value.length} chars`}`);

if (!process.argv.includes('--apply')) {
  console.log('\nDry run. Add --apply to send.');
  process.exit(0);
}
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN is not set.');
  process.exit(1);
}
const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, {
  method: 'PATCH',
  headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
if (!res.ok) {
  console.error(`Failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}
const config = await res.json();
console.log('\nApplied. Now on the project:');
for (const key of Object.keys(body)) console.log(`  ${key}: ${key.includes('subjects') ? config[key] : `${String(config[key] ?? '').length} chars`}`);
console.log(`  mailer_otp_exp (link lifetime, s): ${config.mailer_otp_exp}`);
console.log(`  smtp_sender_name: ${config.smtp_sender_name ?? '(none — built-in sender "Supabase Auth")'}`);
