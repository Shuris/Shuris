import type { Lesson } from '../types';

export const MACRO: Lesson[] = [
  {
    id: 'm-rotacoes',
    title: 'Rotação pelo mapa',
    category: 'macro',
    level: 2,
    minutes: 9,
    skills: ['OBJECTIVES'],
    objective: 'Saber quando sair da rota, por onde ir e o que resolver antes de se mover.',
    theory: [
      {
        title: 'Rotação custa alguma coisa',
        text: 'Sair da rota significa abrir mão de tropas, experiência e, às vezes, de vida da torre. Uma boa rotação é aquela em que o que você ganha do outro lado vale mais do que o que perde. Por isso a primeira etapa é sempre empurrar a onda: assim o custo cai e o adversário precisa escolher entre farmar e acompanhar você.',
      },
      {
        title: 'Vantagem numérica',
        text: 'A maioria das lutas pequenas é decidida por quem chega primeiro com mais jogadores. Quando você se move e o seu oponente fica na rota, o seu time passa a ter um jogador a mais naquele ponto do mapa. Avisar o time e chegar pelo caminho com visão transforma essa diferença em objetivo.',
      },
      {
        title: 'Depois da fase de rotas',
        text: 'Quando as primeiras torres caem, as rotas se reorganizam. Uma distribuição comum é levar a dupla para o meio, onde a torre protege melhor, e deixar os jogadores mais resistentes ou com teleporte nas laterais. O princípio é manter as três ondas sob controle sem expor quem não sobrevive sozinho.',
      },
    ],
    examples: [
      'O jogador do meio empurra a onda e desce ao rio. O adversário fica limpando tropas sob a torre e a rota inferior luta em três contra dois.',
      'Depois de derrubar a torre inferior, a dupla vai para o meio e o jogador do meio passa a empurrar uma lateral.',
    ],
    mistakes: [
      'Sair da rota com a onda inimiga chegando à sua torre: você perde tropas e ainda pode chegar atrasado.',
      'Andar pelo rio sem visão e ser pego no caminho.',
      'Chegar depois que a luta acabou e ficar no meio do mapa sem fazer nada.',
    ],
    apply: [
      'Antes de rotacionar: empurre a onda e olhe onde está o seu oponente.',
      'Avise com um sinal para onde está indo.',
      'Se a jogada do outro lado terminou, volte para pegar a onda em vez de vagar.',
    ],
    exercise: {
      title: 'Rotação com a onda empurrada',
      steps: [
        'Em duas partidas, anote cada vez que saiu da rota nos primeiros 15 minutos.',
        'Para cada saída, registre o estado da onda e o que foi obtido.',
        'Calcule quantas saídas valeram o farm perdido.',
      ],
      success: 'Fazer a maioria das rotações com a onda empurrada e algum retorno concreto.',
    },
    quiz: [
      {
        question: 'O que deve ser feito antes de sair da rota para ajudar em outro ponto?',
        options: ['Voltar à base', 'Empurrar a onda', 'Esperar o adversário sair primeiro'],
        correct: 1,
        explanation: 'Onda empurrada reduz o que você perde e obriga o oponente a escolher entre farmar e seguir.',
      },
      {
        question: 'Por que rotações geram vantagem em lutas pequenas?',
        options: ['Porque criam superioridade numérica momentânea', 'Porque aumentam o dano das habilidades', 'Porque fazem as tropas ficarem mais fortes'],
        correct: 0,
        explanation: 'Chegar primeiro com um jogador a mais decide a maior parte das escaramuças.',
      },
      {
        question: 'A jogada em que você ia ajudar já terminou quando você chega. O que fazer?',
        options: ['Ficar no rio esperando', 'Voltar à rota para não perder a próxima onda', 'Invadir a base inimiga'],
        correct: 1,
        explanation: 'Tempo parado no mapa é ouro e experiência perdidos. Retome a onda e prepare a próxima jogada.',
      },
    ],
  },
  {
    id: 'm-dragoes',
    title: 'Controle de dragões e preparação de objetivos',
    category: 'macro',
    level: 2,
    minutes: 10,
    skills: ['OBJECTIVES', 'VISION'],
    objective: 'Preparar a disputa de um objetivo com um minuto de antecedência, em vez de reagir quando ele já começou.',
    theory: [
      {
        title: 'Por que os dragões importam',
        text: 'Cada dragão elemental dá um bônus permanente ao time, e o quarto dragão concede a Alma do Dragão, um dos efeitos mais fortes da partida. Depois da Alma, passa a nascer o Dragão Ancião, cujo bônus temporário costuma decidir lutas. Deixar o adversário acumular dragões é ceder uma vantagem que não pode ser recuperada.',
      },
      {
        title: 'O minuto de preparação',
        text: 'A disputa começa antes de o objetivo nascer. Cerca de um minuto antes: voltar à base para gastar o ouro, empurrar as ondas mais próximas, limpar a visão inimiga e colocar a própria. O time que chega primeiro, com as ondas empurradas e visão, escolhe onde lutar.',
      },
      {
        title: 'Disputar ou trocar',
        text: 'Nem todo dragão precisa ser disputado. Se o seu time está sem habilidades supremas, com membros mortos ou em clara desvantagem, é melhor conquistar algo do outro lado do mapa. A exceção é o dragão que dá a Alma ao adversário: esse quase sempre vale a disputa.',
      },
    ],
    examples: [
      'Faltando um minuto para o dragão, a rota inferior empurra a onda, o suporte limpa a visão do rio e o time se posiciona. O adversário chega depois e precisa entrar no escuro.',
      'O adversário está com três dragões. Seu time prepara o próximo com antecedência dobrada, porque perdê-lo significa a Alma.',
    ],
    mistakes: [
      'Chegar ao dragão com as ondas das três rotas avançando contra as suas torres.',
      'Começar o objetivo sem saber onde está o caçador inimigo e perder a disputa do golpe final.',
      'Lutar no rio estreito contra um time com muitas habilidades em área.',
    ],
    apply: [
      'Olhe o cronômetro do próximo dragão sempre que voltar à base.',
      'Um minuto antes: onda empurrada, compras feitas, visão colocada.',
      'Conte os dragões do adversário: no terceiro, a prioridade do próximo muda.',
    ],
    exercise: {
      title: 'Onde eu estava quando o dragão nasceu?',
      steps: [
        'Em duas partidas, anote onde você estava e o estado da sua onda no momento em que cada dragão nasceu.',
        'Anote se o seu time tinha visão do covil.',
        'Relacione com quem conquistou cada dragão.',
      ],
      success: 'Estar posicionado, com a onda empurrada, na maioria dos dragões da partida.',
    },
    quiz: [
      {
        question: 'O que a preparação de um objetivo inclui?',
        options: ['Empurrar as ondas, gastar o ouro e controlar a visão antes de ele nascer', 'Esperar o adversário começar para então contestar', 'Juntar o time na base'],
        correct: 0,
        explanation: 'Quem chega antes, com ondas empurradas e visão, dita os termos da luta.',
      },
      {
        question: 'Quando vale abrir mão de um dragão?',
        options: ['Nunca', 'Quando o time está em desvantagem clara e pode conquistar algo em troca', 'Sempre que for o primeiro'],
        correct: 1,
        explanation: 'Perder a luta e o dragão é pior do que trocar o dragão por uma torre ou outro objetivo.',
      },
      {
        question: 'Por que o dragão que dá a Alma ao adversário é diferente?',
        options: ['Porque ele dá mais ouro', 'Porque a Alma é um bônus permanente muito forte', 'Porque ele não pode ser contestado'],
        correct: 1,
        explanation: 'A Alma do Dragão muda o equilíbrio do restante da partida. Impedir que o adversário a conquiste é prioridade.',
      },
    ],
  },
  {
    id: 'm-arauto-barao',
    title: 'Arauto e Barão',
    category: 'macro',
    level: 2,
    minutes: 9,
    skills: ['OBJECTIVES', 'CLOSING'],
    objective: 'Entender para que serve cada objetivo do lado superior e como usar o bônus depois de conquistá-lo.',
    theory: [
      {
        title: 'Arauto: derrubar torres cedo',
        text: 'O Arauto do Vale, depois de conquistado, pode ser invocado em uma rota para investir contra as torres e causar grande dano a elas. Usado enquanto as barricadas ainda existem, rende ouro adicional para o time. O melhor uso é em uma rota onde o seu time já tem vantagem e consegue protegê-lo.',
      },
      {
        title: 'Barão: a ferramenta para encerrar',
        text: 'O bônus do Barão Na\'Shor fortalece os campeões e, principalmente, as tropas próximas, que passam a resistir mais e a pressionar as torres. Isso torna os cercos muito mais seguros. O Barão não vence a partida sozinho: ele dá alguns minutos em que derrubar torres e inibidores fica muito mais fácil.',
      },
      {
        title: 'Quando fazer o Barão',
        text: 'O Barão causa muito dano e reduz a resistência de quem o ataca, então começá-lo com cinco inimigos vivos e por perto é arriscado. As boas janelas são: depois de eliminar dois ou mais inimigos, depois de eliminar o caçador deles, ou quando o adversário está preso defendendo o lado oposto do mapa.',
      },
    ],
    examples: [
      'O time conquista o Arauto e o usa na rota do meio com as barricadas ainda de pé: derruba a torre, ganha ouro e abre o mapa.',
      'Depois de eliminar três inimigos aos 25 minutos, o time vai direto ao Barão em vez de perseguir os dois restantes.',
    ],
    mistakes: [
      'Conquistar o Arauto e esquecer de usá-lo.',
      'Começar o Barão sem visão e ser surpreendido com a vida baixa.',
      'Pegar o Barão e voltar a farmar a selva, deixando o bônus expirar.',
    ],
    apply: [
      'Com o Arauto, escolha a rota com mais barricadas e onde o seu time está mais forte.',
      'Depois de uma luta vencida, pergunte: quantos estão vivos do outro lado e quanto tempo falta para voltarem?',
      'Com o Barão: voltar à base, comprar, agrupar com as ondas e cercar.',
    ],
    exercise: {
      title: 'O que fizemos com o bônus?',
      steps: [
        'Nas próximas partidas em que o seu time conquistar o Barão, anote o que foi derrubado durante o bônus.',
        'Anote se o time voltou à base antes de avançar.',
        'Compare as partidas em que o bônus rendeu inibidores com as que não rendeu nada.',
      ],
      success: 'Participar de um cerco com tropas fortalecidas que derrube ao menos um inibidor.',
    },
    quiz: [
      {
        question: 'Qual é o principal uso do Arauto do Vale?',
        options: ['Causar dano a campeões', 'Derrubar torres, de preferência enquanto há barricadas', 'Dar visão permanente'],
        correct: 1,
        explanation: 'Ele investe contra as torres. Com barricadas de pé, o dano rende ouro extra.',
      },
      {
        question: 'O que o bônus do Barão facilita?',
        options: ['Cercar e derrubar estruturas com tropas fortalecidas', 'Regenerar vida dentro da base', 'Aumentar o farm na selva'],
        correct: 0,
        explanation: 'As tropas fortalecidas avançam com mais segurança e o time consegue pressionar sem mergulhar.',
      },
      {
        question: 'Qual é uma boa janela para iniciar o Barão?',
        options: ['Com cinco inimigos vivos e próximos', 'Depois de eliminar vários inimigos ou o caçador deles', 'No primeiro minuto em que ele estiver disponível'],
        correct: 1,
        explanation: 'Com menos inimigos para contestar, o risco de perder a disputa ou a luta cai muito.',
      },
    ],
  },
  {
    id: 'm-divisao-pressao',
    title: 'Divisão de pressão (split push)',
    category: 'macro',
    level: 3,
    minutes: 9,
    skills: ['CLOSING'],
    objective: 'Pressionar uma rota lateral de forma que o adversário perca algo em qualquer resposta que escolher.',
    theory: [
      {
        title: 'A ideia',
        text: 'Dividir a pressão é empurrar uma rota lateral enquanto o restante do time ameaça outro ponto. Se o adversário envia um jogador, pode perder o duelo; se envia dois, o seu time fica em vantagem numérica do outro lado; se não envia ninguém, perde a torre.',
      },
      {
        title: 'Quem pode fazer',
        text: 'Funciona com campeões que vencem duelos ou escapam com facilidade, e melhor ainda com teleporte disponível. Um campeão que perde no um contra um e não tem fuga apenas entrega uma eliminação longe do time.',
      },
      {
        title: 'O papel dos outros quatro',
        text: 'O restante do time não deve lutar em desvantagem. A tarefa é ameaçar sem se comprometer: manter a onda empurrada, ficar perto da própria torre e recuar se o adversário avançar. A divisão de pressão falha quando os quatro aceitam uma luta de quatro contra cinco.',
      },
    ],
    examples: [
      'O lutador empurra a rota superior enquanto o time se posiciona perto do dragão. Dois inimigos sobem para pará-lo; os outros quatro conquistam o dragão em quatro contra três.',
      'O jogador da lateral avança além do rio sem visão, é cercado por três e o adversário usa a vantagem para fazer o Barão.',
    ],
    mistakes: [
      'Avançar na lateral sem saber onde estão os inimigos.',
      'O time lutar em quatro contra cinco enquanto o quinto está do outro lado.',
      'Dividir a pressão do lado oposto ao objetivo que vai nascer, sem teleporte.',
    ],
    apply: [
      'Antes de avançar, conte os inimigos visíveis no minimapa. Faltam dois ou mais? Recue.',
      'Coloque visão profunda nos acessos pelos quais os inimigos chegariam.',
      'Pressione a lateral oposta ao objetivo apenas se puder chegar a tempo, ou se a troca valer a pena.',
    ],
    exercise: {
      title: 'Contar antes de avançar',
      steps: [
        'Em uma partida com um campeão de rota lateral, toda vez que passar do rio, conte os inimigos visíveis.',
        'Anote quantas vezes avançou com menos de três visíveis.',
        'Relacione com as mortes na lateral.',
      ],
      success: 'Não morrer nenhuma vez sozinho na rota lateral após os 15 minutos.',
    },
    quiz: [
      {
        question: 'Por que a divisão de pressão cria um dilema para o adversário?',
        options: ['Porque qualquer resposta custa algo: um duelo, vantagem numérica ou uma torre', 'Porque impede o adversário de farmar', 'Porque desativa as torres'],
        correct: 0,
        explanation: 'Um jogador pode perder o duelo, dois deixam o time em desvantagem, nenhum entrega a estrutura.',
      },
      {
        question: 'O que os outros quatro jogadores devem fazer?',
        options: ['Iniciar uma luta para distrair', 'Ameaçar sem aceitar uma luta em desvantagem', 'Voltar à base'],
        correct: 1,
        explanation: 'A pressão só funciona se o time não entregar uma luta de quatro contra cinco.',
      },
      {
        question: 'Você está avançado na lateral e três inimigos sumiram do mapa. O correto é:',
        options: ['Continuar na torre', 'Recuar imediatamente', 'Entrar na selva inimiga'],
        correct: 1,
        explanation: 'Inimigos fora do mapa provavelmente estão indo até você. Recuar preserva a pressão para a próxima onda.',
      },
    ],
  },
  {
    id: 'm-encerrar',
    title: 'Como encerrar partidas',
    category: 'macro',
    level: 3,
    minutes: 9,
    skills: ['CLOSING'],
    objective: 'Transformar uma partida em vantagem em vitória, sem dar ao adversário a chance de virar.',
    theory: [
      {
        title: 'Por que partidas ganhas são perdidas',
        text: 'Times em vantagem costumam perder por dois motivos: lutas desnecessárias e mortes isoladas. No fim do jogo o tempo de retorno é longo, e uma única luta perdida pode custar o Barão, inibidores ou a partida. Quem está na frente não precisa de mais abates; precisa de estruturas.',
      },
      {
        title: 'O cerco',
        text: 'Para derrubar torres da base com segurança: ondas empurradas nas três rotas, de preferência com bônus do Barão ou superioridade numérica, e visão nos acessos laterais. As tropas absorvem os tiros da torre enquanto o time causa dano de longe. Não é preciso mergulhar: o adversário é quem tem que sair para defender.',
      },
      {
        title: 'Inibidores e o momento final',
        text: 'Um inibidor destruído faz surgir supertropas naquela rota, que pressionam sozinhas e prendem defensores. Com um ou dois inibidores abertos, o próximo objetivo ou a próxima luta vencida costuma permitir o fim. Depois de uma luta vencida com tempos de retorno longos, vá direto às estruturas.',
      },
    ],
    examples: [
      'O time vence uma luta aos 32 minutos com quatro eliminações. Em vez de fazer o dragão, empurra o meio e encerra a partida antes do retorno dos inimigos.',
      'Com grande vantagem de ouro, dois jogadores entram na selva inimiga atrás de um abate, morrem, e o adversário usa a superioridade numérica para conquistar o Barão.',
    ],
    mistakes: [
      'Perseguir abates dentro da base inimiga.',
      'Agrupar os cinco no meio com as laterais sendo empurradas contra as suas torres.',
      'Andar sozinho pelo mapa no fim do jogo "para farmar uma onda".',
    ],
    apply: [
      'No fim do jogo, ande em grupo e com visão.',
      'Antes de cercar, empurre as ondas laterais.',
      'Depois de vencer uma luta, olhe os tempos de retorno e escolha a maior estrutura alcançável.',
    ],
    exercise: {
      title: 'Depois da luta vencida',
      steps: [
        'Em partidas em que o seu time vencer uma luta após os 25 minutos, anote o que o time fez em seguida.',
        'Classifique: estrutura, objetivo neutro, perseguição ou nada.',
        'Veja qual escolha apareceu nas partidas vencidas.',
      ],
      success: 'Em toda luta vencida no fim do jogo, converter em estrutura ou objetivo, nunca em perseguição.',
    },
    quiz: [
      {
        question: 'Qual é a causa mais comum de derrotas em partidas que estavam ganhas?',
        options: ['Falta de farm', 'Lutas desnecessárias e mortes isoladas', 'Excesso de visão'],
        correct: 1,
        explanation: 'No fim do jogo, uma luta perdida ou uma eliminação isolada dá ao adversário o tempo de que ele precisava.',
      },
      {
        question: 'O que torna um cerco seguro?',
        options: ['Mergulhar na torre com o time inteiro', 'Ondas empurradas, visão nos acessos e dano de longe', 'Esperar o adversário sair da base'],
        correct: 1,
        explanation: 'Com as tropas absorvendo a torre e as laterais empurradas, quem precisa se arriscar é o defensor.',
      },
      {
        question: 'Depois de vencer uma luta com tempos de retorno longos, a prioridade é:',
        options: ['Farmar a selva', 'Ir às estruturas', 'Voltar à base para comprar'],
        correct: 1,
        explanation: 'O tempo em que o adversário está fora é a janela para derrubar o que decide a partida.',
      },
    ],
  },
];
