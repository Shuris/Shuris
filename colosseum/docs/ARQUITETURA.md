# Arquitetura — COLOSSEUM

## Visão geral

```
┌────────────── Processo principal (Node/Electron) ──────────────┐
│ main.ts           protocolo app://, instância única             │
│ windowManager.ts  janela única, maximizar, tela cheia (F11)     │
│ ipcHandlers.ts    IPC validado (remetente + argumentos)         │
│ saveStore.ts      gravação atômica + backup em userData/saves   │
│ settingsStore.ts  preferências da janela                        │
└───────────────▲─────────────────────────────────────────────────┘
                │ IPC (contrato em src/shared/ipc.ts)
┌───────────────┴──── preload.ts (contextBridge) ─────────────────┐
│ expõe window.colosseum = { save, win, app } — nada além disso   │
└───────────────▲─────────────────────────────────────────────────┘
┌───────────────┴──────────── Renderer ───────────────────────────┐
│ core/   lógica pura (sem DOM/Phaser) — testável em Node         │
│   model/types.ts      tipos do domínio                          │
│   data/               equipamentos, habilidades/estratégias,    │
│                       atributos/origens, adversários            │
│   systems/            Attribute, Equipment, Progression,        │
│                       Training, Save, PlayerFactory, rng        │
│   combat/             CombatEngine (simulação), CombatResolver  │
│                       (fórmulas), CombatTypes, CombatantFactory │
│   GameStore.ts        estado + notificação + autosave           │
│ game/   renderização Phaser                                     │
│   Game.ts             fachada usada pela UI                     │
│   scenes/             Boot, Hub (ludus/treino), Arena (batalha) │
│   DayNight.ts         céu dinâmico e luz ambiente               │
│ audio/SoundManager    efeitos sonoros sintetizados (Web Audio)  │
│   entities/Gladiator  sprite em camadas (paper doll)            │
│   assets.ts, layout.ts (câmera responsiva), fx.ts               │
│ ui/     interface HTML/CSS                                      │
│   App.ts              controlador (fluxos, modos, batalha)      │
│   screens/            Intro, MainMenu (Arena), Character,       │
│                       Inventory, Training, History, BattleHud,  │
│                       BattleResult                              │
│ platform/bridge.ts    acesso à API do preload (+ fallback web)  │
└─────────────────────────────────────────────────────────────────┘
```

## Segurança do Electron

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`.
- O renderer é servido pelo protocolo privilegiado `app://colosseum/` (com proteção contra
  *path traversal*), não por `file://`.
- CSP restritiva em `index.html` (`script-src 'self'`).
- Navegação e novas janelas são bloqueadas (`will-navigate`, `setWindowOpenHandler`).
- Cada handler IPC confere se o remetente é a janela do jogo numa URL permitida e valida
  tipos/limites dos argumentos (ex.: tamanho máximo do save de 5 MB, opacidade mínima 30%).
- O preload expõe apenas funções específicas — nunca `ipcRenderer` ou módulos do Node.

## Combate: lógica separada da renderização

`CombatEngine` é uma simulação determinística (semente) em passos fixos de 50 ms. Ela não
conhece Phaser: mantém posição, vida, resistência, ação atual, ataques pendentes, reações,
recargas e *buffs* de cada lutador, e emite eventos (`action`, `attack`, `impact`, `skill`,
`exhausted`, `end`...). A `ArenaScene` apenas:

1. acumula o tempo real (× velocidade escolhida) e chama `engine.step()` em passos fixos;
2. interpola posições entre passos;
3. traduz eventos em animações/efeitos (preparação → golpe no instante do impacto → recuperação,
   bloqueio, esquiva, atordoamento, exaustão, vitória/derrota, textos de dano, faíscas, torcida).

O mesmo motor roda sem tela nos testes de balanceamento e na estimativa de chance de vitória
mostrada na Arena (40 simulações reais com os atributos atuais).

### Fluxo de uma luta

Apresentação (entrada pelos portões) → "LUTEM!" → aproximação até o alcance da arma →
avaliação de distância (lanças/tridentes recuam para manter distância; estratégias cautelosas
esperam o adversário) → ataques com preparação/impacto/recuperação → o defensor pode reagir
(bloquear/esquivar) conforme estratégia, escudo e fôlego → habilidades automáticas → fim por
nocaute, decisão (120 s) ou desistência.

