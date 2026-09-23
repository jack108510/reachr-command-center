# Reachr Command Center

Public, privacy-safe dashboard showing aggregate Messenger outreach totals. It intentionally excludes prospect names, source evidence, message content, and local paths.

## Supabase inbox

The private Messenger desk reads `reachr_conversations` and `reachr_messages` through the signed-in user's RLS permissions and stores manual drafts in `reachr_reply_jobs`. The Overview reads a live Supabase summary of stored messages. Contacts / CRM reads `reachr_contacts` and `reachr_contact_events` in Supabase. Apply both migrations (`20260922_reachr_private_queue.sql`, then `20260923_reachr_live_dashboard.sql`) before importing. A September 2026 backfill used the private, evidence-backed ledger and partial Messenger-rendered archive, excluding Marketplace. The local verified CRM was separately migrated with its audit events. These are partial historical snapshots—not complete Messenger history, delivery receipts, or an automatic sync. Drafts never send automatically. Operators must inspect the exact live Messenger thread before replying.
