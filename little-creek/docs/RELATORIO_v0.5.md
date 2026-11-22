# Little Creek v0.5.0 — Relatório técnico

> **Sobre o número da versão.** O pedido chamava esta entrega de "V0.4.0", mas a
> 0.4.0 já tinha sido entregue (copas sem buracos, distribuição inteligente,
> coelhos). Para não repetir o número, esta é a **0.5.0** (Android: versionCode 5).

## 1. Onde estão os arquivos

| Item | Caminho no pacote entregue |
|---|---|
| **Executável Windows** | `Little Creek/Windows/LittleCreek.exe` (≈118 MB, dados embutidos — é o único arquivo necessário) |
| APK Android | `Little Creek/Android/LittleCreek-0.5.0.apk` (assinado, verificado com `apksigner`) |
| Instruções | `Little Creek/Documentation/INSTRUCOES.md` |
| Este relatório | `Little Creek/Documentation/RELATORIO_v0.5.md` |
| Mudanças | `Little Creek/Documentation/CHANGELOG.md` |
| Capturas | `Little Creek/Documentation/capturas/` (as mesmas de `docs/screenshots/v0.5/` no repositório) |

Save no Windows: `%APPDATA%\LittleCreek\little_creek_save.json`
(no Linux `~/.local/share/LittleCreek/`; no Android, a pasta privada do app).

## 2. O que mudou

### Estações
- **Árvores caducifólias com gêmeo "sem folhas"** gerado proceduralmente
  (`tools/art/pixlib.py: branch_tree`): galhos recursivos que afinam, curvam e
  se dividem, sombreados do lado oposto à luz. Árvores pequenas e grandes,
  copas do fundo (`mid_trees_bare.png`) e folhagem do primeiro plano
  (`fg_top_bare.png`).
- O shader de estação (`shaders/season_core.gdshaderinc`) troca folha por
  galho **por tufos** (ruído em duas escalas) e cada árvore tem uma fase
  própria (`tree_phase`), então elas não perdem nem ganham folhas ao mesmo
  tempo.
  - Primavera: dias 1–15 as folhas voltam (folhas jovens verde-claras, flores
    e botões, brotos nas margens).
  - Verão: copas cheias, sombras de copa no chão (`SeasonDecor.gd`), luz quente.
  - Outono: amarelo → dourado → laranja → vermelho queimado → marrom, com
    alguns tufos verdes até tarde; perda de folhas na segunda metade; montes de
    folhas no chão; folhas caindo e boiando; grama mais palha; luz dourada.
  - Inverno: caducifólias 100% nuas; árvores **perenes** continuam verdes.
    Flores somem.
- Relógio (`Clock.foliage_state`) com as curvas `autumn`, `bare`, `winter`,
  `bloom`, `lush`, `young`.

### Neve
- **Neve na geometria**: cada sprite de vegetação, pedra, tronco e construção
  recebe "tampas" de neve só onde a superfície está voltada para cima (pixel
  opaco com vazio acima), em 1–3 linhas, com tons de luz/meia-luz/sombra. Em
  árvores nuas a neve assenta nos galhos; em perenes, nos tufos.
- **Neve no chão** (`snow_ground.png` + `shaders/snow_ground.gdshader`): a cor
  é pré-sombreada e o canal alfa guarda a *ordem de acúmulo* — sombras e
  partes baixas primeiro, margens e áreas ensolaradas depois, estradas só em
  manchas (continuam legíveis). Borda pontilhada, nunca um "fade".
- `Weather.snow_cover` sobe ~0,28 por hora de jogo com neve (×intensidade) e
  derrete devagar (sol de inverno), mais rápido na primavera e com chuva.
  Salvo no save.
- Clima de inverno: **neve leve, neve e nevasca** (sem chuva). Flocos em três
  camadas (1 px, 2 px e 3 px com sombra) com vento; nevasca adiciona névoa
  (`grade.gdshader: haze`) e reduz raios de luz.