### Fórmulas (src/renderer/core/systems/AttributeSystem.ts e combat/CombatResolver.ts)

| Grandeza | Fórmula |
| --- | --- |
| Vida máxima | 100 + VIT × 12 |
| Resistência máxima | 100 + RES × 10 |
| Dano básico | 8 + FOR × 1,8 + dano da arma |
| Redução de dano | D / (D + 100), D = defesa dos itens + RES × 1,5 − perfuração (PRE × 1) — máx. 70% |
| Chance de acerto | 85% + (PRE − PRE do adversário) × 0,5% — entre 50% e 98% |
| Esquiva | 5% + AGI × 0,5% — limite 35% (metade se o defensor não reagir ativamente) |
| Intervalo de ataque | 2,0 s − AGI × 0,032 + modificadores dos itens — mínimo 0,8 s |
| Crítico | 4% + TEC × 0,2% + PRE × 0,6% (×1,6 de dano) |
| Bloqueio | eficiência do escudo (ou 20% aparando com a arma) + TEC × 0,2% |
| Fadiga | custos × 1/(1 + RES × 0,015); abaixo de 25% de fôlego: −15% dano, +25% intervalo |

`DAMAGE_PACE = 0,36` ajusta a duração das lutas para a faixa de 45–90 s sem alterar as proporções
(as fórmulas puras geram lutas de ~20 s). Os valores foram calibrados com `npm run balance`.

## Personagens em camadas ("paper doll")

Cada gladiador é um `Container` com várias folhas de sprite empilhadas — corpo (3 tons de pele,
em 3 camadas: braço/perna de trás, tronco/cabeça, braço da frente), tanga (tingida), cinto,
cabelo/barba (tingidos), arma, escudo, capacete, armadura e grevas. Todas as folhas usam a mesma
grade e a mesma ordem de quadros, e o `GladiatorView` aplica o mesmo índice de quadro a todas
as camadas. Assim cada equipamento aparece no personagem, e raridades usam tintas sobre a
mesma arte.

### Substituindo a arte

`src/renderer/public/assets/sprites/gladiator/manifest.json` descreve: tamanho do quadro
(112×88), origem (pés em 56,83), quadros de cada animação (`idle`, `walk`, `attack`, `block`,
`hit`, `dodge`, `victory`, `defeat`), a ordem das camadas e o arquivo de cada folha. Para usar
arte desenhada à mão basta substituir os PNGs mantendo nomes, grade e ordem de quadros (ou
ajustar o manifesto) — nenhuma linha do combate precisa mudar. Cenários (`backgrounds/`),
efeitos (`sprites/fx/`) e ícones (`ui/`) também são PNGs comuns.

## Persistência

`GameStore` agenda o salvamento 400 ms após cada alteração e força a gravação síncrona ao
fechar (`beforeunload` → `save:write-sync`). No processo principal, `SaveStore` grava em
`userData/saves/gladiador.json` via arquivo temporário + `fsync` + `rename`, copiando antes a
versão válida anterior para `gladiador.backup.json`. Na leitura, `SaveSystem.parseSave` valida o
formato, descarta itens/equipamentos inexistentes e limita valores fora da faixa; se o arquivo
principal estiver corrompido, o backup é usado.

## Janela

Uma única janela sem moldura (barra de título própria). Tela cheia por botão, F11 (tratado no
processo principal, funciona mesmo antes da interface carregar) ou Esc para sair; o estado é
lembrado em `window-settings.json`. Posições salvas são verificadas contra os monitores
conectados para a janela nunca abrir fora da tela.

## Armas rígidas

As armas não fazem parte das folhas de quadros. O gerador desenha cada arma **uma única vez**
(`weapon_*.png`, apontando para a direita, com o ponto de empunhadura conhecido) e grava no
manifesto, para cada quadro, a posição da mão e o ângulo da arma (`hands`). O `GladiatorView`
posiciona e gira essa imagem a cada quadro, então a lâmina nunca muda de forma.

## Arenas

`core/data/arenas.ts` define 5 anfiteatros; `arenaForOpponent` escolhe o da dupla de
adversários (índice ÷ 2). Os fundos e camadas de público são gerados por
`tools/gen_arenas.py` a partir de temas (madeira, pedra, cores, velário, cenário ao fundo) e
compartilham a mesma geometria do pódio/areia, então o combate não muda.

