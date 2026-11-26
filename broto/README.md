# 🌱 Broto: hábitos, humor e evolução

Aplicativo Android pessoal de autoconhecimento: hábitos positivos e negativos, humor
e emoções, diário, objetivos, score diário, consistência com chamas, descobertas
estatísticas, notificações inteligentes e relatórios em PDF. Funciona 100% offline,
sem conta e sem enviar dados.

**APK pronto para instalar:** [`release/broto-1.0.1.apk`](release/broto-1.0.1.apk)
(Android 8.0 ou superior).

## Instalação no celular

1. Baixe o arquivo `release/broto-1.0.1.apk` no celular (pelo GitHub, Drive etc.).
2. Abra o arquivo. O Android vai pedir para permitir instalar apps desta fonte.
   Permita para o navegador ou gerenciador de arquivos que você usou.
3. Toque em **Instalar** e abra o Broto.
4. Na primeira abertura, informe seu nome (opcional). Se quiser, explore com dados de
   demonstração (dá para removê-los depois em *Ajustes › Backup e restauração*).
5. Permita as notificações quando o app pedir, para receber lembretes.

> O Play Protect pode avisar que o app é de um "desenvolvedor desconhecido". Isso é
> esperado em apps pessoais assinados localmente. Toque em *Instalar mesmo assim*.

## Funcionalidades

| Área | O que faz |
|---|---|
| **Início** | Saudação, score do dia com explicação, humor em 1 toque, hábitos do dia com marcação rápida, chama de consistência, objetivos e mini gráfico de evolução |
| **Hábitos** | Criar, editar, excluir, pausar (sem contar como falha), arquivar e reordenar. Positivos (sim/não, quantidade, tempo, meta numérica) e negativos (não aconteceu / 1 vez / várias vezes / quantidade / duração, com limite pessoal). Dias da semana ou "X vezes por semana", lembrete, data de início, 12 sugestões prontas, calendário e histórico editáveis |
| **Humor** | Escala de 1 a 5 com carinhas próprias (o brotinho cresce com o humor), energia, estresse, sono, 12 emoções e relato. Calendário mensal de carinhas, resumo do mês e detalhe do dia com o score |
| **Diário** | Várias entradas por dia, título, emoções, tags, sugestões de reflexão, busca, filtro por período e tags, linha do tempo |
| **Análises** | 7, 30, 90 dias ou 1 ano: score (média, melhor histórico, média móvel, médias semanais e mensais), hábitos positivos e negativos, humor e energia, sempre comparando com o período anterior |
| **Descobertas sobre mim** | Teste t de Welch, correlação de Pearson e tamanho de efeito, calculados no aparelho. Exige um mínimo de registros, mostra grau de confiança e lembra que correlação não é causalidade |
| **Minha Consistência** | Chama que cresce (1, 3, 7, 30 e 100 dias), melhor sequência, calendário, histórico de sequências, celebração de marcos. O critério é configurável e há dias de descanso |
| **Objetivos** | Curto, médio e longo prazo; progresso por valor, etapas ou dias de hábitos relacionados; concluir, pausar, reabrir |
| **Notificações** | Lembrete por hábito, lembrete de humor, verificação diária de padrões (hábito parado ou irregular, limite ultrapassado, aumento semanal, humor ou energia baixos) e lembrete de sequência. Limite diário, horário silencioso, sem repetição e linguagem acolhedora |
| **Relatórios PDF** | Diário, semanal, mensal, anual ou personalizado. Capa ilustrada, resumo, tabelas, gráficos, calendários de humor e de atividades, objetivos, descobertas e (opcionalmente) o diário. Estilo colorido ou econômico. Abrir, compartilhar, salvar em… e gerar novamente |
| **Backup** | Backup completo em JSON (opcionalmente com senha: AES-256-GCM), restauração atômica, cópia automática diária (7 últimas), exportação CSV e verificação de integridade |
| **Segurança** | PIN (PBKDF2), biometria, bloqueio temporário após 5 erros, conteúdo oculto em "recentes" |
| **Aparência** | Tema claro, escuro ou do sistema; 6 cores de destaque; fonte Nunito; layout adaptado a celulares pequenos e tablets |

