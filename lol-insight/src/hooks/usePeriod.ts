import type { Option } from '@/components/ui';

export type PeriodDays = 7 | 15 | 30 | 90;

export const PERIOD_OPTIONS: ReadonlyArray<Option<PeriodDays>> = [
  { value: 7, label: '7D' },
  { value: 15, label: '15D' },
  { value: 30, label: '30D' },
  { value: 90, label: '90D' },
];
