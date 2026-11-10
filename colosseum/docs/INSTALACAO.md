# Instalação e uso — COLOSSEUM

## Requisitos

- Windows 10 ou 11 (64 bits), ~350 MB livres. Não precisa de internet.

## Instalar

1. Execute **`Colosseum-Setup-0.4.0.exe`**.
2. Se o SmartScreen avisar "editor desconhecido" (o instalador ainda não tem assinatura
   digital), clique em **Mais informações → Executar assim mesmo**.
3. Conclua o assistente. São criados atalhos na **área de trabalho** e no **menu Iniciar**.

**Versão portátil:** `Colosseum-Portatil-0.4.0.exe` roda sem instalar.

## Desinstalar

Configurações → Aplicativos → Colosseum → Desinstalar. O progresso salvo não é apagado.

## Progresso salvo

```
%APPDATA%\Colosseum\saves\gladiador.json         (principal)
%APPDATA%\Colosseum\saves\gladiador.backup.json  (cópia de segurança)
%APPDATA%\Colosseum\window-settings.json         (tamanho da janela, tela cheia)
```

## Como jogar

1. Crie seu gladiador. Você começa no **Alojamento**, na segunda-feira (dia 1), às 8h.
2. Use o **Mapa** para ir aos locais (cada viagem leva 20 minutos):
   - **Ludus:** treinar de graça (−12 energia, 1 hora).
   - **Mercado:** comprar e vender (7h–20h, fechado aos domingos; equipe na ficha **Gladiador**).
   - **Arena:** lutar (−35 energia, 2 horas; aberta das 7h às 20h).
   - **Templo de Marte:** o monge Aurelius ensina a árvore de habilidades (1 ponto por nível).
   - **Fórum:** edições do jornal **Folha Diurna**.
   - **Termas:** pague para recuperar energia.
   - **Alojamento:** durma até o dia seguinte (energia cheia às 7h) ou cochile.
3. Nenhuma ação passa da meia-noite: à noite, volte para dormir.
4. Toda manhã sai o jornal. Fique famoso para virar manchete!

Cada par de adversários luta num anfiteatro diferente. Derrotas nunca tiram níveis ou itens.

## Controles e opções

| Ação | Como |
| --- | --- |
| Tela cheia | botão **Tela cheia** ou **F11** (sair: **Esc** ou **F11**) |
| Som | botão **Som** na barra superior; volume em **Opções** |
| Velocidade da luta | botões **1x / 2x / 3x** durante a batalha |

## Reportar problemas

Abra uma *issue* no repositório com a versão (em **Opções**), os passos, uma captura de tela
e, se possível, uma cópia de `gladiador.json`.
