# LOL Insight

Plataforma de análise e desenvolvimento competitivo para League of Legends, com duas
versões integradas sobre o mesmo código, o mesmo backend e as mesmas contas:

- **Aplicativo Android** — experiência minimalista: abas inferiores, telas enxutas.
- **Plataforma web** — experiência analítica: barra lateral, tabelas ordenáveis,
  cruzamentos, comparações lado a lado, atalhos de teclado (ver "Versão web").

Busca de contas, elo, histórico de partidas, gráficos interativos, insights, relatório
pós-partida, uma escola integrada (**LOI Academy**), previsão de elo (**Rank Predictor**),
desafios diários (**LOL Challenge**) e análise de decisões (**Replay Challenge**).

- **App:** Expo (SDK 58) + React Native + TypeScript + Expo Router.
- **Backend (`server/`):** Node.js + SQLite. É o único que fala com a Riot Games API e
  o único lugar onde a chave existe.
- **Dois modos**, alternáveis no app em *Perfil → Fonte de dados*:
  - **Demonstração** — conta fictícia `Gregory#BR1`, gerada no aparelho. Não precisa de servidor nem de conta.
  - **Dados reais** — exige uma conta do LOL Insight; dados obtidos via backend + Riot API.

> LOL Insight não é endossado pela Riot Games.

## Como executar

Pré-requisitos: **Node.js 22.13+**, Git e, no celular, o app **Expo Go**.

### 1. Backend (necessário só para o modo real)

```bash
cd lol-insight/server
npm install
cp .env.example .env        # depois edite .env e preencha RIOT_API_KEY
npm start
```

A chave é gerada em <https://developer.riotgames.com/>. Chaves de desenvolvimento
**expiram em 24 horas**: quando o app mostrar "Erro de autenticação", gere outra,
atualize `server/.env` e reinicie o servidor.

O servidor mostra o endereço na rede local (ex.: `http://192.168.0.10:3333`).
Para conferir a chave e cada endpoint antes de abrir o app:

```bash
npm run smoke -- "Nome#TAG" BR
```

### 2. App

```bash
cd lol-insight
npm install
npx expo start
```

Abra o Expo Go no Android (mesma rede Wi-Fi do computador) e escaneie o QR code.

### Uso pessoal, sem conta (opcional)

Se só você usa o servidor, coloque `PERSONAL_MODE=1` no `server/.env`. Assim o app e a
versão web usam os dados reais sem cadastro, como um único usuário "local": basta
vincular o seu Riot ID em *Minha conta → Vincular conta Riot*. Por segurança, isso vale
só para pedidos vindos do próprio computador ou da mesma rede Wi-Fi; da internet, o login
continua obrigatório. Contas existentes continuam funcionando normalmente.

### 3. Ativar os dados reais

No app: **Perfil → Fonte de dados → Dados reais → Testar**.

Em desenvolvimento o app descobre o servidor sozinho (usa o IP do computador que
serve o Expo, porta 3333). Se o teste falhar, digite o endereço mostrado pelo
servidor.

Depois:

1. Toque em **Criar conta** (ou **Entrar**) no cartão que aparece no Perfil e no Início.
2. Confirme o e-mail com o código de 6 dígitos. **Em desenvolvimento nenhum e-mail é enviado:
   o código aparece no terminal onde o servidor está rodando**, numa linha
   `[E-MAIL DE DESENVOLVIMENTO — não enviado]`.
3. Em **Minha conta → Vincular conta Riot**, informe seu Riot ID e a região.
4. O app abre suas estatísticas automaticamente. Você também pode pesquisar qualquer
   jogador na aba **Início**.

Observações:

- Com `npx expo start --tunnel`, o endereço automático não funciona: informe o IP do computador manualmente.
- Em um APK (`npx eas-cli build -p android --profile preview`), o Android bloqueia HTTP
  sem TLS por padrão. Hospede o backend com HTTPS e defina `EXPO_PUBLIC_API_BASE_URL`.
- `npm run web` abre o app no navegador.

## O que o modo real faz

