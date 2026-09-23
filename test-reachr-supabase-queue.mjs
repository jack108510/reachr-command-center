import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql=fs.readFileSync(new URL('./supabase/migrations/20260922_reachr_private_queue.sql',import.meta.url),'utf8');
test('browser roles cannot approve or mark messages sent until verified worker exists',()=>{
 assert.match(sql,/revoke all on function public\.reachr_approve_draft\(uuid\) from public, anon, authenticated;/i);
 assert.doesNotMatch(sql,/grant execute on function public\.reachr_approve_draft\(uuid\) to authenticated;/i);
});
