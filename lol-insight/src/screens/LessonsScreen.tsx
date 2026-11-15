import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { CATEGORIES, CATEGORY_IDS, lessonsByCategory, type CategoryId, type CoachReport } from '@/coach';
import { CoachGate } from '@/components/coach/CoachGate';
import { LessonCard } from '@/components/coach/LessonCard';
import { Chip, ChipRow, FadeIn, Screen, SectionHeader } from '@/components/ui';
import { space, type } from '@/theme';

export function LessonsScreen() {
  const { categoria } = useLocalSearchParams<{ categoria?: string }>();
  const initial = CATEGORY_IDS.includes(categoria as CategoryId) ? (categoria as CategoryId) : 'all';
  const [filter, setFilter] = useState<CategoryId | 'all'>(initial);

  return (
    <Screen
      title="Aulas"
      subtitle="Catálogo completo da Academy"
      back
      sticky={
        <ChipRow>
          <Chip label="Todas" active={filter === 'all'} onPress={() => setFilter('all')} />
          {CATEGORY_IDS.map((id) => (
            <Chip key={id} label={CATEGORIES[id].name} active={filter === id} onPress={() => setFilter(id)} />
          ))}
        </ChipRow>
      }>
      <CoachGate>{(report) => <List report={report} filter={filter} />}</CoachGate>
    </Screen>
  );
}

function List({ report, filter }: { report: CoachReport; filter: CategoryId | 'all' }) {
  const router = useRouter();
  const ids = filter === 'all' ? CATEGORY_IDS : [filter];
  return (
    <FadeIn trigger={filter} style={{ gap: space.xl }}>
      {ids.map((id) => {
        const list = lessonsByCategory(id);
        const done = list.filter((l) => report.progress[l.id]?.completedAt).length;
        return (
          <View key={id}>
            <SectionHeader title={CATEGORIES[id].name} subtitle={`${CATEGORIES[id].description} · ${done}/${list.length} concluídas`} />
            <View style={{ gap: space.sm }}>
              {list.map((l) => (
                <LessonCard key={l.id} lesson={l} progress={report.progress[l.id]} onPress={() => router.push({ pathname: '/academy/aula/[id]', params: { id: l.id } })} />
              ))}
            </View>
          </View>
        );
      })}
      <Text style={[type.bodySm, { textAlign: 'center' }]}>Uma aula conta como concluída ao acertar 60% do teste. Você pode refazer o teste quando quiser.</Text>
    </FadeIn>
  );
}
