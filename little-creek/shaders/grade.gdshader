// Time-of-day / weather colour grading of the whole world image.
// Operates per art pixel (dithering in art-pixel space), so it keeps the
// pixel-art look while changing light, temperature and mood.
shader_type canvas_item;

uniform vec3 tint = vec3(1.0);          // multiplicative light colour
uniform vec3 shadow_lift = vec3(0.0);   // colour added to dark tones (split toning)
uniform float saturation = 1.0;
uniform float brightness = 1.0;
uniform float night = 0.0;              // 0..1
uniform float rain = 0.0;               // 0..1
uniform float cold = 0.0;               // winter coolness 0..1
uniform float vignette = 0.0;
uniform vec2 art_size = vec2(800.0, 360.0);

float bayer4(vec2 p) {
	int x = int(mod(p.x, 4.0));
	int y = int(mod(p.y, 4.0));
	float m[16] = float[](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
	return (m[x + y * 4] + 0.5) / 16.0;
}

void fragment() {
	vec3 c = texture(TEXTURE, UV).rgb;
	vec2 px = floor(UV * art_size);
	float lum = dot(c, vec3(0.299, 0.587, 0.114));
	// rain: wet, cool, slightly darker and less saturated
	float sat = saturation * (1.0 - 0.28 * rain) * (1.0 - 0.18 * cold);
	c = mix(vec3(lum), c, sat);
	c *= tint * brightness * (1.0 - 0.16 * rain);
	c = mix(c, c * vec3(0.86, 0.95, 1.08), max(rain * 0.6, cold * 0.5));
	// split toning: lift the shadows toward the period colour
	c += shadow_lift * (1.0 - smoothstep(0.0, 0.7, lum));
	// night: moonlit highlights stay readable, mids sink into blue
	float hl = smoothstep(0.55, 0.95, lum);
	c = mix(c, c + vec3(0.05, 0.07, 0.12) * hl, night);
	// dithered vignette (stepped, art-pixel aligned)
	vec2 d = (UV - 0.5) * vec2(1.0, 0.8);
	float v = clamp(dot(d, d) * 2.4 - 0.15, 0.0, 1.0) * vignette;
	v = floor(v * 4.0 + bayer4(px)) / 4.0;
	c *= 1.0 - v * 0.35;
	COLOR = vec4(clamp(c, 0.0, 1.0), 1.0);
}
