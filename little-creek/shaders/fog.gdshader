// Slow drifting mist band near the horizon, dithered.
shader_type canvas_item;

uniform sampler2D noise_tex : filter_linear, repeat_enable;
uniform vec2 rect_size = vec2(800.0, 90.0);
uniform vec3 fog_col = vec3(0.82, 0.88, 0.80);
uniform float density = 0.5;

float bayer4(vec2 p) {
	int x = int(mod(p.x, 4.0));
	int y = int(mod(p.y, 4.0));
	float m[16] = float[](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
	return (m[x + y * 4] + 0.5) / 16.0;
}

void fragment() {
	vec2 px = floor(UV * rect_size);
	float band = 1.0 - abs(UV.y - 0.5) * 2.0;
	band = band * band;
	float n = texture(noise_tex, px / vec2(260.0, 60.0) + vec2(TIME * 0.006, 0.0)).g;
	float n2 = texture(noise_tex, px / vec2(140.0, 40.0) + vec2(-TIME * 0.004, 0.3)).r;
	float a = band * (n * 0.7 + n2 * 0.5 - 0.25) * density;
	a = step(1.0 - a * 2.2, bayer4(px) * 0.6 + 0.4) * 0.22 + step(0.35, a) * 0.12;
	COLOR = vec4(fog_col, clamp(a, 0.0, 0.4));
}
