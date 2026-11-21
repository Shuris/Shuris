// Seasonal uniforms as global shader parameters (set by Atmosphere).
global uniform float world_wind;      // 0..1 from the weather system
global uniform float season_autumn;   // 0..1 autumn colours
global uniform float season_bare;     // 0..1 canopy thinning
global uniform float season_winter;   // 0..1 dull / cold
global uniform float season_bloom;    // 0..1 spring blossoms
global uniform float season_lush;     // 0..1 summer saturation
global uniform sampler2D season_noise : filter_nearest, repeat_enable;
global uniform float season_young;
global uniform float snow_cover;
