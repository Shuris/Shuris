/**
 * Navegador: serializa o <svg> do cartão, embute as fontes do app (senão a
 * imagem sairia com a fonte padrão), desenha num canvas de 1080 × 1350 e
 * compartilha o PNG (Web Share API) ou baixa o arquivo.
 */

const FAMILIES = ['MarcellusSC_400Regular', 'Rajdhani_600SemiBold', 'Rajdhani_700Bold', 'Manrope_500Medium', 'Manrope_600SemiBold', 'Manrope_700Bold'];

async function toDataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/** Lê as regras @font-face que o expo-font registrou e devolve versões com a fonte embutida. */
async function embeddedFontCss(): Promise<string> {
  const out: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const family = rule.style.getPropertyValue('font-family').replace(/["']/g, '').trim();
      if (!FAMILIES.includes(family)) continue;
      const m = rule.style.getPropertyValue('src').match(/url\(["']?([^"')]+)["']?\)/);
      if (!m) continue;
      try {
        out.push(`@font-face{font-family:"${family}";src:url(${await toDataUrl(m[1])});}`);
      } catch {
        // Sem a fonte, o texto usa a fonte padrão do navegador.
      }
    }
  }
  return out.join('');
}

export async function shareSvgAsPng(_svg: unknown, container: HTMLElement | null, fileName: string): Promise<'shared' | 'downloaded'> {
  const el = container?.querySelector('svg');
  if (!el) throw new Error('Cartão ainda não foi desenhado.');
  const clone = el.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', '1080');
  clone.setAttribute('height', '1350');
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = await embeddedFontCss();
  clone.insertBefore(style, clone.firstChild);
  const xml = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  canvas.getContext('2d')!.drawImage(img, 0, 0, 1080, 1350);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar a imagem.'))), 'image/png'));
  const file = new File([blob], `${fileName}.png`, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'LOL Insight' });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'shared';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${fileName}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'downloaded';
}
