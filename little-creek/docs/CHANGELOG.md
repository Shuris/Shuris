# Changelog

## v0.2.0 — Atualização artística e revisão de escala

### Personagens
- **Veado-catingueiro refeito** com anatomia de verdade (renderizador esquelético
  `tools/art/rig.py`): pernas longas e finas com jarrete invertido, peito fundo,
  dorso subindo até a garupa, pescoço proporcional, cabeça em cunha com focinho
  escuro e queixo claro, orelhas grandes com interior claro, cauda de face
  branca, pelagem em tons quentes. Macho (chifres curtos, como no catingueiro)
  e fêmea.
- Animações do veado: parado, caminhando (8 quadros), bebendo, abaixando e
  levantando a cabeça, observando, orelhas, cauda, alerta e **fuga em galope**
  (cauda erguida mostrando o branco), para direita e esquerda.
- **Três visitantes com identidade própria**: Seu Antônio (observador de aves:
  chapéu, barba, colete, binóculo), Lia (fotógrafa: rabo de cavalo, corta-vento,
  câmera) e Davi (trilheiro: cabelo crespo, camisa xadrez, mochila grande com
  isolante). Animações: caminhar, parado, sentado, observar (binóculo ou mão nos
  olhos), fotografar, alimentar pássaros.
- Sombra de contato sob veado e visitantes; pés/cascos ancorados no chão.
- Pássaros, borboletas, libélulas e peixes mantidos.

### Escala do mundo
- Escala de referência definida pela árvore adulta (ver `ART_DIRECTION.md` §3).
- Todos os elementos construíveis redesenhados maiores e mais volumosos;
  touceiras de flores e grama perceptíveis; arbustos que preenchem o terreno.
- Pedras das margens e das quedas d'água maiores; pedra grande com seixos.
- Trilha mais larga para visitantes do novo tamanho.
- Pontos onde o veado bebe recalculados: patas em terra seca, focinho na água,
  longe das cascatas.
- Itens agora têm "pegada" no chão (`footprint` em `data/items.json`): copas
  podem se sobrepor (Y-sort), bases não.

### Sistemas (sem regressões)
- `Creature` escolhe animações direcionais (`*_l`) e cria sombra de contato.
- Veado alterna macho/fêmea, mexe orelhas/cauda, ondulações saem do focinho.
- Visitante senta no banco sem ajustes manuais de deslocamento.
- Autoteste: 19 verificações (14 antigas + animações em ambas as direções,
  ciclo completo do veado, fuga ao toque, visitante percorrendo a trilha).

### Limitações conhecidas da v0.2.0
- Só um ponto de bebida passa na validação (margem direita, trecho calmo): as
  outras margens têm curvas ou pedras grandes demais. Remodelar um trecho da
  margem esquerda daria variedade.
- A segunda imagem enviada como "referência humana" era a floresta de
  sequoias; os humanos seguiram a descrição textual e o nível de acabamento do
  veado de referência. Uma referência de personagem permitiria um ajuste fino.
- Ainda não testado em aparelho Android físico.

## v0.1.0 — Primeiro protótipo jogável
Ver `docs/Little_Creek_Relatorio_Prototipo.pdf` (relatório da v0.1.0).