| Recurso | Origem |
| --- | --- |
| Busca por Riot ID + região | Account-V1 |
| Nível e ícone de perfil | Summoner-V4 |
| Elo, divisão, LP, vitórias e derrotas (Solo/Duo e Flex) | League-V4 |
| Histórico e detalhes das partidas (KDA, CS, dano, ouro, itens, runas, feitiços, posição, os 10 jogadores) | Match-V5 |
| Ordem de habilidades, itens concluídos e linha do tempo | Match-V5 (timeline), sob demanda ao abrir a partida |
| Campeões com maior maestria | Champion-Mastery-V4 |
| Imagens e nomes (campeões, itens, runas, feitiços, ícone de perfil) | Data Dragon |

Todas as estatísticas exibidas (win rate, KDA, CS/min, ouro/min, dano, participação em
abates, desempenho por campeão/posição/período, sequências, consistência, identidade
competitiva, insights) são **calculadas pelo motor em `src/stats`** a partir das partidas —
o mesmo código nos dois modos.

### Limitações da API e como foram tratadas

- **Histórico de LP não existe na API.** O backend grava um *snapshot* do elo a cada
  consulta (quando muda, ou a cada 6 h). O gráfico de LP mostra essa série e avisa desde
  quando a conta é acompanhada; com um único registro ainda não há linha.
- **Elo de temporadas anteriores e elo no momento de cada partida não existem na API.**
  O app informa isso em vez de exibir valores.
- **Só Summoner's Rift 5v5** (Solo/Duo, Flex, normais) entra na análise. ARAM, Arena e
  remakes são armazenados, mas ficam de fora e são contados à parte na tela inicial.
- **Limite de requisições.** Uma chave de desenvolvimento permite 20 req/s e 100 a cada
  2 min. Carregar 100 partidas pela primeira vez leva alguns minutos: o app mostra o
  progresso e as estatísticas vão se completando. Partidas já baixadas nunca são pedidas de novo.

## Contas de usuário

No modo real, cada pessoa tem uma conta do LOL Insight (nome de usuário, e-mail e senha)
com um ID permanente (`usr_...`). Tudo o que é pessoal pertence a esse ID: contas Riot
vinculadas, progresso e testes da Academy, plano semanal, metas, previsões, configurações
e sessões. Um usuário nunca vê nem altera os dados de outro — o servidor ignora qualquer
identificador enviado pelo app e usa sempre o dono do token.

### Fluxo

1. **Cadastro** → o servidor cria o usuário, abre uma sessão e gera um código de confirmação de e-mail.
2. **Confirmação de e-mail** com o código de 6 dígitos (24 h, no máximo 5 tentativas).
   Obrigatória para vincular uma conta Riot.
3. **Login** → token de acesso (15 min) + token de renovação (30 dias). O app renova sozinho
   quando o acesso expira; cada renovação troca os dois tokens.
4. **Vinculação Riot** pelo Riot ID + região. Fica como **não verificada**: o Riot ID existe,
   mas a posse da conta não é comprovada. A primeira conta vinculada vira a principal e é a
   usada pela Academy e pela previsão.
5. **Recuperação de senha**: código de 6 dígitos (15 min). Redefinir encerra todas as sessões.
6. **Sair**, **encerrar sessões** em outros aparelhos e **excluir a conta** (pede a senha e
   apaga todos os dados pessoais em cascata).

### Segurança

- Senhas com **scrypt** (N = 2^15, r = 8, p = 3, sal aleatório) — configuração recomendada
  pela OWASP. Escolhido no lugar de Argon2id/bcrypt por ser nativo do Node (sem dependência
  que precise compilar no Windows). Os parâmetros ficam no próprio hash; se aumentarem, a
  senha é re-hasheada no próximo login.
- Política de senha: 8 a 128 caracteres, bloqueio de senhas comuns e de senha igual ao e-mail/usuário.
- Tokens de sessão e códigos guardados **só como hash** (SHA-256 e HMAC com o segredo do servidor).
- **Reuso de um token de renovação já trocado encerra a sessão** (sinal de token copiado).
- **Limite de tentativas** persistido no banco: 5 erros de login por conta em 15 min,
  30 por IP, além de limites para cadastro, códigos e pedidos de redefinição.
- Mensagens genéricas onde a resposta poderia revelar se um e-mail está cadastrado
  (login e recuperação de senha), com tempo de resposta equalizado.
- No app, a sessão fica no **armazenamento seguro do aparelho** (Keystore do Android via
  `expo-secure-store`). Na versão web não há equivalente: fica no armazenamento local do navegador.
