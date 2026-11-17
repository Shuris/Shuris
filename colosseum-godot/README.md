# COLOSSEUM — versão Godot

Porte do COLOSSEUM (versão Electron/Phaser em `../colosseum`) para o **Godot 4.3**
(GDScript, renderizador de compatibilidade, leve em PCs simples). Feito por etapas;
cada etapa gera um executável para testar.

| Etapa | Conteúdo | Situação |
|---|---|---|
| 1 | Base, save compatível, menu, criação do gladiador, cidade (locais), mapa e viagem, painel de status, pausa e opções | **pronta** |
| 2 | Arena e combate completos (motor portado com teste de paridade com o TypeScript), HUD, resultado, duplas simultâneas | **pronta** |
| 3 | Sistemas: treino, mercado (melhorias, ferreiro, mercador), torneio, feras, convites, duplas, rivais, jornal, ranking, taverna (queda de braço), templo, alojamento, termas | **pronta** |
| 4 | Clima (chuva, neblina, folhas, guirlandas), moradores com falas e nome ao passar o mouse, rivais pela cidade, plateia, sons e músicas | **pronta** |

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

## Som
Efeitos e músicas são sintetizados com as mesmas receitas do Web Audio da versão
Electron (osciladores, ruído filtrado, sequenciadores de lira, flauta, metais e
tambores) e gravados em WAV por `python3 tools/gen_audio.py` (numpy e scipy). Volume
e mudo dos efeitos ficam no save; música ligada/desligada e volume ficam no computador.

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
- `scripts/autoload` — `Data`, `I18n`, `Saves`, `Game`, `Sfx`, `Music`.
- `scripts/core` — regras sem interface (criação, save, calendário, falas, RNG).
- `scripts/combat` — atributos, perícias e o motor de combate.
- `scripts/systems` — torneio, ranking, jornal, duplas, convites, feras, rivais etc.
- `scripts/game/act.gd` — preparar e encerrar cada tipo de luta, dormir.
- `scripts/world` — gladiador em camadas, locais e vida da cidade, arena, mapa, céu, balões, chuva.
- `scripts/ui` — menu, criação, painéis de cada local, HUD da luta, resultado, jornal, chave do torneio, queda de braço, pausa, opções e tema.

## Rodar, testar e exportar
```bash
godot --path .                                        # jogar
godot --headless --path . res://tests/run_tests.tscn  # testes (lógica e fluxo)
godot --path . res://tests/shots.tscn -- <pasta>      # capturas para conferência
godot --headless --path . --export-release "Windows Desktop" build/Colosseum.exe
```
