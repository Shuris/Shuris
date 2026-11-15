import type { Lesson } from '../types';

export const ROTAS: Lesson[] = [
  {
    id: 'r-primeiros-10',
    title: 'Como jogar os primeiros 10 minutos',
    category: 'rotas',
    level: 1,
    minutes: 9,
    skills: ['LANE', 'FARM'],
    objective: 'Ter um roteiro para o início da partida: níveis, primeira volta à base e o que observar no mapa.',
    theory: [
      {
        title: 'A corrida pelo nível 2',
        text: 'Nas rotas solo, o nível 2 chega com a primeira onda inteira mais uma tropa corpo a corpo da segunda (sete tropas). Na rota inferior, com a experiência dividida entre dois, são a primeira onda e as três tropas corpo a corpo da segunda (nove). Quem chega antes ganha uma habilidade a mais por alguns segundos e pode forçar uma troca vantajosa. Se o adversário vai chegar primeiro, recue antes de a segunda onda encostar.',
      },
      {
        title: 'O primeiro retorno',
        text: 'O primeiro retorno à base define o ritmo da rota. O ideal é empurrar uma onda grande para a torre inimiga e voltar com ouro para um componente importante. Quem volta primeiro com a onda bem posicionada retorna mais forte e sem perder farm.',
      },
      {
        title: 'O mapa nos primeiros minutos',
        text: 'Observe por onde o caçador inimigo começa (pela rota que chega atrasada ou com menos vida) para estimar de que lado ele vai aparecer na primeira passagem. Nos primeiros minutos, uma sentinela na entrada certa do rio evita o gank mais previsível da partida.',
      },
    ],
    examples: [
      'Você está prestes a pegar o nível 2 antes do oponente. No instante em que a primeira tropa corpo a corpo da segunda onda morre, você avança e troca com duas habilidades contra uma.',
      'A dupla inferior inimiga chega tarde à rota. O caçador deles provavelmente começou naquele lado e deve terminar a rota do lado oposto: a rota superior precisa ter cuidado por volta do terceiro minuto.',
    ],
    mistakes: [
      'Trocar no nível 1 contra um campeão mais forte no início só porque ele se aproximou.',
      'Empurrar as primeiras ondas sem sentinela e sem saber onde está o caçador.',
      'Voltar à base com pouco ouro e a onda no meio da rota.',
    ],
    apply: [
      'Antes de a partida começar, decida: meu campeão é mais forte ou mais fraco que o dele nos primeiros níveis?',
      'Conte as tropas até o nível 2 e reaja antes do adversário.',
      'Guarde a sentinela do amuleto para a janela do primeiro gank, e não para o primeiro segundo da rota.',
    ],
    exercise: {
      title: 'Roteiro dos três primeiros minutos',
      steps: [
        'Em três partidas, anote quem chegou primeiro ao nível 2 na sua rota.',
        'Anote o minuto do seu primeiro retorno e quanto ouro você tinha.',
        'Anote se você sabia de que lado o caçador inimigo começou.',
      ],
      success: 'Em pelo menos duas das três partidas, fazer o primeiro retorno com a onda empurrada e ouro para um componente.',
    },
    quiz: [
      {
        question: 'Nas rotas solo, quando o nível 2 é alcançado?',
        options: ['Com a primeira onda inteira', 'Com a primeira onda mais uma tropa corpo a corpo da segunda', 'Somente com duas ondas completas'],
        correct: 1,
        explanation: 'São sete tropas no total. Saber disso permite prever o momento exato da vantagem de nível.',
      },
      {
        question: 'O adversário vai chegar ao nível 2 antes de você. O que fazer?',
        options: ['Avançar para trocar antes disso', 'Recuar um pouco antes de a segunda onda encostar', 'Usar todas as habilidades na onda'],
        correct: 1,
        explanation: 'Por alguns segundos ele terá uma habilidade a mais. Ceder espaço evita uma troca perdida.',
      },
      {
        question: 'Como estimar o lado em que o caçador inimigo começou?',
        options: ['Pela cor do lado do mapa', 'Pela rota adversária que chega atrasada ou com menos vida', 'Não é possível estimar'],
        correct: 1,
        explanation: 'Quem ajuda o caçador no primeiro acampamento chega um pouco depois à rota.',
      },
    ],
  },
  {
    id: 'r-manipular-wave',
    title: 'Freeze, empurrão lento e empurrão rápido',
    category: 'rotas',
    level: 2,
    minutes: 10,
    skills: ['FARM', 'CLOSING'],
    objective: 'Escolher de propósito entre congelar, empurrar devagar e empurrar rápido, de acordo com o que você quer fazer em seguida.',
    theory: [
      {
        title: 'Freeze: negar farm',
        text: 'Para congelar, a onda inimiga precisa ter algumas tropas a mais (três ou quatro magas) e ficar logo fora do alcance da sua torre. Você dá apenas o último golpe. O adversário precisa andar a rota inteira e se expor para farmar; se ele não vier, perde ouro e experiência.',
      },
      {
        title: 'Empurrão lento: construir uma onda grande',
        text: 'Matando só as tropas magas inimigas e deixando as demais, a sua onda acumula reforços e cresce. Uma onda grande chegando à torre inimiga cria tempo: o adversário fica preso farmando sob a torre enquanto você volta à base, coloca visão ou ajuda em outra rota.',
      },
      {
        title: 'Empurrão rápido: resolver agora',
        text: 'Usar tudo para limpar a onda serve quando você precisa sair imediatamente: um objetivo está nascendo, um aliado precisa de ajuda, ou você quer que a onda bata na torre e volte para o seu lado. Depois que uma onda grande morre na torre, a seguinte tende a voltar em sua direção.',
      },
    ],
    examples: [
      'Você matou o oponente e a onda está perto da sua torre. Em vez de empurrar, congela: ele volta e não consegue se aproximar das tropas sem arriscar outra morte.',
      'Trinta segundos antes do dragão, o jogador do meio empurra rápido e chega ao rio antes do adversário, que fica preso limpando a onda sob a torre.',
    ],
    mistakes: [
      'Congelar quando o time precisa de você em um objetivo: o freeze é bom para a sua rota e ruim para o mapa.',
      'Fazer um empurrão lento e ficar ao lado da onda sem visão, entregando um gank fácil.',
      'Empurrar rápido sempre, o que mantém você permanentemente longe da torre.',
    ],
    apply: [
      'Vai voltar à base ou sair da rota? Empurrão lento duas ondas antes, para a onda grande bater na torre.',
      'Está na frente e o adversário é fraco em duelos? Freeze.',
      'Um objetivo nasce em menos de um minuto? Empurrão rápido e movimento.',
    ],
    exercise: {
      title: 'Uma onda grande antes do retorno',
      steps: [
        'Escolha um momento em que queira voltar à base.',
        'Duas ondas antes, mate apenas as tropas magas inimigas e deixe a sua onda crescer.',
        'Leve a onda grande até a torre e só então volte.',
      ],
      success: 'Voltar à base e retornar à rota sem perder mais do que duas ou três tropas.',
    },
    quiz: [
      {
        question: 'Para manter um freeze, a onda inimiga precisa:',
        options: ['Ter menos tropas que a sua', 'Ter algumas tropas a mais e ficar logo fora do alcance da sua torre', 'Estar dentro do alcance da sua torre'],
        correct: 1,
        explanation: 'Com um pouco mais de tropas a onda inimiga não é empurrada de volta; fora do alcance, a torre não a destrói.',
      },
      {
        question: 'Qual é a principal vantagem de um empurrão lento?',
        options: ['Negar experiência imediatamente', 'Criar uma onda grande que dá tempo livre para você', 'Fazer a torre inimiga causar mais dano'],
        correct: 1,
        explanation: 'Enquanto o adversário limpa a onda grande sob a torre, você pode voltar, colocar visão ou se mover.',
      },
      {
        question: 'Quando o empurrão rápido é a escolha certa?',
        options: ['Quando você precisa sair da rota agora para algo importante', 'Sempre que tiver mana', 'Quando está em desvantagem e sem visão'],
        correct: 0,
        explanation: 'Limpar a onda rapidamente libera você para o mapa, ao custo de ficar exposto por alguns instantes.',
      },
    ],
  },
  {
    id: 'r-quando-trocar',
    title: 'Quando trocar com o adversário',
    category: 'rotas',
    level: 2,
    minutes: 9,
    skills: ['LANE'],
    objective: 'Identificar as janelas em que uma troca é favorável e reconhecer as que devem ser recusadas.',
    theory: [
      {
        title: 'Trocas são decididas antes de começar',
        text: 'Uma troca favorável é aquela em que você causa mais do que recebe. Isso depende de fatores visíveis antes do primeiro golpe: quantidade de tropas de cada lado, níveis, habilidades em recarga e vida de cada um. Ler esses fatores vale mais do que mecânica.',
      },
      {
        title: 'As janelas clássicas',
        text: 'A melhor janela é quando o adversário se aproxima para dar o último golpe em uma tropa: nesse instante ele precisa escolher entre farmar e responder. Outras janelas: logo depois de ele gastar a habilidade principal, quando você sobe de nível antes, e quando a sua onda é maior, porque as tropas dele vão bater em você menos do que as suas nele.',
      },
      {
        title: 'Troca curta ou troca longa',
        text: 'Campeões de dano explosivo querem trocas curtas: bater e sair antes da resposta. Campeões de dano contínuo ou com sustentação querem trocas longas. Descubra qual é o seu perfil e o do oponente e não aceite o tipo de troca que favorece o outro.',
      },
    ],
    examples: [
      'O adversário anda para finalizar a tropa canhão. Você ataca nesse momento: ou ele perde a tropa, ou recebe dano de graça.',
      'Seu oponente usa a habilidade de controle e erra. Durante a recarga, você avança, causa dano e recua antes de ela voltar.',
    ],
    mistakes: [
      'Iniciar uma troca dentro de uma onda inimiga grande e receber mais dano das tropas do que do campeão.',
      'Continuar trocando depois de a sua janela acabar, transformando uma troca ganha em uma perdida.',
      'Trocar com pouca vida "para devolver o dano" e dar ao adversário alcance de abate.',
    ],
    apply: [
      'Antes de trocar, compare as ondas: quem tem mais tropas?',
      'Acompanhe a principal habilidade do adversário. Usada? Avance. Disponível? Respeite.',
      'Defina a saída antes de entrar: bater quantas vezes e recuar para onde.',
    ],
    exercise: {
      title: 'Punir o último golpe',
      steps: [
        'Em uma fase de rotas, tente atacar o adversário somente quando ele se aproximar para finalizar uma tropa.',
        'Conte quantas vezes conseguiu causar dano sem receber resposta.',
        'Conte quantas vezes ele fez o mesmo com você.',
      ],
      success: 'Terminar os primeiros seis minutos com mais trocas gratuitas a seu favor do que contra.',
    },
    quiz: [
      {
        question: 'Qual é a janela mais comum para uma troca favorável?',
        options: ['Quando o adversário vai dar o último golpe em uma tropa', 'Quando as duas ondas acabaram de chegar', 'Quando você está com menos vida'],
        correct: 0,
        explanation: 'Ele precisa escolher entre o ouro da tropa e responder ao seu ataque.',
      },
      {
        question: 'Por que o tamanho das ondas influencia uma troca?',
        options: ['Porque tropas atacam o campeão que agride um campeão aliado delas', 'Porque ondas grandes reduzem o alcance das habilidades', 'Não influencia'],
        correct: 0,
        explanation: 'Trocar com mais tropas do seu lado soma dano a seu favor; no meio de uma onda inimiga grande, soma contra.',
      },
      {
        question: 'Um campeão de dano explosivo deve preferir:',
        options: ['Trocas longas', 'Trocas curtas, saindo antes da resposta', 'Nunca trocar'],
        correct: 1,
        explanation: 'O dano dele vem de uma vez. Ficar depois disso dá tempo para o adversário revidar.',
      },
    ],
  },
  {
    id: 'r-evitar-ganks',
    title: 'Como evitar ganks',
    category: 'rotas',
    level: 1,
    minutes: 8,
    skills: ['LANE', 'VISION'],
    objective: 'Reduzir as mortes para o caçador inimigo combinando posição da onda, visão e leitura do mapa.',
    theory: [
      {
        title: 'Gank precisa de três coisas',
        text: 'Um gank funciona quando você está longe da torre, sem visão e sem rota de fuga. Tire uma dessas condições e a maioria dos ganks falha. A posição da onda é a mais importante: é ela que determina a distância até a sua torre.',
      },
      {
        title: 'Rastrear o caçador',
        text: 'O caçador não pode estar em dois lugares. Se ele apareceu na rota superior, a inferior tem alguns segundos de liberdade. Se ninguém o vê há muito tempo e a sua onda está avançada, presuma que ele está a caminho. Acampamentos limpos e sentinelas no rio contam a história do trajeto dele.',
      },
      {
        title: 'Sinais do adversário de rota',
        text: 'Quando o oponente muda de comportamento sem motivo — avança de repente, guarda a habilidade de controle, se posiciona de forma agressiva com pouca vida — é provável que ele saiba de algo que você não sabe. Mudança de postura é informação.',
      },
    ],
    examples: [
      'Sua onda está na torre inimiga e ninguém vê o caçador há quarenta segundos. Você recua para o seu lado do rio e espera a onda voltar.',
      'O adversário, que jogava recuado, passa a andar para frente com um terço da vida. Você recua e, segundos depois, o caçador aparece na sentinela.',
    ],
    mistakes: [
      'Empurrar sem sentinela e sem Flash e culpar o time pela falta de avisos.',
      'Colocar a sentinela e nunca mais olhar para ela.',
      'Gastar o deslocamento do campeão para farmar ou trocar quando o caçador inimigo está sumido.',
    ],
    apply: [
      'Sem Flash? Jogue com a onda mais perto da sua torre até ele voltar.',
      'Relacione a sua agressividade ao que você sabe: caçador visível longe, pode avançar; caçador desaparecido, respeite.',
      'Guarde ao menos uma ferramenta de fuga quando estiver avançado.',
    ],
    exercise: {
      title: 'Revisão das mortes para gank',
      steps: [
        'Nas suas últimas cinco partidas, liste cada morte em que o caçador participou antes dos 15 minutos.',
        'Para cada uma, marque: onde estava a onda, se havia sentinela e se você tinha Flash.',
        'Encontre a condição que mais se repete.',
      ],
      success: 'Jogar três partidas seguidas com no máximo uma morte para gank na fase de rotas.',
    },
    quiz: [
      {
        question: 'Qual fator mais influencia a sua vulnerabilidade a ganks?',
        options: ['A posição da onda em relação à sua torre', 'O número de abates que você tem', 'O nível do seu campeão'],
        correct: 0,
        explanation: 'Onda avançada significa caminho longo até a segurança. Perto da torre, a maioria dos ganks não funciona.',
      },
      {
        question: 'O caçador inimigo acabou de aparecer na rota oposta à sua. O que isso significa?',
        options: ['Você tem alguns segundos de maior segurança para avançar', 'Ele chegará à sua rota em instantes', 'Nada: a posição dele é irrelevante'],
        correct: 0,
        explanation: 'Ele precisa de tempo para atravessar o mapa. Essa é uma janela para trocar ou empurrar.',
      },
      {
        question: 'Seu oponente de rota, com pouca vida, fica agressivo de repente. A leitura mais provável é:',
        options: ['Ele errou', 'Ele espera ajuda do caçador', 'Ele quer voltar à base'],
        correct: 1,
        explanation: 'Mudança de postura sem motivo aparente costuma indicar que há um aliado dele por perto.',
      },
    ],
  },
  {
    id: 'r-aproveitar-vantagem',
    title: 'Como aproveitar vantagens',
    category: 'rotas',
    level: 2,
    minutes: 9,
    skills: ['CLOSING'],
    objective: 'Transformar uma vantagem na rota em vantagem para o time, em vez de apenas acumular ouro.',
    theory: [
      {
        title: 'Vantagem tem prazo de validade',
        text: 'Uma liderança de ouro vale mais no momento em que é conquistada. Com o passar do tempo, os itens de todos se completam e a diferença relativa diminui. Por isso a pergunta certa depois de um abate é: "o que eu consigo tirar disso nos próximos trinta segundos?".',
      },
      {
        title: 'As formas de converter',
        text: 'Há quatro conversões principais: negar farm (freeze ou zoneamento), derrubar barricadas e a torre, invadir a selva inimiga com o seu caçador e levar a sua força a outra rota ou a um objetivo. A escolha depende do campeão e da posição da onda.',
      },
      {
        title: 'Não devolver a vantagem',
        text: 'Quem está na frente vira o alvo principal. O ouro que você carrega aumenta a recompensa pela sua eliminação, e morrer devolve boa parte do que foi ganho. Jogar em vantagem é pressionar com visão e sem se expor sozinho.',
      },
    ],
    examples: [
      'Depois de eliminar o oponente, você empurra a onda, causa dano à torre e sai para o rio ajudar o caçador a garantir o próximo objetivo.',
      'Com dois abates de vantagem, você entra na selva inimiga sem visão, é pego por três e entrega a recompensa acumulada. A rota volta a ficar equilibrada.',
    ],
    mistakes: [
      'Ficar na rota farmando por dez minutos com uma vantagem enorme enquanto o resto do mapa perde.',
      'Tentar mergulhar na torre repetidamente até morrer.',
      'Não comprar visão quando está na frente: é justamente quando ela mais rende.',
    ],
    apply: [
      'Depois de cada abate, escolha uma conversão: negar, torre, selva ou movimento.',
      'Leve visão para o território inimigo antes de avançar.',
      'Observe o valor da recompensa pela sua eliminação e jogue com mais cuidado conforme ele cresce.',
    ],
    exercise: {
      title: 'Abate, e depois?',
      steps: [
        'Em três partidas, toda vez que conseguir um abate na rota, anote o que fez nos trinta segundos seguintes.',
        'Classifique: "converti" (torre, farm negado, objetivo, selva) ou "não converti".',
        'Compare o resultado das partidas com mais conversões.',
      ],
      success: 'Converter a maioria dos abates da fase de rotas em algum ganho concreto.',
    },
    quiz: [
      {
        question: 'Por que uma vantagem deve ser usada logo?',
        options: ['Porque a diferença relativa diminui conforme todos completam os itens', 'Porque o ouro expira', 'Porque o adversário reaparece mais forte'],
        correct: 0,
        explanation: 'Uma liderança de ouro pesa mais cedo. Mais tarde, com todos os itens comprados, ela vale proporcionalmente menos.',
      },
      {
        question: 'Qual destas NÃO é uma boa forma de converter vantagem?',
        options: ['Derrubar barricadas da torre', 'Entrar sozinho na selva inimiga sem visão', 'Mover-se para ajudar em um objetivo'],
        correct: 1,
        explanation: 'Sem visão, quem está na frente vira presa fácil e entrega a recompensa acumulada.',
      },
      {
        question: 'O que acontece quando o jogador em vantagem é eliminado?',
        options: ['Nada especial', 'O adversário recebe uma recompensa maior e recupera parte da diferença', 'O jogador perde os itens'],
        correct: 1,
        explanation: 'Sequências de abates e ouro acumulado aumentam a recompensa. Morrer na frente custa caro.',
      },
    ],
  },
  {
    id: 'r-jogar-atras',
    title: 'Como jogar em desvantagem',
    category: 'rotas',
    level: 2,
    minutes: 8,
    skills: ['LANE', 'MENTAL'],
    objective: 'Limitar o prejuízo quando a rota começa mal e continuar útil para o time.',
    theory: [
      {
        title: 'O objetivo muda',
        text: 'Em desvantagem, o objetivo deixa de ser vencer a rota e passa a ser perder o mínimo possível. Cada morte adicional amplia a distância; cada onda farmada com segurança a reduz. Aceitar isso cedo é a diferença entre uma rota ruim e uma partida perdida.',
      },
      {
        title: 'Ferramentas de quem está atrás',
        text: 'Deixe a onda vir até você e farme perto da torre. Abra mão de tropas quando o custo for uma troca desfavorável: perder duas tropas é melhor do que perder a vida. Peça ajuda ao caçador apenas quando a onda estiver do seu lado, porque gank com onda avançada raramente funciona.',
      },
      {
        title: 'Como continuar útil',
        text: 'Mesmo com menos ouro você oferece visão, controle de grupo, ondas empurradas e presença em objetivos. Itens defensivos ou de utilidade mais baratos costumam render mais do que insistir na montagem de dano planejada antes da partida.',
      },
    ],
    examples: [
      'Você morreu duas vezes cedo. Em vez de voltar e trocar, deixa a onda chegar à torre, perde algumas tropas e chega aos 15 minutos com farm aceitável e sem novas mortes.',
      'Um atirador em desvantagem deixa de lutar na frente e passa a acompanhar o time de longe, limpando ondas e atacando apenas o alvo mais próximo e seguro.',
    ],
    mistakes: [
      'Tentar "recuperar" com uma jogada arriscada e morrer pela terceira vez.',
      'Desistir da partida mentalmente e parar de farmar e de acompanhar o time.',
      'Seguir a mesma montagem de itens como se a partida estivesse igual.',
    ],
    apply: [
      'Depois de duas mortes na rota, adote a regra: não troco, só farmo o que for seguro.',
      'Compre visão e mantenha a onda perto da torre.',
      'Procure a sua utilidade nas lutas: quem eu consigo proteger ou controlar?',
    ],
    exercise: {
      title: 'Rota perdida, partida viva',
      steps: [
        'Na próxima partida em que ficar em desvantagem cedo, conte quantas vezes morreu depois disso até os 15 minutos.',
        'Anote o seu CS aos 15 minutos.',
        'Compare com partidas anteriores em que a rota começou mal.',
      ],
      success: 'Não morrer novamente na rota depois de ficar em desvantagem e manter um farm próximo da sua média.',
    },
    quiz: [
      {
        question: 'Qual é o objetivo principal de quem está em desvantagem na rota?',
        options: ['Vencer a rota a qualquer custo', 'Perder o mínimo possível e não ampliar a diferença', 'Abandonar a rota definitivamente'],
        correct: 1,
        explanation: 'Evitar novas mortes e farmar com segurança mantém você relevante para o restante da partida.',
      },
      {
        question: 'Quando vale abrir mão de uma tropa?',
        options: ['Nunca', 'Quando pegá-la exigir uma troca desfavorável ou risco de morte', 'Sempre que o adversário estiver por perto'],
        correct: 1,
        explanation: 'Algumas tropas valem pouco perto do custo de uma morte: ouro para o adversário e tempo fora da rota.',
      },
      {
        question: 'Em que situação pedir um gank faz mais sentido?',
        options: ['Quando a onda está perto da sua torre', 'Quando a onda está na torre inimiga', 'Quando você não tem vida'],
        correct: 0,
        explanation: 'Com a onda do seu lado, o adversário está longe da torre dele e o gank tem espaço para funcionar.',
      },
    ],
  },
];
