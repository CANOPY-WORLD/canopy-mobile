# Canopy Mobile

Independent mobile preview of Canopy. The static frontend is derived from CANOPY-WORLD/canopy revision ab4bcb35705d7022b994622322449e92907abd3e. It retains the shared Three.js renderer, coordinate transforms and published immutable Scenario resources. It is not a replacement deployment of the main Canopy website.

The mobile adapter uses footprint-extruded display geometry, a compact touch interface and lazy optional modules. Scientific result values and timestamps are unchanged. Display geometry is not a solver input. Model computation remains offline.

Source is the buildless `dist/` tree. Serve with `python3 -m http.server 8880 --directory dist`. GitHub Pages publishes `dist/` using `.github/workflows/pages.yml`. Upstream source attribution is recorded here; existing third-party notices remain in the copied modules.

Buildings reuse the published `models/buildings.glb` footprint extrusions (82,461 source buildings). Original polygon outlines, courtyard holes, base elevations and flat roof heights are retained. No raster pooling or footprint simplification is applied. Lightweight Lambert shading replaces PBR shading while retaining source material colors. The immutable remote gzip is 9,759,945 bytes; decoded GLB is 19,264,284 bytes. Optional fine landmark / facade tiles remain disabled.

Landscape surfaces are losslessly gzip-compressed; vegetation is sampled one in eight for display. Regenerate these assets with `python3 tools/prepare-landscape.py`; original immutable URLs and hashes are recorded in `dist/mobile-assets/provenance.json`.

Selecting a model downloads its additional data. Physics playback uses bounded caches and two-frame lookahead rather than preloading the whole publication. This is not a total memory limit. Browser validation uses mobile viewport emulation; physical iPad Safari performance remains to be tested.

Published mobile website: https://canopy-world.github.io/canopy-mobile/

## Publishing

GitHub Pages is configured for GitHub Actions. Pushing `main` publishes the
checked-in `dist/` tree through `.github/workflows/pages.yml`. The `github-pages`
environment permits `main`. The earlier `gh-pages` branch is retained as a
historical publication snapshot; it is no longer the deployment source.