## Dia e noite

`core/systems/TimeOfDay.ts` (lógica pura e testada) dá a hora do jogo: ciclo rápido de 10
minutos ou relógio do computador. `game/DayNight.ts` desenha o céu atrás dos cenários (que têm
o céu transparente), move sol/lua, mostra estrelas e aplica uma camada de luz ambiente em modo
*multiply* sobre cenário e gladiadores; os brilhos dos braseiros ficam por cima, em modo
*add*, e aumentam à noite.

## Som

`audio/SoundManager.ts` sintetiza todos os efeitos com osciladores, ruído filtrado e envelopes
(sem arquivos de áudio). A `ArenaScene` toca sons a partir dos eventos do motor de combate; a
interface toca cliques, moedas, equipar e subir de nível. Volume e mudo ficam no salvamento.

## Cidade, dias, árvore e jornal (0.3.0)

- `core/data/locations.ts` — locais, horários e posição no mapa. `game/scenes/MapScene.ts`
  desenha o mapa e anima o marcador; `game/scenes/HubScene.ts` é a cena genérica de local
  (cenário, luzes, poste de treino no ludus, animação de dormir).
- `core/systems/CalendarSystem.ts` — relógio (minutos do dia), energia, custos de cada ação,
  horários, viagens, sono, cochilo e termas. Regras puras e testadas.
- `core/data/skillTree.ts` + `core/systems/SkillTreeSystem.ts` — nós, pré-requisitos, custos,
  aprender/recomeçar, soma dos efeitos e escolha automática para adversários.
  `CombatantFactory.applyPerks` aplica os efeitos sobre as estatísticas; o motor de combate usa
  os novos campos (`damageMul`, `damageTakenMul`, `hitBonus`, `blockPierce`,
  `powerStrikeBonus`, `secondWind`).
- `core/systems/NewsSystem.ts` — gera notícias a partir de eventos (fama, vitórias,
  sequências, níveis) com modelos de texto e publica a edição ao acordar.
- Salvamento versão 2 (`SaveSystem`): novos campos validados; saves v1 migrados.

## Clima e semana (0.4.0)

- `core/systems/WeatherSystem.ts` — previsão determinística por gladiador (semente =
  data de criação) e dia: dias chuvosos, horário e intensidade com transição.
  `game/DayNight.ts` aplica nuvens, céu cinzento, luz ambiente mais escura, gotas
  (atrás do cenário em interiores) e o som de chuva.
- `core/data/locations.ts` — dias da semana (`weekdayName`) e `closedSunday`;
  `CalendarSystem.canTrade` bloqueia compra/venda com o mercado fechado.
- Moradores do mercado usam o mesmo sistema de camadas dos gladiadores, com as folhas
  `tunic`/`robe` tingidas.

## Idiomas, taverna, melhorias, jornal e diálogos (0.5.0)

- `i18n/` — `t(chave, parâmetros)` com dicionários `pt.ts` e `en.ts`. O tipo de `en.ts`
  exige todas as chaves do português (o TypeScript acusa qualquer texto faltando). Dados do
  jogo (itens, adversários, habilidades, locais) mantêm o português nos próprios arquivos e o
  inglês em `i18n/data.ts` (testado). A preferência fica em `localStorage` e no salvamento;
  trocar o idioma redesenha moldura, painel, status, cena e mapa.
- `core/data/upgrades.ts` — melhorias permanentes; `CalendarSystem.napEnergy/trainEnergy` e
  `TrainingSystem.trainingGain` aplicam os efeitos. A `HubScene` desenha camas, pesos,
  estacas, pista, palus reforçado e o doctore conforme o que foi comprado.
- `core/systems/TavernSystem.ts` — refeição, boatos (1x por dia, +1 fama) e conversa.
- `core/systems/NewsSystem.ts` — cada notícia guarda o **modelo** (`tpl`) e as variáveis
  (ids), e é montada no idioma atual ao ser exibida; `img` aponta para uma ilustração em
  `assets/news/` (geradas por `tools/gen_v05.py`: cenas compostas com as próprias folhas do
  jogo e convertidas em retícula ordenada de duas tintas).
- `core/data/dialogue.ts` + `game/speech.ts` — falas por personagem e momento (variantes
  separadas por `|`) e o balão de fala em pixel art que acompanha quem fala.
