import { ReplayScreen } from '@/screens/ReplayScreen';
import { WebReplay } from '@/web/pages/Replay';

import { MOBILE_WEB } from './flags';

export default MOBILE_WEB ? ReplayScreen : WebReplay;
