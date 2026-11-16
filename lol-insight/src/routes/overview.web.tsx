import { HomeScreen } from '@/screens/HomeScreen';
import { WebOverview } from '@/web/pages/Overview';

import { MOBILE_WEB } from './flags';

export default MOBILE_WEB ? HomeScreen : WebOverview;
