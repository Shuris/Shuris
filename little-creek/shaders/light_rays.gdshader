// Volumetric god rays from the sun (top-right), quantized + ordered dithering
// so they stay pixel-art. Drawn additively over the world.
shader_type canvas_item;
render_mode blend_add;

uniform sampler2D noise_tex : filter_linear, repeat_enable;
uniform vec2 world_size = vec2(800.0, 360.0);
uniform vec2 sun_pos = vec2(610.0, -60.0);
uniform float intensity = 1.0;
uniform vec3 ray_col = vec3(1.0, 0.94, 0.72);

float bayer4(vec2 p) {
	int x = int(mod(p.x, 4.0));
	int y = int(mod(p.y, 4.0));
	float m[16] = float[](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
	return (m[x + y * 4] + 0.5) / 16.0;
}

void fragment() {
	vec2 px = floor(UV * world_size);
	vec2 d = px - sun_pos;
	float ang = atan(d.x, d.y);
	float dist = length(d);
	float n1 = texture(noise_tex, vec2(ang * 1.9 + TIME * 0.004, 0.13)).g;
	float n2 = texture(noise_tex, vec2(ang * 4.3 - TIME * 0.006, 0.61)).r;
	float beams = smoothstep(0.52, 0.78, n1) * 0.75 + smoothstep(0.6, 0.85, n2) * 0.45;
	float fade = smoothstep(40.0, 160.0, dist) * (1.0 - smoothstep(260.0, 470.0, dist));
	float shimmer = 0.85 + 0.15 * sin(TIME * 0.6 + ang * 7.0);
	float a = beams * fade * shimmer * intensity;
	// quantize to 3 levels with ordered dithering
	float lv = floor(a * 3.0 + bayer4(px)) / 3.0;
	COLOR = vec4(ray_col * lv * 0.16, 1.0);
}
