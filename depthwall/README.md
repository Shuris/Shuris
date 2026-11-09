# DepthWall (protótipo)

Wallpaper animado 3D para Android: você escolhe uma foto, uma IA estima a profundidade
no próprio aparelho e o papel de parede ganha efeito parallax quando o celular se move.
Neve, chuva, vaga-lumes e neblina são desenhados **entre** as camadas da foto, com quantidade,
velocidade e tamanho ajustáveis. A foto pode ser ampliada, diminuída e movida na prévia (pinçar e
arrastar); quando diminuída, o espaço vazio vira um fundo desfocado da própria foto.

## Como testar no celular
1. Abra a página de **Releases** do repositório e baixe `DepthWall-prototipo.apk`
   (release "DepthWall – protótipo"). Também fica como artefato em **Actions → DepthWall APK**.
2. Instale o APK. O Android vai pedir para permitir "instalar apps desconhecidos".
3. Abra o app, toque em **Escolher foto**. Na primeira vez ele baixa o modelo de IA (~27 MB).
4. Ajuste a intensidade, o ponto fixo e o efeito, depois toque em **Definir como papel de parede**.

Dicas: fotos com um objeto ou pessoa em primeiro plano e fundo distante dão o melhor resultado.
Na prévia, pince para dar zoom, arraste para mover a foto e toque duas vezes para voltar ao padrão.
Para o novo mapa de profundidade valer em uma foto antiga, escolha a foto de novo.

## Estrutura
- `DepthEstimator.kt`: Depth Anything V2 Small (Apache-2.0) via ONNX Runtime, na proporção real da foto.
- `GuidedFilter.java`: refino das bordas do mapa usando as cores da foto (recorte de bordas + mediana).
- `BackgroundLayer.java`: reconstrói o fundo escondido atrás das bordas dos objetos, usado quando eles se movem.
- `DepthRenderer.kt`: shader OpenGL ES 2 com parallax por ray marching, enquadramento e efeitos entre camadas.
- `TiltSensor.kt`: giroscópio que volta sozinho ao centro (fallback para acelerômetro).
- `GLWallpaperService.java` / `DepthWallpaperService.kt`: o live wallpaper.
- `MainActivity.kt`: escolha da foto, prévia e painel de ajustes.

## Compilar localmente
Abra a pasta `depthwall/` no Android Studio, ou rode `./gradlew assembleDebug`.
