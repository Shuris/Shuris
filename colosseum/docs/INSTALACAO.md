# Instalação e uso — COLOSSEUM

## Requisitos

- Windows 10 ou Windows 11 (64 bits).
- ~350 MB livres em disco.
- Não precisa de internet para jogar.

## Instalar

1. Execute **`Colosseum-Setup-0.1.0.exe`**.
2. O Windows SmartScreen pode avisar que o aplicativo é de um "editor desconhecido" — isso acontece
   porque o executável ainda não tem assinatura digital (certificado de código). Clique em
   **Mais informações → Executar assim mesmo**.
3. Escolha a pasta de instalação (opcional) e conclua o assistente.
4. O instalador cria atalhos na **área de trabalho** e no **menu Iniciar** ("Colosseum").

**Versão portátil:** `Colosseum-Portatil-0.1.0.exe` roda sem instalar (basta dar dois cliques).
Ela usa a mesma pasta de salvamento da versão instalada.

## Desinstalar

Configurações do Windows → Aplicativos → Colosseum → Desinstalar
(ou "Adicionar ou remover programas"). O desinstalador **não apaga** o seu progresso salvo.

## Onde fica o progresso salvo

O jogo salva automaticamente em:

```
%APPDATA%\Colosseum\saves\gladiador.json         (salvamento principal)
%APPDATA%\Colosseum\saves\gladiador.backup.json  (cópia de segurança anterior)
%APPDATA%\Colosseum\window-settings.json         (posição/tamanho/opções da janela)
```

O caminho exato aparece em **Opções** (barra superior do jogo). Se o arquivo principal for
corrompido, o jogo carrega automaticamente o backup.

## Como jogar (resumo)

1. Na primeira execução: tela de apresentação → criação do gladiador → introdução.
2. **Arena:** escolha estratégia e adversário e clique em **LUTAR!**. A luta é automática.
3. **Gladiador:** distribua os pontos ganhos a cada nível (3 por nível).
4. **Treinamento:** gaste moedas para progredir em Força, Resistência, Agilidade ou Técnica.
5. **Equipamentos:** compre no Mercado e equipe itens. Vitórias podem render equipamentos.
6. **Histórico:** últimas lutas, resultados e recompensas.

Derrotas nunca tiram níveis ou itens: dão um pouco de experiência e moedas.

## Modo companion

- Clique em **Modo companion** na barra superior (ou pressione **Ctrl+Shift+M**).
- A janela fica pequena, sem bordas, no canto da tela e sempre no topo.
- Passe o mouse sobre a janela para ver os controles:
  - arraste pela barra superior para mover; redimensione pelas bordas;
  - **Topo** liga/desliga "sempre no topo";
  - **Opacidade** ajusta a transparência da janela;
  - **Clique** ativa o *clique-através* (a janela passa a ignorar o mouse);
  - **–** minimiza, **Ocultar** esconde a janela, **Expandir** volta ao modo completo;
  - **Lutar** inicia a próxima luta e **Contínuo** liga as revanches automáticas.

### Atalhos globais (funcionam mesmo com o jogo em segundo plano)

| Atalho | Ação |
| --- | --- |
| **Ctrl+Shift+M** | Alternar modo completo / companion |
| **Ctrl+Shift+X** | Ativar/desativar o clique-através |
| **Ctrl+Shift+H** | Mostrar/ocultar a janela |

Se o clique-através estiver ativo, use **Ctrl+Shift+X** ou o **ícone do Colosseum na bandeja do
sistema** (perto do relógio) → desmarque "Ignorar cliques". O ícone da bandeja também permite
mostrar a janela, trocar de modo e sair. O jogo sempre abre no modo completo e o clique-através
nunca fica ativo ao reiniciar, então não há como ficar "preso".

Se algum atalho estiver em uso por outro programa, o jogo avisa ao entrar no modo companion; a
bandeja continua funcionando.

## Reportar problemas

Abra uma *issue* no repositório GitHub do projeto com:

- versão do Windows e do jogo (aparece em **Opções**);
- o que você fez, o que esperava e o que aconteceu;
- se possível, uma captura de tela e uma cópia de `gladiador.json`.
