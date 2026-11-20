// Static vegetation layers (background forest, mid trees): seasonal colour only.
shader_type canvas_item;
#include "res://shaders/season_globals.gdshaderinc"
#include "res://shaders/season_core.gdshaderinc"

varying vec2 wpos;

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 0.0, 1.0)).xy;
}

void fragment() {
	vec4 c = texture(TEXTURE, UV);
	vec2 ts = 1.0 / TEXTURE_PIXEL_SIZE;
	c = apply_season(c, wpos - UV * ts + floor(UV * ts), fringe(TEXTURE, UV, TEXTURE_PIXEL_SIZE));
	COLOR = c * COLOR;
}
