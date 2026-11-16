import { MatchesScreen } from '@/screens/MatchesScreen';
import { WebMatches } from '@/web/pages/Matches';

import { MOBILE_WEB } from './flags';

export default MOBILE_WEB ? MatchesScreen : WebMatches;
