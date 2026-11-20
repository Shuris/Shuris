// Rain puddles: TEXTURE R = puddle mask, G = distance to centre (0..1).
// They fill from the centre as the ground gets wet and dry out slowly,
// reflect the sky and show rain rings.
shader_type canvas_item;

uniform float wet = 0.0;      // 0..1 ground wetness
uniform float rain = 0.0;     // 0..1 rain intensity
uniform vec3 sky_col = vec3(0.70, 0.80, 0.80);
uniform vec3 deep_col = vec3(0.22, 0.30, 0.32);
uniform vec2 world_size = vec2(800.0, 360.0);

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void fragment() {
	vec4 t = texture(TEXTURE, UV);
	if (t.a < 0.5 || t.r < 0.5) {
		discard;
	}
	float d = t.g;
	float lim = wet * 1.05;
	if (d > lim) {
		discard;
	}
	vec2 px = floor(UV * world_size);
	// sky reflection: lighter toward the far edge, darker toward the viewer
	vec3 c = mix(sky_col, deep_col, clamp(d * 0.9 + 0.1, 0.0, 1.0));
	float shimmer = hash(px + floor(TIME * 3.0));
	if (shimmer > 0.97) {
		c = mix(c, vec3(0.95, 0.97, 0.95), 0.5);
	}
	// rain rings
	if (rain > 0.02) {
		vec2 cell = floor(px / vec2(5.0, 3.0));
		if (hash(cell) < rain * 0.7) {
			float ph = fract(TIME * 1.4 + hash(cell + 2.0));
			vec2 cc = (cell + 0.5) * vec2(5.0, 3.0);
			float r = length((px - cc) * vec2(1.0, 2.0));
			if (abs(r - ph * 3.0) < 0.6) {
				c = mix(c, vec3(0.92, 0.95, 0.95), 0.6 * (1.0 - ph));
			}
		}
	}
	// wet rim (dark soil)
	if (d > lim - 0.14) {
		c = vec3(0.16, 0.13, 0.10);
	}
	COLOR = vec4(c, 0.92);
}