- Nenhum segredo no app: a chave da Riot e o segredo de autenticação ficam só no servidor.
- Ao sair ou entrar com outro usuário, o app apaga o histórico local do modo real (buscas e cache).

### Banco de dados (migração 2)

`users`, `user_sessions`, `email_verification_tokens`, `password_reset_tokens`,
`riot_accounts`, `oauth_states`, `user_settings`, `academy_progress`,
`academy_quiz_attempts`, `academy_activity`, `academy_plans`, `academy_diagnoses`,
`rank_predictions`, `rank_goals`, `challenge_progress`, `replay_analyses` e `auth_throttle`.
Todas as tabelas pessoais têm chave estrangeira para `users` com exclusão em cascata.
As migrações são versionadas (`PRAGMA user_version`) e aplicadas em transação ao iniciar o servidor.

O progresso do treinador gravado antes das contas era anônimo (indexado pelo PUUID
pesquisado). Ele **não é atribuído a nenhum usuário**: tabelas com dados viram `legacy_*`
e ficam guardadas à parte; tabelas vazias são removidas. Dados públicos da Riot (partidas,
contas pesquisadas, snapshots de elo) continuam compartilhados e não são duplicados.

### O que depende de serviços externos

- **Envio de e-mail**: não há provedor configurado. Em desenvolvimento, os códigos aparecem
  no terminal do servidor (e o app avisa). Para produção, implemente a interface `Mailer`
  em `server/src/auth/mailer.ts` com um provedor real.
- **Riot Sign On (RSO)**: exige aprovação da aplicação pela Riot. A estrutura está pronta
  (`server/src/auth/rso.ts`: Authorization Code + PKCE, state de uso único, tokens
  criptografados com AES-256-GCM) e desligada. Ela só foi testada contra um provedor
  simulado. Até a aprovação, nenhuma conta aparece como verificada.
- **LOL Challenge e Replay Challenges** ainda não existem no app; as tabelas
  `challenge_progress` e `replay_analyses` estão prontas e protegidas por usuário.

## LOI Academy e Rank Predictor

Os dois módulos formam um ciclo: **estatísticas → diagnóstico → aulas → plano semanal →
novas partidas → reavaliação → nova previsão**. Entram pela seção "Treinador" da tela
inicial e pelo Perfil.

### Academy

- **26 aulas originais** em cinco categorias (Fundamentos, Fase de rotas, Combate, Macro
  game, Mentalidade), cada uma com objetivo, explicação, exemplos, erros comuns, como
  aplicar, exercício e teste de conhecimento.
- **Diagnóstico automático** de oito habilidades (farm, segurança na rota, visão,
  objetivos, converter vantagem, lutas em equipe, mentalidade, pool de campeões). Cada
  uma é comparada com uma referência da **posição jogada em cada partida** e com o
  **próprio jogador** (últimas 10 partidas contra as anteriores). Sem amostra mínima a
  habilidade fica como "insuficiente" e não gera recomendação.
- **Aulas recomendadas** a partir dos pontos fracos, da mais grave para a menos grave.
- **Plano semanal** de 7 dias em torno do ponto fraco principal, com linha de base e meta
  do próprio jogador. Renova a cada 7 dias e só repete o foco se ele continuar sendo o mais crítico.
- **Domínio por habilidade em duas notas separadas**: teoria (testes) e prática
  (partidas). Acertar um teste nunca altera a nota prática.

### Rank Predictor

Modelo estatístico transparente (`src/coach/prediction.ts`):

1. Taxa de vitória **ponderada** das ranqueadas Solo/Duo (o peso de uma partida cai pela metade a cada 20 partidas).
2. **Suavização** com 12 partidas neutras a 50%, para não exagerar amostras pequenas.
3. Ajuste de no máximo ±1,5 p.p. pela evolução de KDA, farm e dano — indicadores auxiliares.
4. **Volume**: ranqueadas por semana observadas no histórico.
5. **LP por vitória e por derrota** medidos nos snapshots de elo (ou no histórico da
   demonstração). Sem observações suficientes usa ±20 LP e reduz a confiança.
