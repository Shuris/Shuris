import { ProfileScreen } from '@/screens/ProfileScreen';
import { WebProfile } from '@/web/pages/Profile';

import { MOBILE_WEB } from './flags';

export default MOBILE_WEB ? ProfileScreen : WebProfile;