- Combate: a `ArenaScene` mantém uma coreografia visual por lutador (investida, empurrão,
  salto, inclinação) somada à posição do motor, mais um afastamento fixo; o motor e o
  balanceamento não mudaram. O manifesto lista em `weaponTop` os quadros em que a arma e o
  braço (folha `arm_top_*`) passam à frente do escudo.
- Salvamento versão 3: `upgrades`, `tavern`, `settings.language` e notícias com `tpl/v/img`.

## Menu, saves, eventos, torneio e rivais (0.6.0)

- **Saves**: `SaveStore` (processo principal) grava `saves/slot1..3.json` (+ backup de cada um); o IPC recebe o número do espaço e o valida (`isSlot`). `TitleScreen` lê os três espaços e mostra um resumo; `App` guarda o espaço em uso e o `GameStore` grava nele. Save versão 4 (`SaveSystem.v4Fields`): `rivals`, `rematch`, `lastRematchDay`, `injury`, `tournament`, `events` e `plus` nos itens.
- **Janela**: moldura do sistema, sem barra própria; sempre abre em tela cheia. `App.openPause` pausa a cena Phaser ativa (`GameView.setPaused`).
- **Eventos** (`core/systems/EventSystem.ts`): festival (`day % 14 === 10`), dias do mercador (sequência com intervalos de 6 a 10 dias, semeada pelo `createdAt`), estoque do mercador e queda de braço. Tudo determinístico por gladiador e dia.
- **Lutadores avulsos** (`core/data/fighters.ts`): 9 tipos (`CLASSES`, com equipamento por faixa de nível) e 16 lutadores (`POOL`). `poolOpponent` gera um `OpponentDef` com `cls`; `freeChallenger` escolhe o desafiante de cada luta do dia.
- **Torneio** (`TournamentSystem.ts`): inscrição, `buildBracket`, rodadas (`roundPairs`, `playerMatch`), simulação das outras lutas com o `CombatEngine` e prêmios (`closeTournament`). A janela da chave é `ui/screens/TournamentView.ts`.
- **Rivais e ferimentos** (`RivalSystem.ts`): memória por adversário, pedido de revanche (raro, com treino), `ladderCheck` (derrotado só luta com revanche ativa), `introMoment` (intro/gloat/rematch), ferimento e médico. O ferimento reduz vida e dano em `playerCombatant`.
- **Lutas por modo**: `FightMode = 'ladder' | 'free' | 'rematch' | 'tournament'`; `App.prepareFight` monta adversário, arena e voz; `applyBattleResult` recebe o modo (desbloqueio só na escada, revanche rende mais, festival dobra a fama).
- **Ferreiro** (`ForgeSystem.ts`, `equipment.forged`): o item do inventário tem `plus` (0 a 3); `equippedItems` devolve a versão melhorada.
- **Arte** (`tools/gen_v06.py`): retratos 48×48 (adversários, avulsos, moradores e camadas do jogador tingidas no jogo), arte do menu, enfeites do festival, carroça, forja, mesa e ilustrações do jornal. O público ganhou os quadros 3 e 4 (de pé) e uma versão lotada (`crowdfest_*`).
- **Cenas**: `ArenaScene` tem câmera lenta/zoom no golpe final (`finalBlow`), ovação (`standing`) e pétalas; `SkyLayer` faz poças, respingos, ondinhas e relâmpagos; os balões ficam só com texto e não se cobrem: `speech.ts` guarda os balões visíveis e o mais novo sobe acima do anterior. Os retratos aparecem na interface HTML (`ui/components/portraits.ts`).
- **Música** (`audio/Music.ts`): sequenciador Web Audio com 5 faixas, usando o contexto do `SoundManager` mas com volume próprio (preferência no `localStorage`). `App.updateMusic` escolhe a faixa pelo lugar e pela hora.

## Mapa e jornal (0.6.2)

- `tools/gen_map.py` desenha o mapa (`MAP_POS` precisa bater com `map` em `core/data/locations.ts`). `MapScene` usa a tabela `LABEL` para a distância do nome e a área clicável de cada prédio, e desenha a plaquinha atrás do nome.
- `tools/gen_news.py` monta as ilustrações do jornal (`Scene`: fundo, camada intermediária e personagens) e converte em gravura: o fundo clareado, os personagens com contorno e halo. As imagens saem com ampliação 2x e o jornal as mostra suavizadas (`image-rendering: auto`) para não criar moiré.

