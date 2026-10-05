import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';
import { Button } from './Button';
import { Chip } from './Chip';
import { Door } from './Door';
import { EmptyState } from './Placeholders';
import { StatusLabel } from './StatusLabel';
import { TextField } from './TextField';

describe('Button', () => {
  it('is a labelled button that reports presses', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button label="Book 10:30" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button', { name: 'Book 10:30' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled and says so to screen readers', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button label="Book 10:30" onPress={onPress} disabled />);
    const button = screen.getByRole('button', { name: 'Book 10:30' });
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
  });
});

describe('Chip', () => {
  it('exposes its selected state', async () => {
    await renderWithProviders(<Chip label="Advising" selected />);
    expect(screen.getByRole('button', { name: 'Advising' })).toBeSelected();
  });
});

describe('TextField', () => {
  it('keeps a visible label, names the input and announces the error', async () => {
    await renderWithProviders(
      <TextField label="Note for students" error="Shorten the note to 60 characters." />,
    );
    expect(screen.getByText('Note for students')).toBeOnTheScreen();
    const input = screen.getByLabelText('Note for students');
    expect(input.props.accessibilityHint).toBe('Shorten the note to 60 characters.');
    expect(screen.getByText('Shorten the note to 60 characters.')).toBeOnTheScreen();
  });

  it('counts characters toward the limit', async () => {
    await renderWithProviders(<TextField label="Note" value="Back soon" maxLength={60} />);
    expect(screen.getByText('9/60')).toBeOnTheScreen();
  });
});

describe('Door', () => {
  it('is announced only when it stands alone', async () => {
    await renderWithProviders(<Door status="in_office" accessibilityLabel="Status: In office" />);
    expect(screen.getByRole('image', { name: 'Status: In office' })).toBeOnTheScreen();
  });

  it('mirrors its drawing for Arabic so the hinge stays on the start edge', async () => {
    await renderWithProviders(<Door status="busy" accessibilityLabel="الحالة: مشغول" />, 'ar');
    expect(screen.getByRole('image')).toHaveStyle({ transform: [{ scaleX: -1 }] });
  });
});

describe('StatusLabel', () => {
  const now = new Date('2026-10-05T07:00:00Z');

  it('shows label and relative time with the right Arabic plural', async () => {
    await renderWithProviders(
      <StatusLabel status="in_office" updatedAt={new Date('2026-10-05T06:57:00Z')} now={now} />,
      'ar',
    );
    expect(screen.getByText('في المكتب')).toBeOnTheScreen();
    expect(screen.getByText('آخر تحديث قبل 3 دقائق')).toBeOnTheScreen();
  });

  it('says "not confirmed" when the schedule is not backed by a recent update', async () => {
    await renderWithProviders(
      <StatusLabel status="in_office" confirmed={false} updatedAt={null} now={now} />,
    );
    expect(screen.getByText('In office (not confirmed)')).toBeOnTheScreen();
    expect(screen.getByText('from the schedule')).toBeOnTheScreen();
  });
});

describe('EmptyState', () => {
  it('invites an action', async () => {
    const onAction = jest.fn();
    await renderWithProviders(
      <EmptyState
        title="No professors pinned yet"
        body="Search and pin."
        actionLabel="Search professors"
        onAction={onAction}
      />,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Search professors' }));
    expect(onAction).toHaveBeenCalled();
  });
});
