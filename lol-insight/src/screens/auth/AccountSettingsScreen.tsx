import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Field, FormError, FormNotice, PASSWORD_MIN } from '@/components/auth/Form';
import { REGIONS } from '@/components/SearchBar';
import { Card, Chip, ChipRow, Screen, SectionHeader, Segmented } from '@/components/ui';
import { MATCH_COUNTS, ServiceError, type MatchCount } from '@/services';
import { usePlayer } from '@/state/PlayerContext';
import { colors, space, type } from '@/theme';

import { useRequireAuth } from './useRequireAuth';

const asError = (e: unknown) => (e instanceof ServiceError ? e : new ServiceError('UNKNOWN', 'Não foi possível concluir.'));

export function AccountSettingsScreen() {
  const auth = useRequireAuth();
  const { setMatchCount } = usePlayer();

  const [prefError, setPrefError] = useState<ServiceError | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmNext, setConfirmNext] = useState('');
  const [pwTouched, setPwTouched] = useState(false);
  const [pwError, setPwError] = useState<ServiceError | null>(null);
  const [pwDone, setPwDone] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

  const [deleteStep, setDeleteStep] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<ServiceError | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const settings = auth.settings;
  const savePref = async (patch: { matchCount?: MatchCount; preferredRegion?: string | null }) => {
    setPrefError(null);
    try {
      if (patch.matchCount) setMatchCount(patch.matchCount);
      else await auth.saveSettings(patch as never);
    } catch (e) {
      setPrefError(asError(e));
    }
  };

  const changePassword = async () => {
    setPwTouched(true);
    setPwDone(false);
    if (!current || next.length < PASSWORD_MIN || next !== confirmNext) return;
    setPwBusy(true);
    setPwError(null);
    try {
      await auth.changePassword(current, next);
      setPwDone(true);
      setCurrent('');
      setNext('');
      setConfirmNext('');
      setPwTouched(false);
    } catch (e) {
      setPwError(asError(e));
    } finally {
      setPwBusy(false);
    }
  };

  const deleteAccount = async () => {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      auth.leave('/perfil');
      await auth.deleteAccount(deletePassword);
    } catch (e) {
      auth.leave(null);
      setDeleteError(asError(e));
      setDeleteBusy(false);
    }
  };

  return (
    <Screen title="Configurações da conta" subtitle={auth.user?.username} back>
      <Card>
        <SectionHeader title="Preferências" subtitle="Salvas na sua conta e aplicadas em qualquer aparelho" />
        <Text style={[type.label, { marginBottom: 8 }]}>Partidas analisadas</Text>
        <Segmented options={MATCH_COUNTS.map((value) => ({ value, label: String(value) }))} value={settings?.matchCount ?? 20} onChange={(matchCount) => void savePref({ matchCount })} />
        <Text style={[type.label, { marginTop: space.lg, marginBottom: 8 }]}>Região preferida para buscas</Text>
        <ChipRow>
          <Chip label="Nenhuma" active={!settings?.preferredRegion} onPress={() => void savePref({ preferredRegion: null })} />
          {REGIONS.map((r) => (
            <Chip key={r.value} label={r.value} active={settings?.preferredRegion === r.value} onPress={() => void savePref({ preferredRegion: r.value })} />
          ))}
        </ChipRow>
        <View style={{ marginTop: space.md }}>
          <FormError error={prefError} />
        </View>
      </Card>

      <Card>
        <SectionHeader title="Alterar senha" subtitle="As outras sessões serão encerradas; esta continua aberta" />
        <View style={{ gap: space.lg }}>
          <Field label="Senha atual" icon="lock-closed-outline" value={current} onChangeText={setCurrent} secret autoComplete="current-password" error={pwTouched && !current ? 'Informe a senha atual.' : null} />
          <Field label="Nova senha" icon="lock-closed-outline" value={next} onChangeText={setNext} secret autoComplete="new-password" error={pwTouched && next.length < PASSWORD_MIN ? `Use pelo menos ${PASSWORD_MIN} caracteres.` : null} />
          <Field label="Confirmar nova senha" icon="lock-closed-outline" value={confirmNext} onChangeText={setConfirmNext} secret autoComplete="new-password" error={pwTouched && confirmNext !== next ? 'As senhas não coincidem.' : null} />
          <FormError error={pwError} />
          {pwDone ? <FormNotice tone="success" icon="checkmark-circle-outline">Senha alterada. As outras sessões foram encerradas.</FormNotice> : null}
          <Button label="Alterar senha" onPress={changePassword} loading={pwBusy} />
        </View>
      </Card>

      <Card style={{ borderColor: 'rgba(229,96,106,0.45)' }}>
        <SectionHeader title="Excluir conta" subtitle="Ação definitiva" />
        <Text style={type.bodySm}>
          Apaga seu perfil, as contas Riot vinculadas, o progresso da Academy, metas, previsões, configurações e todas as sessões. Dados públicos da Riot (partidas e elo) não são pessoais e continuam em cache no servidor.
        </Text>
        {deleteStep ? (
          <View style={{ gap: space.lg, marginTop: space.lg }}>
            <Field label="Digite sua senha para confirmar" icon="lock-closed-outline" value={deletePassword} onChangeText={setDeletePassword} secret autoComplete="current-password" />
            <FormError error={deleteError} />
            <Button label="Excluir minha conta definitivamente" variant="danger" icon="trash-outline" onPress={deleteAccount} loading={deleteBusy} disabled={!deletePassword} />
            <Button label="Cancelar" variant="ghost" onPress={() => (setDeleteStep(false), setDeletePassword(''), setDeleteError(null))} />
          </View>
        ) : (
          <View style={{ marginTop: space.lg }}>
            <Button label="Excluir conta" variant="danger" icon="trash-outline" onPress={() => setDeleteStep(true)} />
          </View>
        )}
      </Card>
      <Text style={[type.bodySm, { textAlign: 'center', color: colors.textMuted }]}>ID da conta: {auth.user?.id}</Text>
    </Screen>
  );
}
