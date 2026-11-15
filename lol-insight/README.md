# LOL Insight

Protótipo navegável de um app mobile de análise competitiva de League of Legends:
gráficos interativos, estatísticas detalhadas e insights calculados sobre o histórico
de um jogador. Feito com **Expo (SDK 58) + React Native + TypeScript + Expo Router**.

> Os dados são demonstrativos (conta fictícia `Gregory#BR1`). LOL Insight não é
> endossado pela Riot Games.

## Como abrir no celular Android

Pré-requisitos no computador: Node.js 20+ e Git. No celular: o app **Expo Go** (Play Store).

```bash
git clone <url-do-repositorio>
cd Shuris/lol-insight
npm install
npx expo start
```

1. O terminal mostra um QR code.
2. Com o celular **na mesma rede Wi-Fi** do computador, abra o Expo Go e toque em
   **Scan QR code**.
3. O app carrega no aparelho; alterações no código atualizam na hora.

Se o celular não alcançar o computador (rede corporativa, Wi-Fi isolado), use o túnel:

```bash
npx expo start --tunnel
```

Outras formas de rodar:

| Comando | O que faz |
| --- | --- |
| `npm run android` | Abre em um emulador/aparelho Android conectado por USB |
| `npm run web` | Abre no navegador (use o modo responsivo para simular o celular) |
| `npx eas-cli build -p android --profile preview` | Gera um **APK** instalável (requer conta Expo gratuita) |

## O que há no app

| Seção | Conteúdo |
| --- | --- |
| **Início** | Busca por invocador + região, cartão da conta (elo, LP, melhor elo), indicadores, gráfico de evolução (LP ou taxa de vitória; 7/15/30/90 dias), prévia de insights e últimas partidas |
| **Desempenho** | 7 gráficos com filtro de período: KDA, taxa de vitória (com comparação entre períodos), posições, mapa de calor de horários, farm, indicadores de combate e consistência |
| **Campeões** | "Seus melhores campeões", biblioteca ordenável e tela individual (evolução, KDA por período, matchups, posições, histórico) |
| **Partidas** | Histórico completo com filtros (resultado, campeão, posição, modo, período) e análise da partida: resumo, equipes, build/runas/habilidades e linha do tempo |
| **Perfil** | Conta, histórico de elos, destaques, estatísticas de carreira e **identidade competitiva** calculada |
| **Insights** | Observações geradas a partir dos dados, cada uma com tamanho de amostra e confiança |

Contas demonstrativas para testar a busca: `Gregory#BR1` (região BR) e `Yuna#KR1` (região KR).
Qualquer outro nome mostra o estado "invocador não encontrado".

## Arquitetura

```
src/
  app/          Rotas (Expo Router): abas, campeão/[id], partida/[id], insights
  screens/      Telas — só composição de interface
  components/   Componentes reutilizáveis
    charts/     Gráficos próprios em react-native-svg (linha, barras, mapa de calor, radar)
    ui/         Cartões, controles, esqueletos, estados vazios, painéis
  state/        PlayerContext: conta carregada + estatísticas derivadas
  services/     Contrato PlayerDataSource, fonte simulada, cliente da API real, persistência
  stats/        Lógica estatística pura (sem React): agregações, séries, identidade, insights
  data/         Catálogos estáticos e gerador determinístico de partidas
  types/        Modelos de domínio
  theme/        Tokens de design (cores, tipografia, espaçamento)
```

### Dados demonstrativos

`src/data/mock/generator.ts` simula 90 dias de sessões de jogo a partir de uma
**semente fixa** — os mesmos dados em toda execução, nada é sorteado ao renderizar.
Todos os números exibidos são **calculados** a partir das partidas (`src/stats`),
por isso vitórias + derrotas = total, o placar das equipes fecha com o K/D/A dos dez
jogadores e o histórico de LP termina exatamente no elo atual.

`npm run check:data` imprime um resumo e valida essa coerência.

### Insights e identidade competitiva

- `src/stats/insights.ts`: cada regra exige amostra mínima e efeito relevante. O que
  não passa aparece em "Análises sem conclusão" com o motivo — nunca vira afirmação.
- `src/stats/identity.ts`: sete traços (0–100) comparando cada partida com uma
  referência da posição jogada; o traço dominante define a classificação.

### Trocar para dados reais da Riot

As telas dependem apenas da interface `PlayerDataSource` (`src/services`).

1. Crie um backend/proxy que guarde a chave da Riot API no servidor, consulte
   Account-V1, League-V4 e Match-V5 e devolva um `PlayerBundle` (`src/types`).
2. Copie `.env.example` para `.env.local` e defina `EXPO_PUBLIC_DATA_SOURCE=riot` e
   `EXPO_PUBLIC_API_BASE_URL`.

Nenhuma chave de API fica no app, e não há scraping de terceiros. As imagens de
campeões e itens vêm do Data Dragon (CDN pública da Riot); sem rede, o app mostra
um avatar desenhado localmente.

## Verificações

```bash
npm run typecheck    # TypeScript
npm run check:data   # coerência dos dados demonstrativos
```