6. **Simulação** de 1.200 sequências de 30 dias por cenário. Saem a projeção central
   (mediana), o intervalo de 10% a 90% e os cenários conservador, realista e otimista
   para 7, 15 e 30 dias, cada um com a explicação do cálculo.

Também calcula metas ("O que falta para chegar lá?"): distância em LP, partidas
necessárias no ritmo atual, taxa de vitória exigida e os obstáculos do diagnóstico
ligados às aulas.

Limites declarados no próprio app:

- O **MMR não é divulgado pela Riot** e o modelo não o conhece.
- Com menos de 10 ranqueadas, sem elo ou sem partidas nos últimos 28 dias, **não há previsão**.
- As referências do diagnóstico e da identidade competitiva são estimativas do LOL Insight, não
  dados oficiais. Farm e visão são ajustados à liga do jogador; a nota usa uma escala suave
  (10% abaixo da referência ≈ 40, 30% abaixo ≈ 23) para não zerar com diferenças moderadas.
- "Mortes antes dos 15 minutos" só entra no diagnóstico quando a linha do tempo das
  partidas está disponível (sempre na demonstração; nos dados reais, apenas nas partidas já abertas).
- Na demonstração as partidas são fixas, então a avaliação prática do plano não avança.
- O progresso da Academy é gravado por conta pesquisada (PUUID). Não há login: para
  vários usuários acompanhando a mesma conta, será preciso adicionar autenticação.

## Versão web

A versão web é o mesmo projeto Expo, publicado para o navegador. As rotas principais
apontam para módulos com versão `.web.tsx` (pasta `src/routes/`): o Metro escolhe a
página web só no build do navegador, então **o pacote Android não recebe nenhum código
das páginas web** (verificado no bundle). Lógica, dados, contas e regras são os mesmos.

| Seção | Rota | O que tem na web |
| --- | --- | --- |
| Visão geral | `/` | Identidade da conta, 8 indicadores com comparação ao período anterior, visão resumida/detalhada, evolução, campeões, partidas, insights |
| Desempenho | `/desempenho` | Filtros combinados (período, últimos N jogos, fila, posição, campeão), evolução de 7 métricas, cruzamentos campeão × posição, horário × dia, KDA × duração, farm × resultado, objetivos, consistência, últimos 10/20/50/100, comparação entre períodos |
| Campeões | `/campeoes`, `/campeao/{id}` | Biblioteca ordenável com maestria, comparação de até 4 campeões, página do campeão com melhores e piores matchups e caderno |
| Partidas | `/partidas`, `/partida/{id}` | Histórico pesquisável com 7 filtros; partida em uma página: relatório, estatísticas, equipes, build e linha do tempo |
| LOI Academy | `/academy` | Recomendações, pontos a corrigir, teoria × prática por habilidade, aulas por categoria, histórico de testes |
| LOL Challenge | `/desafios` | Desafio diário, desafios extras por categoria/dificuldade, XP, níveis, sequência, calendário, conquistas, estatísticas, ranking opcional, histórico |
| Replay Challenge | `/replay` | Leitura real dos metadados de `.rofl` no navegador; desafios de decisão a partir de eventos reais da partida; histórico |
| Perfil | `/perfil` | Identidade competitiva, elo, carreira, campeões, evolução, progresso na Academy e no Challenge |

Telas secundárias (aula, previsão de elo, caderno, comparar jogadores, conta, login)
reaproveitam as do aplicativo dentro da casca web, com mais largura.

**Responsivo:** barra lateral completa (≥ 1100 px), trilho de ícones (760–1100 px) e
menu em gaveta no celular. **Atalhos:** `/` busca, `1`–`8` seções, `[` recolhe a barra,
`?` mostra a ajuda.

### LOL Challenge

30 desafios em 6 categorias (Lane Management, Map Awareness, Macro Game, Team Fight,
Matchups, Mechanics) e 3 dificuldades, em `src/challenge/` (o mesmo código roda no app e
no servidor). Só a primeira resposta a cada desafio vale XP; o diário vale uma vez por dia
e dá bônus. Nas contas reais o **servidor corrige** a resposta e grava (`challenge_progress`);
o ranking mostra apenas o nome de usuário de quem aceitou participar (`challenge_profile`,
migração 4). Na demonstração, o histórico anterior a hoje e o ranking são fictícios e
identificados como DEMO. No Android há uma tela enxuta (desafio do dia e próximos).

