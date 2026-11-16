/**
 * Professor profile route: the full-screen profile (features/professors/ProfessorDetail).
 * `?book=1` opens it with the booking sheet up ("Book again" on a past appointment).
 */
import { useLocalSearchParams } from 'expo-router';

import { RequireSignIn } from '@/auth/RequireSignIn';
import { ProfessorDetail } from '@/features/professors/ProfessorDetail';

export default function ProfessorProfile() {
  const { id, book } = useLocalSearchParams<{ id: string; book?: string }>();
  return (
    <RequireSignIn>
      <ProfessorDetail professorId={Number(id) || 0} openBooking={book === '1'} />
    </RequireSignIn>
  );
}
