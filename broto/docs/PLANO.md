# Broto — Plano técnico

**Broto** é um app Android pessoal de hábitos, humor, diário, metas e evolução.
O nome e o mascote (carinhas com um brotinho de folha) formam a identidade
própria, inspirada na estética delicada e verde do DailyBean, sem copiar a interface dele.

## 1. Análise do ambiente

| Item | Situação | Decisão |
|---|---|---|
| Repositório | Só tinha o README do perfil | O app fica em `broto/`, sem mexer no README |
| JDK 21, Gradle 8.14 | Disponíveis | Usados |
| Android SDK / Google Maven (`dl.google.com`, `maven.google.com`) | **Bloqueados pela rede** | Não dá pra usar o Android Gradle Plugin, AndroidX, Compose nem Room |
| Pacotes do Ubuntu (apt) | Liberados | `aapt2`, `dx`, `zipalign` e `apksigner` vêm daí |
| Maven Central | Liberado | Kotlin, JUnit e Robolectric; o `android.jar` (API 34) é extraído do `android-all` |

### Consequência arquitetural

Sem AndroidX/Compose, o app usa **Kotlin + só o framework Android**:

- **UI:** `View`s nativas e componentes próprios desenhados em `Canvas` (gráficos,
  carinhas, chama, calendário, anel de score). Uma DSL Kotlin pequena deixa o código
  das telas declarativo. Isso dá um app leve (~1 MB), rápido, 100% nativo e sem
  dependências de terceiros em runtime além do `kotlin-stdlib`.
- **Banco:** SQLite nativo (`SQLiteOpenHelper`) com chaves estrangeiras, WAL,
  transações e migrações versionadas.
- **Notificações:** `AlarmManager` + `BroadcastReceiver` + `NotificationManager`,
  com reagendamento no boot. Funcionam com o app fechado.
- **PDF:** `android.graphics.pdf.PdfDocument`, offline, com fonte própria (Nunito,
  licença OFL) para os acentos. O mesmo código de desenho dos gráficos serve à tela e ao PDF.
- **Biometria:** `android.hardware.biometrics.BiometricPrompt` (API 28+) e PIN com hash PBKDF2.
- **Compartilhamento:** `ContentProvider` próprio, equivalente ao FileProvider.
- **Build:** tarefas Gradle próprias (`aapt2 compile/link` → `kotlinc` → `dx` →
  `zipalign` → `apksigner`). Comando único: `./gradlew assembleApk`.
- **Testes:** JUnit para a lógica pura (`core`) e Robolectric para banco, telas
  (com captura de tela PNG), PDF e backup, tudo na JVM.

Limitação do `dx`: ele não converte `invokedynamic`. O código é compilado com
`-Xlambdas=class`, e uma verificação no build falha se o app chamar um dos poucos
métodos do `kotlin-stdlib` que dependem disso.

## 2. Arquitetura

```
broto/
├── core/   Kotlin puro, testável na JVM
│   ├── model/       Habit, HabitLog, MoodEntry, JournalEntry, Goal, Settings...
│   ├── schedule/    regras de programação (dias da semana, semanal, pausas, descanso)
│   ├── score/       ScoreEngine (0–100, pesos configuráveis, explicação por componente)
│   ├── streak/      ConsistencyEngine (chamas, sequências, histórico)
│   ├── insights/    InsightsEngine (estatística local: Welch t, Pearson, tamanho de efeito)
│   ├── alerts/      AlertEngine (regras, cooldown, limite diário, horário silencioso)
│   ├── report/      ReportBuilder (agrega dados de um período para o PDF)
│   └── json/        JSON mínimo próprio, usado no backup
└── app/    Android
    ├── data/        BrotoDatabase (SQLite), Repository, Backup, Demo
    ├── ui/          tema, fontes, ícones, DSL, componentes, gráficos
    ├── screens/     Início, Hábitos, Humor, Diário, Análises, Metas, Relatórios, Ajustes
    ├── notify/      agendador, receivers, canais
    ├── pdf/         ReportRenderer (Canvas) + PdfExporter
    └── security/    PIN, biometria, tela de bloqueio
```

## 3. Banco de dados (SQLite, versão 1)

- `habit` (id, name, description, category, emoji, color, kind POS/NEG, tracking
  BOOL/QTY/TIME, unit, target, period DAY/WEEK, frequency DAILY/WEEKLY,
  weekdays bitmask, times_per_week, reminder_min, start_date, paused, archived,
  sort, created_at, demo)
- `habit_pause` (habit_id → habit, from_day, to_day): pausas não contam como falha
- `habit_log` (habit_id → habit, day, value, note, updated_at) — UNIQUE(habit_id, day).
  Sem linha = sem registro. `value = 0` = registrado como não feito / não aconteceu.
- `mood` (day PK, mood 1–5, energy?, stress?, sleep?, emotions csv, note, updated_at, demo)
- `journal` (id, day, title, body, emotions, tags, created_at, updated_at, demo)
- `goal` (id, name, description, category, horizon, created_day, deadline, target,
  current, unit, progress_mode, status, demo) + `goal_step` + `goal_habit`
- `rest_day` (day PK): dias de descanso avulsos (os fixos semanais ficam em settings)
- `daily_score` (day PK, score, positive, negative, wellbeing, computed_at): histórico
- `alert_log` (key, sent_at): evita repetição
- `settings` (key, value): nome, tema, pesos do score, notificações...

## 4. Etapas

0. **Toolchain e plano.** Build de APK sem Google Maven, testes com Robolectric e captura de tela. ✅
1. **Domínio e dados.** Modelos, programação, score, consistência, banco, repositório e testes unitários.
2. **Fundação visual.** Tema claro/escuro, cor de destaque, fontes, ícones, carinhas,
   componentes, navegação inferior. Telas: **Início** e **Hábitos** (CRUD, registro diário, histórico).
3. **Humor** (registro, emoções, calendário mensal com carinhas) e **Diário** (linha do tempo, busca, filtros, reflexões).
4. **Análises.** Evolução 7/30 dias, histórico do score, comparações, "Descobertas sobre mim",
   "Minha Consistência" (chamas) e **Metas**.
5. **Notificações e alertas inteligentes.**
6. **Relatórios PDF** (diário, semanal, mensal, anual, personalizado), com
   personalização, salvar, abrir, compartilhar e gerar de novo.
7. **Backup e restauração** (com senha opcional), snapshots automáticos, bloqueio por PIN/biometria, **Configurações**.
8. **QA geral, dados de demonstração removíveis e APK final.**

Cada etapa termina com testes automatizados, revisão das capturas de tela e um commit.
