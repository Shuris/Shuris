// Little Creek — animated creek surface (v0.3).
// Runs at native art resolution inside the world SubViewport, so every output
// pixel is an art pixel. Output is quantized to a fixed palette ramp.
//  TEXTURE   = water_flow.png  (RG flow dir incl. eddies around rocks, B speed, A mask)
//  meta_tex  = water_meta.png  (R fall, G foam, B depth, A sunlight)
//  extra_tex = water_extra.png (R wake behind rocks, G eddy strength, B speed variation)
shader_type canvas_item;

uniform sampler2D meta_tex : filter_nearest;
uniform sampler2D extra_tex : filter_nearest;
uniform sampler2D bed_tex : filter_nearest;
uniform sampler2D noise_tex : filter_linear, repeat_enable;
uniform vec2 world_size = vec2(800.0, 360.0);
uniform float quality : hint_range(0.0, 1.0) = 0.2;   // 0 murky -> 1 crystal clear
uniform float flow_speed = 1.0;
uniform float rain = 0.0;                              // 0..1 rain intensity
uniform vec3 clean[10];
uniform vec3 murky[8];
uniform vec3 foam_col = vec3(0.945, 0.953, 0.878);
uniform vec3 glint_col = vec3(1.0, 0.98, 0.9);
uniform float glint = 1.0;
uniform float ice = 0.0;    // 0..1 winter shelf ice along banks and in calm shallows
uniform float cold = 0.0;
uniform bool rain_rings = true;   // off on low quality   // 0..1 winter: darker, bluer water