### Água
- `shaders/water.gdshader`: **gelo de margem** — distância real até a margem
  medida em 8 direções (até ~20 px de arte); largura da placa varia com ruído,
  correnteza (água calma congela mais) e profundidade. Placas ciano foscas,
  janelas de gelo transparente, rachaduras, faixas de brilho e uma borda clara
  quebrada junto à água aberta. Quedas, espuma e o canal principal ficam
  abertos.
- Água mais escura/fria no inverno (`cold`), vapor nas manhãs frias.

### Fauna
- **Pegadas** (`scripts/world/Footprints.gd`): coelho, veado, raposa e
  visitantes; só quando o animal está andando/pulando sobre neve; passada
  proporcional ao animal; até 420 pegadas desenhadas num único `_draw`;
  envelhecem em 30 h de jogo e somem ~25× mais rápido sob nevada.
- Coelhos se escondem mais no frio; pássaros vão aos comedouros no inverno;
  tabelas de visitas por tipo de nevada (`data/fauna.json`).

### PC / Windows
- Preset de exportação "Windows" (x86_64, PCK embutido, `build/windows/LittleCreek.exe`).
- Janela inicial 1920×1080, redimensionável; `stretch=canvas_items/expand`.
- **Escala inteira**: no PC, a escala de mundo é arredondada para um número
  inteiro de pixels de tela por pixel de arte (×3 em 1080p). Resoluções como
  1366×768 ficam com escala ×2 e faixas finas — os pixels nunca ficam
  desiguais.
- `Settings` (autoload novo): modo de tela, resolução (1280×720 até
  3840×2160), VSync, qualidade dos efeitos (0–2), densidade de partículas
  (25–150%). Aplicado na hora e salvo junto com os volumes.
- `MenuScreen` (tela inicial e pausa) e `SettingsPanel`.
- Atalhos (InputMap `lc_*`): Esc, B, U, E, J, I, P/F12, F11, +/−/PgUp/PgDn,
  setas/WASD, Espaço/Enter; roda do mouse = zoom no modo foto.
- Pasta de save própria (`config/use_custom_user_dir`) → `%APPDATA%\LittleCreek`.

## 3. Problemas encontrados e corrigidos

| Problema | Causa | Correção |
|---|---|---|
| Neve esverdeada; pixels de folha misturados aos galhos | Em Godot 4 `COLOR` já é *cor do vértice × textura*; os shaders multiplicavam a textura de novo | `varying vcol` + `COLOR = c * vcol` em sway/foliage/dissolve/reveal (corrigiu também o escurecimento do efeito "brotar") |
| Erro de compilação dos shaders | Amostrar `TEXTURE` e um sampler uniforme na mesma função | macro `SNOW_NB` amostra os vizinhos fora da função |
| Neve do chão uniforme demais no início | Ordem de acúmulo sem variação local | Ruído em manchas no mapa de ordem |
| Gelo invisível nas capturas | Só 1–3 px de largura, só de um lado, e cor igual à da água; margem escondida sob a neve | Distância em 8 direções, margem nevada conta como margem, placa mais larga e cor ciano-fosca própria |
| Montes de folhas laranja por cima da neve | Montes visíveis até o início do inverno | Somem conforme a neve cobre o chão |
| Escala não inteira em 1366×768 | Escala "cobrir a tela" fracionária | Escala inteira no PC |
| 2 falhas no autoteste do .exe (toque na água; pegadas soterradas) | O teste injetava o toque em coordenadas do viewport (1280×720) em vez das da janela (1920×1080); o segundo teste comparava só o número total de pegadas | Teste converte para coordenadas de janela; o segundo verifica se *as pegadas antigas* sumiram. O jogo em si estava certo (cliques reais pelo xdotool funcionavam) |
| Erros de inferência de tipo GDScript | `Variant` em `:=` | Tipos explícitos |

## 4. Testes executados

### Autoteste automático (`--selftest`) — 75 verificações
Executado **sobre os dados do próprio LittleCreek.exe** (`godot --main-pack
LittleCreek.exe`), janela 1920×1080, pasta de save limpa. Cobre: coleta de
água pelo caminho real de entrada, compras, distribuição, estradas, ponte,
coelhos, ciclos de comportamento, dia/noite, as quatro estações, chuva, save e
recarga, e a seção nova da v0.5:

