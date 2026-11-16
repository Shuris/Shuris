import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, Text, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

/** Vibração leve de confirmação (somente no aparelho; no navegador não faz nada). */
export const haptic = {
  select() {
    if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => undefined);
  },
  success() {
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  },
};

const NUMBER = /-?\d+(?:[.,]\d+)?/;

/** Separa "58,3%" em prefixo, número e sufixo, preservando as casas decimais e a vírgula. */
function parse(text: string) {
  const m = text.match(NUMBER);
  if (!m || m.index === undefined) return null;
  const raw = m[0];
  const decimals = raw.includes(',') || raw.includes('.') ? raw.split(/[.,]/)[1].length : 0;
  return {
    pre: text.slice(0, m.index),
    post: text.slice(m.index + raw.length),
    value: Number(raw.replace(',', '.')),
    decimals,
    comma: raw.includes(','),
  };
}

/**
 * Texto com o primeiro número "subindo" até o valor final (≈ 0,7 s).
 * Mantém o formato (prefixo, sufixo, casas decimais). Ao mudar o valor, anima
 * a partir do número anterior. Leitores de tela recebem só o valor final.
 */
export function CountUp({ text, style, duration = 700, numberOfLines }: { text: string; style?: StyleProp<TextStyle>; duration?: number; numberOfLines?: number }) {
  const target = parse(text);
  const from = useRef(0);
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(!target);

  useEffect(() => {
    if (!target || target.value === from.current) {
      setDone(true);
      return;
    }
    setDone(false);
    const start = Date.now();
    const a = from.current;
    const b = target.value;
    let raf = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      setShown(a + (b - a) * e);
      if (t < 1) raf = requestAnimationFrame(step);
      else {
        from.current = b;
        setDone(true);
      }
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      from.current = b;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  let out = text;
  if (target && !done) {
    let n = shown.toFixed(target.decimals);
    if (target.comma) n = n.replace('.', ',');
    out = `${target.pre}${n}${target.post}`;
  }
  return (
    <Text style={style} accessibilityLabel={text} numberOfLines={numberOfLines} adjustsFontSizeToFit={!!numberOfLines}>
      {out}
    </Text>
  );
}

/** Pressable que encolhe levemente ao toque e dá retorno tátil. */
export function PressableScale({ style, children, onPress, haptics = true, ...rest }: PressableProps & { style?: StyleProp<ViewStyle>; haptics?: boolean; children: React.ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Pressable
      {...rest}
      onPressIn={() => to(0.97)}
      onPressOut={() => to(1)}
      onPress={(e) => {
        if (haptics) haptic.select();
        onPress?.(e);
      }}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/**
 * Progresso de 0 a 1 ao montar (e quando `trigger` muda), para desenhar
 * gráficos. Usa estado em vez de Animated porque precisa funcionar igual no
 * SVG do Android e do navegador.
 */
export function useProgress(trigger?: unknown, duration = 850) {
  const [p, setP] = useState(0);
  useEffect(() => {
    const start = Date.now();
    let raf = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      setP(1 - Math.pow(1 - t, 3));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    setP(0);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [trigger, duration]);
  return p;
}
