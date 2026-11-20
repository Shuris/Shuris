// Little Creek — animated creek surface.
// Runs at native art resolution inside the world SubViewport, so every output
// pixel is an art pixel. Output is quantized to a fixed palette ramp.
//  TEXTURE  = water_flow.png  (RG flow dir, B speed, A water mask)
//  meta_tex = water_meta.png  (R fall, G foam, B depth, A sunlight)
shader_type canvas_item;

uniform sampler2D meta_tex : filter_nearest;
uniform sampler2D bed_tex : filter_nearest;
uniform sampler2D noise_tex : filter_linear, repeat_enable;
uniform vec2 world_size = vec2(800.0, 360.0);
uniform float quality : hint_range(0.0, 1.0) = 0.2;   // 0 murky -> 1 crystal clear
uniform float flow_speed = 1.0;
uniform vec3 clean[10];
uniform vec3 murky[8];
uniform vec3 foam_col = vec3(0.945, 0.953, 0.878);

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
float flow_noise(vec2 px, vec2 dir, float spd, vec2 scale, float rate, float chan_off) {
	float t = TIME * rate * flow_speed;
	float p0 = fract(t);
	float p1 = fract(t + 0.5);
	float w = abs(1.0 - 2.0 * p0);
	vec2 d = dir * spd * 26.0;
	vec2 uv0 = (px - d * p0) / scale + vec2(chan_off, 0.0);
	vec2 uv1 = (px - d * p1) / scale + vec2(chan_off + 0.37, 0.21);
	float n0 = texture(noise_tex, uv0).r;
	float n1 = texture(noise_tex, uv1).r;
	return mix(n1, n0, w);
}

void fragment() {
	vec4 f = texture(TEXTURE, UV);
	if (f.a < 0.5) {
		discard;
	}
	vec2 px = floor(UV * world_size);
	vec2 dir = f.rg * 2.0 - 1.0;
	float spd = f.b;
	vec4 meta = texture(meta_tex, UV);
	float fall = meta.r;
	float foam = meta.g;
	float depth = meta.b;
	float sun = meta.a;

	// perspective: ripples get wider/coarser toward the viewer
	float persp = clamp((px.y - 160.0) / 200.0, 0.15, 1.0);
	vec2 sc_big = vec2(150.0, 38.0) * (0.55 + persp * 0.6);
	vec2 sc_fine = vec2(60.0, 12.0) * (0.55 + persp * 0.6);
	float r1 = flow_noise(px, dir, spd, sc_big, 0.22, 0.0);
	float r2 = flow_noise(px, dir, spd * 1.4, sc_fine, 0.35, 0.5);

	float v = 0.64 - depth * 0.48 + sun * 0.18 + (r1 - 0.5) * 0.42;
	// light crests (horizontal glints)
	float crest = smoothstep(0.66 - sun * 0.08, 0.74 - sun * 0.08, r2 * (0.7 + r1 * 0.6));
	v += crest * (0.18 + sun * 0.2);
	// dark troughs right below crests give the "ripple line" look
	v -= smoothstep(0.22, 0.12, r2) * 0.1;

	// near the banks: darker reflection of the vegetation
	float edge = 0.0;
	vec2 tp = 1.0 / world_size;
	edge += step(texture(TEXTURE, UV + vec2(0.0, -2.0) * tp).a, 0.5);
	edge += step(texture(TEXTURE, UV + vec2(-2.0, 0.0) * tp).a, 0.5);
	edge += step(texture(TEXTURE, UV + vec2(2.0, 0.0) * tp).a, 0.5);
	v -= edge * 0.06;

	// waterfall curtains: fast vertical streaks
	float fallv = 0.0;
	if (fall > 0.01) {
		float s1 = texture(noise_tex, vec2(px.x / 3.5, px.y / 46.0 - TIME * 1.15 * flow_speed)).g;
		float s2 = texture(noise_tex, vec2(px.x / 2.0 + 0.3, px.y / 30.0 - TIME * 1.6 * flow_speed)).b;
		fallv = clamp(s1 * 0.8 + s2 * 0.5, 0.0, 1.0);
		v = mix(v, 0.4 + fallv * 0.62, fall);
	}

	float d = bayer4(px) * 0.11;
	vec3 cc = ramp_clean(clamp(v + d, 0.0, 1.0));
	vec3 mc = ramp_murky(clamp(v * 0.78 + 0.02 + d, 0.0, 1.0));
	float q = floor(quality * 5.0 + 0.5) / 5.0;
	vec3 col = mix(mc, cc, q);

	// creek bed visible through shallow, clear water
	vec3 bed = texture(bed_tex, UV).rgb;
	float see = clamp((1.0 - depth * 1.6), 0.0, 1.0) * (0.15 + 0.4 * q) * (1.0 - fall);
	col = mix(col, bed * mix(vec3(0.75, 0.75, 0.55), vec3(0.62, 0.86, 0.84), q), see * 0.55);

	// foam: churning clusters at fall bases, rings around rocks, lips of falls
	float fn = texture(noise_tex, px / vec2(14.0, 7.0) + vec2(TIME * 0.05, -TIME * 0.22 * flow_speed)).b;
	float fn2 = texture(noise_tex, px / vec2(9.0, 5.0) + vec2(-TIME * 0.07, -TIME * 0.31 * flow_speed)).r;
	float fm = foam + (fn * 0.6 + fn2 * 0.4 - 0.5) * 1.1;
	if (fm > 0.72) {
		col = foam_col;
	} else if (fm > 0.6) {
		col = mix(col, foam_col, 0.5);
	}
	if (fall > 0.01 && fallv > 0.8) {
		col = mix(col, foam_col, 0.85);
	}

	// sun sparkles
	float sp = hash(px + floor(TIME * 7.0) * 13.1);
	if (sun > 0.25 && crest > 0.5 && sp > 0.985 - sun * 0.01) {
		col = vec3(1.0, 0.98, 0.9);
	}
	COLOR = vec4(col, 1.0);
}
