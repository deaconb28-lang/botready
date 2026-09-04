'use client';

import { useState } from 'react';

import { Toggle } from '@/components/Toggle';
import { cx } from '@/components/ui';
import { SETTING_ROWS, type UserSettings } from '@/lib/settings';

/**
 * The four toggles. Optimistic: the switch moves at once and reverts with a
 * sentence if the save fails, because a toggle that waits on a round trip
 * feels broken.
 */
export function SettingsToggles({ initial }: { initial: UserSettings }) {
  const [settings, setSettings] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<keyof UserSettings | null>(null);

  async function change(key: keyof UserSettings, next: boolean) {
    const before = settings;
    setSettings({ ...settings, [key]: next });
    setSaving(key);
    setError(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ [key]: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setSettings(before);
        setError(body.error ?? `The setting did not save (HTTP ${res.status}). Try again.`);
      }
    } catch {
      setSettings(before);
      setError('The setting did not reach us. Check your connection and try again.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="max-w-[680px]">
      <div className="edge overflow-hidden rounded-[14px] bg-white shadow-hard-4">
        {SETTING_ROWS.map((row, i) => (
          <div key={row.key} className={cx('flex items-center gap-4 px-5 py-[18px]', i < SETTING_ROWS.length - 1 && 'border-b-2 border-rule')}>
            <div className="min-w-0 flex-1">
              <div className="font-body text-[15px] font-semibold">{row.label}</div>
              <div className="mt-[3px] text-[13.5px] leading-[1.45] text-quiet">{row.help}</div>
            </div>
            <Toggle on={settings[row.key]} onChange={(next) => change(row.key, next)} label={row.label} disabled={saving === row.key} />
          </div>
        ))}
      </div>
      {error ? (
        <p role="alert" className="mt-3 font-mono text-[12.5px] font-medium text-coral-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
