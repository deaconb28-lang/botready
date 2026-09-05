/**
 * The four toggles. One row per person, created on first read with the
 * defaults, so the account and the app can always render a complete set.
 */

import { serviceClient } from './supabase';

export interface UserSettings {
  weeklyRescan: boolean;
  alertOnDrop: boolean;
  monthlyDigest: boolean;
  showInIndex: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  weeklyRescan: true,
  alertOnDrop: true,
  monthlyDigest: false,
  showInIndex: true,
};

export const SETTING_ROWS: Array<{ key: keyof UserSettings; label: string; help: string }> = [
  { key: 'weeklyRescan', label: 'Weekly re-scan', help: 'Every Monday, 6am in your timezone.' },
  { key: 'alertOnDrop', label: 'Alert me on any drop', help: 'A new refusal, or any category losing points.' },
  { key: 'monthlyDigest', label: 'Monthly digest email', help: 'One summary of every domain you watch.' },
  { key: 'showInIndex', label: 'Show my score in the public index', help: 'Your result page is public either way; this only affects the ranking list.' },
];

export async function getSettings(userId: string): Promise<UserSettings> {
  const { data, error } = await serviceClient().from('user_settings').select('*').eq('user_id', userId).maybeSingle();
  // Reading falls back to the defaults, which is the right degrade: the page
  // renders a complete set of toggles either way. But a failure here is never
  // normal, so it goes in the log rather than passing silently.
  if (error) console.error('[settings] read failed', { userId, code: error.code, message: error.message });
  if (!data) return DEFAULT_SETTINGS;
  const row = data as Record<string, boolean>;
  return {
    weeklyRescan: row.weekly_rescan ?? DEFAULT_SETTINGS.weeklyRescan,
    alertOnDrop: row.alert_on_drop ?? DEFAULT_SETTINGS.alertOnDrop,
    monthlyDigest: row.monthly_digest ?? DEFAULT_SETTINGS.monthlyDigest,
    showInIndex: row.show_in_index ?? DEFAULT_SETTINGS.showInIndex,
  };
}

export async function updateSettings(userId: string, patch: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getSettings(userId);
  const next = { ...current, ...patch };
  const { error } = await serviceClient()
    .from('user_settings')
    .upsert(
      {
        user_id: userId,
        weekly_rescan: next.weeklyRescan,
        alert_on_drop: next.alertOnDrop,
        monthly_digest: next.monthlyDigest,
        show_in_index: next.showInIndex,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
  if (error) {
    // The raw PostgREST message is a sentence about our schema cache. It named
    // a table and an internal mechanism in a toggle's help text, which tells
    // the person nothing they can act on. It goes to the log, where somebody
    // can act on it, and the reader gets what actually happened to them.
    console.error('[settings] save failed', { userId, code: error.code, message: error.message });
    throw new Error('We could not save that, so nothing changed.');
  }
  return next;
}
