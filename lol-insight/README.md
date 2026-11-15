# LOL Insight

App mobile de análise competitiva de League of Legends: busca de contas, elo, histórico
de partidas, gráficos interativos e insights calculados sobre os dados.

- **App:** Expo (SDK 58) + React Native + TypeScript + Expo Router.
- **Backend (`server/`):** Node.js + SQLite. É o único que fala com a Riot Games API e
  o único lugar onde a chave existe.
- **Dois modos**, alternáveis no app em *Perfil → Fonte de dados*:
  - **Demonstração** — conta fictícia `Gregory#BR1`, gerada no aparelho. Não precisa de servidor.
  - **Dados reais** — contas reais, via backend + Riot API.

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
servidor. Depois, na aba **Início**, pesquise um Riot ID completo (`Nome#TAG`) e a região.

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
    data/                   Catálogos e gerador determinístico do modo demonstração
    types/                  Modelos de domínio (compartilhados com o backend)
  server/                   BACKEND
    src/riot/               Cliente HTTP da Riot, rate limiter, endpoints, DTOs
    src/regions.ts          Conversão região → plataforma (br1...) e cluster (americas...)
    src/ddragon.ts          Catálogo do Data Dragon, com cache
    src/services/           Busca de conta, coleta de partidas em segundo plano, normalização
    src/db/                 Esquema SQLite e repositórios
    src/http/               Rotas, validação, CORS, limite por cliente
    test/                   Testes com uma Riot simulada
    scripts/smoke.ts        Verificação ao vivo dos endpoints
  tests/                    Testes do motor estatístico
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
atualizações) e `cache`. Todo o SQL está em `server/src/db/repositories.ts`; para
múltiplos servidores, troque essa camada por PostgreSQL.

## Testes

```bash
npm run typecheck              # app
npm test                       # motor estatístico (16 testes)
npm --prefix server test       # backend, contra uma Riot simulada (33 testes)
npm --prefix server run smoke -- "Nome#TAG" BR    # ao vivo, com a sua chave
```

Os testes do backend usam respostas no formato dos endpoints da Riot e cobrem: conta
válida e inexistente, região incorreta, elo, coleta e cache de partidas, extração por
PUUID, win rate e KDA, catálogo de imagens, atualização do histórico, snapshots, rate
limit (429 e `Retry-After`), ausência de chave, chave expirada e falha temporária.
