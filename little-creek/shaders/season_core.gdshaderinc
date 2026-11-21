// Seasonal look shared by vegetation, rock and structure shaders (v0.5).
//  - leaf colour through the year (spring young leaves and blossoms, rich
//    summer greens, varied autumn crowns: some still green, brown, burnt
//    red, orange, gold, yellow), dull winter evergreens
//  - deciduous trees swap their leaves for the bare-branch sprite in clumps,
//    each tree at its own pace (tree_phase)
//  - snow settles on surfaces that face up (pixels with empty space above),
//    so it follows branches, crowns, rocks, logs and roofs

uniform float canopy = 0.0;      // 1 = tree crowns
uniform float season_k = 1.0;    // strength of the seasonal colour on this layer
uniform bool has_bare = false;   // a bare-branch twin texture exists
uniform sampler2D bare_tex : filter_nearest;
uniform float tree_phase = 0.0;  // 0..0.3, offsets leaf fall / leaf-out per tree
uniform float snow_k = 1.0;      // 0 = no snow on this layer
uniform int snow_mode = 0;       // 0 = caps on top edges, 1 = distant forest tint
uniform bool evergreen = false;
uniform float petal_k = 0.0;     // 1 for flowering plants: petals close/vanish in winter

float s_hash(vec2 q) {
	return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453);
}

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

float foliage_mask(vec4 c) {
	float mx = max(c.r, max(c.g, c.b));
	float mn = min(c.r, min(c.g, c.b));
	float sat = (mx - mn) / max(mx, 0.001);
	return smoothstep(0.02, 0.07, c.g - c.r) * step(c.b, c.g * 1.05) * smoothstep(0.15, 0.35, sat);
}

// Fraction of leaves gone on this tree (0 = full crown, 1 = bare).
float bare_amount() {
	return clamp(season_bare * 1.3 - tree_phase, 0.0, 1.0);
}

// True when this pixel should show the bare-branch sprite instead of leaves.
bool show_bare(vec2 p) {
	if (!has_bare || evergreen) {
		return false;
	}
	float clump = s_noise(p / 4.0 + vec2(41.0, 13.0));
	return clump < bare_amount();
}

vec3 ramp3(vec3 a, vec3 b, vec3 c, float l) {
	return l < 0.5 ? mix(a, b, l * 2.0) : mix(b, c, (l - 0.5) * 2.0);
}

vec3 autumn_colour(float hue, float lum, bool crown) {
	float l = clamp(lum * 1.2, 0.0, 1.0);
	if (!crown) {   // grass and low plants: straw and ochre
		return ramp3(vec3(0.33, 0.27, 0.10), vec3(0.68, 0.56, 0.24), vec3(0.88, 0.78, 0.44), l);
	}
	if (hue < 0.30) {        // brown
		return ramp3(vec3(0.24, 0.13, 0.07), vec3(0.50, 0.31, 0.15), vec3(0.72, 0.53, 0.31), l);
	} else if (hue < 0.47) { // burnt red
		return ramp3(vec3(0.33, 0.07, 0.05), vec3(0.68, 0.15, 0.08), vec3(0.90, 0.36, 0.18), l);
	} else if (hue < 0.66) { // orange
		return ramp3(vec3(0.42, 0.12, 0.04), vec3(0.86, 0.36, 0.08), vec3(0.98, 0.62, 0.20), l);
	} else if (hue < 0.82) { // gold
		return ramp3(vec3(0.40, 0.24, 0.04), vec3(0.85, 0.58, 0.12), vec3(0.98, 0.80, 0.30), l);
	}
	return ramp3(vec3(0.40, 0.33, 0.06), vec3(0.88, 0.76, 0.18), vec3(0.99, 0.93, 0.45), l);  // yellow
}

