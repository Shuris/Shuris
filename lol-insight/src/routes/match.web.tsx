import { MatchDetailScreen } from '@/screens/MatchDetailScreen';
import { WebMatch } from '@/web/pages/Match';

import { MOBILE_WEB } from './flags';

export default MOBILE_WEB ? MatchDetailScreen : WebMatch;
