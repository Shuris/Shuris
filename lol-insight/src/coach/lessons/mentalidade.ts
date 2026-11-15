import type { Lesson } from '../types';

export const MENTALIDADE: Lesson[] = [
  {
    id: 't-derrotas',
    title: 'Como lidar com derrotas',
    category: 'mentalidade',
    level: 1,
    minutes: 7,
    skills: ['MENTAL'],
    objective: 'Impedir que uma derrota contamine as partidas seguintes, com regras simples de quando parar.',
    theory: [
      {
        title: 'O que é o tilt',
        text: 'Tilt é o estado em que a frustração passa a tomar as decisões. Sob tilt o jogador arrisca mais, presta menos atenção ao mapa e culpa fatores externos. O efeito é mensurável: a taxa de vitória de muita gente cai depois de duas ou três derrotas seguidas na mesma sessão.',
      },
      {
        title: 'Derrotas fazem parte do sistema',
        text: 'O sistema de pareamento procura partidas equilibradas, então mesmo jogadores em ascensão perdem perto da metade das partidas. Uma derrota isolada não diz nada sobre o seu nível. O que importa é o resultado ao longo de dezenas de partidas.',
      },
      {
        title: 'Regras de parada',
        text: 'A ferramenta mais eficiente contra o tilt é decidir, antes de jogar, quando parar. Uma regra comum: duas derrotas seguidas, pausa de alguns minutos; três, fim da sessão ranqueada. Decidir com a cabeça fria evita a armadilha de "só mais uma para recuperar".',
      },
    ],
    examples: [
      'Depois de duas derrotas, você se levanta, bebe água e volta dez minutos depois. A terceira partida começa sem o peso das anteriores.',
      'Você perde três seguidas, entra na quarta irritado, escolhe um campeão que não domina e perde mais uma. A sessão custou quatro derrotas em vez de três.',
    ],
    mistakes: [
      'Entrar na fila imediatamente depois de uma derrota frustrante.',
      'Jogar ranqueada cansado, com fome ou com pressa.',
      'Usar a partida seguinte para "provar" algo depois de uma discussão.',
    ],
    apply: [
      'Defina a sua regra de parada antes da primeira partida do dia e cumpra.',
      'Entre as partidas, faça uma pausa curta longe da tela.',
      'Depois de uma derrota, anote um erro seu que possa ser corrigido e deixe o resto para trás.',
    ],
    exercise: {
      title: 'Sessão com regra de parada',
      steps: [
        'Escolha um limite: por exemplo, parar após duas derrotas seguidas.',
        'Jogue uma semana respeitando o limite, sem exceções.',
        'Compare a sua taxa de vitória da semana com a anterior.',
      ],
      success: 'Cumprir a regra em todas as sessões da semana.',
    },
    quiz: [
      {
        question: 'O que caracteriza o tilt?',
        options: ['Jogar com mais atenção após uma derrota', 'A frustração passar a influenciar as decisões', 'Perder uma partida equilibrada'],
        correct: 1,
        explanation: 'Sob tilt, o jogador assume riscos piores e perde informação que normalmente perceberia.',
      },
      {
        question: 'Por que uma derrota isolada não indica o seu nível?',
        options: ['Porque o pareamento busca partidas equilibradas e todos perdem com frequência', 'Porque derrotas não contam para o elo', 'Porque o resultado é aleatório'],
        correct: 0,
        explanation: 'O desempenho aparece em dezenas de partidas. Uma única partida tem ruído demais.',
      },
      {
        question: 'Qual é a vantagem de uma regra de parada definida antes de jogar?',
        options: ['Aumenta os LP por vitória', 'A decisão é tomada com a cabeça fria, não durante a frustração', 'Evita o pareamento com jogadores fortes'],
        correct: 1,
        explanation: 'Depois de perder, a vontade de recuperar distorce o julgamento. A regra prévia remove essa decisão.',
      },
    ],
  },
  {
    id: 't-consistencia',
    title: 'Consistência: menos campeões, mais repetição',
    category: 'mentalidade',
    level: 1,
    minutes: 8,
    skills: ['MENTAL', 'POOL'],
    objective: 'Reduzir a variação entre partidas com um conjunto pequeno de campeões e uma rotina de jogo.',
    theory: [
      {
        title: 'Subir de elo é um jogo de médias',
        text: 'O elo sobe quando a sua taxa de vitória se mantém acima de 50% por muitas partidas. Partidas brilhantes isoladas pesam pouco; o que pesa é o seu desempenho típico. Reduzir os piores dias vale mais do que melhorar os melhores.',
      },
      {
        title: 'Um conjunto pequeno de campeões',
        text: 'Cada campeão exige aprender limites de dano, combos e confrontos. Jogando muitos campeões, a atenção fica nos dedos e sobra pouco para o mapa. Com dois ou três campeões por posição, a mecânica vira automática e a cabeça fica livre para decidir. Experimentar é ótimo, mas em partidas normais.',
      },
      {
        title: 'Rotina',
        text: 'Consistência também vem das condições de jogo: jogar na mesma posição, em horários em que você rende melhor, com aquecimento antes da primeira ranqueada. Sessões curtas e focadas costumam render mais do que maratonas.',
      },
    ],
    examples: [
      'Um jogador com 60% de vitórias em um campeão e 40% em outros cinco decide jogar apenas os dois melhores. A taxa geral sobe sem que ele tenha aprendido nada novo.',
      'Você percebe que rende melhor à noite e pior de madrugada, e passa a encerrar as ranqueadas antes de um horário fixo.',
    ],
    mistakes: [
      'Escolher em ranqueada um campeão que acabou de ver em um vídeo.',
      'Trocar de posição principal a cada semana.',
      'Jogar dez partidas seguidas e avaliar o próprio nível pela última.',
    ],
    apply: [
      'Escolha dois ou três campeões para a sua posição principal e um para a secundária.',
      'Teste campeões novos em partidas normais até ter algumas dezenas de partidas.',
      'Use as estatísticas do aplicativo para identificar os horários e campeões em que você rende mais.',
    ],
    exercise: {
      title: 'Vinte partidas, três campeões',
      steps: [
        'Escolha no máximo três campeões.',
        'Jogue as próximas vinte ranqueadas apenas com eles.',
        'Compare a taxa de vitória e o KDA com as vinte anteriores.',
      ],
      success: 'Completar vinte ranqueadas sem sair do conjunto escolhido.',
    },
    quiz: [
      {
        question: 'O que mais influencia a subida de elo ao longo do tempo?',
        options: ['As suas melhores partidas', 'O seu desempenho típico em muitas partidas', 'O número de abates'],
        correct: 1,
        explanation: 'O elo responde à taxa de vitória sustentada. Reduzir partidas ruins pesa mais do que ter partidas excepcionais.',
      },
      {
        question: 'Por que um conjunto pequeno de campeões ajuda?',
        options: ['Porque a mecânica fica automática e sobra atenção para decisões', 'Porque o jogo dá bônus de LP', 'Porque evita banimentos'],
        correct: 0,
        explanation: 'Quando os dedos não precisam de atenção, você enxerga o mapa e decide melhor.',
      },
      {
        question: 'Onde testar um campeão novo?',
        options: ['Na próxima ranqueada', 'Em partidas normais, até ganhar familiaridade', 'Somente em séries decisivas'],
        correct: 1,
        explanation: 'Aprender em ranqueada custa LP e aumenta a variação dos seus resultados.',
      },
    ],
  },
  {
    id: 't-identificar-erros',
    title: 'Identificação de erros: como revisar uma partida',
    category: 'mentalidade',
    level: 2,
    minutes: 8,
    skills: ['MENTAL'],
    objective: 'Usar o replay para encontrar erros repetidos e escolher um único foco de melhoria por vez.',
    theory: [
      {
        title: 'Só melhora o que você controla',
        text: 'Em toda derrota há erros de aliados, mas eles mudam a cada partida. O único fator presente em todas as suas partidas é você. Revisar com a pergunta "o que eu poderia ter feito diferente?" é o caminho mais curto para subir, porque aponta para algo que pode ser repetido e corrigido.',
      },
      {
        title: 'Comece pelas mortes',
        text: 'As mortes são o ponto de partida mais produtivo. Para cada uma, volte quinze segundos e responda: o que eu sabia naquele momento? O que eu poderia saber olhando o mapa? Qual decisão me colocou ali? Quase sempre o erro aconteceu antes da luta, em uma escolha de posição.',
      },
      {
        title: 'Um foco por vez',
        text: 'Tentar corrigir tudo ao mesmo tempo não funciona. Encontre o erro que mais se repete e jogue as próximas partidas pensando apenas nele. Quando deixar de aparecer, escolha o seguinte.',
      },
    ],
    examples: [
      'Revisando três partidas, você percebe que cinco das suas mortes aconteceram com a onda avançada e sem sentinela. O foco da semana passa a ser a posição da onda.',
      'Em vez de assistir à partida inteira, você revê apenas as mortes e os dois minutos antes de cada objetivo perdido.',
    ],
    mistakes: [
      'Rever apenas as vitórias e as jogadas bonitas.',
      'Usar a revisão para listar erros dos aliados.',
      'Anotar dez problemas e não trabalhar em nenhum.',
    ],
    apply: [
      'Depois de uma sessão, reveja as mortes de uma partida perdida.',
      'Escreva o erro mais frequente em uma frase e mantenha-a visível enquanto joga.',
      'Use o diagnóstico do aplicativo como ponto de partida para escolher o foco.',
    ],
    exercise: {
      title: 'Revisão de mortes em quinze minutos',
      steps: [
        'Abra o replay de uma derrota recente.',
        'Para cada morte, volte quinze segundos e anote a decisão que levou a ela.',
        'Agrupe as anotações e identifique o motivo mais comum.',
      ],
      success: 'Sair da revisão com um único foco, escrito em uma frase.',
    },
    quiz: [
      {
        question: 'Qual é a pergunta mais útil ao revisar uma partida?',
        options: ['Quem errou mais no meu time?', 'O que eu poderia ter feito diferente?', 'Qual campeão estava mais forte?'],
        correct: 1,
        explanation: 'Seus próprios erros se repetem em todas as partidas e podem ser corrigidos; os dos aliados, não.',
      },
      {
        question: 'Onde costuma estar o erro que leva a uma morte?',
        options: ['No último segundo da luta', 'Em uma decisão de posição tomada antes da luta', 'Na escolha de runas'],
        correct: 1,
        explanation: 'Na maioria das vezes a morte foi decidida quando você escolheu onde estar, sem a informação necessária.',
      },
      {
        question: 'Quantos focos de melhoria devem ser trabalhados ao mesmo tempo?',
        options: ['Todos os que forem encontrados', 'Um', 'Nenhum: basta jogar mais'],
        correct: 1,
        explanation: 'A atenção é limitada durante a partida. Um foco por vez é o que realmente muda o hábito.',
      },
    ],
  },
  {
    id: 't-decisoes',
    title: 'Tomada de decisões',
    category: 'mentalidade',
    level: 2,
    minutes: 8,
    skills: ['CLOSING', 'MENTAL'],
    objective: 'Avaliar jogadas pelo que se ganha, pelo que se arrisca e pela informação disponível.',
    theory: [
      {
        title: 'Três perguntas antes de agir',
        text: 'Toda jogada pode ser avaliada com três perguntas: o que eu ganho se der certo? O que eu perco se der errado? O que eu sei sobre a posição dos inimigos? Uma jogada com ganho pequeno, perda grande e pouca informação é ruim mesmo quando dá certo.',
      },
      {
        title: 'Decisão boa não é resultado bom',
        text: 'Uma decisão correta pode dar errado e uma decisão ruim pode dar certo. Avaliar pelo resultado ensina os hábitos errados. O critério é: com a informação que eu tinha, essa era a melhor opção? Repetidas muitas vezes, boas decisões vencem.',
      },
      {
        title: 'A condição de vitória',
        text: 'Cada composição vence de uma forma: lutando em grupo, pegando alvos isolados, dividindo pressão, escalando para o fim do jogo. Saber qual é a sua condição de vitória e a do adversário orienta as decisões: você busca as situações que favorecem a sua e evita as que favorecem a dele.',
      },
    ],
    examples: [
      'Seu time tem um atirador que escala bem e está na frente. Aceitar uma luta arriscada pelo terceiro dragão é desnecessário: o tempo joga a seu favor.',
      'Você mergulha na torre, o inimigo erra tudo e você sai com o abate. O resultado foi bom, mas a decisão, sem saber onde estava o caçador, foi ruim.',
    ],
    mistakes: [
      'Repetir uma jogada arriscada porque "funcionou da última vez".',
      'Decidir pelo que o time grita no chat, sem olhar o mapa.',
      'Ignorar a composição e jogar todas as partidas da mesma maneira.',
    ],
    apply: [
      'Antes de uma jogada arriscada, responda mentalmente: ganho, perda, informação.',
      'Na tela de carregamento, defina em uma frase como o seu time vence.',
      'Na revisão, avalie a decisão separadamente do resultado.',
    ],
    exercise: {
      title: 'Três decisões por partida',
      steps: [
        'Depois de uma partida, escolha três momentos importantes.',
        'Para cada um, escreva o ganho possível, a perda possível e o que você sabia.',
        'Marque quais decisões você repetiria.',
      ],
      success: 'Conseguir justificar cada decisão sem citar o resultado.',
    },
    quiz: [
      {
        question: 'Qual jogada é ruim mesmo quando dá certo?',
        options: ['Ganho grande, perda pequena, boa informação', 'Ganho pequeno, perda grande, pouca informação', 'Qualquer jogada que termine em abate'],
        correct: 1,
        explanation: 'Repetida várias vezes, essa escolha custa mais do que rende.',
      },
      {
        question: 'Como uma decisão deve ser avaliada?',
        options: ['Pelo resultado', 'Pela informação disponível no momento', 'Pela reação do time'],
        correct: 1,
        explanation: 'O resultado inclui sorte e erros alheios. A qualidade da decisão depende do que você sabia.',
      },
      {
        question: 'Para que serve identificar a condição de vitória?',
        options: ['Para escolher as situações que favorecem o seu time', 'Para saber quem culpar', 'Para definir a ordem de habilidades'],
        correct: 0,
        explanation: 'Ela orienta quando lutar, quando esperar e o que priorizar no mapa.',
      },
    ],
  },
  {
    id: 't-controle-emocional',
    title: 'Controle emocional durante a partida',
    category: 'mentalidade',
    level: 1,
    minutes: 7,
    skills: ['MENTAL'],
    objective: 'Manter o foco na próxima jogada, mesmo depois de um erro seu ou de um aliado.',
    theory: [
      {
        title: 'A partida é feita de jogadas independentes',
        text: 'Um erro aos cinco minutos não decide o que acontece aos vinte, a menos que você continue pensando nele. Atenção gasta com o que já aconteceu é atenção que falta para o mapa. A pergunta que traz o foco de volta é: qual é a próxima coisa útil que eu posso fazer?',
      },
      {
        title: 'O chat raramente ajuda',
        text: 'Discutir durante a partida tira as mãos do teclado e piora o desempenho de quem lê. Silenciar jogadores que atrapalham não é fraqueza: é proteger a sua concentração. A comunicação útil cabe em sinais e frases curtas sobre o que fazer a seguir.',
      },
      {
        title: 'Pequenos reinícios',
        text: 'O tempo morto — depois de morrer, voltando à base, andando para a rota — serve para reiniciar. Respirar fundo, soltar os ombros, olhar o placar e planejar os próximos trinta segundos. É um hábito pequeno que interrompe a escalada da irritação.',
      },
    ],
    examples: [
      'Você morre por um erro bobo. Enquanto espera o retorno, olha o cronômetro do dragão, compra os itens e decide para onde vai. Quando renasce, já tem um plano.',
      'Um aliado começa a reclamar. Você o silencia e continua usando sinais para o restante do time.',
    ],
    mistakes: [
      'Digitar durante uma luta ou enquanto a onda chega.',
      'Jogar o resto da partida tentando "compensar" um erro com jogadas forçadas.',
      'Votar pela rendição mentalmente e parar de tentar com a partida ainda aberta.',
    ],
    apply: [
      'Silencie quem estiver atrapalhando na primeira provocação.',
      'Use o tempo morto para planejar, não para remoer.',
      'Depois de um erro, diga a si mesmo qual é a próxima ação útil.',
    ],
    exercise: {
      title: 'Uma partida sem digitar',
      steps: [
        'Jogue três partidas usando apenas sinais para se comunicar.',
        'A cada morte, use o tempo de espera para planejar os próximos trinta segundos.',
        'Ao final, anote como se sentiu em comparação com as partidas habituais.',
      ],
      success: 'Completar as três partidas sem escrever no chat sobre erros.',
    },
    quiz: [
      {
        question: 'Qual pergunta ajuda a retomar o foco depois de um erro?',
        options: ['De quem foi a culpa?', 'Qual é a próxima coisa útil que posso fazer?', 'Ainda dá para vencer?'],
        correct: 1,
        explanation: 'Ela desloca a atenção do que não pode ser mudado para a próxima decisão.',
      },
      {
        question: 'Por que silenciar um jogador que atrapalha é uma boa decisão?',
        options: ['Porque protege a sua concentração', 'Porque pune o outro jogador', 'Porque aumenta os LP'],
        correct: 0,
        explanation: 'Discussões consomem atenção e pioram o seu próprio desempenho.',
      },
      {
        question: 'Como aproveitar o tempo de espera após uma morte?',
        options: ['Explicando o erro no chat', 'Planejando os próximos trinta segundos', 'Olhando o placar individual dos aliados'],
        correct: 1,
        explanation: 'O tempo morto é a oportunidade de reiniciar e voltar à partida com um plano.',
      },
    ],
  },
];
