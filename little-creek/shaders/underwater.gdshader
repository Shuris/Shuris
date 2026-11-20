// Creatures under the surface (fish): clipped to the water mask and tinted.
shader_type canvas_item;

uniform sampler2D water_mask : filter_nearest;
uniform vec2 world_size = vec2(800.0, 360.0);
uniform vec4 tint = vec4(0.55, 0.8, 0.8, 0.75);

varying vec2 world_pos;

void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 0.0, 1.0)).xy;
}

void fragment() {
	vec4 c = texture(TEXTURE, UV);
	float m = texture(water_mask, world_pos / world_size).a;
	if (m < 0.5 || c.a < 0.5) {
		discard;
	}
	COLOR = vec4(c.rgb * tint.rgb, tint.a);
}
