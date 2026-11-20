// Pixel-cluster cross-dissolve between two looks (dry -> lush).
// Pixels flip in organic clusters as `amount` grows, so vegetation seems to
// sprout gradually. A thin bright edge highlights the newly grown pixels.
shader_type canvas_item;

uniform sampler2D tex_b : filter_nearest;
uniform sampler2D noise_tex : filter_nearest, repeat_enable;
uniform float amount : hint_range(0.0, 1.0) = 0.0;
uniform vec2 tex_size = vec2(800.0, 360.0);
uniform float edge_glow = 0.12;

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
	COLOR = c * COLOR;
}
