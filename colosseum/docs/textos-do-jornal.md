# Cápua Times — todos os textos do jornal

Este arquivo lista **literalmente todos** os textos que o jornal pode mostrar, em português e em inglês, gerados direto dos dicionários do jogo (`src/renderer/i18n/pt.ts` e `en.ts`).

Para mudar: reescreva, apague ou acrescente à vontade e me mande de volta. Dicas:

- **Variáveis** entre chaves são trocadas pelo jogo:
  - `{name}` — nome do gladiador;
  - `{city}` — a cidade (Cápua / Capua);
  - `{origin}` — origem do gladiador em minúsculas (gaulês, trácio, ex-legionário, grego);
  - `{rival}` — o próximo adversário ainda não derrotado;
  - `{opp}` — o adversário da luta noticiada;
  - `{arena}` — o anfiteatro (ex.: “Arena de Cápua”, “Anfiteatro de Pompeia”).
- Cada grupo pode ter **quantas variantes você quiser**; o jogo sorteia uma.
- Se escrever só em português, eu traduzo para o inglês.
- Use `{arena}` sem artigo antes (“em {arena}”), porque os nomes têm gêneros diferentes.

## Como uma edição é montada

- Sai toda manhã, ao acordar, com até 5 notícias sobre o gladiador e sempre 1 nota da cidade.
- A primeira notícia vira a manchete principal (letra grande); as outras vão para as duas colunas, junto com um anúncio.
- **Ilustrações em preto e branco:** a manchete principal ganha ilustração em 70% das edições; quando não ganha, a última notícia tem 40% de chance.
- Notícias de sequência e de derrota não se repetem na mesma edição: só a mais recente sai.
- **Uma notícia por adversário:** se duas notícias citarem o mesmo adversário (por exemplo "Brutus vence" e "Brutus provoca"), só a mais importante sai. E só um resultado de luta do gladiador aparece por edição (o mais importante: título, vitória, sequência... antes de derrotas).

## Cabeçalho e partes fixas

| Onde | Português | Inglês |
| --- | --- | --- |
| Título | Cápua Times | Capua Times |
| Canto esquerdo (antes "Um asse") | Fórum | Forum |
| Número da edição ({n} = dia) | Edição nº {n} | Issue no. {n} |
| Ano ({y} = ano romano, DCCCXXX) | Ano {y} da fundação de Roma | Year {y} since the founding of Rome |
| Lema (canto direito) | Tudo o que acontece na areia e na cidade | All the news from the sand and the city |
| Título do anúncio | Anúncio | Advertisement |
| Nome do local onde se leem as edições | Fórum | Forum |
| Dica do Fórum | O jornal sai toda manhã. Fique famoso para ser notícia! | The paper comes out every morning. Become famous to make the news! |
| Fórum sem edições | Nenhuma edição ainda. | No editions yet. |
| Etiqueta de edição não lida | nova | new |
| Botão no status | Jornal novo! | New paper! |

Linha de data: `dia da semana, Dia N` (ex.: “Quinta, Dia 4” / “Thursday, Day 4”).

## Estreia do gladiador (`debut`)

**Quando sai:** Primeira edição do jogo (dia 1), sempre como manchete principal e sempre com a ilustração “newcomer”.

**Ilustração possível:** newcomer

1. **Manchete:** Novo gladiador chega a {city}  
   **Texto:** Um {origin} chamado {name} foi comprado pelo ludus. Será que aguenta a areia da arena?  
   *EN:* New gladiator arrives in {city} — A {origin} named {name} was bought by the ludus. Can the newcomer handle the sand of the arena?

2. **Manchete:** {name}, o novato do ludus  
   **Texto:** O lanista apostou algumas moedas em {name}, um {origin} desconhecido. Os veteranos já riem do recém-chegado.  
   *EN:* {name}, the new kid at the ludus — The lanista bet a few coins on {name}, an unknown {origin}. The veterans are already laughing at the newcomer.

## Fama (`fame`)

**Quando sai:** Quando a fama passa de 10, 25, 50, 80, 120, 180, 250, 350, 450 e 600 (uma vez para cada marco).

**Ilustração possível:** crowd, statue

