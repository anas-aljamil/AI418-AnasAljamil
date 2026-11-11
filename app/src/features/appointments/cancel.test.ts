import type { Appointment } from '@/api/types';
import { cancelState } from './AppointmentCard';

const appointment = (status: Appointment['status']) =>
  ({ status, cancel_deadline: '2026-10-11T06:30:00Z' }) as Appointment;

describe('cancellation window (until 1 hour before the start)', () => {
  it('is open before the deadline and closed from the deadline on', () => {
    expect(cancelState(appointment('pending'), new Date('2026-10-11T06:29:59Z'))).toBe('open');
    expect(cancelState(appointment('approved'), new Date('2026-10-11T06:30:00Z'))).toBe('closed');
  });

  it('does not apply to declined, cancelled or finished appointments', () => {
    for (const status of ['declined', 'cancelled', 'completed', 'no_show'] as const) {
      expect(cancelState(appointment(status), new Date('2026-10-01T00:00:00Z'))).toBe('none');
    }
  });
});