float bayer4(vec2 p) {
	int x = int(mod(p.x, 4.0));
	int y = int(mod(p.y, 4.0));
	int i = x + y * 4;
	float m[16] = float[](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
	return (m[i] + 0.5) / 16.0 - 0.5;
}

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec3 ramp_clean(float v) {
	int i = clamp(int(floor(v * 9.0 + 0.5)), 0, 9);
	return clean[i];
}
vec3 ramp_murky(float v) {
	int i = clamp(int(floor(v * 7.0 + 0.5)), 0, 7);
	return murky[i];
}

// two-phase flow-map sampling (no stretching over time)
float flow_noise(vec2 px, vec2 dir, float spd, vec2 scale, float rate, float off, float ch) {
	float t = TIME * rate * flow_speed + off;
	float p0 = fract(t);
	float p1 = fract(t + 0.5);
	float w = abs(1.0 - 2.0 * p0);
	vec2 d = dir * spd * 26.0;
	vec4 n0 = texture(noise_tex, (px - d * p0) / scale + vec2(off, 0.0));
	vec4 n1 = texture(noise_tex, (px - d * p1) / scale + vec2(off + 0.37, 0.21));
	float a = ch < 0.5 ? n0.r : n0.b;
	float b = ch < 0.5 ? n1.r : n1.b;
	return mix(b, a, w);
}

// expanding rain rings, squashed for the elevated perspective
float rain_rings_at(vec2 px, float density) {
	vec2 cell = floor(px / vec2(9.0, 5.0));
	float h = hash(cell);
	if (h > density) {
		return 0.0;
	}
	vec2 c = (cell + vec2(0.25 + 0.5 * hash(cell + 3.1), 0.25 + 0.5 * hash(cell + 7.7))) * vec2(9.0, 5.0);
	float ph = fract(TIME * (1.1 + h) + hash(cell + 1.3));
	vec2 d = (px - c) * vec2(1.0, 2.2);
	float r = ph * 4.5;
	float ring = 1.0 - smoothstep(0.0, 0.9, abs(length(d) - r));
	return ring * (1.0 - ph);
}

void fragment() {
	vec4 f = texture(TEXTURE, UV);
	if (f.a < 0.5) {
		discard;
	}
	vec2 px = floor(UV * world_size);
	vec2 dir = f.rg * 2.0 - 1.0;
	vec4 meta = texture(meta_tex, UV);
	vec4 ex = texture(extra_tex, UV);
	float fall = meta.r;
	float foam = meta.g;
	float depth = meta.b;
	float sun = meta.a;
	float wake = ex.r;
	float eddy = ex.g;
	// regional speed variation + temporary surge with heavy rain
	float spd = f.b * (0.7 + 0.6 * ex.b) * (1.0 + rain * 0.5);

	float persp = clamp((px.y - 160.0) / 200.0, 0.15, 1.0);
	vec2 sc_big = vec2(150.0, 38.0) * (0.55 + persp * 0.6);
	vec2 sc_fine = vec2(60.0, 12.0) * (0.55 + persp * 0.6);
	vec2 sc_x = vec2(34.0, 9.0) * (0.55 + persp * 0.6);
	vec2 dir_x = vec2(dir.x * 0.9 - dir.y * 0.45, dir.x * 0.45 + dir.y * 0.9); // cross ripples
	float r1 = flow_noise(px, dir, spd, sc_big, 0.22, 0.0, 0.0);
	float r2 = flow_noise(px, dir, spd * 1.4, sc_fine, 0.35, 0.5, 0.0);
	float r3 = flow_noise(px, dir_x, spd * 1.1, sc_x, 0.47, 0.25, 1.0);

	float v = 0.64 - depth * 0.48 + sun * 0.18 + (r1 - 0.5) * 0.42;
	// crests of different sizes
	float c_a = smoothstep(0.66 - sun * 0.08, 0.74 - sun * 0.08, r2 * (0.7 + r1 * 0.6));
	float c_b = smoothstep(0.7, 0.78, r3 * (0.8 + r1 * 0.4)) * 0.7;
	float crest = max(c_a, c_b);
	crest = max(crest, smoothstep(0.75, 0.8, r2) * rain * 0.8);   // choppier when raining
	v += crest * (0.18 + sun * 0.2);
	v -= smoothstep(0.22, 0.12, r2) * 0.1;
	// standing waves in the wake of rocks: chevrons moving slowly downstream
	if (wake > 0.05) {
		float along = dot(px, normalize(dir + vec2(0.0001)));
		float band = sin(along * 0.9 - TIME * 2.6 * flow_speed + r2 * 3.0) * 0.5 + 0.5;
		v += step(0.72, band) * wake * 0.22;
		v -= step(band, 0.18) * wake * 0.08;
	}
	// swirling eddies: darker core, bright rim
	v -= eddy * smoothstep(0.55, 0.35, r1) * 0.12;

	// banks: darker reflection of the vegetation
	float edge = 0.0;
	vec2 tp = 1.0 / world_size;
	edge += step(texture(TEXTURE, UV + vec2(0.0, -2.0) * tp).a, 0.5);
	edge += step(texture(TEXTURE, UV + vec2(-2.0, 0.0) * tp).a, 0.5);
	edge += step(texture(TEXTURE, UV + vec2(2.0, 0.0) * tp).a, 0.5);
	v -= edge * 0.06;

	// waterfall curtains
	float fallv = 0.0;
	if (fall > 0.01) {
		float s1 = texture(noise_tex, vec2(px.x / 3.5, px.y / 46.0 - TIME * 1.15 * flow_speed)).g;
		float s2 = texture(noise_tex, vec2(px.x / 2.0 + 0.3, px.y / 30.0 - TIME * 1.6 * flow_speed)).b;
		fallv = clamp(s1 * 0.8 + s2 * 0.5, 0.0, 1.0);
		v = mix(v, 0.4 + fallv * 0.62, fall);
	}

	// rain rings
	float ring = (rain > 0.01 && rain_rings) ? rain_rings_at(px, rain * 0.55) : 0.0;
	v += ring * 0.35;

	// winter: water darker and bluer, fewer bright crests
	v -= cold * 0.08;
	float d = bayer4(px) * 0.11;
	vec3 cc = ramp_clean(clamp(v + d, 0.0, 1.0));
	vec3 mc = ramp_murky(clamp(v * 0.78 + 0.02 + d, 0.0, 1.0));
	// heavy rain stirs the sediment
	float q = floor(clamp(quality - rain * rain * 0.25, 0.0, 1.0) * 5.0 + 0.5) / 5.0;
	vec3 col = mix(mc, cc, q);

	vec3 bed = texture(bed_tex, UV).rgb;
	float see = clamp((1.0 - depth * 1.6), 0.0, 1.0) * (0.15 + 0.4 * q) * (1.0 - fall) * (1.0 - rain * 0.6);
	col = mix(col, bed * mix(vec3(0.75, 0.75, 0.55), vec3(0.62, 0.86, 0.84), q), see * 0.55);

	// foam: churning clusters at fall bases, around rocks, lips; more in storms
	float fn = texture(noise_tex, px / vec2(14.0, 7.0) + vec2(TIME * 0.05, -TIME * 0.22 * flow_speed)).b;
	float fn2 = texture(noise_tex, px / vec2(9.0, 5.0) + vec2(-TIME * 0.07, -TIME * 0.31 * flow_speed)).r;
	float fm = foam * (1.0 + rain * 0.6) + wake * 0.25 + (fn * 0.6 + fn2 * 0.4 - 0.5) * 1.1;
	if (fm > 0.72) {
		col = foam_col;
	} else if (fm > 0.6) {
		col = mix(col, foam_col, 0.5);
	}
	if (fall > 0.01 && fallv > 0.8 - rain * 0.15) {
		col = mix(col, foam_col, 0.85);
	}
	if (ring > 0.6) {
		col = mix(col, foam_col, 0.55);
	}

	// winter ice: grows from the banks into calm, shallow water; it does not
	// flow (static pattern), has cracks and a cold sheen; the main current,
	// falls and foam stay open
	if (ice > 0.01 && fall < 0.01) {
		float near = 0.0;
		for (int k = 1; k <= 6; k++) {
			float o = float(k) * 1.5;
			near = max(near, step(texture(TEXTURE, UV + vec2(-o, 0.0) * tp).a, 0.5) * (1.0 - float(k) / 7.0));
			near = max(near, step(texture(TEXTURE, UV + vec2(o, 0.0) * tp).a, 0.5) * (1.0 - float(k) / 7.0));
			near = max(near, step(texture(TEXTURE, UV + vec2(0.0, -o * 0.6) * tp).a, 0.5) * (1.0 - float(k) / 7.0));
		}
		float calm = (1.0 - smoothstep(0.35, 0.8, f.b)) * (1.0 - wake) * (1.0 - foam * 1.5);
		float in_n = texture(noise_tex, px / vec2(40.0, 18.0) + vec2(0.31, 0.77)).g;
		float shelf = near * 1.1 + calm * (1.0 - depth) * 0.6 + (in_n - 0.5) * 0.35;
		if (shelf > 1.05 - ice * 0.75) {
			float crack = texture(noise_tex, px / vec2(23.0, 11.0)).b;
			// translucent blue-grey ice (darker than snow), sheen streaks
			vec3 ic = mix(vec3(0.46, 0.60, 0.70), vec3(0.64, 0.76, 0.84), in_n);
			ic = mix(ic, col, 0.18);
			if (fract((px.x * 0.35 - px.y * 0.9) / 7.0) < 0.12 && in_n > 0.45) {
				ic = mix(ic, vec3(0.86, 0.92, 0.96), 0.7);
			}
			if (abs(crack - 0.5) < 0.025) {
				ic = vec3(0.34, 0.46, 0.58);
			}
			if (shelf > 1.05 - ice * 0.75 + 0.08 && hash(px) > 0.985) {
				ic = vec3(1.0);
			}
			col = ic;
		} else if (shelf > 1.0 - ice * 0.75) {
			col = mix(col, vec3(0.62, 0.74, 0.82), 0.55);   // thin rim of slush
		}
	}
	// sun / moon glints
	float sp = hash(px + floor(TIME * 7.0) * 13.1);
	if (glint > 0.05 && sun > 0.25 && crest > 0.5 && sp > 1.0 - (0.015 + sun * 0.01) * glint) {
		col = mix(col, glint_col, 0.6 + 0.4 * glint);
	}
	COLOR = vec4(col, 1.0);
}
