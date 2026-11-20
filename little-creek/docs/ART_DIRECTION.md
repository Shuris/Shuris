# Little Creek — Direção Artística

Documento de referência visual. Todo asset (cenário, vegetação, água, rochas,
animais, pessoas, efeitos e interface) deve obedecer a estas regras. Ele foi
escrito a partir da análise da imagem de referência oficial (riacho com
cascatas em floresta, pixel art pictórica).

## 1. Análise da referência

| Aspecto | Observação na referência | Regra para o jogo |
|---|---|---|
| Densidade de pixels | Blocos de ~4 px numa imagem de 736 px de largura (~185 "pixels de arte" na largura) | Mundo em **800×360 px de arte**, área segura 16:9 de **640×360**, exibido em escala inteira **×2** (1280×720) — ×3 em telas 1080p. Mais definição que a referência, mesma linguagem de blocos. |
| Formas | Folhagem em "tufos" de 3–6 px, sem contorno preto, bordas orgânicas | Tufos procedurais com borda irregular; **nunca** contorno preto puro. Contornos são a cor mais escura da própria rampa. |
| Luz | Sol no alto à direita, raios volumétricos diagonais, luz quente amarelada | Direção de luz global **(0.62, -0.78)** (vem de cima/direita). Topos e lados direitos recebem tons quentes. |
| Sombras | Sombras azul-esverdeadas (teal/navy), nunca cinza neutro | Rampa de sombra puxa para `#111d25 → #24393c`. |
| Profundidade | Primeiro plano escuro e saturado; fundo claro, teal, enevoado | 4 planos: fundo distante (névoa), floresta média, plano do riacho, primeiro plano (moldura escura). |
| Água | Azuis/teal com cristas claras horizontais, espuma creme nas quedas | Shader de fluxo quantizado em rampa fixa de 10 cores; espuma `#f1f3e0`. |
| Pedras | Arredondadas, bege/ocre ao sol, cinza-azulado na sombra, musgo no topo | Pedras sombreadas por normal + rampa quente/fria + máscara de musgo voltada para cima. |

## 2. Paleta mestre

A paleta fica em `tools/art/palette.py` e é a única fonte de cor de todos os
assets gerados. Os shaders usam cores amostradas dela.

- **Sombras profundas**: `#0c1820 #111d25 #16222e #1e2b34 #24393c #2f4347`
- **Verdes de folhagem** (escuro → sol): `#0f2a22 #103825 #144325 #1f5131 #2b6631 #3f7c36 #5d9148 #7fa94a #a3c45a #c9da78 #e6e8a0`
- **Verdes frios / teal**: `#143835 #17413c #234748 #32564f #386c5d #487360`
- **Névoa** (fundo): `#475d5a #55796b #618e95 #779885 #7f9e8c #9fbb95 #abc79e #bbd7b7 #d6e6c8`
- **Luz**: `#f1f3e0 #fff6d0`
- **Rocha** (sombra → sol): `#2a2d30 #374043 #444746 #555955 #6d6758 #8a7f66 #999a7b #b7a37a #d4ba88 #ead4a8`
- **Terra**: `#2b2219 #3d2f22 #574231 #74583b #93714a #b38d5b`
- **Água limpa**: `#0f2429 #153e40 #1d4f55 #2b6a70 #3f8686 #5aa3a0 #7fc0b8 #a9dcd0 #d8f0e6 #f1f3e0`
- **Água turva** (estágio 1): `#2c2f20 #3d4229 #545a36 #6e7445`
- **Flores**: `#f4f1e6 #f2d35b #e98a3b #c85a7c #8c6bc8 #d94848 #5a7fd6`

## 3. Escala (revisada na v0.2.0)

1 pixel de arte = 2 px de tela em 1280×720. A referência de escala do mundo é a
**árvore frondosa adulta plantável**: ~184 px de altura, ~80 px de tronco
visível. As proporções pedidas foram aplicadas a partir dela:

