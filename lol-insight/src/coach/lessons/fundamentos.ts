import type { Lesson } from '../types';

export const FUNDAMENTOS: Lesson[] = [
  {
    id: 'f-last-hit',
    title: 'Last hit: a base da sua renda',
    category: 'fundamentos',
    level: 1,
    minutes: 8,
    skills: ['FARM'],
    objective: 'Entender por que o farm é a fonte de ouro mais confiável do jogo e aprender a técnica para não perder tropas.',
    theory: [
      {
        title: 'Por que o farm importa mais do que parece',
        text: 'Cada tropa só dá ouro para quem desfere o golpe final. Duas ondas completas valem aproximadamente o mesmo que um abate, e uma nova onda chega a cada meio minuto, sem depender de o adversário errar. Quem farma melhor compra itens antes, e item comprado antes é vantagem em toda luta seguinte.',
      },
      {
        title: 'A técnica: esperar a vida certa',
        text: 'O erro mais comum é atacar cedo demais. Observe a barra de vida da tropa e ataque apenas quando o seu próximo golpe for suficiente para finalizá-la. Para isso você precisa conhecer o dano do seu ataque básico e o tempo da animação do seu campeão: campeões de ataque lento exigem que você comece o golpe um instante antes.',
      },
      {
        title: 'Farm embaixo da torre',
        text: 'Sob a torre a regra muda, porque ela também bate nas tropas. De modo geral, tropas corpo a corpo morrem com dois tiros da torre mais um ataque seu; tropas magas precisam de um ataque seu antes do tiro da torre e outro depois. Com itens ou níveis diferentes a conta varia, mas a lógica de "preparar" a tropa continua.',
      },
    ],
    examples: [
      'Você tem 6,0 CS/min aos 20 minutos (120 tropas) e seu oponente tem 8,0 (160). São 40 tropas de diferença, algo perto de 800 de ouro: o equivalente a quase três abates sem que ninguém tenha morrido.',
      'Três tropas ficam com pouca vida ao mesmo tempo. Em vez de atacar a que está mais perto, você finaliza primeiro a que vai morrer antes para as suas próprias tropas e usa uma habilidade na terceira.',
    ],
    mistakes: [
      'Atacar tropas com a vida cheia sem necessidade: isso empurra a onda para a torre inimiga e deixa você exposto a ganks.',
      'Largar o farm para perseguir um abate improvável e voltar com duas ondas perdidas.',
      'Gastar toda a mana em habilidades para farmar e ficar sem recursos quando o adversário resolve trocar.',
    ],
    apply: [
      'Defina uma meta simples por partida: um número de CS aos 10 minutos e tente superá-lo na partida seguinte.',
      'Quando uma troca terminar, volte os olhos imediatamente para a vida das tropas: é o momento em que mais se perde farm.',
      'Depois de cada morte ou retorno à base, pense para onde a próxima onda vai e esteja lá quando ela chegar.',
    ],
    exercise: {
      title: 'Dez minutos de last hit puro',
      steps: [
        'Abra a Ferramenta de Treino com o campeão que você mais joga, sem itens além dos iniciais.',
        'Farme por 10 minutos usando apenas ataques básicos, sem habilidades.',
        'Anote o total de CS e repita. Depois, adicione um bot inimigo na rota para treinar sob pressão.',
      ],
      success: 'Chegar a 80 de CS ou mais aos 10 minutos sem usar habilidades (perder menos de uma tropa a cada cinco).',
    },
    quiz: [
      {
        question: 'Qual é o momento certo de atacar uma tropa para garantir o ouro?',
        options: ['Assim que ela entra no alcance', 'Quando o seu próximo ataque é suficiente para finalizá-la', 'Depois que a tropa aliada mais próxima morrer'],
        correct: 1,
        explanation: 'O ouro vai para quem dá o golpe final. Atacar antes só empurra a onda e não garante a tropa.',
      },
      {
        question: 'Por que atacar as tropas o tempo todo, sem necessidade, é um problema?',
        options: ['Porque reduz o ouro que cada tropa dá', 'Porque empurra a onda para longe da sua torre e expõe você a ganks', 'Porque as tropas inimigas passam a focar em você'],
        correct: 1,
        explanation: 'Dano extra nas tropas faz a sua onda avançar. Longe da torre você fica vulnerável ao caçador inimigo.',
      },
      {
        question: 'Um jogador com 8 CS/min e outro com 6 CS/min, aos 20 minutos, sem abates. O que é verdade?',
        options: ['A diferença de ouro é irrelevante sem abates', 'O primeiro tem cerca de 40 tropas a mais, uma vantagem comparável a alguns abates', 'O segundo está na frente se tiver mais dano causado'],
        correct: 1,
        explanation: 'Duas tropas por minuto, em 20 minutos, são 40 tropas: centenas de ouro de vantagem sem risco.',
      },
    ],
  },
  {
    id: 'f-estados-da-wave',
    title: 'Controle de wave: os três estados da onda',
    category: 'fundamentos',
    level: 1,
    minutes: 9,
    skills: ['FARM', 'LANE'],
    objective: 'Reconhecer se a onda está empurrando, puxando ou parada, e saber o que cada estado significa para a sua segurança.',
    theory: [
      {
        title: 'A onda sempre vai para algum lado',
        text: 'Duas ondas se encontram e, se ninguém interferir, a que tiver mais tropas vence e avança. Quem tem mais tropas vivas está "empurrando". A posição também conta: quanto mais perto da sua torre o encontro acontece, mais cedo os seus reforços chegam, e a onda tende a voltar a empurrar a seu favor.',
      },
      {
        title: 'Empurrando, puxando e congelada',
        text: 'Onda empurrando para o inimigo: você tem pressão e liberdade para sair da rota, mas fica longe da sua torre. Onda puxando para você: é seguro farmar, o adversário é quem se expõe. Onda congelada (freeze): parada perto da sua torre, sem encostar nela, mantida com poucas tropas inimigas a mais. É a posição mais segura para você e a mais incômoda para o oponente.',
      },
      {
        title: 'Você decide o estado',
        text: 'Bater nas tropas além do último golpe acelera o empurrão. Dar apenas o golpe final mantém a onda como está. Para puxar, deixe o inimigo ter mais tropas. Antes de cada onda, pergunte: onde eu quero que ela esteja daqui a trinta segundos?',
      },
    ],
    examples: [
      'Você está com pouca vida e o caçador inimigo não aparece no mapa. Em vez de empurrar, você apenas finaliza as tropas e deixa a onda vir até a sua torre.',
      'Você quer voltar à base para comprar. Antes, empurra a onda inteira até a torre inimiga: as tropas morrem para a torre e o adversário é quem perde farm, não você.',
    ],
    mistakes: [
      'Empurrar por reflexo, sem motivo, e depois reclamar de gank.',
      'Voltar à base com a onda parada no meio da rota: você perde tropas e experiência enquanto caminha de volta.',
      'Quebrar o próprio freeze usando uma habilidade em área na onda.',
    ],
    apply: [
      'A cada onda, nomeie mentalmente o estado: "empurrando", "puxando" ou "congelada".',
      'Só empurre quando tiver um objetivo claro: voltar à base, ajudar em um objetivo ou causar dano na torre.',
      'Se estiver em desvantagem, prefira a onda do seu lado do mapa.',
    ],
    exercise: {
      title: 'Segurar um freeze por dois minutos',
      steps: [
        'Em uma partida normal, deixe a onda inimiga chegar perto da sua torre com três ou quatro tropas magas a mais.',
        'Receba a onda antes de ela entrar no alcance da torre e dê apenas o golpe final em cada tropa.',
        'Conte por quanto tempo consegue manter a onda no mesmo lugar.',
      ],
      success: 'Manter a onda parada por duas ondas seguidas sem que ela encoste na torre.',
    },
    quiz: [
      {
        question: 'O que faz uma onda "empurrar" para um lado?',
        options: ['Ter mais tropas vivas do que a onda adversária', 'Estar mais perto da torre inimiga', 'O campeão aliado ter mais nível'],
        correct: 0,
        explanation: 'A onda com mais tropas vence o confronto e avança, a menos que alguém interfira.',
      },
      {
        question: 'Qual é a posição mais segura para farmar quando você está em desvantagem?',
        options: ['Com a onda encostada na torre inimiga', 'Com a onda congelada perto da sua torre', 'No meio da rota, para dividir o risco'],
        correct: 1,
        explanation: 'Perto da sua torre o adversário precisa se expor para farmar, e você tem rota de fuga curta.',
      },
      {
        question: 'Antes de voltar à base, o ideal é:',
        options: ['Deixar a onda onde estiver', 'Empurrar a onda até a torre inimiga', 'Congelar a onda no meio da rota'],
        correct: 1,
        explanation: 'Com a onda na torre inimiga, as tropas morrem para a torre e você perde o mínimo de farm e experiência.',
      },
    ],
  },
  {
    id: 'f-recursos',
    title: 'Gerenciamento de recursos: vida, mana e tempos de recarga',
    category: 'fundamentos',
    level: 1,
    minutes: 7,
    skills: ['LANE'],
    objective: 'Tratar vida, mana, recargas e feitiços como um orçamento, e saber a hora certa de voltar à base.',
    theory: [
      {
        title: 'Tudo o que você tem é recurso',
        text: 'Vida e mana são óbvios, mas tempos de recarga e feitiços de invocador também são recursos. Um campeão sem a habilidade principal disponível vale muito menos por alguns segundos. Jogar bem é gastar recursos quando eles compram algo (um abate, uma onda, um objetivo) e não gastar quando não compram nada.',
      },
      {
        title: 'A vida é o recurso que decide a rota',
        text: 'Com pouca vida você perde o direito de se aproximar da onda, porque qualquer combinação do adversário vira abate. Trocar vida por vida só vale a pena quando você sai da troca com mais do que o oponente, ou quando tem sustentação e ele não.',
      },
      {
        title: 'Retorno à base no momento certo',
        text: 'O bom retorno acontece com a onda empurrada, ouro suficiente para um componente relevante e antes de ficar sem opções. Voltar tarde demais custa um abate; voltar com a onda mal posicionada custa tropas e experiência.',
      },
    ],
    examples: [
      'Você usa três habilidades para afastar o adversário, ele não perde quase nada e você fica com um terço da mana. Na onda seguinte ele avança e você não tem como responder.',
      'Você está com 40% de vida e 900 de ouro. Empurra a onda, volta, compra um componente e retorna à rota sem perder nenhuma tropa.',
    ],
    mistakes: [
      'Ficar na rota com pouca vida "só mais uma onda" e morrer com ouro acumulado no bolso.',
      'Usar o Flash de forma ofensiva em um abate incerto e ficar cinco minutos vulnerável a qualquer gank.',
      'Gastar mana em tropas que você mataria com ataques básicos.',
    ],
    apply: [
      'Antes de iniciar uma troca, confira três coisas: sua mana, as recargas do adversário e a posição da onda.',
      'Marque mentalmente o momento em que o adversário usa o Flash: ele fica cerca de cinco minutos sem o feitiço.',
      'Defina um limite pessoal: abaixo de um terço da vida, a prioridade passa a ser empurrar e voltar.',
    ],
    exercise: {
      title: 'Diário de retornos',
      steps: [
        'Em três partidas, anote o minuto e o motivo de cada retorno à base na fase de rotas.',
        'Classifique cada um: "com onda empurrada" ou "forçado" (morte, pouca vida, sem mana).',
        'Compare a proporção entre as partidas.',
      ],
      success: 'Ter mais retornos planejados do que forçados em uma partida inteira.',
    },
    quiz: [
      {
        question: 'Qual destes também deve ser tratado como recurso?',
        options: ['O tempo de recarga das habilidades', 'O número de tropas aliadas na base', 'A cor do lado do mapa'],
        correct: 0,
        explanation: 'Habilidade em recarga é poder indisponível: saber quando você e o adversário estão "vazios" decide trocas.',
      },
      {
        question: 'Quando vale a pena trocar vida com o adversário?',
        options: ['Sempre que ele estiver no alcance', 'Quando você sai da troca em situação melhor do que ele', 'Apenas quando você estiver com a vida cheia'],
        correct: 1,
        explanation: 'O que importa é o saldo: dano causado contra dano recebido, e quem consegue se recuperar depois.',
      },
      {
        question: 'Qual é a melhor condição para voltar à base?',
        options: ['Com a onda empurrada e ouro para um componente', 'Assim que juntar qualquer quantia de ouro', 'Somente depois de morrer, para não perder tempo'],
        correct: 0,
        explanation: 'Onda empurrada reduz o farm perdido; ouro suficiente garante que a viagem renda poder.',
      },
    ],
  },
  {
    id: 'f-posicionamento',
    title: 'Posicionamento: onde ficar quando nada está acontecendo',
    category: 'fundamentos',
    level: 1,
    minutes: 7,
    skills: ['LANE', 'TEAMFIGHT'],
    objective: 'Usar o alcance de ameaça do adversário e a posição das tropas para decidir onde pisar.',
    theory: [
      {
        title: 'Alcance de ameaça',
        text: 'Todo campeão tem uma distância a partir da qual consegue causar dano relevante ou iniciar uma luta: o alcance das habilidades somado ao deslocamento e ao Flash. Ficar um passo fora dessa distância obriga o adversário a gastar algo para chegar em você.',
      },
      {
        title: 'As tropas são parte do posicionamento',
        text: 'Tropas bloqueiam projéteis e atacam quem agride um campeão perto delas. Ficar atrás da sua onda protege contra habilidades em linha; entrar no meio da onda inimiga para trocar faz você receber dano de várias tropas.',
      },
      {
        title: 'O lado do mapa também importa',
        text: 'Perto de uma entrada de rio sem visão você pode ser pego pelo caçador. Posicione-se do lado onde há uma sentinela ou onde o seu caçador está. Sem informação nenhuma, presuma que o perigo vem do lado escuro.',
      },
    ],
    examples: [
      'Contra um campeão com gancho, você fica na diagonal das suas tropas magas: se ele errar, perde a principal ferramenta por vários segundos.',
      'Há uma sentinela no rio de cima e nenhuma no de baixo. Você farma encostado no lado de cima.',
    ],
    mistakes: [
      'Ficar parado no mesmo lugar: alvo imóvel é fácil de acertar.',
      'Andar para frente para acertar um ataque básico e entrar no alcance de todas as habilidades do adversário.',
      'Ficar entre as tropas inimigas e a torre delas sem saber onde está o caçador.',
    ],
    apply: [
      'Descubra, no início de cada rota, qual é a habilidade principal do adversário e posicione-se para dificultá-la.',
      'Movimente-se entre os ataques: pequenos passos laterais atrapalham quem depende de mira.',
      'Quando a habilidade principal dele entrar em recarga, avance; quando voltar, recue.',
    ],
    exercise: {
      title: 'Zero dano gratuito',
      steps: [
        'Jogue uma fase de rotas com um único objetivo: não receber dano enquanto dá o golpe final nas tropas.',
        'Toda vez que for atingido sem ter causado nada em troca, anote o motivo.',
        'Ao final, veja qual foi o motivo mais frequente.',
      ],
      success: 'Chegar aos 6 minutos com mais vida perdida pelo adversário do que por você.',
    },
    quiz: [
      {
        question: 'O que é o "alcance de ameaça" de um campeão?',
        options: ['O alcance do ataque básico', 'A distância a partir da qual ele consegue iniciar uma luta ou causar dano relevante', 'O raio de visão do campeão'],
        correct: 1,
        explanation: 'Inclui habilidades, deslocamentos e feitiços. Ficar fora dele obriga o adversário a gastar recursos.',
      },
      {
        question: 'Por que entrar no meio da onda inimiga para trocar costuma ser ruim?',
        options: ['Porque as tropas passam a atacar você quando você agride o campeão inimigo', 'Porque você perde o ouro das tropas', 'Porque a torre inimiga ganha alcance'],
        correct: 0,
        explanation: 'As tropas próximas defendem o campeão aliado. No início do jogo esse dano decide trocas.',
      },
      {
        question: 'Sem visão em nenhum dos lados, onde é mais seguro presumir que está o perigo?',
        options: ['Em lugar nenhum, até alguém aparecer', 'No lado sem visão mais próximo de você', 'Sempre na base inimiga'],
        correct: 1,
        explanation: 'Ausência de informação não é ausência de perigo. Jogue como se o caçador pudesse vir do lado escuro.',
      },
    ],
  },
  {
    id: 'f-visao',
    title: 'Visão de mapa: informação é segurança',
    category: 'fundamentos',
    level: 1,
    minutes: 8,
    skills: ['VISION'],
    objective: 'Usar sentinelas, sentinelas de controle e o minimapa para tomar decisões com informação em vez de palpite.',
    theory: [
      {
        title: 'Para que serve a visão',
        text: 'Visão responde a duas perguntas: "onde eles estão?" e "posso fazer isso com segurança?". Uma sentinela não mata ninguém, mas evita mortes, permite avançar e revela o caminho do caçador. Como cada morte evitada vale ouro e tempo, visão é uma das formas mais baratas de vantagem.',
      },
      {
        title: 'As ferramentas',
        text: 'O amuleto inicial dá sentinelas invisíveis temporárias. A Sentinela de Controle é comprada, fica no mapa até ser destruída e revela e desativa sentinelas inimigas ao redor. A Lente do Oráculo varre sentinelas inimigas. No meio do jogo, trocar de amuleto conforme a sua função faz diferença.',
      },
      {
        title: 'Onde e quando colocar',
        text: 'Na fase de rotas, proteja a entrada por onde o caçador chega. Antes de um objetivo, coloque visão ao redor dele com antecedência, não quando a luta já começou. Sentinela colocada enquanto você está em desvantagem deve ser defensiva; em vantagem, avance a visão para o território inimigo.',
      },
    ],
    examples: [
      'Um minuto antes do dragão nascer, você e o suporte limpam a visão inimiga do rio e deixam uma Sentinela de Controle no covil. O time adversário precisa entrar no escuro para contestar.',
      'Você olha o minimapa e vê o caçador inimigo no lado oposto. Por alguns segundos, é seguro avançar e trocar.',
    ],
    mistakes: [
      'Terminar a partida com ouro sobrando e nenhuma Sentinela de Controle comprada.',
      'Colocar a sentinela no mesmo arbusto sempre, mesmo quando a onda está em outro lugar.',
      'Não olhar o minimapa: a informação existe, mas não é usada.',
    ],
    apply: [
      'Compre uma Sentinela de Controle em todo retorno à base em que sobrar ouro e houver espaço.',
      'Crie o hábito de olhar o minimapa sempre que der o golpe final em uma tropa.',
      'Antes de cada objetivo, pergunte: temos visão dos acessos por onde eles vão chegar?',
    ],
    exercise: {
      title: 'Contagem de visão',
      steps: [
        'Em três partidas, confira no fim o seu placar de visão e quantas Sentinelas de Controle comprou.',
        'Divida o placar de visão pela duração em minutos.',
        'Tente aumentar esse número na partida seguinte.',
      ],
      success: 'Aumentar o placar de visão por minuto em relação à sua média anterior por três partidas seguidas.',
    },
    quiz: [
      {
        question: 'O que a Sentinela de Controle faz de diferente da sentinela comum do amuleto?',
        options: ['Dura apenas alguns segundos', 'Permanece até ser destruída e revela e desativa sentinelas inimigas próximas', 'Só pode ser colocada dentro da base'],
        correct: 1,
        explanation: 'Ela nega visão ao adversário e não expira sozinha, por isso é a principal ferramenta para controlar uma área.',
      },
      {
        question: 'Quando a visão ao redor de um objetivo deve ser colocada?',
        options: ['No momento em que a luta começa', 'Com antecedência, antes de o objetivo nascer', 'Depois que o objetivo for conquistado'],
        correct: 1,
        explanation: 'Preparar a área antes obriga o adversário a entrar sem informação.',
      },
      {
        question: 'Qual hábito aproveita melhor a visão que já existe no mapa?',
        options: ['Olhar o minimapa com frequência', 'Comprar mais sentinelas do que consegue carregar', 'Ficar parado ao lado da sentinela'],
        correct: 0,
        explanation: 'Sentinela só gera valor quando alguém olha o que ela mostra.',
      },
    ],
  },
  {
    id: 'f-macro-nocoes',
    title: 'Noções de macro: o mapa como um tabuleiro',
    category: 'fundamentos',
    level: 1,
    minutes: 8,
    skills: ['OBJECTIVES', 'CLOSING'],
    objective: 'Entender o que realmente vence partidas e criar uma ordem de prioridades para decidir o que fazer a cada momento.',
    theory: [
      {
        title: 'O jogo acaba no Nexus',
        text: 'Abates não vencem partidas: estruturas vencem. Um abate só tem valor pelo que permite fazer nos segundos seguintes — derrubar uma torre, conquistar um dragão, invadir a selva. Abate sem conversão é apenas ouro; abate convertido em objetivo é avanço real.',
      },
      {
        title: 'Uma ordem de prioridades',
        text: 'Uma regra prática: primeiro a onda, depois o objetivo, depois a luta. Ondas empurradas dão pressão e impedem que você perca farm. Com as ondas resolvidas, o time se move junto para um objetivo. A luta acontece como consequência de disputar algo, não como finalidade.',
      },
      {
        title: 'Trocas pelo mapa',
        text: 'Nem tudo pode ser defendido. Se o adversário leva um dragão com cinco jogadores, responder com uma torre do outro lado é melhor do que chegar atrasado a uma luta perdida. Pense em trocas: o que eu ganho enquanto eles ganham aquilo?',
      },
    ],
    examples: [
      'Seu time consegue dois abates na rota inferior. Em vez de voltar à base, os dois sobreviventes empurram a onda e derrubam as barricadas da torre.',
      'O adversário começa o Barão com vantagem numérica. Seu time, sem condições de contestar, derruba a torre e o inibidor do lado oposto.',
    ],
    mistakes: [
      'Perseguir um inimigo com pouca vida por metade do mapa enquanto um objetivo fica livre.',
      'Agrupar no meio sem empurrar as rotas laterais: as ondas inimigas chegam às suas torres sozinhas.',
      'Lutar por lutar, sem nada em disputa, logo antes de um objetivo importante.',
    ],
    apply: [
      'Depois de cada abate, pergunte em voz alta: "o que isso nos permite pegar agora?".',
      'Antes de sair da rota, empurre a onda.',
      'Olhe o cronômetro dos objetivos no placar e planeje o próximo minuto em torno do que vai nascer.',
    ],
    exercise: {
      title: 'Abate convertido',
      steps: [
        'Em uma partida, conte quantos abates ou assistências você teve.',
        'Ao lado, conte quantos foram seguidos de algo concreto: torre, barricada, dragão, Arauto, Barão ou acampamentos inimigos.',
        'Calcule a proporção.',
      ],
      success: 'Converter pelo menos metade das suas participações em abates em algum ganho no mapa.',
    },
    quiz: [
      {
        question: 'Por que um abate, sozinho, não garante vantagem duradoura?',
        options: ['Porque o ouro do abate é devolvido depois', 'Porque o valor real está no que o abate permite conquistar em seguida', 'Porque abates não contam para o placar'],
        correct: 1,
        explanation: 'Partidas são vencidas com estruturas e objetivos. O abate abre uma janela; cabe ao time usá-la.',
      },
      {
        question: 'Na regra "onda, objetivo, luta", por que a onda vem primeiro?',
        options: ['Porque ondas empurradas dão pressão e evitam perda de farm enquanto o time se move', 'Porque tropas dão mais ouro que objetivos', 'Porque a onda nunca se move sozinha'],
        correct: 0,
        explanation: 'Sair com as ondas mal posicionadas custa farm e torres enquanto você disputa outra coisa.',
      },
      {
        question: 'O adversário garante um dragão que seu time não consegue contestar. Qual é a melhor resposta?',
        options: ['Entrar na luta mesmo em desvantagem', 'Conquistar algo em outro ponto do mapa', 'Esperar na base'],
        correct: 1,
        explanation: 'Trocar objetivos é melhor do que perder uma luta e o objetivo ao mesmo tempo.',
      },
    ],
  },
];
