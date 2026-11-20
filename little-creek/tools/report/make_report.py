"""Generates docs/Little_Creek_Relatorio_Prototipo.pdf (status report with visuals).

Run from the project root:  python3 tools/report/make_report.py <images_dir>
<images_dir> must contain: reference.jpg, palette.png, water_zoom.png,
s4_detail.png, props.png, creatures.png, ui.png and the self-test panel
screenshots (04_upgrades_panel.png, 06_info_panel.png, 03_placing_ghost.png),
ar1.png (20:9) and ar2.png (4:3).
"""
import json
import os
import sys

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (Image, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate,
                                Spacer, Table, TableStyle)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
IMG = sys.argv[1] if len(sys.argv) > 1 else "."
SHOTS = os.path.join(ROOT, "docs", "screenshots")
OUT = os.path.join(ROOT, "docs", "Little_Creek_Relatorio_Prototipo.pdf")

FD = "/usr/share/fonts/truetype/dejavu/"
pdfmetrics.registerFont(TTFont("DV", FD + "DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("DVB", FD + "DejaVuSans-Bold.ttf"))
pdfmetrics.registerFont(TTFont("DVM", FD + "DejaVuSansMono.ttf"))
pdfmetrics.registerFontFamily("DV", normal="DV", bold="DVB", italic="DV", boldItalic="DVB")

GREEN = colors.HexColor("#1f5131")
TEAL = colors.HexColor("#234748")
LIGHT = colors.HexColor("#eef3e6")
MUTED = colors.HexColor("#55796b")

ss = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=ss["Heading1"], fontName="DVB", fontSize=17, textColor=GREEN,
                    spaceBefore=6, spaceAfter=8)
H2 = ParagraphStyle("H2", parent=ss["Heading2"], fontName="DVB", fontSize=12.5, textColor=TEAL,
                    spaceBefore=10, spaceAfter=5)
B = ParagraphStyle("B", parent=ss["BodyText"], fontName="DV", fontSize=9.6, leading=13.6, spaceAfter=5)
BUL = ParagraphStyle("BUL", parent=B, leftIndent=12, bulletIndent=2, spaceAfter=2)
CAP = ParagraphStyle("CAP", parent=B, fontSize=8.2, leading=11, textColor=MUTED, alignment=TA_CENTER,
                     spaceAfter=10)
TC = ParagraphStyle("TC", parent=B, fontSize=8.2, leading=10.6, spaceAfter=0)
TH = ParagraphStyle("TH", parent=TC, fontName="DVB", textColor=colors.white)
CODE = ParagraphStyle("CODE", parent=B, fontName="DVM", fontSize=7.8, leading=10.2,
                      backColor=colors.HexColor("#f2f4ef"), borderPadding=5, spaceAfter=8)
TITLE = ParagraphStyle("TITLE", parent=H1, fontSize=30, leading=36, alignment=TA_CENTER, spaceAfter=4)
SUB = ParagraphStyle("SUB", parent=B, fontSize=12, alignment=TA_CENTER, textColor=TEAL)

W = A4[0] - 3.6 * cm


def p(t, st=B):
    return Paragraph(t, st)


def bullets(items):
    return [Paragraph(i, BUL, bulletText="•") for i in items]


def img(path, width=W, max_h=None, caption=None):
    im = PILImage.open(path)
    w, h = im.size
    dw = width
    dh = dw * h / w
    if max_h and dh > max_h:
        dh = max_h
        dw = dh * w / h
    flow = [Image(path, width=dw, height=dh)]
    if caption:
        flow.append(Paragraph(caption, CAP))
    return KeepTogether(flow)


def table(rows, widths, header=True):
    data = [[Paragraph(str(c), TH if (header and i == 0) else TC) for c in r] for i, r in enumerate(rows)]
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    style = [
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#c9d4c0")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
    ]
    if header:
        style.append(("BACKGROUND", (0, 0), (-1, 0), TEAL))
    t.setStyle(TableStyle(style))
    return t


def side_by_side(paths, caps, total=W, gap=0.4 * cm, max_h=None):
    n = len(paths)
    cw = (total - gap * (n - 1)) / n
    cells = []
    for pth, cap in zip(paths, caps):
        im = PILImage.open(pth)
        w, h = im.size
        dh = cw * h / w
        dw = cw
        if max_h and dh > max_h:
            dh = max_h
            dw = dh * w / h
        cells.append([Image(pth, width=dw, height=dh), Paragraph(cap, CAP)])
    t = Table([[c for c in cells]], colWidths=[cw + (gap if i < n - 1 else 0) for i in range(n)])
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                           ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    return t


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("DV", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(1.8 * cm, 1.1 * cm, "Little Creek — relatório de estado do protótipo v0.1.0")
    canvas.drawRightString(A4[0] - 1.8 * cm, 1.1 * cm, "página %d" % doc.page)
    canvas.restoreState()


def J(name):
    with open(os.path.join(ROOT, "data", name)) as f:
        return json.load(f)


items = J("items.json")
upgrades = J("upgrades.json")
stages = J("stages.json")
species = J("species.json")

S = []
# ------------------------------------------------------------ cover
S += [Spacer(1, 1.2 * cm), p("Little Creek", TITLE),
      p("Relatório de estado do protótipo mobile — versão 0.1.0", SUB), Spacer(1, 0.2 * cm),
      p("20 de novembro de 2026 · Godot 4.7.2 · Android (landscape)", SUB), Spacer(1, 0.8 * cm),
      img(os.path.join(SHOTS, "03_estagio4.png"),
          caption="Captura real do jogo (renderizador Compatibility, 1280×720): estágio 4 — Refúgio Natural, "
                  "com trilha, visitantes, veado bebendo na margem, pássaros, borboletas e peixes."),
      Spacer(1, 0.4 * cm)]
S.append(p("<b>Para que serve este documento.</b> Ele descreve, de forma autossuficiente, o que o protótipo "
           "<i>Little Creek</i> já é: conceito, direção de arte, sistemas e seus números, arquitetura de código, "
           "o que foi testado, o que não foi e os próximos passos. Foi escrito para que outra IA (por exemplo, o "
           "ChatGPT) ou um desenvolvedor consiga continuar o trabalho sem acesso à conversa original. Todas as "
           "imagens são capturas reais do jogo ou dos assets gerados, salvo a imagem de referência artística."))
S.append(PageBreak())

# ------------------------------------------------------------ 1 summary
S.append(p("1. Resumo executivo", H1))
S += bullets([
    "<b>Gênero:</b> gerenciamento de ecossistema (semi-clicker + idle + simulação de natureza), relaxante e "
    "contemplativo. O jogador transforma um riacho abandonado num refúgio natural.",
    "<b>Estado:</b> protótipo <b>jogável do início ao fim</b> (4 estágios), com economia, construção, 6 espécies "
    "de animais com comportamento, visitantes humanos, interface mobile, áudio, salvamento e progresso offline.",
    "<b>Plataforma:</b> Godot 4.7.2 (GDScript), renderizador <i>GL Compatibility</i>, Android, horizontal, "
    "referência 1280×720 com adaptação a 16:9, 20:9 e 4:3. APK assinado (arm64-v8a + armeabi-v7a, minSdk 24, "
    "targetSdk 36, ~54 MB) foi gerado e verificado com apksigner.",
    "<b>Arte:</b> 100% pixel art gerada por código (Python + numpy) a partir de uma paleta única extraída da "
    "imagem de referência. Nada de assets de terceiros (exceto a fonte Pixelify Sans, licença OFL).",
    "<b>Testes:</b> autoteste automatizado com 14 verificações (input real de toque, menus, construção, "
    "melhorias, progressão, fauna, save/load, offline) — 14/14 passando. Verificação visual por capturas em "
    "três proporções de tela.",
    "<b>Não verificado:</b> execução em aparelho Android físico (desempenho, toque real, retorno do segundo "
    "plano) e escuta humana do áudio sintetizado. O balanceamento não passou por playtest.",
    "<b>Código:</b> repositório Shuris/Shuris, branch <font face='DVM'>ccr-ae76f537-1qhwmg</font>, pasta "
    "<font face='DVM'>little-creek/</font>.",
])

S.append(p("2. Conceito e loop de jogo", H2))
S.append(p("O jogo começa num riacho de água turva, solo seco e quase sem vida. O jogador toca na água para "
           "coletar <b>Água</b> (moeda principal), recebe produção passiva contínua e investe em elementos "
           "físicos (plantas, pedras, troncos, árvores, plantas aquáticas) e em melhorias. Cada escolha altera "
           "indicadores ecológicos (qualidade da água, vitalidade, biodiversidade, beleza), que por sua vez "
           "mudam a aparência do cenário e determinam quais animais passam a viver ali. A biodiversidade "
           "multiplica a produção, fechando o ciclo."))
S.append(table([
    ["Momento", "Ação do jogador", "Resposta do jogo"],
    ["Curto (segundos)", "Tocar na água, tocar em animais e plantas", "Respingo, número flutuante, som; animal reage (canta, foge); folhas balançam"],
    ["Médio (minutos)", "Escolher e posicionar elementos; comprar melhorias", "Elemento surge com animação; chão 'brota' aos poucos; água clareia; novas espécies chegam"],
    ["Longo (sessões)", "Cumprir requisitos de estágio", "Banner de estágio, mudanças visuais grandes (musgo, pólen, peixes, veado, trilha, visitantes)"],
    ["Ausência", "Fechar o jogo", "Produção offline (60%, limitada) e tela de boas-vindas com o ganho"],
], [3 * cm, 6 * cm, W - 9 * cm]))
S.append(PageBreak())

# ------------------------------------------------------------ 3 art
S.append(p("3. Direção artística", H1))
S.append(p("A direção artística é a prioridade máxima do projeto. A imagem de referência fornecida pelo autor "
           "(riacho com cascatas em floresta, pixel art pictórica) foi analisada e transformada no documento "
           "<font face='DVM'>docs/ART_DIRECTION.md</font>, usado como padrão por todos os geradores. O objetivo foi "
           "reproduzir a <i>linguagem</i> da referência num cenário original em 16:9, não copiar a composição."))
S.append(side_by_side([os.path.join(IMG, "reference.jpg"), os.path.join(SHOTS, "02_estagio3.png")],
                      ["Referência oficial (estilo, não composição).",
                       "Resultado no jogo (estágio 3): mesma paleta, luz do alto à direita, névoa teal, rochas "
                       "ocre com musgo, cascatas com espuma creme."], max_h=8.5 * cm))
S.append(p("Regras extraídas da referência", H2))
S.append(table([
    ["Aspecto", "Observado na referência", "Regra aplicada no jogo"],
    ["Densidade", "Blocos de ~4 px numa imagem de 736 px (~185 px de arte na largura)",
     "Mundo de 800×360 px de arte (área segura 640×360) exibido em escala inteira ×2 (×3 em 1080p). Filtro nearest, sem mipmaps."],
    ["Formas", "Folhagem em tufos de 3–6 px, sem contorno preto", "Tufos procedurais sombreados por normal; contornos usam a cor mais escura da própria rampa."],
    ["Luz", "Sol no alto à direita, raios volumétricos, tons quentes", "Direção global (0.62, −0.78); raios em shader quantizado com dithering Bayer."],
    ["Sombras", "Azul-esverdeadas, nunca cinza neutro", "Rampa de sombra #111d25 → #24393c."],
    ["Profundidade", "Frente escura e saturada; fundo claro, teal, enevoado", "4 planos com perspectiva atmosférica (rampas se aproximam da névoa com a distância)."],
    ["Água", "Teal com cristas claras horizontais, espuma creme", "Shader de flow map quantizado numa rampa fixa de 10 cores; espuma #f1f3e0."],
], [2.4 * cm, 6 * cm, W - 8.4 * cm]))
S.append(Spacer(1, 0.3 * cm))
S.append(img(os.path.join(IMG, "palette.png"), width=9 * cm,
             caption="Paleta mestre (tools/art/palette.py), linhas: sombras, folhagem, teal, névoa, rocha, musgo, "
                     "água limpa, água turva, grama, vegetação seca. Única fonte de cor de todos os assets e shaders."))
S.append(p("Técnicas de produção", H2))
S += bullets([
    "<b>Sombreamento por normal quantizado</b> com dithering ordenado de baixa amplitude: gradientes suaves sem blur.",
    "<b>Mapa de luz salpicada compartilhado</b> por chão, água e pedras, para iluminação coerente entre camadas.",
    "<b>Animação compatível com pixel art</b>: shaders rodam num SubViewport de resolução nativa; o balanço do vento "
    "desloca linhas inteiras de pixels; a água é quantizada na paleta.",
    "<b>Evolução por dissolução</b>: chão, pedras e folhagem de borda têm versão seca e viçosa; um shader troca pixels "
    "em aglomerados orgânicos conforme a vitalidade, então o verde parece brotar.",
])
S.append(PageBreak())

# ------------------------------------------------------------ 4 scene
S.append(p("4. Cenário, água e progressão visual", H1))
S.append(p("Camadas de trás para frente: céu e floresta distante (névoa) → floresta média → chão (seco/viçoso) → "
           "trilha (estágio 4) → água (shader) → peixes (recortados pela máscara da água) → rochas do riacho "
           "(nuas/musgosas) → árvores médias → banda de névoa → entidades com Y-sort (árvores-moldura, elementos "
           "do jogador, veado, visitantes) → raios de sol → partículas (poeira, pólen, folhas) → folhagem de "
           "primeiro plano (embaixo e no topo, com balanço) → pássaros e insetos voando → efeitos."))
S.append(img(os.path.join(IMG, "water_zoom.png"), width=11 * cm,
             caption="Detalhe ampliado da água (captura do jogo). Flow map em duas fases (sem esticar com o tempo), "
                     "cristas de luz, vales escuros, espuma em aglomerados na base das quedas e ao redor das pedras, "
                     "brilhos do sol, leito visível nas partes rasas, reflexo escuro nas margens."))
S.append(p("O riacho é descrito por nós (y, centro, meia-largura) e três quedas. A partir disso o gerador produz: "
           "flow map (direção e velocidade), mapa de metadados (queda, espuma, profundidade, luz), textura do "
           "leito, mapa de zonas de construção e <font face='DVM'>data/scene_points.json</font> (poleiros, pontos "
           "onde o veado bebe, trilha, faixas dos peixes). Assim arte e jogabilidade não saem de sincronia."))
S.append(PageBreak())
S.append(p("Evolução por estágio (capturas reais)", H2))
S.append(img(os.path.join(SHOTS, "01_estagio1.png"), max_h=8.6 * cm,
             caption="Estágio 1 — Riacho Abandonado: água turva oliva, campo seco ocre, pouca vida (um sabiá visita "
                     "às vezes). Pobre em vida, mas ainda bonito, como pedido no briefing."))
S.append(img(os.path.join(SHOTS, "02_estagio3.png"), max_h=8.6 * cm,
             caption="Estágio 3 — Ecossistema: chão verde 'brotado', musgo nas pedras, água turquesa cristalina, "
                     "árvores e arbustos plantados, veado na margem."))
S.append(img(os.path.join(IMG, "s4_detail.png"), max_h=6.5 * cm,
             caption="Estágio 4 — detalhe: trilha revelada em aglomerados, visitantes caminhando, banco, comedouro, "
                     "saíra cantando (nota musical), veado."))
S.append(PageBreak())

# ------------------------------------------------------------ 5 systems
S.append(p("5. Sistemas de jogo (valores atuais)", H1))
S.append(p("Fonte: <font face='DVM'>scripts/systems/EcosystemRules.gd</font>, <font face='DVM'>scripts/autoload/GameState.gd</font> "
           "e <font face='DVM'>data/*.json</font>. O balanceamento é inicial e não passou por playtest."))
S.append(p("Recursos e indicadores", H2))
S.append(table([
    ["Indicador", "Como é calculado / obtido", "Para que serve"],
    ["Água (moeda)", "Toque; produção passiva; doações de visitantes", "Construir e comprar melhorias"],
    ["Sementes", "Produção passiva, plantas, 6% de chance por toque", "Plantas e árvores"],
    ["Qualidade da água (0–100)", "12 + 9 por nível de filtro + 6 por planta aquática (máx. 36) + troncos/samambaias/grama (pequeno)",
     "Vitalidade, peixes, libélulas, cor e clareza da água"],
    ["Vitalidade (0–100%)", "0,4 × qualidade + 62 × (1 − e^(−vegetação/42))", "Estágios, fauna, dissolução seco→viçoso, musgo"],
    ["Biodiversidade", "Nº de espécies presentes: tipos de planta + musgo (vitalidade ≥ 30) + animais elegíveis", "Multiplicador de produção, estágios, veado"],
    ["Beleza", "Soma da beleza dos elementos + bônus do estágio (0/4/8/14)", "Estágios"],
    ["Reputação", "Ações de visitantes (fotos, banco, comedouro, contemplar)", "+0,1% de produção por ponto"],
], [3.3 * cm, 7.6 * cm, W - 10.9 * cm]))
S.append(p("Fórmulas de produção", H2))
S.append(p("Água/s = (0,5 + 0,35·nascente + 0,008·qualidade + 0,02·plantas) × mult<br/>"
           "mult = (1 + 0,05·biodiversidade·(1 + 0,15·corredor)) × (1 + bônus do estágio: 0 / 0,15 / 0,35 / 0,6) × (1 + 0,001·reputação)<br/>"
           "Sementes/s = (0,03 + 0,04·banco de sementes + Σ sementes das plantas) × (1 + 0,03·biodiversidade)<br/>"
           "Toque = (1 + nível de 'Mãos na água') × (1 + 0,05·biodiversidade)<br/>"
           "Custo de construção cresce 7% por unidade do mesmo tipo · Offline: 60% da produção, limite de 2 h + 1 h por nível de 'Ciclo das chuvas'.",
           CODE))
S.append(p("Estágios", H2))
names = {"beauty": "Beleza", "vitality": "Vitalidade", "biodiversity": "Biodiversidade"}
rows = [["Estágio", "Requisitos", "Descrição no jogo"]]
for st in stages:
    req = ", ".join("%s %s%s" % (names[k], v, "%" if k == "vitality" else "") for k, v in st["req"].items()) or "—"
    rows.append(["%d · %s" % (st["id"], st["name"]), req, st["desc"]])
S.append(table(rows, [3.8 * cm, 5 * cm, W - 8.8 * cm]))
S.append(p("Melhorias", H2))
rows = [["Melhoria", "Efeito", "Custo base", "Cresc.", "Máx.", "Libera"]]
for u in upgrades:
    c = u["base_cost"]
    rows.append([u["name"], u["desc"], "%d água%s" % (c["water"], (" + %d sem." % c["seeds"]) if c["seeds"] else ""),
                 "×%.2f" % u["growth"], u["max_level"], "est. %d" % u["unlock_stage"]])
S.append(table(rows, [3.6 * cm, 5.6 * cm, 2.7 * cm, 1.3 * cm, 1.1 * cm, W - 14.3 * cm]))
S.append(PageBreak())

S.append(p("Elementos de construção (13)", H2))
rows = [["Elemento", "Custo base", "Beleza", "Vida", "Zona", "Efeito ecológico", "Est."]]
for k, it in items.items():
    c = it["cost"]
    fx = []
    if it.get("quality"):
        fx.append("limpa a água (+%d qualidade)" % it["quality"])
    if it.get("flower"):
        fx.append("atrai borboletas")
    if it.get("perch"):
        fx.append("poleiro de pássaros")
    if it.get("seed_rate"):
        fx.append("+%.3f sementes/s" % it["seed_rate"])
    if it.get("poi"):
        fx.append("ponto de visitantes (%s)" % it["poi"])
    if it.get("moss"):
        fx.append("ganha musgo")
    if it.get("species"):
        fx.append("espécie: %s" % it["species"])
    rows.append([it["name"], "%d água%s" % (c["water"], (" + %d sem." % c["seeds"]) if c["seeds"] else ""),
                 it["beauty"], it["vitality"], "água" if it["zone"] == "water" else "terra",
                 "; ".join(fx), it["unlock_stage"]])
S.append(table(rows, [3.2 * cm, 2.7 * cm, 1.2 * cm, 1 * cm, 1.1 * cm, W - 10.2 * cm, 1 * cm]))
S.append(Spacer(1, 0.2 * cm))
S.append(img(os.path.join(IMG, "props.png"), caption="Sprites dos elementos construíveis (variantes e versões com musgo), "
                                                       "ampliados 2×. Ancoragem na base, sombra de contato embutida."))
S.append(p("A colocação usa um 'fantasma' verde/vermelho que segue o dedo e é validada por "
           "<font face='DVM'>zones.png</font> (terra firme longe da água e das pedras; água calma para plantas "
           "aquáticas; trilha bloqueada no estágio 4) e por distância mínima entre elementos. Há modo de remoção "
           "com reembolso de 50%."))
S.append(PageBreak())

# ------------------------------------------------------------ 6 fauna
S.append(p("6. Fauna e visitantes", H1))
S.append(p("Um <i>WildlifeDirector</i> reavalia o ecossistema a cada 2,5 s, calcula a população-alvo de cada espécie "
           "e faz animais chegarem ou partirem aos poucos (eles entram e saem voando ou andando pela borda da tela, "
           "nunca somem no lugar). Na primeira aparição, a espécie entra no diário com aviso na tela."))
cond = {
    "sabia": ("Sempre (1 no início; mais com árvores e vitalidade, até 5)", "Voa em arco, pousa em copas/árvores/pedras/comedouro, bica, canta (som + nota), troca de poleiro, vai embora"),
    "saira": ("Arbusto + vitalidade 35%", "Mesmo comportamento do sabiá, canto agudo"),
    "butterfly": ("2+ flores + vitalidade 20%", "Voo ondulado entre flores, pousa e abre/fecha as asas"),
    "dragonfly": ("Qualidade 35 + planta aquática", "Disparos rápidos sobre a água, paira, toca a superfície (ondulação)"),
    "fish": ("Qualidade 45 + planta aquática", "Nada sob a superfície (shader recorta pela máscara da água e tinge), pausa, foge de toques"),
    "deer": ("Vitalidade 55%, 8 espécies, 4+ árvores/arbustos", "Evento a cada 50–110 s: sai da mata, caminha até a margem, observa, baixa a cabeça e bebe, olha em volta, volta; foge se tocado"),
}
rows = [["Espécie", "Condição para viver no riacho", "Comportamento implementado"]]
for k, (c, b) in cond.items():
    rows.append([species[k]["name"], c, b])
S.append(table(rows, [3.3 * cm, 4.8 * cm, W - 8.1 * cm]))
S.append(Spacer(1, 0.3 * cm))
S.append(img(os.path.join(IMG, "creatures.png"),
             caption="Folhas de sprite (ampliadas 4×): sabiá e saíra (pousado, piscar, bicar, cantar, voo), borboletas "
                     "em 4 cores, libélula, lambari, veado (parado, orelha, cauda, alerta, caminhada de 6 quadros, "
                     "baixar cabeça, beber) e 3 visitantes (parado, caminhada, sentado, foto, alimentar, observar)."))
S.append(p("Visitantes (estágio 4)", H2))
S += bullets([
    "No máximo 2 ao mesmo tempo, um a cada 25–55 s. Percorrem a trilha nos dois sentidos.",
    "Roteiro sorteado: contemplar o riacho no mirante natural da trilha, sentar no banco (se houver), alimentar "
    "pássaros no comedouro (um pássaro vem ao comedouro), fotografar no mirante construído.",
    "Fotos com animais por perto valem mais (o veado vale mais que os outros). Cada ação gera doação de água e reputação, "
    "mostradas como texto flutuante.",
])
S.append(PageBreak())

# ------------------------------------------------------------ 7 UI
S.append(p("7. Interface mobile", H1))
S += bullets([
    "Bordas apenas: recursos no canto superior esquerdo, cartão de estágio (progresso + vitalidade, "
    "biodiversidade e beleza) no superior direito, 4 botões redondos (Construir, Melhorias, Ecossistema, Info) "
    "no inferior direito. O centro do riacho fica livre.",
    "Menus em gaveta inferior com animação de abertura/fechamento e rolagem horizontal por arraste.",
    "Pixel art na mesma escala do mundo (texturas desenhadas a 1× e ampliadas 2×), fonte Pixelify Sans sem "
    "antialiasing, 19 ícones desenhados para o jogo.",
    "Feedback: números flutuantes, avisos empilhados, banner de estágio, diálogo de boas-vindas com o ganho offline, "
    "dicas iniciais contextuais (tocar na água, construir, filtrar, meta do estágio 2), sons de clique e erro.",
])
S.append(side_by_side([os.path.join(SHOTS, "04_construir.png"), os.path.join(IMG, "04_upgrades_panel.png")],
                      ["Construir: prévia em pixel, custo (vermelho se faltar), efeitos, cadeado por estágio.",
                       "Melhorias: nível, descrição, custo e botão."]))
S.append(side_by_side([os.path.join(SHOTS, "05_ecossistema.png"), os.path.join(IMG, "06_info_panel.png")],
                      ["Ecossistema: indicadores, checklist do próximo estágio, diário de espécies (silhuetas + dicas).",
                       "Info: volumes de música e efeitos, velocidade do tempo ×1/×5/×20 (teste), apagar progresso, ajuda."]))
S.append(side_by_side([os.path.join(IMG, "03_placing_ghost.png"), os.path.join(IMG, "ui.png")],
                      ["Modo de colocação: fantasma segue o dedo, barra com 'Escolher outro' e 'Concluir'.",
                       "Kit de UI: ícones, painéis 9-slice, botões redondos e retangulares, barras."]))
S.append(PageBreak())
S.append(p("Adaptação a proporções de tela", H2))
S.append(p("O mundo tem 800 px de largura para cobrir telas até 20:9 sem barras; a interface usa âncoras. Em 4:3 o "
           "mundo é ampliado (escala não inteira) e as laterais são cortadas."))
S.append(side_by_side([os.path.join(IMG, "ar1.png"), os.path.join(IMG, "ar2.png")],
                      ["2400×1080 (20:9): floresta extra nas laterais.", "1024×768 (4:3): mundo ampliado, UI reancorada."],
                      max_h=6 * cm))

# ------------------------------------------------------------ 8 audio/save
S.append(p("8. Áudio e salvamento", H1))
S += bullets([
    "<b>Áudio 100% sintetizado</b> (tools/audio/gen_audio.py, numpy → Ogg Vorbis): loop de água com bolhas, "
    "loop de vento com rajadas, 3 cantos de sabiá (frases melódicas), 3 chamados de saíra, toque na água, folhas, "
    "plantar, pedra, clique, gaveta, melhoria, descoberta, estágio, erro, câmera, e uma música ambiente de 64 s "
    "(pads + melodia pentatônica). Barramentos Music, SFX e Ambience; a água fica mais alta conforme o riacho se recupera.",
    "<b>Salvamento</b> em user:// (JSON, escrita atômica via arquivo temporário): automático a cada 20 s e ao "
    "pausar/perder foco/sair. Persistem recursos, elementos posicionados, melhorias, estágio, espécies "
    "descobertas, configurações de volume e o horário do último acesso.",
    "<b>Offline</b>: ao abrir (e ao voltar do segundo plano no Android) calcula o tempo fora, aplica 60% da produção "
    "até o limite e mostra a tela de boas-vindas.",
])
S.append(PageBreak())

# ------------------------------------------------------------ 9 architecture
S.append(p("9. Arquitetura de código", H1))
S.append(p("Cena raiz mínima (<font face='DVM'>scenes/Main.tscn</font>); o restante é montado por código para "
           "manter os sistemas modulares. Dados de balanceamento em JSON."))
S.append(table([
    ["Arquivo / pasta", "Responsabilidade"],
    ["scripts/Main.gd", "Monta SubViewport do mundo em escala inteira, camada de toque (tela→mundo), diretores, HUD; carrega o save"],
    ["autoload/GameData.gd", "Lê data/*.json (itens, melhorias, espécies, estágios, criaturas, pontos do cenário)"],
    ["autoload/GameState.gd", "Estado e economia: recursos, elementos, melhorias, estágio, indicadores derivados, sinais"],
    ["autoload/SaveSystem.gd", "Save/load atômico, autosave, progresso offline, configurações"],
    ["autoload/AudioManager.gd", "Música, ambiências em loop, pool de efeitos, volumes independentes"],
    ["systems/EcosystemRules.gd", "Funções puras: qualidade, vitalidade, elegibilidade e população-alvo de cada animal"],
    ["systems/WildlifeDirector.gd", "Faz animais chegarem/partirem conforme as regras; evento do veado"],
    ["systems/VisitorDirector.gd", "Visitantes no estágio 4 e recompensas"],
    ["world/World.gd", "Camadas, materiais/shaders, sincroniza visual com o estado, consultas espaciais (água, zonas, poleiros), toque no mundo, fantasma"],
    ["world/PlacedItem.gd", "Elemento posicionado: sprite, balanço, musgo, animação de surgimento"],
    ["creatures/*.gd", "Creature (base com máquina de estados e locomoção) + Bird, Butterfly, Dragonfly, Fish, Deer, Visitor"],
    ["ui/*.gd", "UITheme (tema pixel), HUD (barras, botões, gaveta, modos, avisos, banners) e os 4 painéis"],
    ["util/*.gd", "Palette, SpriteLib (SpriteFrames a partir das folhas), NumFmt, DevTools, SelfTest"],
    ["shaders/", "water, dissolve, sway, light_rays, fog, reveal, underwater"],
    ["tools/art, tools/audio", "Geradores de todos os assets (Python); tools/report gera este PDF"],
], [4.6 * cm, W - 4.6 * cm]))
S.append(p("Fluxo principal", H2))
S.append(p("Toque → Main (TouchLayer) → HUD.world_touch (modos de construir/remover) ou World.handle_tap "
           "(animais, água, plantas, copas) → GameState altera recursos/elementos → recompute() recalcula "
           "indicadores e verifica estágio → sinais atualizam HUD e World (shaders), e o WildlifeDirector lê as "
           "regras a cada 2,5 s para ajustar a fauna.", CODE))

# ------------------------------------------------------------ 10 quality
S.append(p("10. Qualidade, testes e limitações", H1))
S.append(p("Autoteste automatizado (<font face='DVM'>-- --selftest</font>), 14/14 passando:", B))
S += bullets([
    "Toque na água pelo caminho real de input aumenta toques e água.",
    "Gaveta de construção abre; flores posicionadas por toque; flores recusadas na água; planta aquática aceita na água.",
    "Melhoria de filtro aumenta a qualidade da água; colocar elementos leva ao estágio 2.",
    "Borboletas elegíveis com flores; peixes elegíveis de acordo com a qualidade.",
    "Save gravado e restaurado; progresso offline aplicado; limite offline respeitado.",
])
S.append(p("Limitações conhecidas", H2))
S.append(table([
    ["Item", "Situação / impacto"],
    ["Aparelho físico", "Não testado em Android real: desempenho, toque real e retorno do segundo plano ainda não verificados"],
    ["Áudio", "Sintetizado e verificado só por métricas (duração, volume); falta escuta humana e ajuste de mixagem"],
    ["Balanceamento", "Valores iniciais sem playtest; tempo até o estágio 4 não medido"],
    ["Pássaro em item removido", "Se um elemento com pássaro pousado é removido, o pássaro fica no ar até a próxima decisão (menor)"],
    ["Tela 4:3", "Zonas de construção podem incluir áreas cortadas nas laterais"],
    ["Avisos", "Várias descobertas simultâneas geram fila longa de avisos"],
    ["Remoção", "Sem confirmação (há reembolso de 50%)"],
    ["Câmera", "Fixa; arquitetura pronta (mundo de 800 px), mas sem pan/zoom"],
    ["Assinatura", "APK release assinado com chave local deste ambiente (fora do repositório); publicação exige chave própria"],
    ["Tamanho do APK", "~54 MB (motor Godot para duas arquiteturas); pode cair para ~27 MB só com arm64"],
], [3.8 * cm, W - 3.8 * cm]))
S.append(p("Próximos passos sugeridos (por prioridade)", H2))
S += bullets([
    "1. Testar em 2–3 celulares (intermediário e de entrada): fps, tamanho de toque, legibilidade da fonte, consumo de bateria.",
    "2. Playtest de ritmo: medir tempo por estágio e ajustar custos/curvas em data/*.json.",
    "3. Revisar e mixar o áudio (ou substituir por gravações reais).",
    "4. Polimento: confirmação de remoção, limitar fila de avisos, corrigir pássaro em item removido, zonas em 4:3.",
    "5. Conteúdo: ciclo dia/noite e chuva, mais espécies (sapo, martim-pescador), novas estruturas de contemplação.",
    "6. Câmera com pan para expandir o mapa e novas áreas do riacho.",
])
S.append(PageBreak())

# ------------------------------------------------------------ appendix
S.append(p("Apêndice — como executar e reproduzir", H1))
S.append(p("Executar: Godot 4.7 → Importar → little-creek/project.godot → F5 (o mouse simula o toque).", B))
S.append(p("Ferramentas de desenvolvimento (argumentos após --):", B))
S.append(p("--state=stage2|stage3|stage4   monta um ecossistema de demonstração (não salva)<br/>"
           "--spawn=deer,visitor,fish,butterfly,dragonfly,sabia,saira   força aparições<br/>"
           "--ui=build|upgrades|eco|info   abre um painel<br/>"
           "--shot=arquivo.png --frames=N --quit   captura a tela<br/>"
           "--selftest --out=pasta   executa o autoteste", CODE))
S.append(p("Regenerar assets (Python 3 + numpy, pillow, scipy; ffmpeg com libvorbis para o áudio):", B))
S.append(p("python3 tools/art/gen_environment.py · gen_props.py · gen_creatures.py · gen_effects.py · gen_ui.py<br/>"
           "python3 tools/audio/gen_audio.py", CODE))
S.append(p("Exportar Android (SDK com platform-tools e build-tools, JDK 17+, templates da Godot 4.7):", B))
S.append(p("export GODOT_ANDROID_KEYSTORE_RELEASE_PATH=/caminho/minha.keystore<br/>"
           "export GODOT_ANDROID_KEYSTORE_RELEASE_USER=alias<br/>"
           "export GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD=senha<br/>"
           "godot --headless --path little-creek --export-release \"Android\" build/LittleCreek.apk", CODE))
S.append(p("Documentos relacionados no repositório: README.md (visão geral), docs/ART_DIRECTION.md (direção de "
           "arte), docs/GAME_DESIGN.md (design e fórmulas).", B))

doc = SimpleDocTemplate(OUT, pagesize=A4, leftMargin=1.8 * cm, rightMargin=1.8 * cm, topMargin=1.6 * cm,
                        bottomMargin=1.8 * cm, title="Little Creek — Relatório do protótipo",
                        author="Little Creek", subject="Estado do protótipo v0.1.0")
doc.build(S, onFirstPage=footer, onLaterPages=footer)
print(OUT)
