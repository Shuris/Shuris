# COLOSSEUM — Desktop Gladiator RPG

RPG de progressão / auto-battler / idle em **pixel art 16-bit**, ambientado na Roma Antiga.
Você desenvolve **um único gladiador** ao longo de uma carreira permanente: treina, distribui
atributos, compra e equipa armas e proteções, escolhe a estratégia — e assiste às lutas, que
acontecem **automaticamente**, em tempo real e com animações.

O diferencial é o **modo companion**: o jogo vira uma pequena janela flutuante, sem bordas e
sempre no topo, para acompanhar as batalhas enquanto você usa o computador.

> Versão: **0.1.0 (MVP jogável)** · Plataforma: Windows 10/11 · Idioma: português (Brasil) · Funciona offline.

![Arena](docs/img/arena.png)

## Funcionalidades principais

- Criação do gladiador (nome, origem com bônus, aparência: pele, cabelo, barba, tanga).
- 6 atributos (Força, Vitalidade, Resistência, Agilidade, Precisão, Técnica) — 3 pontos por nível, até o nível 30.
- Combate automático em tempo real: distância, alcance da arma, intervalo de ataque, acerto, esquiva,
  bloqueio, resistência (fadiga/exaustão), golpes críticos, atordoamento e 4 habilidades automáticas.
- 3 estratégias (Agressiva, Equilibrada, Defensiva) que mudam de fato o comportamento.
- 27 equipamentos em 5 espaços (arma, escudo, capacete, armadura, pernas) com 4 raridades — visíveis no personagem.
- Mercado, inventário (equipar/desequipar/vender), recompensas de batalha.
- Treinamento com custo progressivo que converte progresso em pontos de atributo.
- 9 adversários com dificuldade crescente, desbloqueados em sequência; estimativa de chance de vitória.
- Histórico das últimas 50 lutas; lutas contínuas (revanche automática); velocidade 1x/2x/3x.
- Salvamento automático com gravação atômica, backup e validação dos dados.
- Modo companion: janela pequena, sem bordas, redimensionável, arrastável, sempre no topo (opcional),
  opacidade ajustável, **clique-através** reversível por atalho global e pelo ícone na bandeja.

Lista completa (e o que ainda falta) em [docs/FUNCIONALIDADES.md](docs/FUNCIONALIDADES.md).

## Instalação (jogador)

Veja [docs/INSTALACAO.md](docs/INSTALACAO.md). Resumo: execute `Colosseum-Setup-0.1.0.exe`,
siga o assistente e abra o jogo pelo atalho da área de trabalho ou do menu Iniciar.
Também há a versão portátil `Colosseum-Portatil-0.1.0.exe`, que roda sem instalar.

## Desenvolvimento

```bash
npm install
```

```bash
npm run dev
```

Mais detalhes em [docs/DESENVOLVIMENTO.md](docs/DESENVOLVIMENTO.md) (scripts, testes, geração de
assets e do instalador) e [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Tecnologias

Electron 45 · Phaser 3.90 · TypeScript 5.9 · Vite 6 · Electron Builder 26 · Vitest 3 · Playwright (E2E).
Arte 100% própria, gerada por um gerador de pixel art incluído no projeto (`tools/generate_assets.py`).
Fontes VT323 e Pixelify Sans (SIL Open Font License), empacotadas localmente.
