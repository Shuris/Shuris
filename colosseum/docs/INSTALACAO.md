# Instalação e uso — COLOSSEUM

## Requisitos

- Windows 10 ou 11 (64 bits), ~350 MB livres. Não precisa de internet.

## Instalar

1. Execute **`Colosseum-Setup-0.2.0.exe`**.
2. Se o SmartScreen avisar "editor desconhecido" (o instalador ainda não tem assinatura
   digital), clique em **Mais informações → Executar assim mesmo**.
3. Conclua o assistente. São criados atalhos na **área de trabalho** e no **menu Iniciar**.

**Versão portátil:** `Colosseum-Portatil-0.2.0.exe` roda sem instalar.

## Desinstalar

Configurações → Aplicativos → Colosseum → Desinstalar. O progresso salvo não é apagado.

## Progresso salvo

```
%APPDATA%\Colosseum\saves\gladiador.json         (principal)
%APPDATA%\Colosseum\saves\gladiador.backup.json  (cópia de segurança)
%APPDATA%\Colosseum\window-settings.json         (tamanho da janela, tela cheia)
```

## Como jogar

1. Crie seu gladiador (nome, origem, aparência).
2. **Arena:** escolha o adversário e clique em **LUTAR**. A luta é automática.
3. **Gladiador:** use os 3 pontos ganhos a cada nível.
4. **Treino** e **Itens:** gaste moedas para ficar mais forte.

Cada par de adversários luta num anfiteatro diferente. Derrotas nunca tiram níveis ou itens.

## Controles e opções

| Ação | Como |
| --- | --- |
| Tela cheia | botão **Tela cheia** ou **F11** (sair: **Esc** ou **F11**) |
| Som | botão **Som** na barra superior; volume em **Opções** |
| Dia e noite | **Opções → Rápido (10 min)** ou **Hora do PC** |
| Velocidade da luta | botões **1x / 2x / 3x** durante a batalha |

## Reportar problemas

Abra uma *issue* no repositório com a versão (em **Opções**), os passos, uma captura de tela
e, se possível, uma cópia de `gladiador.json`.
