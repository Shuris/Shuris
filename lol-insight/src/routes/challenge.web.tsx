import { ChallengeScreen } from '@/screens/ChallengeScreen';
import { WebChallenge } from '@/web/pages/Challenge';

import { MOBILE_WEB } from './flags';

export default MOBILE_WEB ? ChallengeScreen : WebChallenge;
