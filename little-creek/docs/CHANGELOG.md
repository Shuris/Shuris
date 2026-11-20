# Changelog

## v0.4.0 — Correções visuais, distribuição inteligente e coelhos

### Copas das árvores sem buracos
- **Causa**: as copas eram feitas só de "tufos" de folhas sobrepostos; entre
  tufos vizinhos sobravam pixels transparentes (até 12 px fechados, além de
  recortes abertos na borda). No inverno, o shader de estação ainda apagava
  tufos inteiros no meio da copa.
- **Correção na geração** (`pixlib.foliage_cluster`): depois dos tufos, os
  vãos internos recebem folhagem sombreada de profundidade (fechamento
  morfológico só dentro da silhueta, que continua a mesma); uma rede de
  segurança (`fill_enclosed_holes`) preenche qualquer pixel transparente
  totalmente cercado em árvores, arbustos, samambaias, copas do fundo e
  folhagem do primeiro plano. Medição: 0 pixels transparentes fechados em
  todos os 16 sprites de folhagem (antes: até 84 px por sprite).
- **Correção no shader**: o raleamento de outono/inverno só remove folhas da
  franja externa da copa; no interior as folhas escurecem (efeito de copa rala
  sem buracos).

### Distribuição inteligente
- `AutoPlacer` reescrito: o terreno é dividido em 18 regiões e cada uma gera
  candidatos (amostragem estratificada, não só aleatória). Regras rígidas:
  zona válida, **pegada inteira fora das estradas**, sem colisão, distância
  mínima por tipo. Regras por categoria: grama espalhada por regiões pouco
  usadas; flores em pequenos grupos de 2–3 em regiões diferentes; arbustos em
  grupos de tamanho variado, sem fechar passagens; árvores espaçadas, no fundo
  e nas laterais, fora do corredor de visão do riacho e da ponte; pedras nas
  margens; plantas aquáticas espaçadas na água calma.
- Teste com todas as compras até o limite: flores em ≥4 regiões (máx. 4 por
  região), grama em ≥7 regiões (máx. 3), arbustos em ≥3 grupos, árvores a ≥54
  px uma da outra, nenhuma sobreposição.
- Posições continuam salvas e idênticas após fechar e abrir (testado).

### Estradas protegidas
- Máscara de estrada com margem de segurança de 5 px, incluindo o vão da
  ponte. Cada elemento verifica 25 pontos: elipse da base e a faixa visual do
  sprite (estruturas 70% da altura, plantas e pedras 60%, árvores o tronco).
  Vale para todos os itens, atuais e futuros.

### Ponte
- Desenhada em coordenadas do mundo a partir das margens: começa exatamente no
  fim da trilha oeste e termina exatamente no início da trilha leste (mesmos
  pontos), com tabuleiro da mesma largura da estrada naquela profundidade,
  pilares de pedra nas margens, corrimão de trás e da frente. As pontas das
  trilhas são cortadas retas no tabuleiro. O caminho dos visitantes vem do
  próprio desenho.

### Coelhos
- Coelho-do-mato em três pelagens (marrom, cinza, branco com manchas
  marrons), feito no mesmo esqueleto anatômico: parado, orelhas, alerta,
  comendo, descansando e salto de 4 quadros, nas duas direções.
- Comportamento: sai de baixo de um arbusto, observa, pula em séries curtas
  com pausas, come touceiras de grama (que balançam), descansa perto de
  árvores e arbustos, esconde-se atrás dos arbustos, foge para o arbusto mais
  próximo quando tocado, com visitantes perto ou com a raposa por perto. Nunca
  atravessa o riacho nem para sobre estradas ou água.
- Aparece mais ao amanhecer e entardecer, mais na primavera, menos no inverno,
  nunca na chuva forte ou com visitantes; no máximo 2. Exige vitalidade 40%,
  arbustos e grama. No diário de biodiversidade.

### Saves antigos
- Elementos de saves anteriores (ou do cenário inicial) que encostem numa
  estrada são movidos uma única vez para o ponto válido mais próximo; a nova
  posição é salva e não muda mais.

### Testes
- Autoteste: 60 verificações (passou em duas rodadas seguidas com sorteios
  diferentes). Não testado em aparelho físico; áudio continua sem escuta humana.

### Animais
- Pontos de parada de animais (raposa/lobo-guará, coelhos) validados: terreno
  válido, fora das estradas e da água, longe da base de árvores, pedras e
  construções.


## v0.3.0 — Ecossistema vivo: clima, estações e imersão

### Tempo e atmosfera
- **Ciclo de dia e noite** (`Clock`): amanhecer, dia, entardecer e noite, com
  transições graduais. Um shader de gradação muda luz, temperatura de cor,
  sombras (split-toning), saturação, vinheta e brilhos na água; raios de sol
  viram luar azulado à noite; névoa matinal; poeira só com sol. Um dia de jogo
  dura 24 min reais (configurável).
- **Estações** (30 dias de jogo cada, configurável): a vegetação muda aos poucos
  ao longo de dias, por regiões (uma copa vira antes da outra). Primavera com
  flores nas copas e no campo; verão mais saturado e luminoso; outono laranja e
  vermelho, folhas caindo e acumuladas nas margens; inverno com copas ralas, tons
  frios e geada de manhã e à noite. Menos animais e silêncio no inverno.
