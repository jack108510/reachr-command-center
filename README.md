# Reachr Command Center

Public, privacy-safe dashboard showing aggregate Messenger outreach totals. It intentionally excludes prospect names, source evidence, message content, and local paths.

## Supabase inbox

Apply `supabase/migrations/20260922_reachr_private_queue.sql` to the Supabase project before publishing the inbox change. The private Messenger desk then reads `reachr_conversations` and `reachr_messages` through the signed-in user's RLS permissions and stores manual drafts in `reachr_reply_jobs`. New tables start empty; this change does not import earlier Messenger history or send messages. The Overview reads a live Supabase summary of stored messages. Contacts / CRM reads `reachr_contacts` and `reachr_contact_events` in Supabase. Apply `supabase/migrations/20260923_reachr_live_dashboard.sql` before publishing this change. The new CRM starts empty; existing contacts are not migrated. The site does not sync Messenger automatically.
