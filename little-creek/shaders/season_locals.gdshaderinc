// Seasonal uniforms as per-material parameters (set by Atmosphere).
uniform float world_wind = 0.25;
uniform float season_autumn = 0.0;
uniform float season_bare = 0.0;
uniform float season_winter = 0.0;
uniform float season_bloom = 0.0;
uniform float season_lush = 0.0;
uniform sampler2D season_noise : filter_nearest, repeat_enable;
uniform float season_young = 0.0;
uniform float snow_cover = 0.0;
