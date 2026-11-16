import React from 'react';

/** No Android não há moldura extra: cada tela já ocupa a tela inteira. */
export default function AppFrame({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