vec4 apply_season(vec4 c, vec2 wpx, float edge) {
	if (c.a < 0.01 || season_k <= 0.0) {
		return c;
	}
	vec2 p = floor(wpx);
	float isg = foliage_mask(c);
	if (petal_k > 0.0 && isg < 0.2) {
		// flower petals: gone in winter (bare green tufts remain), back in spring
		float mx = max(c.r, max(c.g, c.b));
		float sat = (mx - min(c.r, min(c.g, c.b))) / max(mx, 0.001);
		bool petal = sat > 0.25 || mx > 0.8;
		if (petal && s_noise(p / 2.0 + vec2(7.0, 3.0)) < season_winter * petal_k * 1.1) {
			return vec4(0.0);
		}
	}
	if (isg <= 0.0) {
		return c;
	}
	float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
	float region = s_noise(p / 90.0);                // which crowns turn first
	float hue = s_noise(p / 40.0 + vec2(17.3, 5.1));  // crown colour family
	float fine = s_noise(p / 3.0 + vec2(3.7, 9.2));
	bool crown = canopy > 0.5;
	// summer: richer greens
	c.rgb = mix(vec3(lum), c.rgb, 1.0 + 0.12 * season_lush * season_k);
	// spring: fresh, lighter young leaves while trees leaf out
	if (crown) {
		c.rgb = mix(c.rgb, c.rgb * vec3(1.06, 1.12, 0.82) + vec3(0.03, 0.05, 0.0), season_young * 0.55 * isg);
	}
	// autumn: crowns turn on different days; a few stay green longer
	float turn = smoothstep(region * 0.8, region * 0.8 + 0.18, season_autumn) * isg * season_k;
	if (evergreen) {
		turn = 0.0;
	} else if (crown && hue > 0.88) {
		turn *= 0.35;   // late trees: still mostly green
	}
	c.rgb = mix(c.rgb, autumn_colour(hue, lum, crown), turn * (crown ? 1.0 : 0.55));
	// winter: dull, cold greens (evergreens keep a deep green)
	vec3 dull = mix(vec3(lum) * vec3(0.92, 0.97, 1.06), vec3(lum * 1.02, lum * 0.94, lum * 0.78), 0.45);
	c.rgb = mix(c.rgb, dull, season_winter * isg * (evergreen ? 0.3 : 0.75) * season_k);
	if (crown) {
		// fallback thinning for crowns without a bare twin (fringe only)
		if (!has_bare && !evergreen) {
			float clump = s_noise(p / 5.0 + vec2(41.0, 13.0));
			if (clump < season_bare * 0.4 * isg && edge > 0.5) {
				c.a = 0.0;
			}
		}
		// spring blossoms
		float h = s_hash(p * 1.37);
		if (!evergreen && h > 1.0 - season_bloom * 0.16 && fine > 0.3 && isg > 0.3) {
			c.rgb = hue > 0.5 ? vec3(0.96, 0.74, 0.82) : vec3(0.98, 0.96, 0.92);
			c.rgb *= 0.75 + 0.35 * clamp(lum * 2.0, 0.0, 1.0);
		}
	}
	return c;
}

// Snow resting on top surfaces. tex/uv/tps describe the sprite the pixel
// came from (to look at the pixels above it). p = world pixel.
// nb = alpha of the pixels 1, 2 and 3 above, and of the pixel to the right
vec4 add_snow(vec4 c, vec4 nb, vec2 p) {
	float cover = snow_cover * snow_k;
	if (c.a < 0.01 || cover <= 0.01) {
		return c;
	}
	float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
	if (snow_mode == 1) {   // distant forest: snowy crowns read as pale speckles
		float n = s_noise(p / 2.0);
		float k = cover * smoothstep(0.25, 0.6, lum + n * 0.3) * 0.55;
		return vec4(mix(c.rgb, vec3(0.86, 0.91, 0.97) * (0.8 + lum * 0.3), k), c.a);
	}
	float up1 = nb.x;
	float up2 = nb.y;
	float up3 = nb.z;
	float right = nb.w;
	float n = s_hash(p);
	float n2 = s_noise(p / 3.0);
	vec3 lit = vec3(0.95, 0.97, 1.0);
	vec3 mid = vec3(0.84, 0.89, 0.96);
	vec3 shade = vec3(0.68, 0.76, 0.88);
	if (up1 < 0.01 && n2 < cover * 1.35) {
		c.rgb = right < 0.01 ? lit : mix(lit, mid, 0.35);   // brighter toward the light
	} else if (up2 < 0.01 && cover > 0.35 && n2 < cover * 1.1) {
		c.rgb = mid;
	} else if (up3 < 0.01 && cover > 0.7 && n2 < cover * 0.9) {
		c.rgb = mix(c.rgb, shade, 0.85);
	} else if (canopy > 0.5 && foliage_mask(c) > 0.3 && lum > 0.22 && n < cover * 0.45) {
		c.rgb = mix(c.rgb, mid, 0.8);   // clumps of snow caught in evergreen foliage
	}
	return c;
}

#define SNOW_NB(T, UVP, TPS) vec4(texture(T, (UVP) - vec2(0.0, (TPS).y)).a, texture(T, (UVP) - vec2(0.0, 2.0 * (TPS).y)).a, texture(T, (UVP) - vec2(0.0, 3.0 * (TPS).y)).a, texture(T, (UVP) + vec2((TPS).x, 0.0)).a)

// 1 if a transparent pixel lies within 2 px (canopy fringe)
float fringe(sampler2D tex, vec2 uv, vec2 tps) {
	float e = 0.0;
	e += step(texture(tex, uv + vec2(2.0, 0.0) * tps).a, 0.01);
	e += step(texture(tex, uv + vec2(-2.0, 0.0) * tps).a, 0.01);
	e += step(texture(tex, uv + vec2(0.0, 2.0) * tps).a, 0.01);
	e += step(texture(tex, uv + vec2(0.0, -2.0) * tps).a, 0.01);
	return min(e, 1.0);
}
