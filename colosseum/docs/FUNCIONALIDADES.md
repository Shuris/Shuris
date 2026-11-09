# Funcionalidades — versão 0.1.0

## Implementadas

### Aplicativo desktop
- [x] Aplicativo Electron independente, offline, com janela sem moldura e barra de título própria.
- [x] Instalador NSIS (`.exe`) com ícone próprio, atalhos na área de trabalho e no menu Iniciar,
      escolha da pasta e desinstalador; versão portátil (`.exe`).
- [x] Instância única; ícone na bandeja com menu (mostrar, trocar modo, sempre no topo,
      clique-através, sair).
- [x] Segurança: contextIsolation, sem nodeIntegration, sandbox, IPC validado, CSP, protocolo `app://`.

### Fluxo de jogo
- [x] Tela de apresentação → criação (nome validado, 4 origens com bônus, aparência) → introdução → arena.
- [x] Dicas para iniciantes em cada tela (dispensáveis) e narração da luta no HUD.
- [x] Tela de resultado com vitória/derrota, estatísticas da luta, XP, moedas, reputação,
      item recebido, evolução de nível e adversário desbloqueado.

### Gladiador e progressão
- [x] Nome, nível (1–30), experiência, moedas, reputação (com títulos), atributos, pontos,
      equipamentos, inventário, habilidades e histórico.
- [x] 6 atributos; 3 pontos por nível com planejamento (+/−) e confirmação; sem valores negativos.
- [x] Vitória: XP, moedas, reputação, chance de item (garantido na 1ª vitória contra cada adversário).
- [x] Derrota: pouca XP e moedas, sem perder itens ou níveis. Desistência disponível.
- [x] Recompensas reduzidas contra adversários muito abaixo do nível (evita progressão rápida).
- [x] Histórico das últimas 50 lutas.

### Combate
- [x] Motor determinístico independente da renderização (passos fixos de 50 ms).
- [x] Distância e alcance por arma, aproximação, recuo para manter distância, espera estratégica.
- [x] Preparação, impacto e recuperação de cada golpe; intervalo de ataque.
- [x] Acerto, esquiva (ativa/passiva, limite 35%), bloqueio com escudo ou aparando, críticos,
      atordoamento, recuo por impacto.
- [x] Resistência: custo das ações, recuperação, fadiga e exaustão (quebra de guarda).
- [x] 4 habilidades automáticas: Golpe poderoso, Defesa reforçada, Ataque rápido, Contra-ataque.
- [x] 3 estratégias com efeito real (frequência de ataque, reações, gasto de fôlego, cautela).
- [x] Fim por nocaute, por decisão (limite de 120 s) ou desistência.
- [x] Lutas de ~45–90 s (verificado por simulação), velocidade 1x/2x/3x, lutas contínuas.
- [x] Animações: espera, movimento, ataque, defesa, dano, esquiva, vitória, derrota; números de
      dano, faíscas, poeira, tremor de câmera, aura da Defesa reforçada, torcida animada.

### Equipamentos e treino
- [x] 5 espaços; 27 itens (Gládio, Espada curta, Tridente, Lança, Scutum, Escudo pequeno,
      Capacete de gladiador, Armadura leve, Armadura média, Proteção de pernas e variantes) com
      nome, descrição, categoria, modificadores, preço e raridade (Comum/Incomum/Raro/Épico).
- [x] Equipamentos visíveis no personagem; mercado; inventário com comparação de estatísticas;
      equipar, desequipar e vender.
- [x] 4 treinamentos com custo progressivo, animação no palus e conversão de progresso em +1 atributo.

### Arena e adversários
- [x] Arena romana em pixel art: velário, arcadas, arquibancadas com público animado, camarote
      imperial, pódio decorado, portões, estandartes, braseiros com luz, areia com sombras.
- [x] Pátio de treino (ludus) com colunata, celas, poste de treino e suporte de armas.
- [x] 9 adversários (níveis 1 a 27) com aparência, atributos, equipamentos e estratégias próprios,
      desbloqueados em sequência, com estimativa de chance de vitória.

### Salvamento
- [x] Salvamento automático em `%APPDATA%\Colosseum\saves`, gravação atômica, backup, validação e correção.

### Desktop companion
- [x] Modo completo e modo companion sem recarregar (a luta continua).
- [x] Companion: pequeno, sem bordas, sempre no topo (desativável), redimensionável, arrastável,
      arena + barras de vida/resistência + informações essenciais; câmera que acompanha a luta.
- [x] Minimizar, ocultar, opacidade (Windows/macOS), clique-através.
- [x] Atalhos globais: Ctrl+Shift+M (modo), Ctrl+Shift+X (clique-através), Ctrl+Shift+H (mostrar/ocultar).

## Limitações conhecidas / não verificadas

- O instalador foi **gerado por compilação cruzada no Linux** (Electron Builder + Wine). Os testes
  automatizados rodaram no Linux (Electron real sob Xvfb). **O `.exe` ainda não foi executado
  num Windows real** neste ambiente — recomenda-se o teste manual no Windows 10/11 ou usar o
  workflow do GitHub Actions, que compila num runner Windows.
- Opacidade da janela: suportada pelo Electron apenas no Windows/macOS (no Linux o controle é ocultado).
- O instalador não é assinado digitalmente (o SmartScreen mostrará um aviso).
- A arte é procedural (gerada pelo script do projeto): coerente e própria, mas mais simples do
  que spritesheets desenhadas à mão; a estrutura já permite substituí-las.
- Sem áudio nesta versão.

## Pendentes (próximas versões)

- [ ] Efeitos sonoros e música.
- [ ] Spritesheets desenhadas à mão e mais quadros de animação (ex.: golpes diferentes por arma).
- [ ] Novas arenas e eventos (torneios, desafios diários).
- [ ] Mais habilidades e opção de escolher quais habilidades levar para a luta.
- [ ] Vários espaços de salvamento e exportação/importação do save.
- [ ] Assinatura de código e atualização automática.
- [ ] Opções de acessibilidade (tamanho de fonte, desativar tremor de tela).
