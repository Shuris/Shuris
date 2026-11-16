# LOL Insight

App mobile de análise e desenvolvimento competitivo para League of Legends: busca de
contas, elo, histórico de partidas, gráficos interativos, insights, uma escola integrada
(**LOI Academy**) e previsão de evolução de elo (**Rank Predictor**).

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
npm test                       # motor estatístico e treinador (44 testes)
npm --prefix server test       # backend: Riot simulada, contas, isolamento, RSO e migrações (64 testes)
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