- **Chuva fraca e forte** (`Weather`): eventos com chance por estação, duração e
  intervalo mínimo. Gotas em duas camadas de profundidade, respingos no chão,
  anéis de chuva na água, correnteza acelerada, mais espuma e água turva na
  chuva forte, relâmpagos e trovões, poças que enchem e secam aos poucos (só em
  pontos baixos do terreno, longe de árvores e pedras) e arco-íris depois de
  algumas chuvas diurnas.
- **Correnteza melhorada**: redemoinhos ao redor das pedras (o mapa de fluxo
  contorna as rochas), ondas estacionárias atrás delas, ondulações cruzadas de
  vários tamanhos, variação regional de velocidade.
- **Vagalumes** com brilho próprio numa camada de luz aditiva, movimento
  irregular e piscar individual; mais no verão, nenhum no inverno.
- **Folhas que caem e flutuam**: seguem o vento, flutuam na correnteza,
  contornam as pedras e se acumulam nas margens; muito mais no outono.

### Vida selvagem
- Cada espécie tem **horários, estações e reação ao clima** (`data/fauna.json`):
  pássaros de manhã, borboletas de dia na primavera/verão, veados ao amanhecer e
  ao entardecer, corujas à noite, raposas quando não há pessoas.
- Novas espécies: **corujinha-do-mato**, **raposa-do-campo**,
  **marreca-pé-vermelho** (com patinhos na primavera) e o raríssimo
  **lobo-guará**. **Filhote de veado** (com pintas) segue a mãe.
- **Ninhos**: pássaros constroem ninhos nas árvores plantadas (gravetos → ninho
  → ovos → filhotes alimentados pelos adultos → abandono).
- **Acontecimentos naturais** (`NatureEvents`): grupo de borboletas, veado com
  filhote, novo ninho, patos no riacho, arco-íris, flor rara, bando de pássaros,
  folhas de outono, cheia na chuva forte, animal raro. Probabilidades, intervalos
  e pausa mínima configuráveis; avisos discretos.
- **Diário de biodiversidade**: espécies (silhuetas até a descoberta) com
  ilustração, descrição, avistamentos, horário, estação, habitat, curiosidade e
  data do primeiro avistamento; aba de acontecimentos. Aviso "Nova espécie
  descoberta!".

### Visitantes e construção
- Visitantes **bem mais raros** (2,5 a 6 min entre grupos, no máximo um grupo),
  dependentes de beleza, construções, trilha, estação, chuva e hora (ninguém à
  noite). **Perfis sazonais**: fotógrafos e observadores de aves na primavera,
  famílias (com criança) no verão, fotógrafos de folhas no outono, raros no
  inverno.
- **Ponte de madeira** (estágio 4): só depois dela os visitantes atravessam o
  riacho, sempre sobre o tabuleiro em arco, com o corrimão da frente desenhado
  na frente deles. Uma trilha nova na outra margem aparece com a ponte.
- **Compra automática**: comprar adiciona o elemento ao cenário sozinho
  (`AutoPlacer`), com regras por categoria (flores em manchas no campo aberto,
  pedras nas margens, samambaias na sombra/umidade, arbustos nas bordas,
  árvores espaçadas nas laterais, plantas aquáticas na água calma, banco e
  comedouro ao lado da trilha). Cada item tem limite e o cartão mostra
  quantidade, limite e preço da próxima unidade. O posicionamento manual foi
  removido.

### Áudio
- **Trilha lo-fi** sintetizada: piano elétrico, violão dedilhado, batida
  discreta com swing, chiado de vinil; uma faixa por período (manhã, dia,
  entardecer, noite) com troca suave e variação no inverno.
- **Ambiente dinâmico**: água, vento, coro de pássaros de manhã, insetos à
  tarde, grilos à noite, chuva fraca/forte, trovões, corujas, raposa, patos;
  sons pontuais aleatórios para não soar repetitivo.
- Volumes independentes de **música**, **sons ambientes** e **efeitos**.

### Modo fotografia
- Botão da câmera: esconde a interface, zoom ×1 a ×4 (níveis que mantêm os
  pixels nítidos), arrastar para enquadrar, pinça, "Enquadrar" para voltar e
  "Capturar" (PNG em `user://photos`, sem interface).

### Técnico
- Configuração central em `data/config.json` (tempo, chuva, acontecimentos,
  animais, visitantes, efeitos) e `data/fauna.json`.
- Salvamento persiste relógio, estação, clima, ninhos, diário, acontecimentos,
  patos residentes, compras e ponte. O tempo offline avança no máximo 18 horas
  de jogo (as estações nunca passam voando) e não dispara rajadas de eventos.
- O mundo agora é exibido por um TextureRect com shader de gradação e uma
  segunda viewport de luz aditiva; zoom e enquadramento no `Main`.
- Autoteste: 44 verificações.

### Limitações conhecidas da v0.3.0
- **Áudio sintetizado não foi ouvido por uma pessoa**: verificado só por duração,
  volume e ausência de saturação. As faixas lo-fi (1,5–2 min) reiniciam ao fim
  sem crossfade interno.
- **Desempenho não medido em celular**: neste ambiente só há renderização por
  software (~28 fps a 1280×720). Os scripts somam menos de 0,15 ms por quadro;
  o custo real depende da GPU do aparelho (shaders de água, gradação e a
  segunda viewport de luz).
- O veado ainda tem um único ponto de bebida (margem direita).
- Remover elementos não está mais na interface (a compra é automática);
  a função existe no código.
- Os limites de compra e as probabilidades de acontecimentos não passaram por
  playtest.


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
