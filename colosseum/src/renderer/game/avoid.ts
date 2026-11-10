// Cálculo puro (testável) de como afastar um balão de fala das janelas da interface.
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Quanto mover o balão (px de tela) para não ficar sob nenhuma janela. */
export function avoidOffset(box: { left: number; top: number; right: number; bottom: number }, rects: Rect[], bounds: { left: number; right: number; bottom: number }, margin = 4): { dx: number; dy: number } {
  let dx = 0;
  let dy = 0;
  for (let pass = 0; pass < 4; pass++) {
    const b = { left: box.left + dx, right: box.right + dx, top: box.top + dy, bottom: box.bottom + dy };
    const hit = rects.find((r) => b.left < r.right + margin && b.right > r.left - margin && b.top < r.bottom + margin && b.bottom > r.top - margin);
    if (!hit) break;
    const w = b.right - b.left;
    const options: Array<{ dx: number; dy: number; cost: number }> = [];
    const right = hit.right + margin - b.left;
    const left = hit.left - margin - b.right;
    const down = hit.bottom + margin - b.top;
    if (b.left + right + w <= bounds.right) options.push({ dx: right, dy: 0, cost: Math.abs(right) });
    if (b.left + left >= bounds.left) options.push({ dx: left, dy: 0, cost: Math.abs(left) });
    if (b.bottom + down <= bounds.bottom) options.push({ dx: 0, dy: down, cost: down * 1.3 });
    if (!options.length) break;
    options.sort((p, q) => p.cost - q.cost);
    dx += options[0].dx;
    dy += options[0].dy;
  }
  return { dx, dy };
}
