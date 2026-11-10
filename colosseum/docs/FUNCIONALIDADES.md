# Funcionalidades — versão 0.6.0

## Novidades da 0.6.0

### Menu, saves e janela
- Menu principal com a arte do jogo (o Coliseu, o público de pé e dois gladiadores) e **3 espaços de salvamento** separados. Cada espaço mostra retrato, nível, título, dia, vitórias/derrotas e a data em que foi jogado; dá para apagar um espaço sem mexer nos outros. O save único das versões antigas vira o espaço 1.
- A barra que ficava em cima do jogo foi removida. O jogo **abre em tela cheia**; F11 alterna para janela (com a moldura normal do Windows).
- **Esc pausa o jogo** (a luta congela): continuar, opções, salvar e voltar ao menu, salvar e sair.

### Eventos da cidade
- **Mercador viajante**: aparece no mercado a cada 6 a 10 dias (nunca no domingo), com uma carroça na praça. Vende duas peças raras que não existem nas bancas e uma com 25% de desconto; cada peça uma vez por visita.
- **Queda de braço**: domingo das 19h às 23h na taverna. Minijogo de tempo (apertar quando o marcador está na faixa dourada); a Força aumenta a faixa e o empurrão. Inscrição em moedas, uma disputa por domingo; quem vence leva moedas, +3 de fama e vira notícia. O campeão da taverna fica mais forte a cada vitória sua.
- **Festival** a cada 14 dias (dias 10, 24, 38...): arquibancadas lotadas e enfeitadas com guirlandas, flâmulas e pétalas; **a fama das lutas vale em dobro**. O jornal avisa na véspera.

### Torneio de sábado
- Inscrição antecipada na arena, de domingo a sexta. No sábado, das 14h às 16h, o torneio começa: **chave com 8 lutadores** (você e 7 competidores novos perto do seu nível), quartas, semifinal e final seguidas (15 de energia e 40 minutos por luta). As outras lutas são simuladas pelo próprio motor de combate.
- Janela com a chave atualizada a cada rodada. Prêmios por rodada alcançada; o campeão ganha moedas, fama, experiência e um troféu (equipamento raro ou épico). Quem se inscreve e não aparece perde a inscrição.

### Rivais e revanche
- Cada adversário da escada lembra das lutas contra você (vitórias, derrotas, último resultado).
- **Revanche só quando o adversário pede**: depois de perder, às vezes (35%, no máximo um pedido a cada 7 dias) ele pede revanche no jornal. Enquanto espera, **treina** (até 3 níveis a mais). Vencer a revanche rende 50% mais; ignorar o pedido por 7 dias custa 2 de fama.
- Adversários já derrotados não lutam de novo sem pedido. O botão de revanche instantânea saiu; ficou "Tentar de novo" contra quem você ainda não venceu.
- **Desafiante do dia**: cada luta avulsa é contra um lutador novo da cidade, do seu nível, para continuar ganhando experiência.
- As falas mudam: provocação de quem venceu você da última vez, falas de revanche próprias de cada adversário.

### Novos tipos de gladiador (corpo a corpo)
- Dimachaerus (uma espada em cada mão, sem escudo), Scissor (arbelas, lâmina em meia-lua no braço), Provocator (cardiophylax, gládio e scutum) e Crupellarius (todo coberto de ferro), além de mirmilão, trácio, hoplômaco, secutor e retiário entre os 16 lutadores avulsos.
- 7 equipamentos novos no mercado: arbelas, segundo gládio, elmos de provocator, secutor e crupellarius, cardiophylax e lorica squamata.

### Ferimentos, médico e ferreiro
- Derrota por **nocaute** deixa ferido por 1 ou 2 dias; **desistência**, por 1 dia. Ferido luta com 15% menos vida e 10% menos dano (o jogo avisa antes).
- Cura: cada noite de sono tira um dia; as termas tiram um dia; **Galeno, o médico do ludus**, cura na hora por moedas.
- **Ferreiro** (aba no mercado): melhora armas, escudos e armaduras de +1 a +3 (custo e nível crescentes). Item melhorado vende por mais.

