import type { Lesson } from '../types';

export const COMBATE: Lesson[] = [
  {
    id: 'c-mecanicas',
    title: 'Mecânicas individuais: atacar e se mover',
    category: 'combate',
    level: 2,
    minutes: 9,
    skills: ['TEAMFIGHT'],
    objective: 'Dominar o movimento entre ataques (kiting) e treinar combos até que saiam sem pensar.',
    theory: [
      {
        title: 'O ataque básico tem duas partes',
        text: 'Todo ataque básico tem um instante em que o dano é aplicado e um tempo de espera até o próximo. Depois que o dano sai, ficar parado não ajuda em nada. Dar um passo nesse intervalo e atacar de novo assim que possível é o que se chama de kiting: você mantém o dano e controla a distância.',
      },
      {
        title: 'Mover para onde',
        text: 'Contra um inimigo que avança, mova-se para trás entre os ataques. Contra um inimigo que foge, mova-se para frente. Em lutas, mova-se para o lado quando houver habilidades de mira vindo na sua direção. O comando de "atacar ao mover" ajuda a mirar no alvo mais próximo sem clicar no chão por engano.',
      },
      {
        title: 'Combos se treinam fora da partida',
        text: 'Um combo é uma sequência de habilidades e ataques que aproveita cancelamentos de animação e reinícios do ataque básico. Dentro de uma partida ranqueada não é hora de aprender a sequência: a Ferramenta de Treino permite repetir dezenas de vezes em poucos minutos, com recargas zeradas.',
      },
    ],
    examples: [
      'Um atirador perseguido por um lutador ataca, dá um passo para trás, ataca de novo. O lutador percorre a mesma distância recebendo dano o tempo todo.',
      'Antes de jogar um campeão novo em ranqueada, você pratica o combo principal vinte vezes seguidas na Ferramenta de Treino até acertar todas.',
    ],
    mistakes: [
      'Ficar parado atacando enquanto o inimigo se aproxima.',
      'Cancelar o próprio ataque ao clicar para andar cedo demais, antes de o dano sair.',
      'Tentar um combo difícil pela primeira vez em um momento decisivo da partida.',
    ],
    apply: [
      'Em toda perseguição ou fuga, intercale um passo entre cada ataque.',
      'Ative e acostume-se ao lançamento rápido das habilidades.',
      'Aqueça por cinco minutos na Ferramenta de Treino antes da primeira partida do dia.',
    ],
    exercise: {
      title: 'Kiting contra o boneco',
      steps: [
        'Na Ferramenta de Treino, coloque um boneco de treino e ataque-o dando um passo entre cada golpe.',
        'Aumente a velocidade de ataque com itens e repita: o ritmo muda.',
        'Depois, faça o mesmo contra um bot que persiga você.',
      ],
      success: 'Manter o ritmo por trinta segundos sem cancelar nenhum ataque e sem ficar parado.',
    },
    quiz: [
      {
        question: 'O que é kiting?',
        options: ['Atacar parado para causar mais dano', 'Mover-se no intervalo entre os ataques básicos', 'Usar todas as habilidades de uma vez'],
        correct: 1,
        explanation: 'Depois que o dano do ataque sai, o intervalo até o próximo pode ser usado para reposicionar.',
      },
      {
        question: 'O que acontece se você clicar para andar antes de o dano do ataque ser aplicado?',
        options: ['O ataque é cancelado', 'O ataque causa o dobro de dano', 'Nada muda'],
        correct: 0,
        explanation: 'A parte inicial da animação precisa terminar. Mover-se cedo demais desperdiça o ataque.',
      },
      {
        question: 'Qual é o melhor lugar para aprender um combo novo?',
        options: ['Em uma partida ranqueada', 'Na Ferramenta de Treino, com repetição', 'Durante uma luta em equipe'],
        correct: 1,
        explanation: 'Repetição sem pressão cria o automatismo. Na partida, a atenção precisa estar na decisão, não nos dedos.',
      },
    ],
  },
  {
    id: 'c-posicionamento-tf',
    title: 'Posicionamento em team fights',
    category: 'combate',
    level: 2,
    minutes: 9,
    skills: ['TEAMFIGHT'],
    objective: 'Saber onde ficar em uma luta em equipe de acordo com a função do seu campeão.',
    theory: [
      {
        title: 'Cada função tem um lugar',
        text: 'Uma luta em equipe tem linha de frente e linha de trás. Tanques e lutadores ficam à frente, absorvendo habilidades e criando espaço. Atiradores e magos ficam atrás, onde conseguem causar dano sem serem alcançados. Assassinos e alguns lutadores atacam pelos lados, buscando a linha de trás inimiga.',
      },
      {
        title: 'Para quem causa dano: sobreviver vem primeiro',
        text: 'Um carregador morto causa zero de dano. A posição certa é a maior distância da qual você ainda consegue atacar alguém. Antes de avançar, identifique as habilidades inimigas que podem alcançá-lo e espere que sejam usadas.',
      },
      {
        title: 'Para quem está na frente: o momento de entrar',
        text: 'Iniciar uma luta com o time longe é entregar uma eliminação. A linha de frente precisa entrar quando os aliados conseguem acompanhar e, de preferência, quando o adversário já gastou alguma ferramenta importante. Depois de iniciar, a tarefa muda: proteger os seus carregadores ou perseguir os deles.',
      },
    ],
    examples: [
      'O atirador fica atrás do tanque e ataca quem estiver mais perto. Só avança depois que o assassino inimigo usa o deslocamento em outro alvo.',
      'O tanque inicia sozinho enquanto dois aliados ainda estão limpando uma onda. A luta começa em três contra cinco.',
    ],
    mistakes: [
      'Carregador andando à frente do tanque "para causar mais dano".',
      'Todo o time agrupado em um ponto estreito, vulnerável a habilidades em área.',
      'Linha de frente perseguindo um alvo distante e deixando os carregadores desprotegidos.',
    ],
    apply: [
      'Antes da luta, identifique o maior perigo para você e mantenha distância dele.',
      'Como carregador, pergunte: "se eu der mais um passo, quem me alcança?".',
      'Como linha de frente, olhe o minimapa antes de iniciar: quantos aliados conseguem seguir?',
    ],
    exercise: {
      title: 'Revisão de três lutas',
      steps: [
        'Assista ao replay de três lutas em equipe de uma partida sua.',
        'Em cada uma, pause no início e anote onde você estava em relação ao seu time.',
        'Anote se morreu, quando e para qual habilidade.',
      ],
      success: 'Identificar, em cada luta, uma posição melhor do que a que você ocupou.',
    },
    quiz: [
      {
        question: 'Qual é a prioridade de um carregador em uma luta em equipe?',
        options: ['Eliminar o carregador inimigo a qualquer custo', 'Sobreviver causando dano de uma posição segura', 'Iniciar a luta'],
        correct: 1,
        explanation: 'O dano contínuo de quem permanece vivo decide a luta. Morrer cedo anula a sua contribuição.',
      },
      {
        question: 'Quando a linha de frente deve iniciar uma luta?',
        options: ['Assim que vir um inimigo', 'Quando o time consegue acompanhar', 'Somente quando estiver com a vida cheia'],
        correct: 1,
        explanation: 'Iniciar longe dos aliados cria uma desvantagem numérica imediata.',
      },
      {
        question: 'Por que agrupar todos em um ponto estreito é arriscado?',
        options: ['Porque reduz o ouro recebido', 'Porque habilidades em área atingem o time inteiro', 'Porque bloqueia as tropas'],
        correct: 1,
        explanation: 'Espalhar-se o suficiente evita que uma única habilidade decida a luta.',
      },
    ],
  },
  {
    id: 'c-foco-alvos',
    title: 'Foco de alvos: em quem bater',
    category: 'combate',
    level: 2,
    minutes: 8,
    skills: ['TEAMFIGHT'],
    objective: 'Escolher o alvo certo em cada momento da luta, considerando alcance e risco.',
    theory: [
      {
        title: 'O alvo ideal e o alvo possível',
        text: 'O alvo mais valioso costuma ser o carregador inimigo. Mas o alvo certo é o mais valioso que você consegue atingir com segurança. Para um atirador, quase sempre isso significa bater em quem está mais perto, mesmo que seja o tanque: atravessar a luta para alcançar a linha de trás costuma terminar em morte.',
      },
      {
        title: 'Quem pode alcançar a linha de trás',
        text: 'Assassinos e lutadores com mobilidade existem para chegar aos carregadores. Para eles, o alvo é quem causa mais dano e tem menos defesa. O momento importa tanto quanto o alvo: entrar depois que as habilidades de proteção foram usadas.',
      },
      {
        title: 'Concentrar dano',
        text: 'Cinco jogadores batendo em cinco alvos diferentes não eliminam ninguém. Dano concentrado em um alvo o remove da luta e transforma o combate em cinco contra quatro. Um alvo sob controle de grupo é o melhor candidato: ele não consegue reagir.',
      },
    ],
    examples: [
      'O tanque inimigo mergulha no seu time. O atirador bate nele, que é o único alvo no alcance, enquanto o suporte o controla. Com o tanque eliminado, o resto da luta fica fácil.',
      'O assassino aliado espera o mago inimigo usar a habilidade de fuga e só então entra na linha de trás.',
    ],
    mistakes: [
      'Atirador atravessando a luta para alcançar o carregador inimigo.',
      'Gastar todas as habilidades em um tanque cheio de vida quando havia um alvo frágil ao alcance.',
      'Trocar de alvo a todo momento e não eliminar ninguém.',
    ],
    apply: [
      'Como carregador de longo alcance: alvo mais próximo e seguro.',
      'Como assassino: espere a ferramenta de proteção ser usada antes de entrar.',
      'Quando um inimigo for controlado, concentre o dano nele.',
    ],
    exercise: {
      title: 'Quem eu ataquei?',
      steps: [
        'No replay de uma partida, escolha duas lutas em equipe.',
        'Anote em qual alvo você bateu primeiro e por quanto tempo.',
        'Pergunte: havia um alvo melhor e seguro no meu alcance?',
      ],
      success: 'Conseguir justificar a escolha de alvo em cada luta revisada.',
    },
    quiz: [
      {
        question: 'Para um atirador, qual costuma ser o alvo correto?',
        options: ['Sempre o carregador inimigo', 'O alvo mais próximo que pode ser atingido com segurança', 'O inimigo com mais vida'],
        correct: 1,
        explanation: 'Buscar a linha de trás expõe o atirador. Dano constante no alvo ao alcance é a contribuição mais segura.',
      },
      {
        question: 'Por que concentrar dano em um alvo é mais eficiente?',
        options: ['Porque elimina um inimigo e cria vantagem numérica', 'Porque aumenta o dano total do time', 'Porque reduz as recargas'],
        correct: 0,
        explanation: 'Dano espalhado não remove ninguém da luta. Um inimigo eliminado deixa de causar dano.',
      },
      {
        question: 'Quando um assassino deve entrar na linha de trás?',
        options: ['No primeiro segundo da luta', 'Depois que as ferramentas de proteção e fuga foram usadas', 'Somente quando a luta já estiver perdida'],
        correct: 1,
        explanation: 'Entrar contra habilidades disponíveis costuma resultar em controle de grupo e morte sem eliminação.',
      },
    ],
  },
  {
    id: 'c-controle-habilidades',
    title: 'Controle de habilidades e trocas eficientes',
    category: 'combate',
    level: 3,
    minutes: 9,
    skills: ['TEAMFIGHT', 'LANE'],
    objective: 'Acompanhar as recargas importantes dos dois lados e guardar as suas ferramentas-chave para o momento certo.',
    theory: [
      {
        title: 'Toda luta gira em torno de poucas habilidades',
        text: 'Em quase todo confronto existem duas ou três habilidades que decidem o resultado: um controle de grupo, uma ferramenta de fuga, uma habilidade suprema. Identificá-las antes da luta e saber se estão disponíveis vale mais do que qualquer outro dado.',
      },
      {
        title: 'A janela de recarga',
        text: 'Quando o adversário usa a ferramenta principal, abre-se uma janela de alguns segundos em que ele está mais fraco. É o momento de avançar. O mesmo vale para os feitiços: o Flash tem recarga longa, de cerca de cinco minutos, e um alvo sem Flash é prioridade para o time inteiro.',
      },
      {
        title: 'Guardar a resposta',
        text: 'Se o seu campeão tem a ferramenta que anula a principal ameaça inimiga — um escudo, um controle, um deslocamento — ela não deve ser usada para causar dano ou farmar. Usar a resposta antes da pergunta deixa você sem defesa quando a ameaça aparecer.',
      },
    ],
    examples: [
      'O oponente de rota erra a habilidade de controle. Você sabe que tem alguns segundos e avança para uma troca que, com a habilidade disponível, perderia.',
      'O suporte guarda a habilidade de proteção até o assassino inimigo entrar, em vez de usá-la no início da luta.',
    ],
    mistakes: [
      'Usar todas as habilidades assim que a luta começa, sem alvo definido.',
      'Avançar contra um adversário com a suprema disponível como se ela não existisse.',
      'Usar o deslocamento para se aproximar e ficar sem saída.',
    ],
    apply: [
      'No início da partida, escolha a habilidade inimiga que mais ameaça você e acompanhe o uso dela.',
      'Avise o time quando um inimigo importante gastar o Flash.',
      'Antes de usar a sua ferramenta defensiva, pergunte: a ameaça principal já foi usada?',
    ],
    exercise: {
      title: 'Rastrear uma habilidade',
      steps: [
        'Escolha uma única habilidade do oponente de rota para acompanhar durante toda a fase de rotas.',
        'Toda vez que ela for usada, tente avançar ou trocar nos segundos seguintes.',
        'Conte quantas janelas você aproveitou e quantas deixou passar.',
      ],
      success: 'Aproveitar mais da metade das janelas em que a habilidade estava em recarga.',
    },
    quiz: [
      {
        question: 'O que é uma "janela de recarga"?',
        options: ['O tempo em que a sua habilidade está indisponível', 'O período em que o adversário está sem a ferramenta principal', 'O intervalo entre duas ondas'],
        correct: 1,
        explanation: 'Sem a ferramenta principal ele fica mais fraco por alguns segundos: é a hora de pressionar.',
      },
      {
        question: 'Por que um inimigo sem Flash é um alvo prioritário?',
        options: ['Porque ele causa menos dano', 'Porque fica por minutos sem a principal ferramenta de fuga', 'Porque dá mais ouro'],
        correct: 1,
        explanation: 'A recarga longa do Flash cria uma oportunidade que dura vários minutos para ganks e iniciações.',
      },
      {
        question: 'Seu campeão tem a habilidade que anula a principal ameaça inimiga. O correto é:',
        options: ['Usá-la assim que possível para causar dano', 'Guardá-la para quando a ameaça aparecer', 'Não subir o nível dela'],
        correct: 1,
        explanation: 'Gastar a resposta antes da ameaça deixa você vulnerável justamente no momento decisivo.',
      },
    ],
  },
];
