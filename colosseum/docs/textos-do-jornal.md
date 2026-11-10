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

## Cabeçalho e partes fixas

| Onde | Português | Inglês |
| --- | --- | --- |
| Título | Cápua Times | Capua Times |
| Preço (canto esquerdo) | Um asse | One as |
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
