# Reachr Command Center

Public, privacy-safe dashboard showing aggregate Messenger outreach totals. It intentionally excludes prospect names, source evidence, message content, and local paths.

## Supabase inbox

The private, read-only Messenger view reads `reachr_conversations` and `reachr_messages` through the signed-in user's RLS permissions. Its inbox lists only conversations with a stored inbound reply; opening one shows all stored inbound and outbound messages in order. It refreshes manually and every minute while visible. It does not send messages or create drafts. The Overview leads with stored replies, reply conversations, positive replies, and the latest reply; its 14-day chart shows inbound activity. Contacts / CRM reads `reachr_contacts` and `reachr_contact_events` in Supabase. Apply both migrations (`20260922_reachr_private_queue.sql`, then `20260923_reachr_live_dashboard.sql`) before importing. A September 2026 backfill used the private, evidence-backed ledger and partial Messenger-rendered archive, excluding Marketplace. The local verified CRM was separately migrated with its audit events. These are partial historical snapshots, not complete Messenger history or an automatic sync. Operators can open the exact live Messenger thread for current context.
