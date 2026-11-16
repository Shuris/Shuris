import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type Svg from 'react-native-svg';

/**
 * Android/iOS: o react-native-svg rasteriza o cartão em PNG (base64), o arquivo
 * vai para o cache do app e a folha de compartilhamento do sistema é aberta.
 */
export async function shareSvgAsPng(svg: Svg | null, _container: unknown, fileName: string): Promise<'shared' | 'downloaded'> {
  if (!svg) throw new Error('Cartão ainda não foi desenhado.');
  const base64 = await new Promise<string>((resolve) => svg.toDataURL((b) => resolve(b), { width: 1080, height: 1350 }));
  const file = new File(Paths.cache, `${fileName}.png`);
  file.create({ overwrite: true });
  await file.write(base64, { encoding: 'base64' });
  if (!(await Sharing.isAvailableAsync())) throw new Error('O compartilhamento não está disponível neste aparelho.');
  await Sharing.shareAsync(file.uri, { mimeType: 'image/png', dialogTitle: 'Compartilhar cartão do LOL Insight', UTI: 'public.png' });
  return 'shared';
}
