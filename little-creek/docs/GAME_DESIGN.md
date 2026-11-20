# Little Creek — Game Design (protótipo)

Valores reais usados no código (`scripts/systems/EcosystemRules.gd`,
`scripts/autoload/GameState.gd`, `data/*.json`).

## Fantasia

Cuidar de um riacho esquecido até ele virar um refúgio. O jogador sente que
**ajuda a natureza a florescer**: cada elemento aparece fisicamente na cena,
o chão "brota" aos poucos, a água clareia e os animais chegam porque
encontraram o que precisam.

## Recursos e indicadores

| Recurso | Origem | Uso |
|---|---|---|
| **Água** (moeda) | toque no riacho, produção passiva, doações | construir, melhorias |
| **Sementes** | produção passiva, plantas, 6% dos toques | plantas e árvores |
| **Qualidade da água** (0–100) | 12 + 9/filtro + 6/planta aquática (máx 36) + troncos, samambaias, grama | vitalidade, peixes, libélulas, aparência da água |
| **Vitalidade** (0–100%) | `0,4 × qualidade + 62 × (1 − e^(−vegetação/42))` | estágios, fauna, "brotar" do cenário, musgo |
| **Biodiversidade** | nº de espécies presentes (plantas colocadas + musgo + animais elegíveis) | multiplicador de produção, estágios, veado |
| **Beleza** | soma da beleza dos elementos + bônus do estágio | estágios |
| **Reputação** | visitantes (fotos, bancos, comedouros) | +0,1% de produção por ponto |

Produção:

- Água/s = `(0,5 + 0,35·nascente + 0,008·qualidade + 0,02·plantas) × mult`
- `mult = (1 + 0,05·biodiversidade·(1 + 0,15·corredor)) × (1 + bônus do estágio) × (1 + 0,001·reputação)`
- Sementes/s = `(0,03 + 0,04·banco de sementes + Σ sementes das plantas) × (1 + 0,03·biodiversidade)`
- Toque = `(1 + nível de "Mãos na água") × (1 + 0,05·biodiversidade)`
- Custos de construção crescem 7% por unidade do mesmo tipo.
- Offline: 60% da produção, limite de 2 h + 1 h por nível de *Ciclo das chuvas*.

## Estágios

| Estágio | Requisitos | O que muda |
|---|---|---|
| 1 Riacho Abandonado | — | água turva, campo seco oliva/ocre, um sabiá visita de vez em quando |
| 2 Florescimento | Beleza 15, Vitalidade 25% | pólen, musgo, borboletas; libera árvore frondosa, corredor e ciclo das chuvas |
| 3 Ecossistema | Beleza 45, Vitalidade 50%, 8 espécies | peixes, libélulas, veado (com mata densa) |
| 4 Refúgio Natural | Beleza 100, Vitalidade 72%, 12 espécies | trilha surge, visitantes, banco/comedouro/mirante |

## Fauna (condições)

| Espécie | Condição | Comportamento |
|---|---|---|
| Sabiá-laranjeira | sempre (1 no início; mais com árvores e vitalidade) | voa, pousa em copas/árvores/pedras/comedouros, bica, canta |
| Saíra-sete-cores | arbusto + vitalidade 35% | idem, canto agudo |
| Borboletas | 2+ flores + vitalidade 20% | voam entre as flores e pousam |
| Libélulas | qualidade 35 + planta aquática | disparam sobre a água, pairam, tocam a superfície |
| Lambaris | qualidade 45 + planta aquática | nadam sob a superfície, fogem do toque |
| Veado-catingueiro | vitalidade 55%, 8 espécies, 4+ árvores/arbustos | sai da mata, vai à margem, bebe, observa, volta |

A elegibilidade é contínua: se o ambiente piora (ex.: remover as plantas
aquáticas), os animais vão embora aos poucos.

## Construção (13 elementos)

Grama, flores (4 cores), pedra pequena, pedra grande, samambaia, arbusto
(frutinhas), tronco caído (fungos), plantas aquáticas (dentro d'água),
árvore jovem, árvore frondosa (estágio 2), banco, comedouro e mirante
(estágio 4). Cada um tem custo, beleza, vitalidade e efeito ecológico
(poleiro, atrai borboletas, limpa a água, gera sementes, ponto de visitantes).

## v0.3 — Tempo, clima, fauna e acontecimentos

### Tempo (`data/config.json → time`)
- 1 dia de jogo = 24 min reais. Períodos: amanhecer 5h–7h30, dia 7h30–17h,
  entardecer 17h–19h30, noite 19h30–5h.
- Estação = 30 dias de jogo (ano = 120 dias). Novas partidas começam no dia 11
  da primavera.
- Offline: o relógio avança no máximo 18 h de jogo.

### Clima (`weather`)
- Checagem a cada 2 h de jogo após um intervalo seco de 8–16 h.
- Chance de chuva: primavera 16%, verão 20%, outono 14%, inverno 9%; parte delas
  é forte (30/40/25/15%). Chuva fraca 1,5–4 h; forte 1–2,5 h.
- 40% de chance de arco-íris quando uma chuva termina de dia.

### Fauna (`data/fauna.json`)
População-alvo = alvo ecológico × atividade (período × estação × clima).
Veado e raposa visitam por intervalos de 5–14 h e 10–30 h de jogo (divididos
pela atividade). Coruja: um sorteio por noite (60%). Máximo de 12 animais.

| Espécie | Condição ecológica |
|---|---|
| Corujinha-do-mato | estágio 2+, pelo menos uma árvore plantada |
| Raposa-do-campo | vitalidade 45%, 7 espécies |
| Marreca-pé-vermelho | qualidade 50+, planta aquática e o acontecimento "patos" |
| Lobo-guará | só pelo acontecimento raro (estágio 3+, vitalidade 65%, à noite, sem visitantes) |

### Acontecimentos (`events`)
Checados a cada hora de jogo, com pelo menos 3 h entre um e outro.

| Acontecimento | Chance/h | Intervalo mínimo |
|---|---|---|
| Grupo de borboletas | 10% | 20 h |
| Veado com filhote | 8% | 48 h |
| Ninho | 12% | 24 h |
| Patos no riacho | 7% | 36 h |
| Flor rara | 5% | 72 h |
| Bando de pássaros | 10% | 16 h |
| Animal raro | 2,5% | 96 h |

### Visitantes (`visitors`)
Intervalo base 160–380 s reais ÷ multiplicador (estação: primavera 1,2, verão
1,4, outono 0,9, inverno 0,35; chuva fraca 0,35, forte 0; noite 0; beleza,
bancos/comedouros/mirante e ponte aumentam um pouco). Um grupo por vez.

### Limites de compra
Grama 14, flores 12, pedra pequena 8, pedra grande 5, samambaia 10, arbusto 9,
tronco 3, plantas aquáticas 6, árvore jovem 7, árvore frondosa 4, banco 2,
comedouro 2, mirante 1, ponte 1.