### Replay Challenge: o que é real e o que não é

- **Real:** o arquivo `.rofl` começa com a assinatura `RIOT` e traz um bloco de
  metadados em JSON (duração, versão e estatísticas finais dos 10 jogadores). Ele é lido
  no navegador (`src/replay/rofl.ts`), sem enviar o arquivo a lugar nenhum. Se a partida
  estiver no histórico carregado, o app oferece abrir a análise dela.
- **Não implementado:** posições, momentos e pausas dentro do replay. Esse conteúdo é um
  fluxo de pacotes criptografado, que muda a cada patch e não tem documentação oficial.
  A interface mostra isso claramente e não simula a leitura.
- **Enquanto isso:** os desafios de decisão usam eventos reais da linha do tempo da
  Match-V5 (mortes antes de objetivos, mortes no rio/selva inimiga, desvantagem numérica,
  vantagem de ouro), com "o que aconteceu na partida" ao lado da resposta. Sem linha do
  tempo, aparecem cenários didáticos identificados como tal.

### Executar a versão web

```bash
npm install
npx expo start --web            # desenvolvimento (abre no navegador)
npm run build:web               # build de produção em dist/
npm run serve:web               # serve dist/ em http://localhost:8080 (com fallback de rotas)
npm run build:web:mobile        # build web com as telas do celular (testes de compatibilidade)
```

### Publicação

Nada é publicado automaticamente. Para hospedar:

1. **Backend** (Render, Fly.io, Railway ou VPS) com HTTPS e disco persistente para o
   SQLite (`DATABASE_FILE`). Variáveis: `RIOT_API_KEY` (chave de produção da Riot),
   `AUTH_SECRET` (32+ caracteres), `ALLOWED_ORIGINS=https://seu-dominio` (CORS restrito)
   e `TRUST_PROXY=1` quando houver proxy na frente (para o limite de tentativas usar o IP
   real do cliente).
2. **Web** (Vercel, Netlify, Cloudflare Pages): build com
   `EXPO_PUBLIC_API_BASE_URL=https://api.seu-dominio npm run build:web` e publique `dist/`.
   O arquivo `public/_redirects` já faz o fallback de rotas (Netlify/Cloudflare); na Vercel,
   configure a reescrita de `/(.*)` para `/index.html`.
3. **Domínio:** por exemplo `app.seu-dominio` para a web e `api.seu-dominio` para o backend,
   ambos com HTTPS (o navegador bloqueia chamadas HTTP a partir de uma página HTTPS).
4. **E-mail:** sem provedor configurado, os códigos de confirmação só aparecem no terminal
   do servidor. Para contas públicas é preciso um provedor (SES, Resend, SMTP).

Nenhuma chave vai para o navegador: tudo que começa com `EXPO_PUBLIC_` é público e só
contém endereços e opções (ver `.env.example`).

## Relatório, comparação, caderno, cartão e notificações