1. **Manchete:** O recém-chegado {name} ganha força em {city}  
   **Texto:** O público já grita o nome do gladiador nas arquibancadas. É melhor {rival} tomar cuidado!  
   *EN:* Newcomer {name} gains strength in {city} — The crowd already chants the gladiator’s name in the stands. {rival} had better watch out!

2. **Manchete:** Quem é {name}?  
   **Texto:** As tavernas só falam do {origin} que vem derrubando adversários. {rival} diz não estar preocupado.  
   *EN:* Who is {name}? — The taverns talk of nothing but the {origin} who keeps knocking rivals down. {rival} says there is nothing to worry about.

3. **Manchete:** {name}, a nova paixão da plebe  
   **Texto:** Vendedores já oferecem estatuetas de barro do gladiador. {rival} seria a próxima vítima?  
   *EN:* {name}, the new darling of the plebs — Vendors are already selling clay figurines of the gladiator. Will {rival} be the next victim?

4. **Manchete:** A fama de {name} chega aos senadores  
   **Texto:** Até no Senado se comenta o estilo do gladiador. {rival} treina dobrado, dizem.  
   *EN:* The fame of {name} reaches the senators — Even the Senate talks about the gladiator’s style. {rival} is training twice as hard, they say.

5. **Manchete:** Multidões seguem {name} pelas ruas  
   **Texto:** Crianças imitam seus golpes com espadas de madeira. {rival} que se cuide!  
   *EN:* Crowds follow {name} through the streets — Children copy the gladiator’s moves with wooden swords. {rival} had better be careful!

## Provocação do rival (`rival`)

**Quando sai:** Junto com uma notícia de fama, com 50% de chance.

**Ilustração possível:** rival

1. **Manchete:** {rival} provoca {name}  
   **Texto:** "Esse {origin} não dura um minuto comigo!", disse {rival} numa taverna perto do fórum.  
   *EN:* {rival} taunts {name} — "That {origin} won’t last a minute with me!", said {rival} at a tavern near the forum.

2. **Manchete:** {rival} aceita o desafio  
   **Texto:** "Que venha! A areia de {arena} vai decidir", declarou {rival}.  
   *EN:* {rival} accepts the challenge — "Bring it on! The sand of the {arena} will decide", declared {rival}.

3. **Manchete:** {rival} treina em segredo  
   **Texto:** Dizem que {rival} só treina à noite, longe dos curiosos, pensando em {name}.  
   *EN:* {rival} trains in secret — They say {rival} only trains at night, far from curious eyes, thinking about {name}.

## Vitória (`victory`)

**Quando sai:** Primeira vitória contra cada adversário (exceto Flamma).

**Ilustração possível:** victory

1. **Manchete:** {name} derrota {opp} em {arena}!  
   **Texto:** A multidão aplaudiu de pé. Agora {rival} aguarda o desafiante.  
   *EN:* {name} defeats {opp} at the {arena}! — The crowd gave a standing ovation. Now {rival} awaits the challenger.

2. **Manchete:** Vitória de {name} sobre {opp}  
   **Texto:** Em {arena}, o gladiador mostrou garra. Os apostadores já olham para o duelo contra {rival}.  
   *EN:* Victory for {name} over {opp} — At the {arena}, the gladiator showed real grit. Gamblers are already eyeing the bout against {rival}.

3. **Manchete:** {opp} cai diante de {name}  
   **Texto:** Poucos acreditavam no {origin}. Hoje, até {rival} assistiu à luta em silêncio.  
   *EN:* {opp} falls before {name} — Few believed in the {origin}. Today, even {rival} watched the fight in silence.

## Mudança de arena (`arena`)

**Quando sai:** Junto com a vitória, quando o próximo rival luta em outro anfiteatro.

**Ilustração possível:** colosseum

1. **Manchete:** {name} é chamado para lutar em {arena}  
   **Texto:** Os organizadores dos jogos querem o gladiador em palcos maiores.  
   *EN:* {name} is called to fight at the {arena} — The organizers of the games want the gladiator on bigger stages.

## Campeão (`champion`)

**Quando sai:** Primeira vitória contra Flamma, o campeão.

**Ilustração possível:** colosseum

1. **Manchete:** NOVO CAMPEÃO DE ROMA!  
   **Texto:** {name} derrotou Flamma no Coliseu. O imperador em pessoa ergueu o polegar diante de 50 mil pessoas.  
   *EN:* NEW CHAMPION OF ROME! — {name} defeated Flamma at the Colosseum. The emperor himself gave a thumbs up before 50,000 people.

