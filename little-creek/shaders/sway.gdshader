// Wind sway for pixel art: shifts whole rows by integer pixels.
// anchor_top = true for hanging foliage (canopy), false for plants on ground.
shader_type canvas_item;

uniform float strength = 1.0;      // max shift in pixels
uniform float speed = 1.2;
uniform float phase = 0.0;
uniform bool anchor_top = false;
uniform float gust = 0.0;          // extra strength from gameplay (e.g. touch)
uniform sampler2D tex_b : filter_nearest;  // optional second look (dissolve)
uniform sampler2D noise_tex : filter_nearest, repeat_enable;
uniform float amount = 0.0;
uniform bool use_dissolve = false;

void fragment() {
	vec2 ts = 1.0 / TEXTURE_PIXEL_SIZE;
	vec2 px = floor(UV * ts);
	float k = anchor_top ? clamp(px.y / ts.y, 0.0, 1.0) : clamp(1.0 - px.y / ts.y, 0.0, 1.0);
	k = k * k;
	float wave = sin(TIME * speed + phase + px.y * 0.07) * 0.65
		+ sin(TIME * speed * 0.53 + phase * 1.7 + px.x * 0.013) * 0.35;
	float shift = floor(wave * (strength + gust) * k + 0.5);
	vec2 uv = (px + vec2(-shift, 0.0) + 0.5) * TEXTURE_PIXEL_SIZE;
	vec4 c = texture(TEXTURE, uv);
	if (use_dissolve) {
		float n = texture(noise_tex, px / 256.0).a;
		vec4 b = texture(tex_b, uv);
		c = n < amount ? b : c;
	}
	COLOR = c * COLOR;
}
