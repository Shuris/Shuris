// Pixel-cluster cross-dissolve between two looks (dry -> lush), with
// seasonal recolouring. Pixels flip in organic clusters as `amount` grows,
// so vegetation seems to sprout gradually.
shader_type canvas_item;
#include "res://shaders/season_globals.gdshaderinc"
#include "res://shaders/season_core.gdshaderinc"

uniform sampler2D tex_b : filter_nearest;
uniform sampler2D noise_tex : filter_nearest, repeat_enable;
uniform float amount : hint_range(0.0, 1.0) = 0.0;
uniform vec2 tex_size = vec2(800.0, 360.0);
uniform float edge_glow = 0.12;

varying vec2 wpos;

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 0.0, 1.0)).xy;
}

void fragment() {
	vec2 px = floor(UV * tex_size);
	float n = texture(noise_tex, px / 256.0).a;
	vec4 a = texture(TEXTURE, UV);
	vec4 b = texture(tex_b, UV);
	float amt = amount * 1.04 - 0.02;
	vec4 c = n < amt ? b : a;
	if (abs(n - amt) < 0.012 && c.a > 0.0 && amount > 0.01 && amount < 0.99) {
		c.rgb = mix(c.rgb, vec3(0.86, 0.9, 0.55), edge_glow);
	}
	c = apply_season(c, wpos, 0.0);
	COLOR = c * COLOR;
}