## Sequência de 3 vitórias (`streak3`)

**Quando sai:** Ao completar 3 vitórias seguidas (só a sequência mais recente sai na edição).

**Ilustração possível:** crowd

1. **Manchete:** Três vitórias seguidas para {name}  
   **Texto:** O público já decorou o nome do gladiador. Os apostadores estão de olho.  
   *EN:* Three wins in a row for {name} — The crowd knows the gladiator’s name by heart. The gamblers are paying attention.

## Sequência de 5 vitórias (`streak5`)

**Quando sai:** Ao completar 5 vitórias seguidas.

**Ilustração possível:** victory

1. **Manchete:** {name} vence pela quinta vez seguida  
   **Texto:** Cinco lutas, cinco vitórias. {rival} começa a ficar preocupado.  
   *EN:* {name} wins for the fifth straight time — Five fights, five wins. {rival} is starting to worry.

## Sequência de 10 vitórias (`streak10`)

**Quando sai:** Ao completar 10 vitórias seguidas.

**Ilustração possível:** statue

1. **Manchete:** Dez vitórias seguidas!  
   **Texto:** Ninguém derrota {name} há dez lutas. Já falam em levar o gladiador a Roma.  
   *EN:* Ten wins in a row! — No one has beaten {name} in ten fights. There is talk of taking the gladiator to Rome.

## Volta por cima (`comeback`)

**Quando sai:** Vitória depois de 2 ou mais derrotas seguidas.

**Ilustração possível:** victory

1. **Manchete:** {name} dá a volta por cima  
   **Texto:** Depois de uma fase ruim, o gladiador voltou a vencer em {arena}.  
   *EN:* {name} bounces back — After a rough patch, the gladiator is winning again at the {arena}.

## Derrota por nocaute (`lossKo`)

**Quando sai:** Derrota em que o gladiador caiu.

**Ilustração possível:** defeat

1. **Manchete:** {opp} derruba {name} em {arena}  
   **Texto:** A torcida silenciou quando o gladiador caiu na areia. Nas tavernas, já pedem uma revanche.  
   *EN:* {opp} knocks down {name} at the {arena} — The crowd fell silent when the gladiator hit the sand. In the taverns, they are already calling for a rematch.

2. **Manchete:** Dia difícil para {name}  
   **Texto:** {opp} foi superior em {arena}. Os instrutores pedem mais disciplina no ludus.  
   *EN:* A hard day for {name} — {opp} was the better fighter at the {arena}. The trainers demand more discipline at the ludus.

## Derrota por decisão (`lossDecision`)

**Quando sai:** Derrota quando o tempo acaba e os juízes decidem.

**Ilustração possível:** defeat

1. **Manchete:** {opp} vence {name} por decisão  
   **Texto:** A luta foi até o fim, mas os juízes deram a vitória a {opp}.  
   *EN:* {opp} beats {name} on a decision — The fight went the distance, but the judges gave the win to {opp}.

## Derrota por desistência (`lossForfeit`)

**Quando sai:** Quando o jogador desiste da luta.

**Ilustração possível:** defeat

1. **Manchete:** {name} desiste diante de {opp}  
   **Texto:** O gladiador ergueu o dedo pedindo clemência. Parte do público vaiou.  
   *EN:* {name} yields to {opp} — The gladiator raised a finger asking for mercy. Part of the crowd booed.

## Três derrotas seguidas (`slump`)

**Quando sai:** No lugar da notícia de derrota, ao chegar a 3 derrotas seguidas.

**Ilustração possível:** training

1. **Manchete:** Três derrotas seguidas para {name}  
   **Texto:** O lanista está preocupado e exige mais treino no ludus.  
   *EN:* Three defeats in a row for {name} — The lanista is worried and demands more training at the ludus.

## Treino / nível (`level`)

**Quando sai:** Ao chegar aos níveis 5, 10, 15, 20, 25 e 30.

**Ilustração possível:** training

1. **Manchete:** {name} impressiona nos treinos  
   **Texto:** Os instrutores do ludus dizem que o gladiador está mais forte do que nunca.  
   *EN:* {name} impresses in training — The ludus trainers say the gladiator is stronger than ever.

