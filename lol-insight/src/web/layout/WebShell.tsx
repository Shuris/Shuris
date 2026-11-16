import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppMark, RankEmblem } from '@/components/ui';
import { useAuth } from '@/state/AuthContext';
import { usePlayer } from '@/state/PlayerContext';
import { rankLabel, TIER_COLOR } from '@/stats/rank';
import { colors, fonts, radius, space } from '@/theme';

import { css, useBreakpoint } from '../hooks';
import type { WebPress } from '../ui';
import { isActive, SECTIONS, TOOLS, type NavItem } from './nav';
import { WebSearch, type SearchInputRef } from './WebSearch';

const SIDEBAR = 248;
const RAIL = 72;

/**
 * Casca da versão web: barra lateral persistente (trilho de ícones em telas
 * médias, gaveta em telas pequenas), barra superior com busca e origem dos
 * dados, e atalhos de teclado. O conteúdo de cada rota aparece à direita.
 */
export function WebShell({ children }: { children: React.ReactNode }) {
  const { bp } = useBreakpoint();
  const router = useRouter();
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [help, setHelp] = useState(false);
  const searchRef = useRef<SearchInputRef>(null);
  const mode: 'full' | 'rail' | 'drawer' = bp === 'sm' ? 'drawer' : bp === 'md' || collapsed ? 'rail' : 'full';

  // Fecha a gaveta ao navegar.
  useEffect(() => setDrawer(false), [path]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (e.key === 'Escape') {
        setHelp(false);
        setDrawer(false);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === '?') {
        setHelp((h) => !h);
      } else if (e.key === '[') {
        setCollapsed((c) => !c);
      } else {
        const item = SECTIONS.find((s) => s.key === e.key);
        if (item) router.navigate(item.href as never);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  const sidebar = <Sidebar path={path} compact={mode === 'rail'} onToggle={() => setCollapsed((c) => !c)} showToggle={bp !== 'md' && mode !== 'drawer'} />;

  return (
    <View style={styles.root}>
      {mode !== 'drawer' ? <View style={{ width: mode === 'rail' ? RAIL : SIDEBAR }}>{sidebar}</View> : null}
      <View style={styles.main}>
        <View style={styles.topbar}>
          {mode === 'drawer' ? (
            <Pressable onPress={() => setDrawer(true)} accessibilityRole="button" accessibilityLabel="Abrir menu" style={[styles.iconBtn, css({ cursor: 'pointer' })]}>
              <Ionicons name="menu" size={20} color={colors.text} />
            </Pressable>
          ) : null}
          <WebSearch ref={searchRef} compact={mode === 'drawer'} />
          {mode !== 'drawer' ? <SourceSwitch /> : null}
          {mode !== 'drawer' ? (
          <Pressable onPress={() => setHelp(true)} accessibilityRole="button" accessibilityLabel="Atalhos de teclado" style={[styles.iconBtn, css({ cursor: 'pointer' })]}>
            <Ionicons name="help-circle-outline" size={19} color={colors.textSecondary} />
          </Pressable>
          ) : null}
        </View>
        <View style={{ flex: 1 }}>{children}</View>
      </View>

      <Modal visible={drawer} transparent animationType="fade" onRequestClose={() => setDrawer(false)}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={{ width: Math.min(300, SIDEBAR + 40) }}>
            <Sidebar path={path} compact={false} onToggle={() => setDrawer(false)} showToggle={false} withSource />
          </View>
          <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={() => setDrawer(false)} accessibilityLabel="Fechar menu" />
        </View>
      </Modal>

      <Modal visible={help} transparent animationType="fade" onRequestClose={() => setHelp(false)}>
        <Pressable style={styles.helpBackdrop} onPress={() => setHelp(false)} accessibilityLabel="Fechar atalhos">
          <View style={styles.help}>
            <Text style={styles.helpTitle}>Atalhos de teclado</Text>
            {[
              ['/', 'Buscar invocador'],
              ...SECTIONS.map((s) => [s.key!, s.label]),
              ['[', 'Recolher ou expandir a barra lateral'],
              ['?', 'Mostrar ou esconder esta ajuda'],
              ['Esc', 'Fechar menus'],
            ].map(([k, label]) => (
              <View key={k} style={styles.helpRow}>
                <Text style={styles.kbd}>{k}</Text>
                <Text style={styles.helpText}>{label}</Text>
              </View>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function Sidebar({ path, compact, onToggle, showToggle, withSource }: { path: string; compact: boolean; onToggle: () => void; showToggle: boolean; withSource?: boolean }) {
  const router = useRouter();
  const auth = useAuth();
  const { data } = usePlayer();
  const item = (n: NavItem) => {
    const on = isActive(n, path);
    return (
      <Pressable
        key={n.href}
        onPress={() => router.navigate(n.href as never)}
        accessibilityRole="link"
        accessibilityLabel={n.label}
        accessibilityState={{ selected: on }}
        style={({ hovered }: WebPress) => [styles.nav, compact && styles.navCompact, on && styles.navOn, hovered && !on && { backgroundColor: colors.surfaceAlt }, css({ cursor: 'pointer' })]}>
        {on ? <View style={styles.navBar} /> : null}
        <Ionicons name={on ? (n.icon.replace('-outline', '') as NavItem['icon']) : n.icon} size={18} color={on ? colors.accentSoft : colors.textSecondary} />
        {!compact ? <Text style={[styles.navText, on && { color: colors.text }]}>{n.label}</Text> : null}
        {!compact && n.key ? <Text style={styles.navKey}>{n.key}</Text> : null}
      </Pressable>
    );
  };
  return (
    <View style={[styles.sidebar, compact && { paddingHorizontal: 10 }]}>
      <View style={[styles.brand, compact && { justifyContent: 'center' }]}>
        <AppMark size={30} />
        {!compact ? (
          <Text style={styles.wordmark}>
            LOL <Text style={{ color: colors.gold }}>INSIGHT</Text>
          </Text>
        ) : null}
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 2, paddingBottom: space.lg }}>
        {!compact ? <Text style={styles.group}>Análise</Text> : null}
        {SECTIONS.map(item)}
        {!compact ? <Text style={[styles.group, { marginTop: space.lg }]}>Ferramentas</Text> : <View style={styles.sep} />}
        {TOOLS.map(item)}
      </ScrollView>
      {withSource ? <SourceSwitch /> : null}
      {data && !compact ? (
        <Pressable onPress={() => router.navigate('/perfil')} style={[styles.player, css({ cursor: 'pointer' })]} accessibilityRole="link" accessibilityLabel={`Perfil de ${data.player.gameName}`}>
          {data.player.rank ? <RankEmblem rank={data.player.rank} size={30} /> : <Ionicons name="person-circle-outline" size={28} color={colors.textMuted} />}
          <View style={{ flex: 1 }}>
            <Text style={styles.playerName} numberOfLines={1}>
              {data.player.gameName}
              <Text style={{ color: colors.textMuted }}>#{data.player.tagLine}</Text>
            </Text>
            <Text style={[styles.playerRank, { color: data.player.rank ? TIER_COLOR[data.player.rank.tier] : colors.textMuted }]}>
              {data.player.rank ? `${rankLabel(data.player.rank)} · ${data.player.rank.lp} LP` : 'Sem elo'}
            </Text>
          </View>
        </Pressable>
      ) : null}
      <Pressable
        onPress={() => router.navigate((auth.status === 'signedIn' ? '/conta' : '/entrar') as never)}
        accessibilityRole="link"
        accessibilityLabel={auth.status === 'signedIn' ? 'Minha conta' : 'Entrar'}
        style={[styles.nav, compact && styles.navCompact, css({ cursor: 'pointer' })]}>
        <Ionicons name={auth.status === 'signedIn' ? 'person-circle' : 'log-in-outline'} size={18} color={colors.textSecondary} />
        {!compact ? <Text style={styles.navText}>{auth.status === 'signedIn' ? (auth.user?.username ?? 'Minha conta') : 'Entrar ou criar conta'}</Text> : null}
      </Pressable>
      {showToggle ? (
        <Pressable onPress={onToggle} accessibilityRole="button" accessibilityLabel={compact ? 'Expandir barra lateral' : 'Recolher barra lateral'} style={[styles.nav, compact && styles.navCompact, css({ cursor: 'pointer' })]}>
          <Ionicons name={compact ? 'chevron-forward' : 'chevron-back'} size={16} color={colors.textMuted} />
          {!compact ? <Text style={[styles.navText, { color: colors.textMuted }]}>Recolher</Text> : null}
        </Pressable>
      ) : null}
    </View>
  );
}

/** Alterna entre demonstração e dados reais; sempre mostra a origem do que está na tela. */
function SourceSwitch() {
  const { settings, setMode, data } = usePlayer();
  const source = data?.source ?? settings.mode;
  return (
    <View style={styles.switch} accessibilityRole="radiogroup" accessibilityLabel="Fonte de dados">
      {(['demo', 'riot'] as const).map((m) => {
        const on = source === m;
        return (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={m === 'demo' ? 'Demonstração' : 'Dados reais'}
            style={[styles.switchOpt, on && { backgroundColor: m === 'demo' ? colors.goldDim : 'rgba(47,179,128,0.14)' }, css({ cursor: 'pointer' })]}>
            <Ionicons name={m === 'demo' ? 'flask' : 'radio'} size={11} color={on ? (m === 'demo' ? colors.gold : colors.good) : colors.textMuted} />
            <Text style={[styles.switchText, { color: on ? (m === 'demo' ? colors.gold : colors.good) : colors.textMuted }]}>{m === 'demo' ? 'DEMO' : 'DADOS REAIS'}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: colors.bg, ...css({ height: '100vh' }) },
  main: { flex: 1, minWidth: 0 },
  topbar: { height: 60, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, borderBottomWidth: 1, borderBottomColor: colors.hairline, backgroundColor: colors.bg, zIndex: 30 },
  iconBtn: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  sidebar: { flex: 1, backgroundColor: '#0A0D12', borderRightWidth: 1, borderRightColor: colors.hairline, paddingHorizontal: 14, paddingTop: 16, paddingBottom: 12, gap: 8 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 36, marginBottom: 14, paddingHorizontal: 4 },
  wordmark: { fontFamily: fonts.title, fontSize: 16, color: colors.text, letterSpacing: 2 },
  group: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.4, color: colors.textMuted, textTransform: 'uppercase', paddingHorizontal: 10, marginBottom: 6 },
  sep: { height: 1, backgroundColor: colors.hairline, marginVertical: 10 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 38, paddingHorizontal: 10, borderRadius: radius.md, position: 'relative' },
  navCompact: { justifyContent: 'center', paddingHorizontal: 0 },
  navOn: { backgroundColor: colors.accentDim },
  navBar: { position: 'absolute', left: -14, top: 8, bottom: 8, width: 3, borderRadius: 2, backgroundColor: colors.accent },
  navText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.textSecondary },
  navKey: { fontFamily: fonts.bodyBold, fontSize: 10.5, color: colors.textMuted, opacity: 0.7 },
  player: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.md, backgroundColor: colors.surface },
  playerName: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.text },
  playerRank: { fontFamily: fonts.bodySemi, fontSize: 11.5 },
  switch: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, padding: 3, gap: 2 },
  switchOpt: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 26, paddingHorizontal: 10, borderRadius: radius.pill },
  switchText: { fontFamily: fonts.bodyBold, fontSize: 10.5, letterSpacing: 0.6 },
  helpBackdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  help: { width: '100%', maxWidth: 420, backgroundColor: colors.surface, borderRadius: 16, padding: 24, gap: 10, borderWidth: 1, borderColor: colors.border },
  helpTitle: { fontFamily: fonts.title, fontSize: 20, color: colors.text, marginBottom: 6 },
  helpRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  kbd: { minWidth: 34, textAlign: 'center', fontFamily: fonts.bodyBold, fontSize: 12, color: colors.text, backgroundColor: colors.surfaceHigh, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 6 },
  helpText: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textSecondary },
});