- **Relatório pós-partida** (aba padrão de cada partida e cartão "Relatório da última
  partida" na Início): até três pontos principais com a aula da Academy relacionada,
  diferença de ouro e CS para o oponente de rota aos 10 e 15 minutos, gráfico da
  diferença de ouro e mapa das mortes (onde, quando e com quantos inimigos). Nos dados
  reais vem da linha do tempo da Match-V5 (`participantFrames` e posições dos eventos);
  na demonstração é gerada de forma determinística a partir da partida. O mapa é um
  desenho próprio, sem a arte oficial do Summoner's Rift.
- **Comparar com um amigo** (`/comparar`): oito métricas lado a lado, as três maiores
  diferenças em frases e o radar de identidade dos dois, ambos na referência do elo de
  quem compara.
- **Caderno de matchups** (`/caderno`, tela do campeão e relatório da partida):
  dificuldade e anotação por confronto. Na demonstração fica só no aparelho; nos dados
  reais fica na conta (tabela `matchup_notes`, migração 3, apagada junto com a conta).
- **Cartão para compartilhar** (`/compartilhar`): imagem 1080 × 1350 com elo, números
  e campeões da semana, do mês ou de todas as partidas. É um SVG sem imagens remotas:
  no Android vira PNG e abre a folha de compartilhamento; no navegador é baixado (ou
  compartilhado, se o navegador permitir). No modo demonstração leva a marca "dados
  demonstrativos".
- **Notificações** (`/notificacoes`, só no Android): relatório de partida nova, resumo
  semanal (segunda, 10h), lembrete do plano de treino e meta de elo próxima. Tudo
  começa desligado. São notificações locais: o app confere partidas novas quando é
  aberto ou atualizado. Avisos com o app fechado exigiriam um servidor de push.

## Arquitetura

```
lol-insight/
  src/                      APP
    app/                    Rotas (Expo Router)
    screens/                Telas
    components/             Componentes; charts/ = gráficos em react-native-svg
    state/PlayerContext     Conta carregada, modo, quantidade de partidas, atualização progressiva
    services/               Contrato PlayerDataSource + MockDataSource (demo) + RiotApiDataSource (backend),
                            erros tipados, preferências, cache local, versão do Data Dragon
    stats/                  Motor estatístico (TypeScript puro, sem React)
    coach/                  Motor do treinador (TypeScript puro, usado pelo app e pelo backend):
                            diagnóstico, plano, domínio, LP por partida, previsão e as aulas
    data/                   Catálogos e gerador determinístico do modo demonstração
    types/                  Modelos de domínio (compartilhados com o backend)
  server/                   BACKEND
    src/riot/               Cliente HTTP da Riot, rate limiter, endpoints, DTOs
    src/regions.ts          Conversão região → plataforma (br1...) e cluster (americas...)
    src/ddragon.ts          Catálogo do Data Dragon, com cache
    src/services/           Busca de conta, coleta de partidas em segundo plano, normalização
    src/coach/              AcademyService, LessonService, PlayerDiagnosisService, TrainingPlanService,
                            RankPredictionService, LPHistoryService e a persistência do treinador
    src/db/                 Esquema SQLite e repositórios
    src/http/               Rotas, validação, CORS, limite por cliente
    test/                   Testes com uma Riot simulada
    scripts/smoke.ts        Verificação ao vivo dos endpoints
  tests/                    Testes do motor estatístico e do treinador
```

### Regiões

| Região no app | Plataforma (Summoner, League, Mastery) | Cluster (Account, Match) |
| --- | --- | --- |
| BR, NA, LAN, LAS | br1, na1, la1, la2 | americas |
| EUW, EUNE, TR | euw1, eun1, tr1 | europe |
| KR, JP | kr, jp1 | asia |
| OCE | oc1 | sea (Match) / asia (Account) |

### Endpoints da Riot utilizados

| API | Endpoint |
| --- | --- |
| Account-V1 | `GET /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}` |
| Account-V1 | `GET /riot/account/v1/region/by-game/lol/by-puuid/{puuid}` (sugere a região certa) |
| Summoner-V4 | `GET /lol/summoner/v4/summoners/by-puuid/{puuid}` |
| League-V4 | `GET /lol/league/v4/entries/by-puuid/{puuid}` |
| Champion-Mastery-V4 | `GET /lol/champion-mastery/v4/champion-masteries/by-puuid/{puuid}/top` |
| Match-V5 | `GET /lol/match/v5/matches/by-puuid/{puuid}/ids` |
| Match-V5 | `GET /lol/match/v5/matches/{matchId}` |
| Match-V5 | `GET /lol/match/v5/matches/{matchId}/timeline` |

### API do backend

| Rota | Descrição |
| --- | --- |
| `GET /health` | Situação do servidor e se há chave configurada (nunca a chave) |
| `GET /v1/accounts/{região}/{nome}/{tag}?count=10\|20\|50\|100&refresh=1` | Conta, elo, partidas, snapshots, maestria e estado da coleta |
| `GET /v1/matches/{matchId}/details?puuid=...` | Ordem de habilidades, itens concluídos e linha do tempo |
| `GET /v1/academy/lessons` | Catálogo de aulas (público) |
| `POST /v1/auth/register` · `login` · `refresh` · `logout` | Cadastro, login, renovação e saída |
| `POST /v1/auth/password/forgot` · `password/reset` | Recuperação de senha |
| `GET /v1/me` | Perfil, contas Riot vinculadas, configurações e situação do RSO |
| `POST /v1/me/email/verify` · `email/resend` | Confirmação de e-mail |
| `POST /v1/me/password` · `settings` · `delete` | Trocar senha, salvar preferências, excluir a conta |
| `GET /v1/me/sessions` · `DELETE /v1/me/sessions/{id}` · `POST /v1/me/sessions/revoke-others` | Sessões |
| `GET` / `POST /v1/me/riot-accounts` · `POST …/{id}/primary` · `DELETE …/{id}` | Contas Riot vinculadas |
| `GET /v1/me/coach?count=...` | Relatório do treinador da conta Riot principal |
| `POST /v1/me/coach/attempts` · `goal` · `plan-day` | Teste de aula, meta de elo, dia do plano |
| `GET` / `POST /v1/me/matchups` · `DELETE /v1/me/matchups/{campeão}/{adversário}` | Caderno de matchups do usuário |
| `GET /v1/me/challenge?tz=` · `POST /v1/me/challenge/attempts` | LOL Challenge: estado e resposta (corrigida no servidor) |
| `GET` / `POST /v1/me/challenge/ranking` | Ranking (só quem aceitou) e participação |
| `GET` / `POST /v1/me/replay-analyses` | Histórico do Replay Challenge |

Exceto `/health`, o catálogo de aulas e as rotas `/v1/auth/*` de entrada, todas exigem
`Authorization: Bearer <token de acesso>`.

Erros voltam como `{ "error": { "code", "message" } }`. Códigos: `INVALID_RIOT_ID`,
`INVALID_REGION`, `PLAYER_NOT_FOUND`, `WRONG_REGION`, `RATE_LIMITED`, `RIOT_AUTH`,
`MISSING_API_KEY`, `RIOT_UNAVAILABLE`. O app tem uma mensagem própria para cada um.

### Segurança e limites

- A chave fica em `server/.env` (fora do Git) e vai à Riot apenas no cabeçalho
  `X-Riot-Token` — nunca na URL, nunca em respostas, e é mascarada nos logs.
- Rate limiter por janela deslizante, um balde por host; adota os limites reais
  informados pela Riot em `X-App-Rate-Limit`.
- HTTP 429: respeita o `Retry-After`. Falhas temporárias (5xx, rede): até 3 novas
  tentativas com espera crescente. Nenhuma repetição sem limite.
- Entradas validadas (Riot ID, região, quantidade, IDs) e limite de 120 req/min por cliente.
- Se a Riot estiver fora do ar, contas já acompanhadas são servidas do banco, com aviso.

### Banco de dados

SQLite (módulo nativo do Node, arquivo em `server/data/`). Tabelas: `accounts`,
`matches` (partida completa), `player_matches` (estatísticas individuais),
`match_timelines`, `rank_snapshots`, `champion_mastery`, `sync_log` (histórico de
atualizações), `cache` e, para o treinador, `lesson_progress`, `quiz_attempts`,
`training_activity`, `diagnoses`, `training_plans`, `rank_predictions` e `rank_goals`. Todo o SQL está em `server/src/db/repositories.ts`; para
múltiplos servidores, troque essa camada por PostgreSQL.

## Testes

```bash
npm run typecheck              # app
npm test                       # estatísticas, treinador, relatório, comparação, notificações, cruzamentos, challenge, .rofl e decisões (57 testes)
npm --prefix server test       # backend: Riot simulada, contas, isolamento, RSO, migrações, caderno, challenge, replay e CORS (72 testes)
npm run check:coach            # imprime diagnóstico e previsão das contas demonstrativas
npm --prefix server run smoke -- "Nome#TAG" BR    # ao vivo, com a sua chave
```

Os testes do backend usam respostas no formato dos endpoints da Riot e cobrem: conta
válida e inexistente, região incorreta, elo, coleta e cache de partidas, extração por
PUUID, win rate e KDA, catálogo de imagens, atualização do histórico, snapshots, rate
limit (429 e `Retry-After`), ausência de chave, chave expirada e falha temporária.

Os testes do treinador validam a previsão com sete perfis simulados (70%, 50% e 35% de
vitórias, poucas partidas, desempenho em queda, em evolução e KDA alto com poucas
vitórias), além das propriedades do modelo, das recomendações, do plano semanal e do
ciclo completo aula → partidas novas → reavaliação → nova previsão.