2. **Manchete:** Músculos de ferro  
   **Texto:** Quem viu {name} treinar no palus garante: {rival} terá trabalho.  
   *EN:* Muscles of iron — Those who saw {name} train at the palus swear: {rival} is in for a hard time.

## Taverna (`tavern`)

**Quando sai:** Depois de pagar a rodada de vinho na Taverna, com 60% de chance.

**Ilustração possível:** tavern

1. **Manchete:** Discussão na Taverna do Javali  
   **Texto:** {name} e amigos de {rival} trocaram provocações ontem à noite. A taverneira Lívia teve de separar os ânimos.  
   *EN:* Quarrel at the Boar Tavern — {name} and friends of {rival} traded insults last night. Livia the tavern keeper had to calm things down.

2. **Manchete:** {name} paga rodada e ouve histórias  
   **Texto:** O velho Quintus contou ao gladiador os segredos de {rival}. "Escutei tudo", disse um freguês.  
   *EN:* {name} buys a round and hears stories — Old Quintus told the gladiator the secrets of {rival}. "I heard everything", said a patron.

## Notícias da cidade (`city`)

**Quando sai:** Uma nota da cidade sai em toda edição (escolhida ao acaso).

**Ilustração (40% de chance, quando a manchete principal não tem):** 1ª → market, 2ª → forum, 3ª → ship, 4ª → baths, 5ª → theater, 6ª → rain, 7ª → temple, 8ª → market

1. **Manchete:** Preço do trigo sobe no mercado  
   **Texto:** Os padeiros culpam as chuvas na Sicília.  
   *EN:* Wheat prices rise at the market — The bakers blame the rains in Sicily.

2. **Manchete:** Senado anuncia novos jogos  
   **Texto:** Haverá distribuição de pão para o povo nos dias de luta.  
   *EN:* Senate announces new games — Bread will be handed out to the people on fight days.

3. **Manchete:** Navio do Egito chega ao porto  
   **Texto:** Especiarias, linho e papiro já estão à venda no mercado.  
   *EN:* Ship from Egypt arrives in port — Spices, linen and papyrus are already on sale at the market.

4. **Manchete:** Termas ganham piscina nova  
   **Texto:** A água quente agora chega por um novo aqueduto.  
   *EN:* The baths get a new pool — Hot water now arrives through a new aqueduct.

5. **Manchete:** Comédia lota o teatro  
   **Texto:** Os atores foram aplaudidos por mais de uma hora.  
   *EN:* Comedy packs the theater — The actors were applauded for more than an hour.

6. **Manchete:** Chuva forte alaga o fórum  
   **Texto:** Os comerciantes passaram a manhã tirando água das lojas.  
   *EN:* Heavy rain floods the forum — Merchants spent the morning bailing water out of their shops.

7. **Manchete:** Oferendas lotam o Templo de Marte  
   **Texto:** Antes dos jogos, gladiadores e apostadores pedem a proteção do deus da guerra.  
   *EN:* Offerings fill the Temple of Mars — Before the games, gladiators and gamblers ask the god of war for protection.

8. **Manchete:** Edil proíbe venda aos domingos  
   **Texto:** O mercado fecha no dia do sol. Os comerciantes reclamam, os escravos agradecem.  
   *EN:* Aedile bans trading on Sundays — The market closes on the day of the sun. Merchants complain; slaves are grateful.

## Novidades da versão 0.6

As notícias abaixo vieram com os eventos da cidade, o torneio e os rivais. Valem as mesmas regras de variáveis.

### Pedido de revanche (`rematchAsk`)

**Quando sai:** Na manhã seguinte a uma vitória sobre um adversário da escada, se ele pedir revanche (chance de 35%, no máximo um pedido a cada 7 dias).

**Ilustração possível:** rival

1. **Manchete:** {opp} quer revanche contra {name}  
   **Texto:** "Foi sorte", diz o derrotado, que promete treinar todos os dias até a nova luta.  
   *EN:* {opp} wants a rematch against {name} — "It was luck," says the loser, who promises to train every day until the new fight.

2. **Manchete:** Orgulho ferido: {opp} desafia {name} outra vez  
   **Texto:** O desafio está feito. Resta saber se {name} vai aceitar.  
   *EN:* Wounded pride: {opp} challenges {name} again — The challenge is made. Will {name} accept?

### Revanche vencida (`rematchWin`)

