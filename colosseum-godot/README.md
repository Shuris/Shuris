# COLOSSEUM — versão Godot

Porte do COLOSSEUM (versão Electron/Phaser em `../colosseum`) para o **Godot 4.3**
(GDScript, renderizador de compatibilidade, leve em PCs simples). Feito por etapas;
cada etapa gera um executável para testar.

| Etapa | Conteúdo | Situação |
|---|---|---|
| 1 | Base, save compatível, menu, criação do gladiador, cidade (locais), mapa e viagem, painel de status, pausa e opções | **pronta** |
| 2 | Arena e combate completos | a fazer |
| 3 | Sistemas: treino, mercado, torneio, feras, duplas, rivais, jornal, ranking, taverna, templo | a fazer |
| 4 | Detalhes visuais (clima, plateia, balões, figurantes) e melhorias do Godot | a fazer |

## Visual em pixel art
- O jogo inteiro é desenhado numa grade de **640x360** pixels e ampliado em **escala
  inteira** (1920x1080 = 3x): cada pixel da arte é um pixel nítido na tela.
- Os personagens usam as camadas da versão atual em **1x** (sem a passada de resolução
  dupla), mais pixelados; nos locais a câmera aproxima 2x.
- **Paleta única**: um filtro (`shaders/palette.gdshader`) leva cada cor do mundo para a
  paleta de 48 cores tirada da própria arte (`assets/palette.png`), com retícula leve:
  cenários e personagens ficam no mesmo conjunto de cores.
- **Luz 2D de verdade**: braseiros e lamparinas acendem à noite (`PointLight2D` com luz
  em faixas) sobre o mundo escurecido pela hora do dia (`CanvasModulate`).
- Céu pixelado com sol, lua, estrelas e nuvens conforme a hora.
- Fontes em pixel VT323 e Pixelify Sans (licença OFL, em `assets/fonts`).

## Saves
Mesmo formato da versão Electron (`{format: "colosseum-save", version: 5, player}`),
com os mesmos campos: os saves atuais abrem aqui e vice-versa. Os saves ficam em
`user://saves` (no Windows: `%APPDATA%\Godot\app_userdata\Colosseum\saves`). Na primeira
vez, se o espaço estiver vazio, o jogo lê o save da versão Electron
(`%APPDATA%\Colosseum\saves`), sem apagá-lo.

## Estrutura
- `data/` — dados e textos exportados da versão TypeScript (mesmos números):
  `npx vite-node tools/export-godot.ts` (na pasta `colosseum`).
- `assets/` — arte (gerada por `python3 tools/build_assets.py`).
- `scripts/autoload` — `Data`, `I18n`, `Saves`, `Game`.
- `scripts/core` — regras sem interface (criação, save, calendário).
- `scripts/world` — gladiador em camadas, local da cidade, mapa, céu.
- `scripts/ui` — menu, criação, painéis, pausa, opções e tema.

## Rodar, testar e exportar
```bash
godot --path .                                        # jogar
godot --headless --path . res://tests/run_tests.tscn  # testes (lógica e fluxo)
godot --path . res://tests/shots.tscn -- <pasta>      # capturas para conferência
godot --headless --path . --export-release "Windows Desktop" build/Colosseum.exe
```
