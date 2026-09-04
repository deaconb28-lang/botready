'use client';

import { useState } from 'react';

import { Toggle } from '@/components/Toggle';
import { ListRow } from '@/components/account/bits';
import { SETTING_ROWS, type UserSettings } from '@/lib/settings';

/**
 * The four toggles. Each flip is applied on screen at once and sent to
 * /api/settings; if the save fails the switch goes back and the row says so.
 */
export function SettingsForm({ initial }: { initial: UserSettings }) {
  const [settings, setSettings] = useState<UserSettings>(initial);
  const [saving, setSaving] = useState<keyof UserSettings | null>(null);
  const [error, setError] = useState<{ key: keyof UserSettings; text: string } | null>(null);

  async function flip(key: keyof UserSettings, next: boolean) {
    if (saving) return;
    const before = settings;
    setError(null);
    setSaving(key);
    setSettings({ ...before, [key]: next });

    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ [key]: next }),
      });
      const body = (await res.json().catch(() => ({}))) as Partial<UserSettings> & { error?: string };
      if (!res.ok) {
        setSettings(before);
        setError({ key, text: `${body.error ?? `The setting did not save (HTTP ${res.status}).`} Flip it again to retry.` });
        return;
      }
      setSettings({ ...before, [key]: next, ...body });
    } catch {
      setSettings(before);
      setError({ key, text: 'The request did not reach us. Check your connection and flip it again.' });
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="edge max-w-[700px] overflow-hidden rounded-[16px] bg-white shadow-hard-4">
      {SETTING_ROWS.map((row) => {
        const rowError = error?.key === row.key ? error.text : null;
        return (
          <ListRow key={row.key} className="px-5 py-[18px]">
            <div className="min-w-0 flex-1">
              <div id={`setting-${row.key}`} className="font-body text-[15px] font-semibold">
                {row.label}
              </div>
              <div className="mt-[3px] text-[13.5px] leading-[1.45] text-quiet">{row.help}</div>
              {rowError ? (
                <p role="alert" className="mt-2 font-mono text-[12.5px] font-medium text-coral-text">
                  {rowError}
                </p>
              ) : null}
            </div>
            <Toggle on={settings[row.key]} onChange={(next) => flip(row.key, next)} label={row.label} disabled={saving === row.key} />
          </ListRow>
        );
      })}
    </div>
  );
}