**Quando sai:** Depois de vencer uma revanche.

**Ilustração possível:** victory

1. **Manchete:** {name} vence a revanche contra {opp}  
   **Texto:** Nem o treino extra salvou o rival. A questão está encerrada.  
   *EN:* {name} wins the rematch against {opp} — Not even extra training saved the rival. The matter is settled.

### Revanche perdida (`rematchLose`)

**Quando sai:** Depois de perder uma revanche.

**Ilustração possível:** defeat

1. **Manchete:** {opp} se vinga de {name}  
   **Texto:** O treino deu resultado: o rival saiu da arena de cabeça erguida.  
   *EN:* {opp} takes revenge on {name} — The training paid off: the rival left the arena with his head held high.

### Revanche esquecida (`rematchFled`)

**Quando sai:** Quando o pedido de revanche expira sem resposta (7 dias). Custa 2 de fama.

**Ilustração possível:** rival

1. **Manchete:** {opp}: "{name} fugiu da revanche"  
   **Texto:** O pedido de revanche ficou sem resposta, e a cidade comenta.  
   *EN:* {opp}: "{name} ran from the rematch" — The challenge went unanswered, and the city is talking.

### Véspera de festival (`festivalSoon`)

**Quando sai:** Na edição do dia anterior ao festival (a cada 14 dias: dias 10, 24, 38...).

**Ilustração possível:** festival

1. **Manchete:** Amanhã é dia de festival em {city}!  
   **Texto:** As arquibancadas devem lotar: a fama de cada vitória valerá em dobro.  
   *EN:* Tomorrow is festival day in {city}! — The stands should be packed: fame from every victory will count double.

### Dia de festival (`festival`)

**Quando sai:** Na edição do dia do festival.

**Ilustração possível:** festival

1. **Manchete:** Hoje é festival: a cidade vai à arena  
   **Texto:** Flores, flâmulas e arquibancadas cheias. Quem lutar hoje ganha fama em dobro.  
   *EN:* Festival today: the city goes to the arena — Flowers, pennants and full stands. Whoever fights today earns double fame.

2. **Manchete:** Festa nas ruas e na arena  
   **Texto:** O povo de {city} celebra os deuses e quer ver grandes lutas.  
   *EN:* Celebrations in the streets and in the arena — The people of {city} honor the gods and want to see great fights.

### Mercador viajante (`merchant`)

**Quando sai:** Na edição dos dias em que o mercador viajante está na praça (a cada 6 a 10 dias).

**Ilustração possível:** merchant

1. **Manchete:** Mercador viajante chega à praça  
   **Texto:** Só hoje: armas e armaduras raras vindas de longe, no mercado.  
   *EN:* Travelling merchant arrives in the square — Today only: rare weapons and armor from distant lands, at the market.

2. **Manchete:** Carroça exótica no mercado  
   **Texto:** O mercador fica até o fim do dia. Quem tiver moedas deve se apressar.  
   *EN:* Exotic cart at the market — The merchant stays until the end of the day. Those with coins should hurry.

### Queda de braço (`armWin`)

**Quando sai:** Depois de vencer a queda de braço na taverna (domingo à noite).

**Ilustração possível:** armwrestle

1. **Manchete:** {name} vence a queda de braço da taverna  
   **Texto:** Os fregueses da Taverna do Javali juram que a mesa quase quebrou.  
   *EN:* {name} wins the tavern arm wrestling — The Boar Tavern regulars swear the table almost broke.

2. **Manchete:** Braço de ferro: {name} derruba o campeão da taverna  
   **Texto:** Na noite de domingo, a força de {name} rendeu moedas e aplausos.  
   *EN:* Iron arm: {name} topples the tavern champion — On Sunday night, {name}’s strength earned coins and applause.

### Torneio: hoje é o dia (`tourneyToday`)

**Quando sai:** Manhã de sábado, só para quem se inscreveu no torneio.

**Ilustração possível:** tournament

1. **Manchete:** Hoje é dia de torneio: {name} está na chave
   **Texto:** Oito lutadores, três rodadas, a partir das 14h na arena. A plateia espera ver {name} na areia; faltar seria uma vergonha.
2. **Manchete:** Torneio de sábado começa às 14h
   **Texto:** {name} se inscreveu e a cidade já faz apostas. Quem não aparecer perde o respeito da arena.

