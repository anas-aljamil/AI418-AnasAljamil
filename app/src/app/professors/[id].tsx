/** Professor profile route: the full-screen profile (features/professors/ProfessorDetail). */
import { useLocalSearchParams } from 'expo-router';

import { ProfessorDetail } from '@/features/professors/ProfessorDetail';

export default function ProfessorProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProfessorDetail professorId={Number(id) || 0} />;
}
