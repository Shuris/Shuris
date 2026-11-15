import AsyncStorage from '@react-native-async-storage/async-storage';

import { dataDragonVersion, setDataDragonVersion } from '@/data/champions';

const KEY = 'lolinsight:ddragonVersion';
const TTL_MS = 24 * 3_600_000;

/**
 * Descobre a versão atual do Data Dragon (CDN oficial de imagens da Riot) para
 * que ícones de campeões, itens e perfil apontem para os arquivos do patch
 * vigente. Consulta pública, sem chave. O resultado fica em cache por 24 h; sem
 * rede, mantém a última versão conhecida.
 */
export async function resolveDataDragonVersion(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const cached = raw ? (JSON.parse(raw) as { version: string; at: number }) : null;
    if (cached) setDataDragonVersion(cached.version);
    if (cached && Date.now() - cached.at < TTL_MS) return cached.version;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch('https://ddragon.leagueoflegends.com/api/versions.json', { signal: controller.signal });
      const versions = (await res.json()) as string[];
      if (res.ok && typeof versions[0] === 'string') {
        setDataDragonVersion(versions[0]);
        await AsyncStorage.setItem(KEY, JSON.stringify({ version: versions[0], at: Date.now() }));
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Sem rede: segue com a versão em memória.
  }
  return dataDragonVersion();
}
