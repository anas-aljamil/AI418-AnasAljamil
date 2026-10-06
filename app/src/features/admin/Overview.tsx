/**
 * Admin overview, the first tab: accounts that cannot sign in yet (professors who signed up,
 * or accounts switched off), each with a one-tap Activate; the numbers that matter (each tile
 * opens its list); and quick ways to add a professor or a student.
 */
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CalendarCheck from 'lucide-react-native/icons/calendar-check';
import DoorOpen from 'lucide-react-native/icons/door-open';
import GraduationCap from 'lucide-react-native/icons/graduation-cap';
import Landmark from 'lucide-react-native/icons/landmark';
import Plus from 'lucide-react-native/icons/plus';
import UserCheck from 'lucide-react-native/icons/user-check';
import Users from 'lucide-react-native/icons/users';

import { useAdminList, useAppointments, useColleges } from '@/api/queries';
import type { AdminProfessor, AdminStudent } from '@/api/types';
import { useUser } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { SkeletonRow } from '@/components/Placeholders';
import { Card } from '@/components/Surfaces';
import { Text } from '@/components/Text';
import { departmentName, fullName, spokenList } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { space, type Language } from '@/theme/tokens';
import { Initials, StatTile } from './parts';
import { useActivate } from './useActivate';

type Waiting =
  { role: 'professor'; account: AdminProfessor } | { role: 'student'; account: AdminStudent };

export function AdminOverview() {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useUser();
  const professors = useAdminList('professors');
  const students = useAdminList('students');
  const departments = useAdminList('departments');
  const offices = useAdminList('offices');
  const colleges = useColleges();
  const upcoming = useAppointments('upcoming');
  const activateProfessor = useActivate('professors');
  const activateStudent = useActivate('students');

  const waiting: Waiting[] = [
    ...(professors.data ?? [])
      .filter((p) => !p.is_active)
      .map((account) => ({ role: 'professor' as const, account })),
    ...(students.data ?? [])
      .filter((s) => !s.is_active)
      .map((account) => ({ role: 'student' as const, account })),
  ];
  const loadingAccounts = professors.data === undefined || students.data === undefined;
  const active = (upcoming.data ?? []).filter(
    (a) => a.status === 'pending' || a.status === 'approved',
  );
  const count = <T,>(data: T[] | undefined) => (data ? data.length : null);
  const tileLabel = (label: string, value: number | null, detail?: string | null) =>
    spokenList([`${label}: ${value ?? '–'}`, detail ?? null], t);

  const notActiveProfessors = (professors.data ?? []).filter((p) => !p.is_active).length;
  const tiles = [
    {
      icon: Users,
      label: t('tabs.professors'),
      value: count(professors.data),
      detail: notActiveProfessors
        ? t('admin.stat_not_active', { count: notActiveProfessors })
        : null,
      open: () => router.navigate('/admin/professors'),
    },
    {
      icon: GraduationCap,
      label: t('tabs.students'),
      value: count(students.data),
      detail: null,
      open: () => router.navigate('/admin/students'),
    },
    {
      icon: Landmark,
      label: t('tabs.departments'),
      value: count(departments.data),
      detail: colleges.data ? t('admin.stat_colleges', { count: colleges.data.length }) : null,
      open: () => router.navigate({ pathname: '/admin/campus', params: { view: 'departments' } }),
    },
    {
      icon: DoorOpen,
      label: t('tabs.offices'),
      value: count(offices.data),
      detail: null,
      open: () => router.navigate({ pathname: '/admin/campus', params: { view: 'offices' } }),
    },
    {
      icon: CalendarCheck,
      label: t('admin.stat_appointments'),
      value: upcoming.data ? active.length : null,
      detail: upcoming.data
        ? t('admin.stat_waiting', { count: active.filter((a) => a.status === 'pending').length })
        : null,
      open: undefined,
    },
  ];

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.lg }]}
    >
      <View>
        <Text variant="heading" role="heading">
          {t('admin.overview_title')}
        </Text>
        <Text color="muted">{t('admin.signed_in_as', { name: fullName(user, language) })}</Text>
      </View>

      <Card>
        <Text variant="title" role="heading">
          {loadingAccounts
            ? t('admin.not_active_heading')
            : t('admin.not_active_title', { count: waiting.length })}
        </Text>
        {loadingAccounts ? (
          <SkeletonRow />
        ) : waiting.length === 0 ? (
          <View style={styles.allGood}>
            <UserCheck color={colors.status.in_office} size={22} strokeWidth={1.75} />
            <Text color="muted" style={styles.grow}>
              {t('admin.all_active')}
            </Text>
          </View>
        ) : (
          <>
            <Text variant="caption" color="muted">
              {t('admin.not_active_body')}
            </Text>
            {waiting.map((item) => {
              const name = fullName(item.account, language);
              const line = spokenList(
                [t(`admin.role_${item.role}`), departmentName(item.account.department, language)],
                t,
              );
              return (
                <View
                  key={`${item.role}-${item.account.user_id}`}
                  style={[styles.waiting, { borderTopColor: colors.line }]}
                >
                  <Initials name={name} muted />
                  <View
                    style={styles.grow}
                    accessible
                    accessibilityLabel={spokenList([name, line, item.account.email], t)}
                  >
                    <Text weight="semibold">{name}</Text>
                    <Text variant="caption" color="muted">
                      {line}
                    </Text>
                    <Text variant="caption" color="muted" numberOfLines={1} ellipsizeMode="middle">
                      {item.account.email}
                    </Text>
                  </View>
                  <Button
                    variant="secondary"
                    label={t('admin.activate')}
                    accessibilityLabel={t('admin.activate_label', { name })}
                    onPress={() =>
                      item.role === 'professor'
                        ? activateProfessor(item.account, name)
                        : activateStudent(item.account, name)
                    }
                  />
                </View>
              );
            })}
          </>
        )}
      </Card>

      <View style={styles.section}>
        <Text variant="title" role="heading">
          {t('admin.numbers')}
        </Text>
        <View style={styles.tiles}>
          {tiles.map((tile) => (
            <StatTile
              key={tile.label}
              icon={tile.icon}
              label={tile.label}
              value={tile.value}
              detail={tile.detail}
              onPress={tile.open}
              accessibilityLabel={tileLabel(tile.label, tile.value, tile.detail)}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="title" role="heading">
          {t('admin.quick_actions')}
        </Text>
        <View style={styles.actions}>
          <Button
            variant="secondary"
            icon={<Plus color={colors.primary} size={18} strokeWidth={2.25} />}
            label={t('admin.add_professor')}
            onPress={() => router.navigate({ pathname: '/admin/professors', params: { add: '1' } })}
            block
          />
          <Button
            variant="secondary"
            icon={<Plus color={colors.primary} size={18} strokeWidth={2.25} />}
            label={t('admin.add_student')}
            onPress={() => router.navigate({ pathname: '/admin/students', params: { add: '1' } })}
            block
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.md, paddingBottom: space.xl, gap: space.lg },
  grow: { flex: 1 },
  allGood: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  waiting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.sm,
  },
  section: { gap: space.sm },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  actions: { gap: space.xs },
});