### Torneio: últimas inscrições (`tourneySoon`)

**Quando sai:** Toda sexta-feira.

**Ilustração possível:** tournament

1. **Manchete:** Torneio de sábado: inscrições até hoje  
   **Texto:** Oito lutadores, três rodadas, a partir das 14h. Inscrições na arena.  
   *EN:* Saturday tournament: last day to sign up — Eight fighters, three rounds, from 14:00. Sign up at the arena.

### Campeão do torneio (`tourneyWin`)

**Quando sai:** Depois de ganhar o torneio de sábado.

**Ilustração possível:** tournament

1. **Manchete:** {name} é campeão do torneio de sábado!  
   **Texto:** Três lutas, três vitórias. {city} tem um novo favorito.  
   *EN:* {name} wins the Saturday tournament! — Three fights, three wins. {city} has a new favorite.

2. **Manchete:** Torneio: ninguém para {name}  
   **Texto:** O troféu e a coroa de louros ficaram com {name}.  
   *EN:* Tournament: no one can stop {name} — The trophy and the laurel crown went to {name}.

### Vice no torneio (`tourneyFinal`)

**Quando sai:** Depois de perder a final do torneio.

**Ilustração possível:** tournament

1. **Manchete:** {name} cai na final do torneio  
   **Texto:** {opp} ficou com o título, mas {name} saiu aplaudido.  
   *EN:* {name} falls in the tournament final — {opp} took the title, but {name} left to applause.

### Eliminado do torneio (`tourneyOut`)

**Quando sai:** Depois de cair nas quartas ou na semifinal ({opp} = campeão).

**Ilustração possível:** tournament

1. **Manchete:** Torneio de sábado termina com {opp} campeão  
   **Texto:** {name} lutou, mas não foi desta vez.  
   *EN:* Saturday tournament ends with {opp} as champion — {name} fought, but not this time.

### Faltou ao torneio (`tourneyNoShow`)

**Quando sai:** Quando se inscreveu e não apareceu no sábado.

**Ilustração possível:** tournament

1. **Manchete:** {name} não aparece no torneio  
   **Texto:** A vaga ficou vazia e a inscrição foi perdida.  
   *EN:* {name} misses the tournament — The spot stayed empty and the sign-up was lost.

### Legendas das novas ilustrações

| Ilustração | Português | Inglês |
| --- | --- | --- |
| festival | Guirlandas e flâmulas no dia de festival. | Garlands and pennants on festival day. |
| merchant | A carroça do mercador viajante. | The travelling merchant’s cart. |
| armwrestle | Queda de braço na Taverna do Javali. | Arm wrestling at the Boar Tavern. |
| tournament | O campeão do torneio de sábado. | The Saturday tournament champion. |

## Legendas das ilustrações

| Ilustração | Português | Inglês |
| --- | --- | --- |
| baths | As termas da cidade. | The city baths. |
| colosseum | O grande anfiteatro. | The great amphitheater. |
| crowd | As arquibancadas lotadas. | Packed stands. |
| defeat | De joelhos na areia. | On his knees in the sand. |
| forum | O fórum de Cápua. | The forum of Capua. |
| market | Movimento no mercado. | A busy day at the market. |
| newcomer | O novato chega ao ludus. | The newcomer arrives at the ludus. |
| rain | Chuva forte sobre a cidade. | Heavy rain over the city. |
| rival | O rival, visto num treino. | The rival, seen during training. |
| ship | Navio atracado no porto. | A ship moored in the harbor. |
| statue | Estátua erguida em honra aos heróis da arena. | A statue raised in honor of the heroes of the arena. |
| tavern | A Taverna do Javali, perto do fórum. | The Boar Tavern, near the forum. |
| temple | O Templo de Marte. | The Temple of Mars. |
| theater | Noite de estreia no teatro. | Opening night at the theater. |
| training | Treino duro no palus. | Hard training at the palus. |
| victory | O vencedor ergue a espada diante do público. | The victor raises his sword before the crowd. |

## Anúncios

Um por edição; a edição do dia N mostra o anúncio número (N mod 6).

1. Taverna do Javali: ensopado quente e vinho de Falerno. Boatos de graça para quem paga a rodada!  
   *EN:* The Boar Tavern: hot stew and Falernian wine. Free gossip for whoever buys the round!
