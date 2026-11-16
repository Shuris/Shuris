import { ChampionsScreen } from '@/screens/ChampionsScreen';
import { WebChampions } from '@/web/pages/Champions';

import { MOBILE_WEB } from './flags';

export default MOBILE_WEB ? ChampionsScreen : WebChampions;
