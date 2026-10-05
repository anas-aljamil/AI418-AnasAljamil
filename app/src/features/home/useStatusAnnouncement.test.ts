import i18n, { resources } from '@/i18n';
import type { ProfessorSummary } from '@/api/types';
import { describeChanges } from './useStatusAnnouncement';

const professor = (id: number, status: ProfessorSummary['status']['status'], confirmed = true) =>
  ({
    professor_id: id,
    full_name_ar: 'نورة الحربي',
    full_name_en: 'Noura Al-Harbi',
    honorific: 'dr',
    status: { status, confirmed, source: 'override', note: null, until: null, updated_at: null },
  }) as ProfessorSummary;

beforeAll(async () => {
  if (!i18n.isInitialized) await i18n.init({ resources, lng: 'en', fallbackLng: 'en' });
});

describe('status change announcements', () => {
  it('says nothing on the first load or when nothing changed', () => {
    expect(describeChanges(undefined, [professor(1, 'away')], 'en', i18n.t)).toBe('');
    expect(describeChanges([professor(1, 'away')], [professor(1, 'away')], 'en', i18n.t)).toBe('');
  });

  it('names the professor and the new status', () => {
    expect(describeChanges([professor(1, 'away')], [professor(1, 'in_office')], 'en', i18n.t)).toBe(
      'Dr. Noura Al-Harbi is now In office',
    );
    expect(
      describeChanges(
        [professor(1, 'in_office')],
        [professor(1, 'in_office', false)],
        'en',
        i18n.t,
      ),
    ).toBe('Dr. Noura Al-Harbi is now In office (not confirmed)');
  });

  it('does not announce a professor who was just pinned', () => {
    expect(describeChanges([], [professor(2, 'busy')], 'en', i18n.t)).toBe('');
  });
});
