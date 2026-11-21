// Static vegetation layers (background forest, mid trees): seasonal colour only.
shader_type canvas_item;
#include "res://shaders/season_globals.gdshaderinc"
#include "res://shaders/season_core.gdshaderinc"

varying vec2 wpos;

varying vec4 vcol;

void vertex() {
	vcol = COLOR;
	wpos = (MODEL_MATRIX * vec4(VERTEX, 0.0, 1.0)).xy;
}

void fragment() {
	vec4 c = texture(TEXTURE, UV);
	vec2 ts = 1.0 / TEXTURE_PIXEL_SIZE;
	vec2 wp = floor(wpos - UV * ts + floor(UV * ts));
	if (show_bare(wp)) {
		c = add_snow(texture(bare_tex, UV), SNOW_NB(bare_tex, UV, TEXTURE_PIXEL_SIZE), wp);
	} else {
		c = apply_season(c, wp, fringe(TEXTURE, UV, TEXTURE_PIXEL_SIZE));
		c = add_snow(c, SNOW_NB(TEXTURE, UV, TEXTURE_PIXEL_SIZE), wp);
	}
	COLOR = c * vcol;  // vertex colour only (COLOR already holds the texture)
}
