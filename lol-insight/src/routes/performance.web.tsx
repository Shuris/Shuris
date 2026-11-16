import { PerformanceScreen } from '@/screens/PerformanceScreen';
import { WebPerformance } from '@/web/pages/Performance';

import { MOBILE_WEB } from './flags';

export default MOBILE_WEB ? PerformanceScreen : WebPerformance;
