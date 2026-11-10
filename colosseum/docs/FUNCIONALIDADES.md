# Funcionalidades — versão 0.2.0

## Novidades da 0.2.0

- [x] **Efeitos sonoros** sintetizados em tempo real (Web Audio): golpes, críticos, metal dos
      escudos, lâminas no ar, esquivas, passos na areia, habilidades, cansaço, corneta de
      início, murmúrio e explosões do público, fanfarra de vitória/derrota e sons da interface
      (cliques, moedas, equipar, subir de nível). Volume ajustável e botão de mudo.
- [x] **Armas rígidas:** cada arma é uma única imagem que apenas gira na mão do gladiador — a
      lâmina não muda mais de forma ou tamanho entre os quadros.
- [x] **Tela cheia** (botão, F11, Esc para sair), lembrada ao reabrir.
- [x] **Interface mais legível:** fontes maiores (texto base 24 px), mais contraste e textos
      muito mais curtos; descrições longas ficam em dicas ao passar o mouse.
- [x] **Ciclo de dia e noite:** céu em gradiente, sol e lua com trajetória, estrelas, nuvens,
      luz ambiente sobre cenário e gladiadores, braseiros que iluminam à noite. Modo rápido
      (dia completo em 10 min) ou hora real do computador. Relógio do jogo na barra de status.
- [x] **5 anfiteatros**, um a cada dois adversários: Arena de Cápua (madeira), Anfiteatro de
      Pompeia (com o Vesúvio), Arena de Verona (pedra rosa), Anfiteatro de Leptis Magna
      (palmeiras e mar) e Coliseu de Roma (para o campeão).
- [x] **Removido:** modo companion (janela flutuante, clique-através, atalhos globais e ícone na bandeja).

## Jogo

- [x] Criação do gladiador (nome validado, 4 origens, aparência) e introdução curta.
- [x] 6 atributos, 3 pontos por nível, nível máximo 30, experiência, moedas e fama.
- [x] Combate automático determinístico, separado da renderização: distância e alcance,
      preparação/impacto/recuperação, acerto, esquiva (máx. 35%), bloqueio, críticos,
      atordoamento, cansaço/exaustão, 4 habilidades automáticas, 3 estratégias, fim por
      nocaute, decisão (120 s) ou desistência. Lutas de ~45–90 s.
- [x] 27 equipamentos em 5 espaços e 4 raridades, visíveis no personagem; mercado, inventário,
      comparação, equipar/desequipar/vender.
- [x] Treinamento com custo progressivo (+1 atributo a cada 4 treinos).
- [x] 9 adversários com dificuldade crescente e chance de vitória estimada por simulação.
- [x] Histórico das últimas 50 lutas, revanche automática, velocidade 1x/2x/3x.
- [x] Salvamento automático (gravação atômica, backup, validação).
- [x] Instalador NSIS e versão portátil para Windows.

## Limitações conhecidas

- Instalador sem assinatura digital (aviso do SmartScreen).
- Arte procedural (gerada pelo script do projeto); a estrutura permite trocar por arte feita à mão.
- Sem música de fundo (apenas efeitos e ambiente do público).

## Pendentes

- [ ] Música de fundo.
- [ ] Spritesheets desenhadas à mão e golpes diferentes por arma.
- [ ] Torneios e eventos; mais habilidades.
- [ ] Vários espaços de salvamento; assinatura de código e atualização automática.
