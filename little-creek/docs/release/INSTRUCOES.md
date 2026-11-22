# Little Creek v0.5.0 — Instruções

## Windows (PC)

1. Copie a pasta `Little Creek/Windows/` para qualquer lugar do computador
   (por exemplo `C:\Jogos\Little Creek\`).
2. Dê dois cliques em **`LittleCreek.exe`**. Não é preciso instalar nada nem
   abrir a Godot: o executável já contém todos os gráficos, sons, shaders e dados.
3. Requisitos: Windows 10/11 64 bits, placa de vídeo com OpenGL 3.3
   (praticamente qualquer GPU dos últimos 10 anos).
4. O Windows SmartScreen pode avisar "editor desconhecido" (o executável não é
   assinado digitalmente). Clique em *Mais informações → Executar assim mesmo*.

**Progresso salvo em:** `%APPDATA%\LittleCreek\little_creek_save.json`
(fora da pasta do jogo; apagar a pasta do jogo não apaga o progresso).

### Controles

| Ação | Mouse / teclado |
|---|---|
| Coletar água | clique na água do riacho |
| Menus | clique nos botões (canto inferior direito) ou B (construir), U (melhorias), E (ecossistema), J (diário), I (info) |
| Comprar | clique em **Comprar** no cartão |
| Fechar menu / pausar | **Esc** (Esc de novo continua) |
| Modo foto | **P** (ou botão da câmera); roda do mouse = zoom; arrastar ou setas/WASD = enquadrar; Espaço/Enter = capturar; Esc = sair |
| Tela cheia | **F11** |

Configurações (Esc → Configurações): modo de tela (janela/tela cheia),
resolução da janela (1280×720 a 3840×2160), VSync, qualidade dos efeitos
(baixa/média/alta), densidade de partículas e volumes de música, ambiente e efeitos.

A imagem usa **escala inteira de pixels** (cada pixel da arte vira 2×2, 3×3,
4×4… pixels da tela). Em 1920×1080 a escala é ×3 e preenche a tela; em
resoluções fora do padrão (ex.: 1366×768) podem aparecer faixas finas nas bordas.

Se o jogo não abrir, o registro de erros fica em
`%APPDATA%\LittleCreek\logs\godot.log`.

## Android

Instale `Little Creek/Android/LittleCreek-0.5.0.apk` (permita "instalar apps
desconhecidos"). Os controles por toque continuam os mesmos.