| Elemento | Tamanho (px de arte) | Proporção |
|---|---|---|
| Árvores-moldura e árvores do fundo | 90–120 × 260+ | gigantes da mata antiga (como as sequoias da referência 2) |
| Árvore frondosa (adulta) | 112 × 184, tronco visível ~80 | **referência** |
| Árvore jovem | 62 × 106 | ~58% da adulta |
| Arbusto | 48 × 36 (copa ~30) | ~38% do tronco adulto |
| Samambaia | 44 × 32 | |
| Flores (touceira) | 32 × 24 | |
| Grama (touceira) | 26 × 19 | |
| Tronco caído | 60 × 22 | |
| Pedra grande / pequena | 42 × 29 / 23 × 16 | obstáculos reais na margem |
| Pedras de margem nas quedas | até ~50 × 30 | |
| Veado-catingueiro | 76 × 64 (animal ~50 × 44) | ~54% do tronco adulto |
| Visitante humano | 36 × 54 (pessoa ~40) | ~50% do tronco adulto |
| Banco / comedouro / mirante | 50×25 / 22×46 / 84×42 | assento na altura do joelho do visitante |
| Pássaro / borboleta / libélula / peixe | 13×10 / 9×6 / 10×4 / 10×3 | mantidos da v0.1 |

Não há escala por profundidade (preservaria a densidade de pixels); a área
construível começa em y = 206 para que elementos grandes não fiquem perto
demais do horizonte.

## 3.1 Personagens complexos (veado e humanos) — v0.2.0

Os sprites de veado e visitantes são produzidos por `tools/art/rig.py`, um
renderizador esquelético de pixel art:

- cada parte anatômica é um **contorno orgânico em spline** (peito, cernelha,
  garupa, coxa, jarrete, canela, quartela, casco, focinho, orelha; tronco,
  braço, antebraço, mão, coxa, canela, calçado, cabelo, roupas), não uma
  elipse ou cápsula;
- sombreamento por mapa de altura (transformada de distância → domo →
  normais) com a mesma luz global do cenário (alto à direita);
- textura de pelagem/tecido presa à parte (não "ferve" entre quadros) e
  estampas (xadrez);
- supersampling 4× → pixels de arte, rampas da paleta, contorno seletivo
  (mais escuro embaixo/à esquerda), linha de oclusão entre partes e pixels de
  detalhe (olho, focinho, chifres, alças);
- quadros para a **direita e para a esquerda** são renderizados separadamente
  (a geometria é espelhada, a luz não), então o personagem não troca de lado
  de iluminação ao virar;
- poses por ângulos de ossos; o contato dos pés/cascos com o chão é resolvido
  automaticamente a cada quadro (sem flutuar) e há sombra de contato no jogo.

Referências usadas: o veado fornecido (anatomia, pernas longas e finas,
jarrete, pescoço, cabeça em cunha, pelagem em manchas de tom) e a floresta de
sequoias (escala dos troncos e volume das samambaias). A imagem do veado foi
usada como guia de proporção e acabamento — os pixels não foram copiados.

## 4. Técnicas

- **Sombreamento por normal quantizado**: cada tufo de folha, pedra e tronco
  calcula uma normal e é mapeado para uma rampa com *ordered dithering*
  (Bayer 4×4) de baixa amplitude — gradientes suaves sem "banding" e sem blur.
- **Perspectiva atmosférica**: quanto mais distante, mais a rampa se aproxima
  das cores de névoa; contraste e saturação caem.
- **Luz salpicada (dapple)**: um mapa de luz compartilhado por chão, água e
  pedras garante iluminação coerente entre camadas.
- **Animação compatível com pixel art**: shaders rodam no SubViewport de
  resolução nativa e quantizam a saída numa rampa fixa; o balanço de vegetação
  desloca linhas inteiras de pixels (nunca sub-pixel).
- **Evolução por dissolução**: chão, pedras e vegetação de borda têm versão
  "seca" e "viçosa"; um shader troca pixels em aglomerados conforme a
  vitalidade, fazendo o verde "brotar" aos poucos.
- **Filtro nearest** em todo o projeto, sem mipmaps. Nada de interpolação.

## 5. Interface

- Painéis escuros translúcidos (`#111d25` a ~88%) com borda de madeira/musgo
  desenhada em pixel art, na mesma escala ×2 do mundo.
- Fonte **Pixelify Sans** (OFL) sem antialiasing.
- Ícones 12×12/16×16 desenhados à mão, exibidos em múltiplos de 2.
- A interface ocupa as bordas; o centro do riacho fica sempre livre.

## 6. Proibido

Pixel art retrô de baixa resolução, estética voxel, contornos pretos grossos,
flat/vetor, emojis, gradientes borrados, mistura de densidades de pixel,
redimensionamento com interpolação.
