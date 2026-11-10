# Funcionalidades — versão 0.4.0

## Novidades da 0.4.0

- [x] Público cresce com a arena: Cápua quase vazia (22%), Pompeia, Verona, Leptis Magna e o Coliseu lotado (96%).
- [x] **Dias da semana** (dia 1 = segunda). O **mercado fecha à noite e aos domingos** e,
      fechado, não permite comprar nem vender.
- [x] **Chuva:** cerca de 30% dos dias têm chuva por 3 a 6 horas. Fica nublado o dia todo,
      o céu fecha e escurece, sol e lua somem, gotas caem (pela janela nos interiores) e há
      som de chuva. O status mostra "Nublado"/"Chuva".
- [x] Jornal renomeado para **Folha Diurna**; manchetes de sequência diferentes para 3, 5 e 10
      vitórias (só a mais recente sai), notícias de **derrota** (nocaute, decisão,
      desistência), "três derrotas seguidas" e "volta por cima".
- [x] Nomes do mapa nítidos (texto em alta resolução).
- [x] Mercado mais vivo: moradores andando e parando nas bancas (túnicas e estolas), fonte,
      caixotes, barris, cestos de frutas, lanternas e pombos.
- [x] Templo: o **monge Aurelius**, sentado de pernas cruzadas, ensina as habilidades.
- [x] **Treinar no ludus não custa moedas** — só energia e tempo; atributos já treinados
      evoluem mais devagar.
- [x] Alojamento redesenhado na escala do gladiador: cama proporcional, janela na altura da
      cabeça, mesa com lamparina, pão e caneca, banquinho, larário, prateleira, capa,
      tapete, baú e ânfora.


## Da versão 0.3.0

- [x] **Mapa da cidade (Cápua)** com 7 locais, cada um com cenário próprio em pixel art:
      Ludus (treino), Alojamento (dormir), Mercado (comprar/vender), Arena (lutar),
      Templo de Marte (árvore de habilidades), Fórum (jornal) e Termas (recuperar energia).
      Viajar leva 20 minutos; locais têm horário de funcionamento.
- [x] **Sistema de dias:** calendário (Dia N), relógio e **energia**. Treinar (−12, 1h) e lutar
      (−35, 2h) cansam; nenhuma ação passa da meia-noite. Dormir no Alojamento leva ao dia
      seguinte às 7h com energia cheia; cochilo (+20) e termas (+40, pago) recuperam durante
      o dia. O céu (dia/noite) segue o relógio do jogo, com transição suave.
- [x] **Árvore de habilidades** (Templo de Marte): 3 caminhos — Marte (ataque), Mercúrio
      (velocidade) e Minerva (defesa) —, 18 habilidades com pré-requisitos e custos de 1 a 3
      pontos. 2 pontos no início + 1 por nível; não dá para aprender tudo. As 4 habilidades de
      combate agora são aprendidas na árvore; há bônus passivos (dano, crítico, esquiva,
      velocidade, acerto, vida, fôlego, bloqueio, quebra-guarda, redução de dano) e o
      "Segundo fôlego" (recupera vida uma vez por luta). Recomeçar a árvore custa moedas.
      Os adversários também seguem a árvore.
- [x] **Jornal Folha Diurna (antes "Acta Diurna"):** sai toda manhã. Manchetes geradas pelos acontecimentos: estreia,
      marcos de fama (citando o próximo rival: "é melhor Brutus tomar cuidado!"), primeiras
      vitórias, chegada a novas arenas, sequências de vitórias/derrotas, evolução nos treinos,
      provocações dos rivais e notícias da cidade. Edições antigas ficam no Fórum.
- [x] Saves da versão anterior são convertidos automaticamente (recebem os pontos de habilidade do nível).


## Da versão 0.2.0

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
