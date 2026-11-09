package com.shuris.depthwall;

import android.content.Context;
import android.opengl.GLSurfaceView;
import android.service.wallpaper.WallpaperService;
import android.view.SurfaceHolder;

/**
 * WallpaperService que renderiza com um GLSurfaceView "emprestando" a superfície do wallpaper.
 * Escrito em Java porque o GLSurfaceView chama getHolder() já no construtor, e a classe
 * interna precisa enxergar o Engine nesse momento.
 */
public abstract class GLWallpaperService extends WallpaperService {

    public class GLEngine extends Engine {

        class WallpaperGLSurfaceView extends GLSurfaceView {
            WallpaperGLSurfaceView(Context context) {
                super(context);
            }

            @Override
            public SurfaceHolder getHolder() {
                return GLEngine.this.getSurfaceHolder();
            }

            void onDestroy() {
                super.onDetachedFromWindow();
            }
        }

        private WallpaperGLSurfaceView glView;
        private boolean rendererSet;

        @Override
        public void onCreate(SurfaceHolder surfaceHolder) {
            super.onCreate(surfaceHolder);
            glView = new WallpaperGLSurfaceView(GLWallpaperService.this);
        }

        protected void setRenderer(GLSurfaceView.Renderer renderer) {
            glView.setEGLContextClientVersion(2);
            glView.setPreserveEGLContextOnPause(true);
            glView.setRenderer(renderer);
            rendererSet = true;
        }

        @Override
        public void onVisibilityChanged(boolean visible) {
            super.onVisibilityChanged(visible);
            if (!rendererSet) return;
            if (visible) {
                glView.onResume();
            } else {
                glView.onPause();
            }
        }

        @Override
        public void onDestroy() {
            super.onDestroy();
            glView.onDestroy();
        }
    }
}
