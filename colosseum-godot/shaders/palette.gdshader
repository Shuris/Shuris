shader_type canvas_item;
// Pós-processamento do mundo: cada cor da tela é levada para a cor mais próxima da
// paleta única do jogo (48 cores tiradas da própria arte), com uma retícula 4x4
// leve nas transições. Resultado: todos os cenários e personagens falam a mesma
// "língua" de cores, como pixel art feita à mão.

uniform sampler2D screen_tex : hint_screen_texture, filter_nearest;
uniform sampler2D palette : filter_nearest;
uniform int colors = 48;
uniform float dither = 0.035;
uniform float strength = 1.0;

const float bayer[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);

void fragment() {
	vec3 c = texture(screen_tex, SCREEN_UV).rgb;
	ivec2 p = ivec2(FRAGCOORD.xy) % 4;
	float th = bayer[p.y * 4 + p.x] / 16.0 - 0.5;
	vec3 q = c + th * dither;
	float best = 1e9;
	vec3 pick = c;
	for (int i = 0; i < colors; i++) {
		vec3 pc = texture(palette, vec2((float(i) + 0.5) / float(colors), 0.5)).rgb;
		vec3 d = q - pc;
		// distância com pesos de percepção (o olho vê mais o verde)
		float dist = dot(d * d, vec3(0.30, 0.59, 0.11));
		if (dist < best) { best = dist; pick = pc; }
	}
	COLOR = vec4(mix(c, pick, strength), 1.0);
}