### Visual e som
- **Chuva forte**: gotas mais longas em duas camadas, poças que crescem no chão, respingos e ondinhas, respingos nos pés de quem anda, relâmpagos com clarão e trovão.
- **Luta cinematográfica**: no golpe final a cena congela, entra em câmera lenta e a câmera aproxima; no fim o público fica de pé (ovação) e chovem pétalas quando você vence.
- **Retratos em pixel art** (36 personagens + o seu, montado com sua aparência e capacete) na lista de adversários, na ficha do adversário, no desafiante do dia, na chave do torneio e no menu. Os balões de fala continuam só com texto.
- **Balões de fala não se sobrepõem**: quando dois personagens falam ao mesmo tempo, o balão mais novo sobe acima do anterior.
- **Enfeites do festival** posicionados entre os estandartes da arena (nunca por cima deles).
- **Música** sintetizada em tempo real: cidade (lira e flauta), noite, taverna, arena (tambores e metais) e menu. Volume próprio e liga/desliga em Opções.
- Oito novas manchetes e quatro ilustrações em preto e branco no jornal (festival, mercador, queda de braço e torneio).


## Da versão 0.5.0

- [x] **Idiomas:** português e inglês. Botão PT/EN na barra de título, na tela inicial e em
      Opções. Tudo é traduzido: interface, itens, adversários, habilidades, jornal, falas e
      mensagens. A escolha fica salva. Um teste garante que o inglês tem todos os textos.
- [x] **Combate legível:** lutadores **30% maiores** e afastados (não ficam "abraçados").
      Cada golpe tem preparação (recua o peso), investida rápida e um arco de corte; no golpe
      a arma e o braço passam à frente do escudo. Bloqueio: faísca e anel no escudo e o
      defensor desliza para trás. Esquiva: salto para trás em arco. Golpe recebido: empurrão,
      tronco inclinado, faíscas e pausa de impacto nos golpes fortes. Erro: o atacante
      passa do ponto.
- [x] **Gráficos mais detalhados:** poses de ataque redesenhadas (espada erguida, golpe por
      cima, estocada); armas com fio, sulco central, guarda e pomo; nova **sica** curva e
      **parma** trácia; scutum com curvatura, umbo e rebites; capacetes com viseira furada,
      penacho e crista; **lorica segmentata** em faixas, couraça musculada e ptéruges;
      grevas com joelheira e correias.
- [x] **Templo:** o monge fica à direita e o gladiador à esquerda, de frente para ele.
- [x] **Melhorias no Mercado** (aba Melhorias, permanentes): colchão de lã (+12 no cochilo),
      leito de nobre (+25), pesos de pedra (+35% Força), pista de areia (+35% Resistência),
      circuito de estacas (+35% Agilidade), palus reforçado (+35% Técnica) e doctore
      particular (treino gasta 3 de energia a menos). Aparecem no alojamento e no ludus.
- [x] **Taverna do Javali** (perto do fórum, 11h–24h): ensopado (+15 energia), rodada de
      vinho com **boatos sobre o próximo rival** (personalidade e dica de combate, +1 fama,
      1x por dia, às vezes vira nota no jornal) e conversas com Lívia, a taverneira, o velho
      Quintus e fregueses.
- [x] **Ludus vivo:** dupla de gladiadores treinando (ataques, bloqueios e esquivas), um
      gladiador no segundo poste e o instrutor dando ordens.
- [x] **Jornal Cápua Times:** cabeçalho gótico, preço, número da edição e ano romano, duas
      colunas, anúncios e, de vez em quando, **ilustrações em preto e branco** (retícula de
      jornal) — vitória, derrota, retrato do rival, estátua, multidão, navio, teatro, chuva...
      As notícias guardam o modelo do texto, então mudam de idioma junto com o jogo.
- [x] **Personalidade e diálogos:** cada adversário tem um temperamento (Marcus nervoso,
      Cassius impetuoso, Rufus piadista, Brutus bruto, Spiculus disciplinado, Crixus
      orgulhoso, Verus frio, Priscus cansado, Flamma showman) com falas em balões: provocação
      e resposta do jogador antes da luta, falas ao ficar ferido, ao acertar crítico, ao
      vencer e ao perder. Monge, instrutor, doctore, taverneira, Quintus, fregueses,
      vendedores e compradores também falam.

## Da versão 0.4.0

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
