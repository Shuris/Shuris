// Reveals a sprite in organic pixel clusters as `amount` goes 0 -> 1.
shader_type canvas_item;

uniform sampler2D noise_tex : filter_nearest, repeat_enable;
uniform float amount : hint_range(0.0, 1.0) = 0.0;

varying vec4 vcol;

void vertex() {
	vcol = COLOR;
}

void fragment() {
	vec2 ts = 1.0 / TEXTURE_PIXEL_SIZE;
	vec2 px = floor(UV * ts);
	float n = texture(noise_tex, px / 256.0).a;
	vec4 c = texture(TEXTURE, UV);
	if (n > amount * 1.04 - 0.02) {
		c.a = 0.0;
	}
	COLOR = c * vcol;  // vertex colour only (COLOR already holds the texture)
}
