import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsScreen } from '@/components/SettingsScreen';
import { DEFAULT_SETTINGS } from '@/types/match';

function renderSettings() {
  const onUpdateCalendarSettings = vi.fn();
  render(
    <SettingsScreen
      settings={{ ...DEFAULT_SETTINGS }}
      onBack={vi.fn()}
      onUpdateTeamName={vi.fn()}
      onUpdateCalendarSettings={onUpdateCalendarSettings}
      onAddPlayer={vi.fn()}
      onRemovePlayer={vi.fn()}
      onUpdatePeriods={vi.fn()}
      onUpdateSyncToken={vi.fn()}
      onUpdateTheme={vi.fn()}
      onUpdateDebug={vi.fn()}
      onExportBackup={vi.fn()}
      onImportBackup={vi.fn()}
    />,
  );
  return onUpdateCalendarSettings;
}

describe('SettingsScreen calendar settings', () => {
  it('saves the URL and calendar team name on blur', () => {
    const onUpdateCalendarSettings = renderSettings();

    fireEvent.change(screen.getByPlaceholderText('Paste ProSoccerData subscription URL'), {
      target: { value: 'https://club.prosoccerdata.com/api/v2/members/ics/file?id=1&uuid=x' },
    });
    fireEvent.change(screen.getByPlaceholderText('Detected automatically, for example IPU15'), {
      target: { value: 'IPU15' },
    });
    fireEvent.blur(screen.getByPlaceholderText('Detected automatically, for example IPU15'));

    expect(onUpdateCalendarSettings).toHaveBeenCalledWith(
      'https://club.prosoccerdata.com/api/v2/members/ics/file?id=1&uuid=x',
      'IPU15',
    );
  });
});