## Falas, sangue, golpe final, visual e colisão (0.7.0)

- `speech()` aceita `onDone` e garante 3 s no ar. `ArenaScene.say` usa uma fila: uma fala por vez. Na cidade só quem tem `auto` (o monge) fala sozinho (`MONK_EVERY`); os outros moradores são interativos (`HubScene.makeClickable`).
- `predictFinale(setup)` roda a mesma luta com a mesma semente e devolve o início do ataque fatal; `ArenaScene.startFinale` faz zoom, câmera lenta (0,2) e escurece o cenário (retângulo atrás dos lutadores + holofote).
- Sangue: partículas em `ArenaScene.blood`, manchas desenhadas em `bloodGround` (fica até o fim da luta).
- `game/shaders.ts`: `applyLook()` (ColorMatrix + vinheta da câmera) em todas as cenas; texturas de luz criadas em tempo de execução. Público em primeiro plano: `fx:crowd_front` (gerado em `gen_v06.crowd_front`).
- Objetos de cena (`gen_v06.props`): `HubScene.addProp` registra a pegada; `blocked()` e `freeX()` evitam sobreposição; profundidade por `depthAt(y)`.
- Jornal: `NewsSystem.editionItems()` remove notícias repetidas sobre o mesmo adversário e deixa só um resultado de luta por edição.

## Clima do dia e locais que fecham (0.7.1)

- `WeatherSystem.weatherOfDay` devolve `kind` (`sun`, `cloudy` ou `rain`) para o dia inteiro; `weatherAt` é constante durante o dia.
- `HubData.openNow()` diz se o local está aberto; `HubScene` não cria figurantes em local fechado e, se o local fechar com gente, chama `departAll()` (cada um sai andando pela borda mais próxima). `rainyDay` e `minutes` deixam a taverna mais cheia em noite de chuva.
- Textos novos em `i18n/pt07.ts` e `en07.ts` (substituem as falas antigas pelas listas completas).

## Iluminação, fama e carreira (0.8.0 e 0.9.0)
- **Mapa de iluminação** (`game/DayNight.ts`): à noite, em vez de um retângulo que só multiplica a cor do ambiente, um `RenderTexture` é preenchido com a luz ambiente e recebe "poças" de luz aditivas em volta de cada fonte (`addLight`). É redesenhado só quando o ambiente muda ou cerca de 12 vezes por segundo, para a tremulação.
- **Carreira** (`PlayerState.career`, save versão 5, validado em `SaveSystem.careerFields`). Saves antigos começam com a carreira vazia. Os sistemas puros ficam em `core/systems/`:
  - `InviteSystem`: convites por fama, amistosos e o torneio de Baiae (semifinal e final; a outra semifinal é simulada pelo motor).
  - `VenatioSystem`: dias de feras, sorteados de forma estável por gladiador. As feras são `OpponentDef` com `beast`. `CombatantFactory.BEAST_STATS` dá alcance das garras e multiplicadores de dano e vida, calibrados para cerca de 40% de vitória de um gladiador médio.
  - `DuoSystem`: respeito, amigos, parceiro e o revezamento. O motor aceita `startHp`, e a interface encadeia os assaltos.
  - `CrowdSystem`: favor da plateia, uma função pura sobre os eventos do motor; polegar e fama.
  - `QuestSystem`: missões dos moradores.
  - `RankingSystem`: tabela da cidade; lutas noturnas simuladas ao dormir.
- **Feras e bichos na cena**: folhas `sprites/beasts/beast_<tipo>.png` com exatamente os mesmos 29 quadros e animações do gladiador (`tools/gen_beasts.py`). A `GladiatorView` com `visual.beast` usa uma única folha, e a cena da arena não precisa saber que é um animal.
- **Arenas particulares**: temas `PRIVATE` em `tools/gen_arenas.py`, gerados com RNG próprio (não alteram os outros cenários), e `PRIVATE_ARENAS` em `core/data/arenas.ts`.
- **Boneco** (`ui/components/doll.ts`): monta as mesmas camadas num canvas. O manifesto é lido por XHR, porque `fetch` não lê `file://` no Electron.
