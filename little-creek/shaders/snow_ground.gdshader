// Ground snow: TEXTURE.rgb = shaded snow, TEXTURE.a = accumulation order.
// Snow appears where order <= cover (shade first, banks/sunny spots later,
// roads only in patches) and melts back the same way, with a ragged,
// dithered edge so the transition never looks like a fade.
shader_type canvas_item;

uniform float cover = 0.0;
uniform vec2 tex_size = vec2(800.0, 360.0);

float bayer4(vec2 p) {
	int x = int(mod(p.x, 4.0));
	int y = int(mod(p.y, 4.0));
	float m[16] = float[](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
	return (m[x + y * 4] + 0.5) / 16.0;
}

void fragment() {
	vec4 t = texture(TEXTURE, UV);
	if (t.a <= 0.0) {
		discard;
	}
	vec2 px = floor(UV * tex_size);
	float order = t.a;
	float edge = cover - order;
	if (edge < 0.0) {
		discard;
	}
	// thin snow near the reveal edge: dithered so grass shows through
	if (edge < 0.06 && bayer4(px) > edge / 0.06) {
		discard;
	}
	COLOR = vec4(t.rgb, 1.0);
}