2. Escudos, gládios e grevas no Mercado. Fechado aos domingos, por ordem do edil.  
   *EN:* Shields, gladii and greaves at the Market. Closed on Sundays by order of the aedile.
3. Termas de Cápua: água quente do novo aqueduto. Saia descansado para a arena!  
   *EN:* Baths of Capua: hot water from the new aqueduct. Leave rested for the arena!
4. Vende-se colchão de lã de ovelha da Apúlia. Durma como um senador. Tratar no Mercado.  
   *EN:* For sale: Apulian sheep-wool mattress. Sleep like a senator. Ask at the Market.
5. Procura-se doctore experiente para treinar gladiadores. Bom salário, comida farta.  
   *EN:* Wanted: experienced doctore to train gladiators. Good pay, plenty of food.
6. Oferendas ao Templo de Marte trazem coragem. O monge Aurelius recebe os bravos.  
   *EN:* Offerings at the Temple of Mars bring courage. The monk Aurelius welcomes the brave.

## Novas notícias da cidade (versão 0.7.1, `city.8` a `city.29`)

Notas secundárias (Senado, obras, comércio, costumes). Saem como as outras notas da cidade.

9. **Manchete:** Senado debate novo aqueduto  
   **Texto:** Os senadores discutem quem vai pagar a obra. Ninguém quer.  
   *EN:* Senate debates a new aqueduct — The senators argue over who will pay for it. Nobody wants to.

10. **Manchete:** Edil promete consertar a ponte  
   **Texto:** Depois da última cheia, a ponte do fórum ficou com rachaduras.  
   *EN:* Aedile promises to fix the bridge — After the last flood, the forum bridge was left cracked.

11. **Manchete:** Incêndio numa padaria assusta a vizinhança  
   **Texto:** Os vigias apagaram o fogo antes que chegasse às casas.  
   *EN:* Bakery fire scares the neighborhood — The night watch put out the fire before it reached the houses.

12. **Manchete:** Cônsul visita Cápua  
   **Texto:** O povo encheu as ruas para ver a comitiva passar.  
   *EN:* Consul visits Capua — People filled the streets to watch the retinue go by.

13. **Manchete:** Ladrão de capas preso nas termas  
   **Texto:** Ele roubava as roupas dos banhistas enquanto se lavavam.  
   *EN:* Cloak thief caught at the baths — He stole bathers' clothes while they washed.

14. **Manchete:** Safra de uvas promete vinho farto  
   **Texto:** Os vinhateiros do Vesúvio esperam o melhor ano em décadas.  
   *EN:* Grape harvest promises plenty of wine — The vintners of Vesuvius expect the best year in decades.

15. **Manchete:** Novo templo de Juno será erguido  
   **Texto:** As obras começam depois das festas, diz o pontífice.  
   *EN:* New temple of Juno to be built — Work begins after the festivities, says the pontiff.

16. **Manchete:** Senado aprova pão de graça nos dias de jogos  
   **Texto:** Os padeiros reclamam; o povo comemora.  
   *EN:* Senate approves free bread on game days — The bakers complain; the people celebrate.

17. **Manchete:** Escola de retórica abre as portas  
   **Texto:** Os filhos dos mercadores agora aprendem a discursar como senadores.  
   *EN:* School of rhetoric opens its doors — Merchants' sons now learn to speak like senators.

18. **Manchete:** Elefante foge de circo e passeia no mercado  
   **Texto:** Ninguém se feriu, mas uma barraca de melões foi destruída.  
   *EN:* Elephant escapes and strolls through the market — Nobody was hurt, but a melon stall was destroyed.

19. **Manchete:** Preço do azeite cai depois da colheita  
   **Texto:** As ânforas chegam aos montes da Apúlia.  
   *EN:* Olive oil prices fall after the harvest — Amphorae arrive by the hundreds from Apulia.

20. **Manchete:** Censo da cidade começa amanhã  
   **Texto:** Todo morador deve se apresentar no fórum com a família.  
   *EN:* City census begins tomorrow — Every resident must appear at the forum with their family.

21. **Manchete:** Nova estrada liga Cápua a Roma mais rápido  
   **Texto:** Os mensageiros agora chegam em dois dias.  
   *EN:* New road links Capua to Rome faster — Messengers now arrive in two days.

