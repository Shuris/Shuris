import type { Challenge } from './types';

/**
 * Banco de desafios do LOL Challenge. Situações genéricas, válidas em qualquer
 * patch: nenhum número de dano, tempo de recarga ou item específico de patch.
 */
const RAW: Challenge[] = [
  // ---- Lane Management -------------------------------------------------------------
  {
    id: 'lane-freeze-lead', category: 'lane', difficulty: 'facil', title: 'Vantagem na rota',
    context: 'Você está com 2 abates de vantagem no topo. A onda está chegando perto da sua torre e o caçador inimigo foi visto do outro lado do mapa.',
    question: 'Qual é a melhor forma de manter a vantagem?',
    options: ['Empurrar a onda com tudo até a torre inimiga', 'Congelar a onda perto da sua torre, abatendo só o último golpe', 'Voltar para a base imediatamente', 'Ir para a selva inimiga roubar campos'],
    answer: 1,
    explanation: 'Congelar perto da sua torre obriga o oponente, já atrás, a se expor para farmar. Você ganha ouro e experiência com segurança e nega recursos a ele.',
    lessonId: 'f-estados-da-wave',
  },
  {
    id: 'lane-recall-timing', category: 'lane', difficulty: 'facil', title: 'Hora de voltar',
    context: 'Você tem ouro para o seu primeiro item completo, está com meia vida e a onda inimiga está grande vindo na sua direção.',
    question: 'Quando é o melhor momento para voltar à base?',
    options: ['Agora, deixando a onda grande bater na torre', 'Depois de empurrar a onda até a torre inimiga', 'Só quando estiver com pouca vida', 'Esperar o oponente voltar primeiro, mesmo sem saber quando'],
    answer: 1,
    explanation: 'Voltar com a onda empurrada faz as tropas baterem na torre inimiga enquanto você compra. Voltar com uma onda grande vindo para você faz você perder tropas embaixo da torre.',
    lessonId: 'f-recursos',
  },
  {
    id: 'lane-slow-push', category: 'lane', difficulty: 'medio', title: 'Preparar o mergulho',
    context: 'O seu caçador vai chegar ao meio em cerca de 40 segundos para tentar um abate embaixo da torre inimiga.',
    question: 'O que fazer com a onda até ele chegar?',
    options: ['Empurrar rápido agora para limpar a onda', 'Fazer uma onda lenta (slow push) para chegar com muitas tropas na torre junto com ele', 'Congelar a onda do seu lado', 'Deixar a onda e ajudar no dragão'],
    answer: 1,
    explanation: 'Uma onda lenta acumula tropas. Quando o caçador chega, as suas tropas absorvem os tiros da torre e o mergulho fica muito mais seguro.',
    lessonId: 'r-manipular-wave',
  },
  {
    id: 'lane-trade-cooldown', category: 'lane', difficulty: 'medio', title: 'Janela de troca',
    context: 'O seu oponente de rota acabou de usar a habilidade principal de dano para abater uma tropa. Ela fica vários segundos em recarga.',
    question: 'Qual é a melhor reação?',
    options: ['Recuar para a torre', 'Trocar dano agora, enquanto ele está sem a habilidade', 'Esperar ele recuperar a habilidade para lutar em igualdade', 'Ignorar e continuar só farmando'],
    answer: 1,
    explanation: 'A janela em que a habilidade principal do oponente está em recarga é o melhor momento para trocar: você causa dano e ele não consegue responder com força total.',
    lessonId: 'r-quando-trocar',
  },
  {
    id: 'lane-cannon', category: 'lane', difficulty: 'dificil', title: 'Tropa de cerco em risco',
    context: 'Você está atrás no farm e embaixo da sua torre. A onda tem uma tropa de cerco (canhão) e o oponente está pressionando muito.',
    question: 'Qual tropa é a prioridade para garantir o último golpe?',
    options: ['As tropas corpo a corpo, porque morrem primeiro', 'A tropa de cerco, porque vale bem mais ouro', 'As tropas à distância, porque são mais fáceis', 'Nenhuma: deixar a torre farmar sozinha'],
    answer: 1,
    explanation: 'A tropa de cerco vale bem mais ouro que as demais. Quando estiver atrás, priorize garanti-la mesmo que perca uma tropa comum.',
    lessonId: 'f-last-hit',
  },

  // ---- Map Awareness ---------------------------------------------------------------
  {
    id: 'map-missing', category: 'map', difficulty: 'facil', title: 'Oponente sumiu',
    context: 'O seu oponente do meio sumiu do mapa há alguns segundos. Você está no meio com a onda empurrada.',
    question: 'Qual é a primeira atitude?',
    options: ['Continuar empurrando até a torre', 'Avisar a equipe (sinal de "sumiu") e recuar para uma posição segura', 'Ir para a selva inimiga', 'Ficar parado esperando ele voltar'],
    answer: 1,
    explanation: 'Um oponente fora do mapa pode estar indo a outra rota ou esperando você. Avisar a equipe e recuar reduz o risco de um abate fácil para ele.',
    lessonId: 'f-visao',
  },
  {
    id: 'map-ward-river', category: 'map', difficulty: 'facil', title: 'Sentinela no rio',
    context: 'Você joga na rota inferior e o caçador inimigo começou a partida do lado do topo.',
    question: 'Onde uma sentinela protege melhor a rota inferior por volta dos 3 minutos?',
    options: ['Na base inimiga', 'No rio, na entrada que leva à rota inferior', 'Na rota do topo', 'Embaixo da sua própria torre'],
    answer: 1,
    explanation: 'Depois de limpar o primeiro lado, o caçador costuma passar pelo rio. Uma sentinela na entrada do rio mostra a chegada dele a tempo de recuar.',
    lessonId: 'r-evitar-ganks',
  },
  {
    id: 'map-dragon-vision', category: 'map', difficulty: 'medio', title: 'Antes do dragão',
    context: 'O dragão nasce em 1 minuto. A sua equipe quer disputá-lo.',
    question: 'O que deve ser feito primeiro?',
    options: ['Ir direto ao dragão quando ele nascer', 'Empurrar as rotas próximas e colocar visão em volta do dragão antes de ele nascer', 'Esperar a equipe inimiga começar', 'Comprar itens e voltar só depois'],
    answer: 1,
    explanation: 'Quem prepara o terreno com visão e rotas empurradas chega primeiro e luta com vantagem de informação. Ir no último segundo deixa a iniciativa para o inimigo.',
    lessonId: 'm-dragoes',
  },
  {
    id: 'map-deep-ward', category: 'map', difficulty: 'medio', title: 'Vantagem para a sua equipe',
    context: 'A sua equipe está com 5 mil de ouro de vantagem e controla o lado do mapa perto do Barão.',
    question: 'Onde colocar as sentinelas agora?',
    options: ['Só na sua selva', 'Mais fundo, na selva inimiga, para ver a movimentação deles', 'Na sua base', 'Não precisa de visão com vantagem'],
    answer: 1,
    explanation: 'Com vantagem, a visão avança: sentinelas na selva inimiga mostram por onde eles vêm e deixam a sua equipe escolher as lutas.',
    lessonId: 'f-visao',
  },
  {
    id: 'map-five-missing', category: 'map', difficulty: 'dificil', title: 'Cinco sumidos',
    context: 'Aos 25 minutos você está empurrando a rota lateral. Os cinco inimigos sumiram do mapa ao mesmo tempo e a sua equipe está no meio.',
    question: 'O que é mais provável e qual a reação certa?',
    options: ['Estão todos na base; continue empurrando', 'Podem estar vindo pegar você ou a sua equipe: recue para perto dos aliados e avise', 'Estão fazendo o Arauto; vá contestar sozinho', 'Ignore e foque no farm'],
    answer: 1,
    explanation: 'Cinco inimigos sumidos significa um movimento em grupo: uma emboscada, um objetivo ou um ataque. Recuar e reagrupar evita perder alguém em desvantagem.',
    lessonId: 'f-macro-nocoes',
  },

  // ---- Macro Game ------------------------------------------------------------------
  {
    id: 'macro-after-kill', category: 'macro', difficulty: 'facil', title: 'Depois do abate',
    context: 'Você abateu o seu oponente do meio aos 9 minutos e está com metade da vida.',
    question: 'Qual é o melhor uso dessa vantagem?',
    options: ['Voltar imediatamente para a base', 'Empurrar a onda e dar dano na torre ou ajudar no dragão antes de voltar', 'Ficar parado na rota', 'Ir para a rota do topo'],
    answer: 1,
    explanation: 'Um abate abre uma janela em que o oponente não está no mapa. Converter em torre, placas ou dragão rende mais que só voltar.',
    lessonId: 'f-macro-nocoes',
  },
  {
    id: 'macro-herald', category: 'macro', difficulty: 'medio', title: 'Uso do Arauto',
    context: 'A sua equipe acabou de pegar o Arauto do Vale. A torre do topo inimiga está com vida cheia e o oponente do topo voltou para a base.',
    question: 'Onde o Arauto rende mais?',
    options: ['Guardar para o fim da partida', 'Usar no topo agora, enquanto o oponente está fora da rota', 'Usar na rota com mais inimigos', 'Não usar'],
    answer: 1,
    explanation: 'O Arauto derruba torres e placas. Usá-lo onde o defensor está ausente garante o máximo de ouro sem disputa.',
    lessonId: 'm-arauto-barao',
  },
  {
    id: 'macro-baron-power', category: 'macro', difficulty: 'medio', title: 'Barão garantido',
    context: 'A sua equipe pegou o Barão e está com o bônus ativo. Os inimigos estão vivos e defendendo a base.',
    question: 'Como usar melhor o bônus do Barão?',
    options: ['Lutar no meio da selva', 'Agrupar e pressionar rotas com tropas fortalecidas, derrubando torres e inibidores', 'Voltar para farmar a selva', 'Dividir a equipe nas três rotas sem objetivo'],
    answer: 1,
    explanation: 'O bônus do Barão fortalece as tropas. A melhor conversão é derrubar estruturas, que são permanentes, não perseguir abates.',
    lessonId: 'm-arauto-barao',
  },
  {
    id: 'macro-cross-map', category: 'macro', difficulty: 'dificil', title: 'Troca pelo mapa',
    context: 'O inimigo começou o dragão do outro lado. A sua equipe está longe e não chega a tempo de contestar.',
    question: 'Qual é a decisão mais lucrativa?',
    options: ['Correr para o dragão mesmo assim', 'Trocar: pegar o Arauto ou derrubar uma torre do lado oposto', 'Voltar para a base', 'Ficar esperando na rota'],
    answer: 1,
    explanation: 'Quando não dá para contestar, troque objetivo por objetivo. Correr de longe só entrega o dragão e ainda arrisca abates.',
    lessonId: 'm-rotacoes',
  },
  {
    id: 'macro-split', category: 'macro', difficulty: 'dificil', title: 'Pressão dividida',
    context: 'Você joga com um lutador forte em duelos. A sua equipe tem um bom controle de grupo para se defender, e o Barão nasce em 2 minutos.',
    question: 'Qual estratégia aproveita o seu campeão?',
    options: ['Agrupar com a equipe o tempo todo', 'Pressionar a rota lateral oposta ao Barão para puxar inimigos, voltando ao grupo quando o objetivo for disputado', 'Ir sozinho fazer o Barão', 'Ficar na base'],
    answer: 1,
    explanation: 'A pressão dividida força o inimigo a mandar alguém responder. Com isso a sua equipe luta em vantagem numérica perto do objetivo.',
    lessonId: 'm-divisao-pressao',
  },

  // ---- Team Fight ------------------------------------------------------------------
  {
    id: 'tf-carry-position', category: 'teamfight', difficulty: 'facil', title: 'Atirador na luta',
    context: 'Você é o atirador da equipe. A luta vai começar em frente ao dragão.',
    question: 'Qual é a sua posição ideal?',
    options: ['Na frente, iniciando a luta', 'Atrás da sua linha de frente, atacando o alvo mais próximo e seguro', 'Sozinho no flanco', 'Longe da luta, esperando acabar'],
    answer: 1,
    explanation: 'O atirador causa dano contínuo. Ficar atrás da linha de frente mantém você vivo e atacando durante toda a luta.',
    lessonId: 'c-posicionamento-tf',
  },
  {
    id: 'tf-target', category: 'teamfight', difficulty: 'medio', title: 'Escolha de alvo',
    context: 'Na luta, o tanque inimigo está na sua frente com vida cheia. O atirador inimigo está um pouco atrás, ao alcance das suas habilidades.',
    question: 'Em quem concentrar o dano?',
    options: ['No tanque, porque está mais perto', 'No atirador, se você consegue alcançá-lo com segurança', 'Em quem estiver com mais vida', 'Distribuir o dano entre todos'],
    answer: 1,
    explanation: 'Derrubar quem causa mais dano decide a luta. Bater no tanque com vida cheia gasta tempo, desde que você alcance o alvo prioritário sem se expor demais.',
    lessonId: 'c-foco-alvos',
  },
  {
    id: 'tf-engage-numbers', category: 'teamfight', difficulty: 'medio', title: 'Iniciar ou não',
    context: 'Você joga de tanque com uma boa habilidade de iniciar lutas. Dois aliados ainda estão a caminho e os cinco inimigos estão agrupados.',
    question: 'Qual é a melhor decisão?',
    options: ['Iniciar agora', 'Esperar os aliados chegarem para lutar com cinco', 'Iniciar no atirador inimigo sozinho', 'Ir para outra rota'],
    answer: 1,
    explanation: 'Iniciar 3 contra 5 quase sempre perde a luta. A força de uma boa iniciação depende de ter a equipe pronta para seguir.',
    lessonId: 'c-posicionamento-tf',
  },
  {
    id: 'tf-key-spell', category: 'teamfight', difficulty: 'dificil', title: 'Habilidade decisiva',
    context: 'O suporte inimigo tem uma habilidade de controle em área que decide lutas. Ele acabou de usá-la errando todos os alvos.',
    question: 'Qual é a melhor reação da sua equipe?',
    options: ['Recuar e esperar', 'Lutar agora, enquanto a habilidade decisiva dele está em recarga', 'Separar a equipe', 'Focar no tanque inimigo'],
    answer: 1,
    explanation: 'Lutas giram em torno de poucas habilidades. Quando a habilidade decisiva do inimigo é gasta sem efeito, a sua equipe ganha uma janela para lutar.',
    lessonId: 'c-controle-habilidades',
  },
  {
    id: 'tf-peel', category: 'teamfight', difficulty: 'dificil', title: 'Proteger ou mergulhar',
    context: 'Você joga de suporte encantador. Um assassino inimigo pulou sobre o seu atirador, que está causando muito dano.',
    question: 'O que fazer?',
    options: ['Correr atrás do atirador inimigo', 'Usar as suas habilidades para proteger o seu atirador do assassino', 'Recuar para se salvar', 'Iniciar no tanque inimigo'],
    answer: 1,
    explanation: 'Proteger (peel) o seu principal causador de dano costuma valer mais do que tentar um abate do outro lado. Ele vivo continua decidindo a luta.',
    lessonId: 'c-posicionamento-tf',
  },

  // ---- Matchups --------------------------------------------------------------------
  {
    id: 'mu-ranged-vs-melee', category: 'matchups', difficulty: 'facil', title: 'Alcance a seu favor',
    context: 'Você joga com um campeão de ataque à distância contra um corpo a corpo na rota.',
    question: 'Qual é a forma mais comum de ganhar a rota?',
    options: ['Ficar longe e só farmar', 'Usar o alcance para acertar ataques quando ele chega perto das tropas', 'Lutar corpo a corpo', 'Trocar de rota'],
    answer: 1,
    explanation: 'Com mais alcance, você pode punir o oponente sempre que ele se aproxima para abater tropas, sem receber dano de volta.',
    lessonId: 'r-quando-trocar',
  },
  {
    id: 'mu-early-scaling', category: 'matchups', difficulty: 'medio', title: 'Forte cedo × forte tarde',
    context: 'O seu campeão fica forte no fim da partida. O oponente é muito forte nos primeiros níveis.',
    question: 'Qual é o plano para a fase de rotas?',
    options: ['Lutar desde o nível 1', 'Jogar seguro, farmar perto da sua torre e evitar trocas até o seu pico de força', 'Ir para a selva', 'Ignorar o farm'],
    answer: 1,
    explanation: 'Contra quem é forte cedo, o objetivo é sobreviver sem perder muito. O tempo joga a seu favor: cada minuto aproxima o seu pico de força.',
    lessonId: 'r-jogar-atras',
  },
  {
    id: 'mu-level-spike', category: 'matchups', difficulty: 'medio', title: 'Nível 6',
    context: 'Você vai chegar ao nível 6 antes do oponente porque abateu mais tropas. Os dois têm habilidades finais fortes para trocas.',
    question: 'O que fazer ao chegar ao nível 6?',
    options: ['Esperar ele também chegar ao 6', 'Aproveitar a vantagem momentânea para trocar ou tentar o abate', 'Voltar para a base', 'Ir para a selva'],
    answer: 1,
    explanation: 'Alguns segundos com a habilidade final contra um oponente que ainda não a tem são uma janela forte para trocar ou abater.',
    lessonId: 'r-aproveitar-vantagem',
  },
  {
    id: 'mu-ganked-lane', category: 'matchups', difficulty: 'dificil', title: 'Rota sem fuga',
    context: 'O seu campeão não tem habilidade de fuga e o caçador inimigo é forte em emboscadas.',
    question: 'Qual estado de onda é mais seguro?',
    options: ['Onda sempre empurrada para o lado inimigo', 'Onda mais perto da sua torre, mantendo distância segura do rio', 'Não importa', 'Ficar na selva'],
    answer: 1,
    explanation: 'Sem fuga, o perigo é estar longe da sua torre. Manter a onda do seu lado reduz a distância de escape quando o caçador aparecer.',
    lessonId: 'r-evitar-ganks',
  },
  {
    id: 'mu-poke-vs-sustain', category: 'matchups', difficulty: 'dificil', title: 'Dano à distância × cura',
    context: 'Você causa dano à distância aos poucos (poke). O oponente tem muita recuperação de vida.',
    question: 'Como transformar o poke em vantagem?',
    options: ['Dar poke de vez em quando, sem pressa', 'Pokar com frequência e aproveitar as janelas em que ele está mais baixo para uma pressão maior ou para o caçador agir', 'Desistir do poke', 'Lutar corpo a corpo'],
    answer: 1,
    explanation: 'Contra recuperação, dano esporádico some. O poke precisa ser constante e convertido em algo: um abate, uma janela para o caçador ou forçá-lo a voltar.',
    lessonId: 'r-quando-trocar',
  },

  // ---- Mechanics -------------------------------------------------------------------
  {
    id: 'mech-orbwalk', category: 'mechanics', difficulty: 'facil', title: 'Atacar e se mover',
    context: 'Você está com um atirador em luta contra um corpo a corpo que tenta se aproximar.',
    question: 'Qual técnica mantém o dano e a distância?',
    options: ['Ficar parado atacando', 'Intercalar ataques com passos (kiting): atacar, mover, atacar', 'Só correr', 'Usar todas as habilidades de uma vez e parar'],
    answer: 1,
    explanation: 'Mover-se entre os ataques mantém a distância sem perder dano. É a base de quase todo campeão de ataque à distância.',
    lessonId: 'c-mecanicas',
  },
  {
    id: 'mech-flash-defensive', category: 'mechanics', difficulty: 'facil', title: 'Flash defensivo',
    context: 'Você está com pouca vida, o inimigo usou um controle que vai atingir você em seguida e a torre está perto.',
    question: 'Quando o Flash defensivo funciona melhor?',
    options: ['Depois de ser controlado', 'Antes de a habilidade atingir, para escapar do controle', 'Nunca usar o Flash defensivamente', 'Guardar para a próxima luta'],
    answer: 1,
    explanation: 'Depois de controlado, você não consegue usar o Flash. Ele salva quando é usado no momento certo, antes da habilidade decisiva acertar.',
    lessonId: 'c-mecanicas',
  },
  {
    id: 'mech-skillshot-dodge', category: 'mechanics', difficulty: 'medio', title: 'Desviar de habilidades',
    context: 'O oponente tem uma habilidade de linha reta lenta e previsível.',
    question: 'Qual movimento ajuda mais a desviar?',
    options: ['Andar sempre em linha reta', 'Mover-se lateralmente em relação a ele, mudando de direção', 'Ficar parado', 'Andar em direção a ele'],
    answer: 1,
    explanation: 'Mudanças laterais de direção dificultam a mira. Andar em linha reta, para trás ou para frente, deixa você fácil de acertar.',
    lessonId: 'c-mecanicas',
  },
  {
    id: 'mech-animation-cancel', category: 'mechanics', difficulty: 'dificil', title: 'Ordem do combo',
    context: 'O seu combo tem um controle seguido de dano em área. O alvo está no limite do alcance.',
    question: 'Qual ordem rende mais?',
    options: ['Dano em área primeiro, controle depois', 'Controle primeiro, para garantir que o dano em área acerte', 'Tanto faz', 'Só ataques básicos'],
    answer: 1,
    explanation: 'Imobilizar o alvo antes garante que o dano acerte. Usar o dano antes dá ao alvo a chance de se mover para fora da área.',
    lessonId: 'c-controle-habilidades',
  },
  {
    id: 'mech-last-hit-tower', category: 'mechanics', difficulty: 'dificil', title: 'Farm embaixo da torre',
    context: 'Uma onda grande chegou embaixo da sua torre. Você joga com um campeão de ataque à distância.',
    question: 'Como garantir o último golpe nas tropas à distância?',
    options: ['Esperar a torre bater uma vez e depois dar o último golpe', 'Dar um ataque antes da torre, para que o tiro dela deixe a tropa no ponto de um último golpe seu', 'Deixar a torre farmar sozinha', 'Usar habilidades em todas as tropas'],
    answer: 1,
    explanation: 'Um tiro da torre não basta para garantir o último golpe em uma tropa à distância. Um ataque seu antes do tiro deixa a vida dela no ponto certo para você finalizar.',
    lessonId: 'f-last-hit',
  },
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Embaralha as alternativas de forma determinística (mesma ordem no app e no servidor). */
function shuffled(c: Challenge): Challenge {
  let seed = hash(c.id);
  const idx = c.options.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    const j = seed % (i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return { ...c, options: idx.map((i) => c.options[i]), answer: idx.indexOf(c.answer) };
}

export const CHALLENGES: Challenge[] = RAW.map(shuffled);

const BY_ID = new Map(CHALLENGES.map((c) => [c.id, c]));
export const challengeById = (id: string) => BY_ID.get(id);
