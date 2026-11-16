import React from 'react';

import { WebShell } from '@/web/layout/WebShell';

import { MOBILE_WEB } from './flags';

export default function AppFrame({ children }: { children: React.ReactNode }) {
  return MOBILE_WEB ? <>{children}</> : <WebShell>{children}</WebShell>;
}
