import { ChampionDetailScreen } from '@/screens/ChampionDetailScreen';
import { WebChampion } from '@/web/pages/Champion';

import { MOBILE_WEB } from './flags';

export default MOBILE_WEB ? ChampionDetailScreen : WebChampion;
