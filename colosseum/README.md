# COLOSSEUM — Desktop Gladiator RPG

RPG de progressão / auto-battler em **pixel art 16-bit**, ambientado na Roma Antiga.
Você desenvolve **um único gladiador** numa carreira permanente: treina, distribui atributos,
compra e equipa armas e proteções, escolhe a estratégia — e assiste às lutas, que acontecem
**automaticamente**, em tempo real, com animações e efeitos sonoros.

> Versão: **0.2.0** · Windows 10/11 · Português (Brasil) · Funciona offline.

![Arena](docs/img/arena.png)

## Destaques

- Combate automático com distância, alcance, acerto, esquiva, bloqueio, cansaço, críticos e 4 habilidades.
- 3 estratégias, 6 atributos, nível até 30, 27 equipamentos visíveis no personagem.
- **5 anfiteatros** (um a cada dois adversários): Cápua, Pompeia, Verona, Leptis Magna e o Coliseu de Roma.
- **Ciclo de dia e noite** com céu, sol, lua, estrelas e braseiros que iluminam a arena à noite.
- **Efeitos sonoros** sintetizados: golpes, metal dos escudos, esquivas, corneta, público e fanfarras.
- **Tela cheia** (botão ou F11), interface com textos grandes e curtos.
- Salvamento automático com backup.

Detalhes em [docs/FUNCIONALIDADES.md](docs/FUNCIONALIDADES.md).

## Instalação (jogador)

Execute `Colosseum-Setup-0.2.0.exe` e abra o jogo pelo atalho. Há também a versão portátil
`Colosseum-Portatil-0.2.0.exe`. Veja [docs/INSTALACAO.md](docs/INSTALACAO.md).

## Desenvolvimento

```bash
npm install
```

```bash
npm run dev
```

Veja [docs/DESENVOLVIMENTO.md](docs/DESENVOLVIMENTO.md) e [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Tecnologias

Electron 45 · Phaser 3.90 · TypeScript 5.9 · Vite 6 · Electron Builder 26 · Vitest 3 · Playwright.
Arte 100% própria, gerada por `tools/generate_assets.py`; sons sintetizados em tempo real (Web Audio).
Fontes VT323 e Pixelify Sans (SIL Open Font License).