- inverno: caducifólias 100% nuas; primavera: folhas voltam gradualmente;
  fim do outono: parcialmente nuas e com cores viradas;
- árvores têm gêmeo sem folhas (perenes excluídas);
- neve acumula gradualmente (não instantânea), derrete gradualmente e some;
- clima de inverno produz neve leve, neve e nevasca, e nunca chuva;
- gelo no riacho no inverno, nenhum no verão;
- animais deixam pegadas na neve; nevada nova cobre as antigas;
- configurações de qualidade/partículas realmente mudam a cena;
- configurações de vídeo e cobertura de neve são salvas;
- Esc pausa e retoma o jogo.

**Resultado na build final (LittleCreek.exe, SHA-256 `65b800cb…99f3b5`): 75 de 75 verificações passaram, 0 falhas.** O mesmo resultado no projeto-fonte.

### Capturas
17 capturas em 1920×1080 / 1366×768 / 1280×720 (`docs/screenshots/v0.5/`):
primavera, primavera brotando, verão, outono com folhas caindo, fim do outono,
inverno com árvores nuas, neve acumulada, nevasca, nevada leve, riacho com gelo
nas margens (zoom ×3), pegadas na neve, entardecer e amanhecer de inverno, tela
inicial, configurações e duas resoluções alternativas.

### Desempenho
Medido em renderização **por software** (llvmpipe, sem GPU) a 1920×1080:
~28 fps, com todos os scripts somando <0,15 ms por quadro — o gargalo é só
o render por CPU. Numa GPU real (mesmo integrada) deve rodar a 60 fps. Em
"Qualidade: baixa" o jogo desliga raios de luz e reduz partículas.

## 5. Testes da build Windows

**Verificação estática do .exe**: cabeçalho PE32+ x86_64 (`MZ`/`PE`), PCK
embutido (assinatura `GDPC` no final), 117.867.200 bytes.

**Execução**: a pasta foi copiada para um diretório limpo
(`/tmp/clean/Little Creek/Windows/`), sem o projeto Godot por perto, e o jogo
foi executado a partir do pacote de dados do próprio .exe, numa tela virtual
1920×1080, com mouse e teclado **reais** (eventos X11 via `xdotool`, não
chamadas internas):

| Passo | Resultado |
|---|---|
| Tela inicial aparece | ✅ |
| Clique em "Jogar" | ✅ entra no jogo |
| 12 cliques na água | ✅ água sobe |
| Tecla B abre "Construir"; 2 cliques em "Comprar" | ✅ 2 itens comprados |
| J abre o diário; Esc fecha | ✅ |
| P abre o modo foto; roda do mouse ×2 aproxima | ✅ |
| Esc sai do modo foto; Esc abre a pausa | ✅ |
| "Configurações" pela pausa; Esc volta | ✅ |
| "Sair do jogo" salva e fecha o processo | ✅ |
| Reabrir: progresso mantido (água, 8 itens = 6 iniciais + 2 comprados, mesmo dia/hora) | ✅ |
| Arquivos ausentes | nenhum erro de recurso faltando no log |

Montagem das telas dessa sessão real: `capturas/18_teste_real_exe_mouse_teclado.png`.

**O que NÃO foi possível fazer aqui**: executar o `.exe` no *Windows de
verdade* (ou no Wine). O ambiente é Linux, sem Windows. O Wine do Ubuntu
(9.0) travava ao criar o prefixo (`free(): invalid pointer`). Tentei usar uma
build mais nova do Wine baixada da internet, mas a execução desse binário de
terceiros foi bloqueada pela política de permissões do ambiente — e eu não
contornei esse bloqueio. Por isso:

- os **dados do jogo** dentro do .exe foram testados de verdade (mesmo PCK,
  mesma versão da Godot 4.7.2, mesmo renderer);
- o **lançador Windows** (o binário oficial da Godot para Windows, sem
  modificação) não foi executado aqui.

Recomendação: dar dois cliques no `LittleCreek.exe` num PC com Windows 10/11
e conferir a tela inicial — é um teste de 1 minuto. Se algo falhar, o log fica
em `%APPDATA%\LittleCreek\logs\godot.log`.
