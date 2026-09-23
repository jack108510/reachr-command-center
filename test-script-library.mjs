import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql=fs.readFileSync(new URL('./supabase/migrations/20260923_reachr_script_library.sql',import.meta.url),'utf8');

test('script library is private, editable only by the operator, and starts with the agreed script',()=>{
 assert.match(sql,/alter table public\.reachr_script_templates enable row level security;/i);
 assert.match(sql,/revoke all on public\.reachr_script_templates from public, anon, authenticated;/i);
 assert.match(sql,/grant update \(title, category, body, is_active\)/i);
 assert.match(sql,/created_by = auth\.uid\(\)/i);
 assert.match(sql,/on conflict \(id\) do nothing;/i);
 for(const placeholder of ['[specific offer you actually saw]','[area]','[time]','[business]']) assert.ok(sql.includes(placeholder));
});
