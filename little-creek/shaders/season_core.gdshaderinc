// Seasonal foliage recolouring shared by vegetation shaders.
// Green foliage pixels change in organic clusters (world-space noise), so
// regions turn on different days instead of all at once.


uniform float canopy = 0.0;      // 1 = tree crowns (can thin out / blossom)
uniform float season_k = 1.0;    // strength of the seasonal effect on this layer

float s_hash(vec2 q) {
	return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453);
}

// smooth value noise (procedural: no texture binding needed)
float s_noise(vec2 q) {
	vec2 i = floor(q);
	vec2 f = fract(q);
	f = f * f * (3.0 - 2.0 * f);
	float a = s_hash(i);
	float b = s_hash(i + vec2(1.0, 0.0));
	float c2 = s_hash(i + vec2(0.0, 1.0));
	float d = s_hash(i + vec2(1.0, 1.0));
	return mix(mix(a, b, f.x), mix(c2, d, f.x), f.y);
}

vec4 apply_season(vec4 c, vec2 wpx) {
	if (c.a < 0.01 || season_k <= 0.0) {
		return c;
	}
	vec2 p = floor(wpx);
	// foliage detector: green dominates red, not bluer than green, saturated
	float mx = max(c.r, max(c.g, c.b));
	float mn = min(c.r, min(c.g, c.b));
	float sat = (mx - mn) / max(mx, 0.001);
	float isg = smoothstep(0.02, 0.07, c.g - c.r) * step(c.b, c.g * 1.05) * smoothstep(0.15, 0.35, sat);
	if (isg <= 0.0) {
		return c;
	}
	float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
	float region = s_noise(p / 90.0);                     // which crowns turn first
	float hue = s_noise(p / 40.0 + vec2(17.3, 5.1));
	float fine = s_noise(p / 3.0 + vec2(3.7, 9.2));       // pixel clusters
	// summer: richer greens
	c.rgb = mix(vec3(lum), c.rgb, 1.0 + 0.12 * season_lush * season_k);
	// autumn
	float turn = smoothstep(region * 0.8, region * 0.8 + 0.18, season_autumn) * isg * season_k;
	vec3 deep = mix(vec3(0.36, 0.13, 0.08), vec3(0.42, 0.24, 0.06), hue);
	vec3 mid = mix(vec3(0.78, 0.33, 0.10), vec3(0.85, 0.55, 0.12), hue);
	vec3 high = mix(vec3(0.95, 0.66, 0.24), vec3(0.98, 0.84, 0.38), hue);
	float l2 = clamp(lum * 1.3 - 0.05, 0.0, 1.0);
	vec3 aut = l2 < 0.5 ? mix(deep, mid, l2 * 2.0) : mix(mid, high, (l2 - 0.5) * 2.0);
	aut = mix(aut, vec3(lum) * vec3(1.1, 0.95, 0.7), 0.06);
	c.rgb = mix(c.rgb, aut, turn * (canopy > 0.5 ? 1.0 : 0.6));
	// winter: dull olive-grey, cold
	vec3 dull = mix(vec3(lum) * vec3(0.92, 0.97, 1.06), vec3(lum * 1.02, lum * 0.94, lum * 0.78), 0.45);
	c.rgb = mix(c.rgb, dull, season_winter * isg * 0.75 * season_k);
	if (canopy > 0.5) {
		// thinning crowns (leaf fall) in clumps of leaves
		float clump = s_noise(p / 5.0 + vec2(41.0, 13.0));
		if (clump < season_bare * 0.8 * isg) {
			c.a = 0.0;
		}
		// spring blossoms: scattered dots, grouped on some branches
		float h = fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
		if (h > 1.0 - season_bloom * 0.16 && fine > 0.3 && isg > 0.3) {
			c.rgb = hue > 0.5 ? vec3(0.96, 0.74, 0.82) : vec3(0.98, 0.96, 0.92);
			c.rgb *= 0.75 + 0.35 * clamp(lum * 2.0, 0.0, 1.0);
		}
	}
	return c;
}
