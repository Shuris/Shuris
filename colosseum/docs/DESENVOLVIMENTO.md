# Desenvolvimento — COLOSSEUM

## Pré-requisitos

- Node.js 20+ (testado com Node 22) e npm.
- Python 3 com Pillow e numpy — **somente** se for regenerar a arte (`npm run assets`).
- Para gerar o instalador no Windows: nada além do Node. No Linux/macOS: Wine (64 e 32 bits).

## Instalação das dependências

```bash
npm install
```

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor Vite com recarregamento + Electron apontando para ele |
| `npm run build` | Checagem de tipos + build do renderer (Vite) + build do main/preload (esbuild) |
| `npm start` | Abre o Electron usando o build em `dist/` |
| `npm test` | Testes unitários (Vitest): sistemas, motor de combate e balanceamento |
| `npm run balance` | Mostra a tabela de balanceamento (taxa de vitória e duração por adversário/estratégia) |
| `npm run test:e2e` | Teste ponta a ponta do aplicativo real (Playwright + Electron). Usa Xvfb no Linux sem display |
| `npm run typecheck` | Somente checagem de tipos |
| `npm run assets` | Regenera todos os PNGs a partir do gerador de pixel art |
| `npm run dist:win` | Gera o instalador NSIS e a versão portátil em `release/` |
| `npm run dist:dir` | Gera apenas a pasta descompactada (teste rápido do empacotamento) |

Variável útil: `COLOSSEUM_USER_DATA=/caminho` faz o app salvar em outra pasta (usado nos testes).
`E2E_SHOTS=/caminho npm run test:e2e` salva capturas de tela de cada etapa do teste E2E.

## Gerar o instalador

No Windows (recomendado):

```bash
npm run dist:win
```

Saída em `release/`:

- `Colosseum-Setup-0.6.1.exe` — instalador (atalhos na área de trabalho e menu Iniciar, desinstalador).
- `Colosseum-Portatil-0.6.1.exe` — versão portátil.
- `win-unpacked/` — aplicativo descompactado (útil para testes).

No Linux é possível gerar o mesmo instalador com Wine (`wine64` + `wine32:i386`); foi assim que a
versão 0.1.0 foi produzida (as versões atuais são geradas pelo GitHub Actions). Configuração em `electron-builder.yml`; ícone em `build/icon.ico`.

Também há um workflow do GitHub Actions (`.github/workflows/colosseum-windows.yml` na raiz do
repositório) que roda os testes e gera o instalador num runner Windows real, disponibilizando os
`.exe` como artefato para download.

## Assinatura de código

O instalador não é assinado. Para evitar o aviso do SmartScreen é preciso um certificado de
assinatura de código (configurável via `CSC_LINK`/`CSC_KEY_PASSWORD` no Electron Builder).

## Arte

Toda a arte é gerada por `tools/generate_assets.py` (+ `tools/pixel.py`, `gen_gladiator.py`,
`gen_scenes.py`, `gen_ui.py`, `gen_arenas.py`, `gen_locations.py`, `gen_v05.py`) e os PNGs resultantes ficam versionados em
`src/renderer/public/assets/`. Para trocar por spritesheets desenhadas à mão, veja a seção
"Substituindo a arte" em [ARQUITETURA.md](ARQUITETURA.md).

## Testes

- **Unitários (74):** fórmulas de atributos, limites (esquiva 35%, intervalo 0,8 s, redução 70%),
  equipamentos, progressão, treinamento, salvamento/validação, GameStore, motor de combate
  (determinismo, limites físicos, todos os eventos/habilidades, efeito das estratégias,
  duração média), arenas, hora do dia, configurações salvas, árvore de habilidades, sistema de dias, jornal, migração de save, idiomas (inglês completo, mesmos
  parâmetros), melhorias, taverna, modelos e ilustrações do jornal, falas de todos os adversários,
  salvamento v3 e balanceamento (150 lutas × 3 estratégias × 9 adversários).
- **E2E (21 etapas):** criação e jornal de estreia, viagens pelo mapa, mercado e equipamento,
  treino (energia/tempo), luta completa com sons, falta de energia, dormir e novo dia,
  derrota, evolução de nível, árvore no Templo, arena correta por adversário, dia e noite,
  manchete de fama citando o rival, tela cheia, redimensionamento, salvamento/reabertura e
  recuperação por backup, mercado fechado à noite/domingo, chuva, lutadores 30% maiores com
  provocação em balão, monge à direita no templo, melhorias (ludus com gladiadores treinando),
  taverna e troca de idioma.