22. **Manchete:** Poeta lê versos no fórum e é vaiado  
   **Texto:** Ele promete voltar com um poema sobre gladiadores.  
   *EN:* Poet reads verses at the forum and is booed — He promises to return with a poem about gladiators.

23. **Manchete:** Médico grego abre consultório perto das termas  
   **Texto:** Diz curar dor nas costas com agulhas. Muitos duvidam.  
   *EN:* Greek doctor opens a practice near the baths — He claims to cure back pain with needles. Many doubt it.

24. **Manchete:** Tempestade afunda barco de pescadores  
   **Texto:** Todos foram resgatados a nado pelos colegas.  
   *EN:* Storm sinks a fishing boat — Everyone was rescued by fellow fishermen swimming out.

25. **Manchete:** Cães de rua viram problema no fórum  
   **Texto:** O edil promete uma solução até o fim do mês.  
   *EN:* Stray dogs become a problem at the forum — The aedile promises a solution by the end of the month.

26. **Manchete:** Mercadores de Cartago chegam com marfim  
   **Texto:** Os ricos da cidade disputam os melhores pedaços.  
   *EN:* Merchants from Carthage arrive with ivory — The city's rich compete for the best pieces.

27. **Manchete:** Festa de Saturno se aproxima  
   **Texto:** Escravos e senhores trocam de lugar por um dia.  
   *EN:* The feast of Saturn draws near — Slaves and masters trade places for a day.

28. **Manchete:** Corrida de bigas lota o hipódromo  
   **Texto:** A equipe verde venceu de novo, para alegria da plebe.  
   *EN:* Chariot race packs the circus — The Greens won again, to the delight of the plebs.

29. **Manchete:** Eleição para edil esquenta  
   **Texto:** Muros da cidade amanhecem cheios de pinturas dos candidatos.  
   *EN:* Election for aedile heats up — City walls wake up covered in candidates' paintings.

30. **Manchete:** Sacerdotes leem bons presságios  
   **Texto:** As aves voaram para a direita. Ano de sorte, dizem.  
   *EN:* Priests read good omens — The birds flew to the right. A lucky year, they say.

## Novos anúncios (versão 0.7.1, `ad.6` a `ad.19`)

| Nº | Português | Inglês |
| --- | --- | --- |
| 6 | Barbearia do Lúcio: corte e barba por dois asses. Sai mais bonito que um senador. | Lucius' Barbershop: haircut and shave for two asses. Leave handsomer than a senator. |
| 7 | Vende-se escravo que sabe ler, escrever e fazer contas. Tratar com o lanista. | For sale: a slave who reads, writes and does sums. Ask the lanista. |
| 8 | Aulas de grego com professor de Atenas. Preço justo, paciência infinita. | Greek lessons with a teacher from Athens. Fair price, infinite patience. |
| 9 | Perdeu-se um cachorro malhado perto das termas. Recompensa! | Lost: a spotted dog near the baths. Reward! |
| 10 | Padaria do Fórum: pão quente ao nascer do sol. | Forum Bakery: hot bread at sunrise. |
| 11 | Aluga-se quarto no segundo andar, perto do mercado. Sem goteiras (quase). | Room for rent on the second floor, near the market. No leaks (almost). |
| 12 | Amuletos contra mau-olhado. Testados por gladiadores! | Amulets against the evil eye. Tested by gladiators! |
| 13 | Sandálias sob medida. Couro da Hispânia. | Made-to-measure sandals. Leather from Hispania. |
| 14 | Teatro de Cápua apresenta: 'O soldado fanfarrão'. Risos garantidos. | The Capua theater presents: 'The Braggart Soldier'. Laughs guaranteed. |
| 15 | Compro ouro, prata e moedas antigas. Pago na hora. | Buying gold, silver and old coins. Cash on the spot. |
| 16 | Escribas para cartas de amor e de cobrança. Discrição total. | Scribes for love letters and debt notices. Total discretion. |
| 17 | Óleo para massagem dos atletas: deixa os músculos soltos para a arena. | Massage oil for athletes: keeps muscles loose for the arena. |
| 18 | Vinho de Falerno direto do produtor. Ânforas lacradas. | Falernian wine straight from the vintner. Sealed amphorae. |
| 19 | Ferreiro Vulcanus: armas afiadas, escudos consertados, preço honesto. | Vulcanus the blacksmith: sharp weapons, mended shields, honest prices. |