### Regras do score (0 a 100)

- **45%** hábitos positivos, **30%** controle dos negativos e **25%** bem-estar. Os pesos são configuráveis.
- Metas numéricas contam proporcionalmente (60 de 120 min = 50%).
- Negativos: evitar vale 100%; dentro do limite, 70% a 100%; acima do limite, a nota
  cai gradualmente e nunca chega a zerar o dia.
- Informação não registrada não é resultado ruim: humor ausente e negativos sem
  registro são ignorados, e os pesos dos demais componentes são redistribuídos.
- Nada é penalizado fora dos dias programados, antes do início, durante pausas ou em dias de descanso.

## Arquitetura

```
broto/
├── core/   Kotlin puro (testável na JVM): modelos, programação, score, consistência,
│           descobertas (estatística), alertas, resumos de período, JSON
├── app/    Android: SQLite, telas, componentes visuais, notificações, PDF, backup, segurança
├── tools/  setup-toolchain.sh
└── docs/   PLANO.md (plano técnico e etapas)
```

- **Kotlin + framework Android puro.** Nesta máquina de desenvolvimento o repositório
  Maven do Google (AndroidX, Compose, Android Gradle Plugin) estava inacessível. Por
  isso a UI usa só o framework: componentes, gráficos e ilustrações são desenhados em
  `Canvas`. O app tem ~1,8 MB e nenhuma biblioteca de terceiros em runtime além do
  `kotlin-stdlib`.
- **Banco de dados:** SQLite com chaves estrangeiras, WAL, transações e migrações versionadas.
- **Notificações:** `AlarmManager` + `BroadcastReceiver`, reagendadas no boot e ao trocar o fuso.
- **PDF:** `android.graphics.pdf.PdfDocument`, gerado offline.

## Como compilar

Requisitos: JDK 17+, `bash`, Ubuntu/Debian (para as ferramentas Android do apt).

```bash
cd broto
./tools/setup-toolchain.sh      # instala aapt2/dx/zipalign/apksigner e prepara o android.jar (API 34)
./gradlew assembleApk           # gera app/build/apk/broto-1.0.1.apk (assinado)
./gradlew test                  # testes de unidade, banco, UI, PDF, backup e notificações
```

Na primeira compilação é criada uma chave de assinatura em `broto/keystore/broto-release.jks`
(fora do git). **Guarde essa chave:** para atualizar o app sem desinstalar, a nova versão
precisa ser assinada com a mesma chave. Se perdê-la, faça um backup no app, desinstale,
instale a nova versão e restaure o backup.

## Testes

São 71 testes automatizados:

- **core:** score, consistência, alertas, estatística e descobertas, resumos de período e JSON.
- **app (Robolectric):** repositório SQLite, notificações (agendamento e disparo),
  backup (ida e volta, senha, arquivo inválido), PIN e fluxos completos tocando na
  interface: boas-vindas, criação e marcação de hábitos, hábitos negativos, humor,
  diário, objetivos, desbloqueio, troca de tema.
- **Capturas de tela e páginas de relatório:** geradas como PNG em
  `app/build/screenshots/`, inclusive em celular pequeno e tablet.

## Limitações conhecidas

- O app foi verificado com testes automatizados e uma checagem estática de todas as
  chamadas ao framework contra a API 26. Não foi testado num aparelho físico ou
  emulador, porque o ambiente de desenvolvimento não tinha acesso às imagens do Android.
- No ambiente de testes, o PDF é validado renderizando as mesmas páginas como imagem
  (o `PdfDocument` nativo só existe no aparelho).
- Alarmes exatos no Android 12+ dependem da permissão "Alarmes e lembretes". Sem ela,
  os lembretes podem atrasar alguns minutos.
