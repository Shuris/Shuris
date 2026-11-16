import { useWindowDimensions } from 'react-native';

/** Larguras de referência da versão web. */
export const BP = { md: 760, lg: 1100, xl: 1440 } as const;

export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl';

export function useBreakpoint() {
  const { width, height } = useWindowDimensions();
  const bp: Breakpoint = width >= BP.xl ? 'xl' : width >= BP.lg ? 'lg' : width >= BP.md ? 'md' : 'sm';
  return { width, height, bp, wide: bp === 'lg' || bp === 'xl', narrow: bp === 'sm' };
}

/** Estilos que só existem no navegador (cursor, sticky, transições). O RN Web os repassa ao CSS. */
export const css = (s: Record<string, unknown>) => s as object;
