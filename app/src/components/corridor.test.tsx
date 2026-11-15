import { fireEvent, screen } from '@testing-library/react-native';
import { initReactI18next } from 'react-i18next';

import type { Block, ProfessorStatus } from '@/api/types';
import i18n, { resources } from '@/i18n';
import { renderWithProviders } from '@/test-utils';
import { Corridor, CorridorDoor } from './Corridor';
import { DayRibbon } from './DayRibbon';
import { statusSentence } from './StatusLabel';
import { TallDoor } from './TallDoor';

// Monday 10:00 AM in Riyadh.
const now = new Date('2026-10-05T07:00:00Z');
const status = (rest: Partial<ProfessorStatus>): ProfessorStatus => ({
  status: 'in_office',
  confirmed: true,
  source: 'schedule',
  note: null,
  until: null,
  updated_at: null,
  ...rest,
});

describe('statusSentence', () => {
  // No screen is rendered here, so the strings are loaded directly.
  beforeAll(async () => {
    if (i18n.isInitialized) await i18n.changeLanguage('en');
    else await i18n.use(initReactI18next).init({ resources, lng: 'en', fallbackLng: 'en' });
  });
  const sentence = (rest: Partial<ProfessorStatus>) =>
    statusSentence(status(rest), now, 'en', i18n.t);

  it('says when the status is expected to change', () => {
    expect(sentence({ until: '2026-10-05T09:00:00Z' }).sentence).toBe('In office until 12:00 PM');
    expect(sentence({ status: 'in_class', until: '2026-10-05T08:00:00Z' }).sentence).toBe(
      'In class until 11:00 AM',
    );
  });

  it('reads an away status without a return time as the rest of the day', () => {
    expect(sentence({ status: 'away', until: '2026-10-05T21:00:00Z' }).sentence).toBe(
      'Away for the rest of today',
    );
  });

  it('is the label alone when the API gives no time, or a time already past', () => {
    expect(sentence({ status: 'away' })).toMatchObject({ sentence: 'Away', when: null });
    expect(sentence({ status: 'busy', until: '2026-10-05T06:59:00Z' }).sentence).toBe('Busy');
  });

  it('gives a not-confirmed status its age and the dashed door, not an end time', () => {
    expect(
      sentence({
        confirmed: false,
        until: '2026-10-05T09:00:00Z',
        updated_at: '2026-10-05T02:00:00Z',
      }),
    ).toMatchObject({
      door: 'unknown',
      sentence: 'In office (not confirmed) updated 5 hours ago',
    });
    expect(sentence({ status: 'unknown', confirmed: false })).toMatchObject({
      door: 'unknown',
      sentence: 'Not confirmed',
    });
  });
});

describe('TallDoor', () => {
  it('is announced only when it stands alone', async () => {
    await renderWithProviders(<TallDoor status="busy" accessibilityLabel="Status: Busy" />);
    expect(screen.getByRole('image', { name: 'Status: Busy' })).toBeOnTheScreen();
  });

  it('is one and a half times as tall as it is wide, and mirrors for Arabic', async () => {
    await renderWithProviders(
      <TallDoor status="in_office" size={80} accessibilityLabel="الحالة: في المكتب" />,
      'ar',
    );
    expect(screen.getByRole('image')).toHaveStyle({
      width: 80,
      height: 120,
      transform: [{ scaleX: -1 }],
    });
  });
});

describe('Corridor', () => {
  it('names each door with the professor, the status and when it changes', async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <Corridor>
        <CorridorDoor
          name="Dr. Noura"
          status={status({ until: '2026-10-05T09:00:00Z' })}
          now={now}
          onPress={onPress}
        />
        <CorridorDoor name="Dr. Huda" status={status({ status: 'away' })} now={now} />
      </Corridor>,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Dr. Noura, In office, until 12:00 PM' }),
    );
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Dr. Huda, Away')).toBeOnTheScreen();
  });
});

describe('DayRibbon', () => {
  const block = (block_id: number, kind: Block['kind'], start: string, end: string): Block => ({
    block_id,
    kind,
    start_time: start,
    end_time: end,
    label: null,
    day_of_week: 1,
    on_date: null,
    ends_on: null,
    skipped_dates: [],
  });

  it('reads the day as one sentence, in time order, and names the kinds shown', async () => {
    await renderWithProviders(
      <DayRibbon
        blocks={[block(2, 'office_hours', '09:30', '12:00'), block(1, 'class', '08:00', '09:00')]}
        now="10:00"
      />,
    );
    expect(
      screen.getByRole('image', {
        name: 'Today, 8:00 AM–9:00 AM, Class, 9:30 AM–12:00 PM, Office hours, Now 10:00 AM',
      }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Office hours')).toBeOnTheScreen();
    expect(screen.getByText('Class')).toBeOnTheScreen();
    expect(screen.queryByText('Meeting')).toBeNull();
  });

  it('widens past 8 AM to 5 PM for a late block', async () => {
    await renderWithProviders(
      <DayRibbon blocks={[block(1, 'class', '17:30', '19:00')]} now="10:00" />,
    );
    // The hour labels are hidden from screen readers: the ribbon's own sentence has the times.
    expect(screen.getByText('6 PM', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('says so when the day is empty', async () => {
    await renderWithProviders(<DayRibbon blocks={[]} now="10:00" />);
    expect(
      screen.getByRole('image', {
        name: 'Today, No office hours or classes today., Now 10:00 AM',
      }),
    ).toBeOnTheScreen();
  });
});
