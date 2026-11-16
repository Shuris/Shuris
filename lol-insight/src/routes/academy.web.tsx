import { AcademyScreen } from '@/screens/AcademyScreen';
import { WebAcademy } from '@/web/pages/Academy';

import { MOBILE_WEB } from './flags';

export default MOBILE_WEB ? AcademyScreen : WebAcademy;
