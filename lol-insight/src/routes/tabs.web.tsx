import { Slot } from 'expo-router';
import React from 'react';

import { MOBILE_WEB } from './flags';
import { NativeTabs } from './tabsNative';

/** Na web, as seções ficam na barra lateral da casca: o grupo de abas só exibe a rota atual. */
export default function WebTabs() {
  return MOBILE_WEB ? <NativeTabs /> : <Slot />;
}
