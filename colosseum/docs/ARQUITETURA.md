# Arquitetura — COLOSSEUM

## Visão geral

```
┌────────────── Processo principal (Node/Electron) ──────────────┐
│ main.ts           protocolo app://, instância única, atalhos    │
│ windowManager.ts  janela única, modos completo/companion,       │
│                   sempre no topo, opacidade, clique-através     │
│ ipcHandlers.ts    IPC validado (remetente + argumentos)         │
│ saveStore.ts      gravação atômica + backup em userData/saves   │
│ settingsStore.ts  preferências da janela                        │
│ tray.ts           ícone na bandeja (saída de emergência)        │
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

## Janela e modo companion

Há uma única janela sem moldura (barra de título própria no modo completo). Alternar o modo
apenas muda tamanho, tamanho mínimo, "sempre no topo" e opacidade — **sem recriar a janela**,
então uma batalha em andamento continua. Clique-através usa `setIgnoreMouseEvents(true,
{ forward: true })` e só é permitido no modo companion; é desligado automaticamente ao voltar
ao modo completo, pode ser revertido pelo atalho global Ctrl+Shift+X e pelo menu da bandeja, e
nunca é restaurado ao reiniciar. Posições salvas são verificadas contra os monitores
conectados para a janela nunca abrir fora da tela.
