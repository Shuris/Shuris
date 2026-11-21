// Wind sway for pixel art: shifts whole rows by integer pixels, plus
// optional dry->lush dissolve and seasonal recolouring.
// anchor_top = true for hanging foliage (canopy), false for plants on ground.
shader_type canvas_item;
#include "res://shaders/season_locals.gdshaderinc"
#include "res://shaders/season_core.gdshaderinc"


uniform float strength = 1.0;      // max shift in pixels
uniform float speed = 1.2;
uniform float phase = 0.0;
uniform bool anchor_top = false;
uniform float gust = 0.0;          // extra strength from gameplay (e.g. touch)
uniform sampler2D tex_b : filter_nearest;  // optional second look (dissolve)
uniform sampler2D noise_tex : filter_nearest, repeat_enable;
uniform float amount = 0.0;
uniform bool use_dissolve = false;

varying vec2 wpos;

varying vec4 vcol;

void vertex() {
	vcol = COLOR;
	wpos = (MODEL_MATRIX * vec4(VERTEX, 0.0, 1.0)).xy;
}

void fragment() {
	vec2 ts = 1.0 / TEXTURE_PIXEL_SIZE;
	vec2 px = floor(UV * ts);
	float k = anchor_top ? clamp(px.y / ts.y, 0.0, 1.0) : clamp(1.0 - px.y / ts.y, 0.0, 1.0);
	k = k * k;
	float wind = 0.6 + world_wind * 1.6;
	float wave = sin(TIME * speed * (0.8 + world_wind) + phase + px.y * 0.07) * 0.65
		+ sin(TIME * speed * 0.53 + phase * 1.7 + px.x * 0.013) * 0.35;
	float shift = floor(wave * (strength * wind + gust) * k + 0.5);
	vec2 uv = (px + vec2(-shift, 0.0) + 0.5) * TEXTURE_PIXEL_SIZE;
	vec4 c = texture(TEXTURE, uv);
	if (use_dissolve) {
		float n = texture(noise_tex, px / 256.0).a;
		vec4 b = texture(tex_b, uv);
		c = n < amount ? b : c;
	}
	vec2 wp = floor(wpos - (UV * ts) + px);   // world pixel (unshifted)
	bool bare = show_bare(wp);
	if (bare) {
		c = texture(bare_tex, uv);
		c = add_snow(c, SNOW_NB(bare_tex, uv, TEXTURE_PIXEL_SIZE), wp);
	} else {
		c = apply_season(c, wp, fringe(TEXTURE, uv, TEXTURE_PIXEL_SIZE));
		c = add_snow(c, SNOW_NB(TEXTURE, uv, TEXTURE_PIXEL_SIZE), wp);
	}
	COLOR = c * vcol;  // vertex colour only (COLOR already holds the texture)
}
