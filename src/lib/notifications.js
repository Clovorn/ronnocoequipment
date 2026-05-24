/**
 * Notifications client (v32).
 *
 * Talks to the pipeline DB's `notifications` table directly via the
 * existing dealPipeline Supabase client. The Deal Builder is already
 * configured to talk to both Supabase projects, and notifications live
 * on the pipeline side because their primary writer is a trigger on
 * pipeline `deals` updates.
 *
 * Recipient is identified by email. The current `auth.uid()` lives on
 * the catalog DB, not pipeline, so we don't try to enforce server-side
 * scoping — we just pass the rep's email as a filter on every call.
 * (This matches the existing pattern in fetchMyDeals — see Section 6,
 * open item #5 in the v32 state-of-union for the broader RLS hardening
 * conversation.)
 *
 * Polling: the bell component polls every 60s. Lightweight — one count
 * query against an indexed partial. No realtime subscription for now
 * (could be a future optimization).
 */
import { dealPipeline, isDealPipelineConfigured } from './dealPipeline.js';

const PAGE_SIZE = 25;

/**
 * Fetch the latest N notifications for one rep. Sorted newest-first.
 */
export async function fetchNotifications(recipientEmail, { limit = PAGE_SIZE } = {}) {
  if (!isDealPipelineConfigured || !dealPipeline) {
    return { data: [], error: { message: 'Deal pipeline not configured.' } };
  }
  if (!recipientEmail) {
    return { data: [], error: null };
  }
  const { data, error } = await dealPipeline
    .from('notifications')
    .select('id, deal_id, kind, title, body, link_path, is_read, created_at, read_at, created_by')
    .eq('recipient_email', recipientEmail)
    .order('created_at', { ascending: false })
    .limit(limit);
  return { data: data || [], error };
}

/**
 * Cheap unread-count query. Uses the partial index on
 * (recipient_email) WHERE is_read = false.
 */
export async function fetchUnreadCount(recipientEmail) {
  if (!isDealPipelineConfigured || !dealPipeline || !recipientEmail) {
    return { count: 0, error: null };
  }
  const { count, error } = await dealPipeline
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_email', recipientEmail)
    .eq('is_read', false);
  return { count: count || 0, error };
}

/**
 * Mark a single notification read. No-op if it's already read.
 */
export async function markNotificationRead(notificationId) {
  if (!isDealPipelineConfigured || !dealPipeline) {
    return { error: { message: 'Deal pipeline not configured.' } };
  }
  const { error } = await dealPipeline
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('is_read', false);
  return { error };
}

/**
 * Mark all notifications for one rep as read. Bulk dropdown action.
 */
export async function markAllNotificationsRead(recipientEmail) {
  if (!isDealPipelineConfigured || !dealPipeline || !recipientEmail) {
    return { error: null };
  }
  const { error } = await dealPipeline
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('recipient_email', recipientEmail)
    .eq('is_read', false);
  return { error };
}

/* ─────────────────────── Email preference (team_members) ─────────────────────── */

/**
 * Fetch the rep's current email_notifications_enabled flag from the pipeline
 * DB's team_members table. Returns true when no row is found — emails are
 * the default-on state, and reps without a team_members row (newer users
 * who weren't migrated from the legacy Jotform notification list) still
 * get emails by default.
 *
 * Pre-v32 the column didn't exist; the migration sets DEFAULT true so all
 * existing rows are opted in.
 */
export async function fetchEmailNotificationsEnabled(email) {
  if (!isDealPipelineConfigured || !dealPipeline || !email) {
    return { enabled: true, exists: false, error: null };
  }
  const { data, error } = await dealPipeline
    .from('team_members')
    .select('id, email_notifications_enabled')
    .eq('email', email)
    .maybeSingle();
  if (error) return { enabled: true, exists: false, error };
  if (!data) return { enabled: true, exists: false, error: null };
  return { enabled: !!data.email_notifications_enabled, exists: true, error: null };
}

/**
 * Toggle the rep's email_notifications_enabled flag.
 *
 * If the rep has no team_members row yet (newer hires not on the legacy
 * notification list), we insert one. The dashboard's email sender reads
 * this column before sending; the in-app bell is unaffected.
 *
 * `name` is used only on insert (for the team_members.name NOT NULL
 * column). On update we don't touch it.
 */
export async function setEmailNotificationsEnabled(email, enabled, displayName) {
  if (!isDealPipelineConfigured || !dealPipeline || !email) {
    return { error: { message: 'Deal pipeline not configured.' } };
  }

  // Try update first; if no row matches, insert.
  const { data: updated, error: updateErr } = await dealPipeline
    .from('team_members')
    .update({ email_notifications_enabled: enabled })
    .eq('email', email)
    .select('id')
    .maybeSingle();

  if (updateErr) return { error: updateErr };
  if (updated) return { error: null };

  // No row — insert one. Default role 'sales' since this is rep self-service.
  const { error: insertErr } = await dealPipeline
    .from('team_members')
    .insert({
      name:  displayName || email,
      email: email,
      role:  'sales',
      active: true,
      email_notifications_enabled: enabled,
    });

  return { error: insertErr };
}
