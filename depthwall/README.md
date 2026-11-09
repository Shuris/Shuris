# DepthWall (protótipo)

Wallpaper animado 3D para Android: você escolhe uma foto, uma IA estima a profundidade
no próprio aparelho e o papel de parede ganha efeito parallax quando o celular se move.
Neve, chuva, vaga-lumes e neblina são desenhados **entre** as camadas da foto, com quantidade,
velocidade e tamanho ajustáveis. O relógio (7 estilos, 8 cores, com data) também é uma camada
de profundidade: a pessoa ou objeto da foto pode passar na frente dele, como no iPhone.

## Como testar no celular
1. Abra a página de **Releases** do repositório e baixe `DepthWall-prototipo.apk`
   (release "DepthWall – protótipo"). Também fica como artefato em **Actions → DepthWall APK**.
2. Instale o APK. O Android vai pedir para permitir "instalar apps desconhecidos".
3. Abra o app, toque em **Escolher foto**. Na primeira vez ele baixa o modelo de IA (~27 MB).
4. Ajuste a intensidade, o ponto fixo e o efeito, depois toque em **Definir como papel de parede**.

Dicas: fotos com um objeto ou pessoa em primeiro plano e fundo distante dão o melhor resultado.
Arrastar o dedo na prévia simula a inclinação.

## Estrutura
- `DepthEstimator.kt`: Depth Anything V2 Small (Apache-2.0) via ONNX Runtime, mais pós-processamento do mapa.
- `DepthRenderer.kt`: shader OpenGL ES 2 com parallax por mapa de profundidade e efeitos entre camadas.
- `TiltSensor.kt`: giroscópio que volta sozinho ao centro (fallback para acelerômetro).
- `GLWallpaperService.java` / `DepthWallpaperService.kt`: o live wallpaper.
- `ClockPainter.kt`: desenha o relógio (estilos, cores, data) que vira textura no shader.
- `MainActivity.kt`: escolha da foto, prévia e painel de ajustes.

## Compilar localmente
Abra a pasta `depthwall/` no Android Studio, ou rode `./gradlew assembleDebug`.
