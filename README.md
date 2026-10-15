# Borough II
A standalone browser city simulation with a Cities: Skylines II inspired interface and a real Three.js 3D view. It is an original small game, not the commercial game or a reproduction of its complete simulation.

## Run
`python3 -m http.server 4173 --directory dist`
Open http://localhost:4173. No build or dependency installation is needed. Three.js 0.170.0, OrbitControls and Reflector are vendored with their MIT license. Google Fonts are optional; the interface has system font fallbacks.

## Main menu and game lifecycle
The site opens to a home screen with Continue, New Game, Load Game and Settings. The city in the menu background is a separate unsaved demonstration world. It never changes a player's save. No player simulation runs on the home screen. Continue/Play/Start New City begin simulation only after the player chooses them. The game menu pauses simulation. Save & Exit verifies a save before returning home. Failed saves keep the city open. Reloading or reopening the page returns to the home screen, with Continue available for the saved city.

## Features
48×48 seeded river, islands and plains worlds; rotatable and zoomable 3D camera; scanned CC0 grass, asphalt and brick surfaces; rolling terrain and banks; animated water; varied houses, apartments, shops and office towers; curbs, sidewalks, crosswalks, road lamps and bridge supports; trees, shadows, night lighting and cars. Drag roads and bridges; choose from eight road types and use straight or curved paths. Avenues cost more but support more traffic. Road paths are checked before construction, so a blocked or unaffordable path does not partially build. Paint low/high density housing, commerce, industry and offices with brush sizes 1, 2 and 4. Connected power and water gate development; capacity matters. Build healthcare, schools, police, fire protection, parks, recycling centers and bus depots. Services affect happiness, protection capacity, pollution or congestion. Taxes, upkeep and loan repayment affect the city budget. Milestones, demand indicators, inspection, bulldozing, information overlays, photo mode and graphics settings are included.

Buildings must be beside roads connected to a map edge. Start by extending the starter road and placing a power station and water tower, then paint zones beside roads. Services have capacities based on the simplified city model; this version does not simulate individual emergency dispatch, sewage pipes, bus routes, dynamic water physics or the complete commercial game's agent simulation. Vehicles move along connected roads; congestion is a capacity metric.

## Controls
- Right-drag: rotate and tilt
- Middle-drag or WASD: pan
- Scroll or +/−: zoom
- Left-drag: draw roads or paint zones
- Space: pause/resume
- Ctrl/Cmd+S: save
- Escape: cancel tool or open menu
- On touchscreens: one finger rotates in inspection mode; two fingers pan/zoom; one finger paints with a build tool selected

## Saves
Worlds are stored in localStorage under the original `borough.worlds.v1` key, scoped to browser profile and website origin. Existing v1 worlds load unchanged. Saves contain terrain, buildings, residents, funds, day, taxes, loan balance and development state. Saves do not sync to another browser or device. Export/import JSON backups transfer worlds. Import validates data and assigns a fresh world ID.

Writes are read back and compared before the UI reports success. Each stored world is a detached snapshot, so live changes cannot mutate an earlier save in memory. Last verified save time appears in the HUD, game menu and world list. Autosave runs every 300,000 ms while a city is open, including while paused. Overdue saves are checked each second; browsers can delay timers in suspended tabs. Page hiding and page exit also attempt a synchronous save. Closing a browser cannot keep an autosave timer running. Save & Exit saves before returning home and prevents exit on failure. Cross-tab storage changes pause a live session to avoid overwriting another tab's progress. Corrupt existing storage is preserved, and the export action can download its original data for recovery.

## Validation
`node --test tests/engine.test.cjs`
`node --check dist/app.js`
`node --check dist/renderer.js`

Tests cover world isolation, save verification, rejected/quota writes, snapshot isolation, old data validation, utilities and growth, costs, road connectivity and atomic paths, services, five-minute autosave while paused, and home/start/pause/exit/continue/reload lifecycle. Browser QA covers actual 3D building placement, old save loading, new-world start, save/exit/reload/continue, pause, autosave, and desktop/mobile layouts.

## Design reference
The dark translucent HUD, blue buttons, bottom category tools and build panels were guided by the [official Cities: Skylines II gameplay screenshots](https://www.paradoxinteractive.com/games/cities-skylines-ii/about). Game code and procedural geometry are original; the detailed facade meshes use credited CC0 assets. The reference screenshots are not shipped as game assets.

## GitHub Pages
The `Publish game to GitHub Pages` workflow tests the engine and publishes `dist` on each push to main. Enable Pages with GitHub Actions as the source. All runtime modules and textures use relative URLs for project-site hosting. Asset credits and licenses are in `dist/assets/CREDITS.md` and `dist/vendor/THREE-LICENSE.txt`.

Moving from the original ChatGPT site to GitHub Pages creates a different storage origin. On the old site, open Load Game and Export each world; on the GitHub site, open Load Game and Import the JSON backup. Keep backups outside the public repository.

## Graphics revision 4
Replaces square lot slabs with gardens and driveways, corrects inward-facing roof triangles, adds hipped roof styles, chamfered building footprints, varied proportions, darker glazing, detailed CC0 window meshes with PBR textures, leafy cutout canopies, smoother riverbanks, rounded junction corners, crosswalks and traffic signals. The home background is an unsaved demonstration city with residential neighborhoods and a concentrated office district. Player save format remains version 1.

### Edition 5: roads and building catalogue

- Eight road specifications: gravel, alley, two-lane, one-way, four-lane,
  tree-lined avenue, six-lane boulevard and highway. Width, markings, cost,
  capacity and vehicle animation speed differ.
- Straight mode: drag from start to end. Curved mode: click start, control/bend
  point, then endpoint. Escape cancels. Previews show the construction quote;
  blocked or unaffordable paths leave the city unchanged. Endpoints snap to
  existing road endpoints. Bridges cost four times the land construction rate.
- Curves are persistent quadratic paths rendered as continuous road surfaces.
  Underlying connected cells support the existing economy and zoning system.
  Bulldozing any cell belonging to a path removes that whole path for ₡10;
  shared intersections and pre-existing roads are retained.
- 38 selectable building/zone options across housing, commerce, industry,
  offices, power, water, health, education, emergency services, parks,
  transportation and waste. Facilities have individual costs, upkeep and
  service-capacity multipliers. New models include turbines, solar arrays,
  treatment tanks, row houses, courtyards, sports courts and fountain plazas.
- Continuous riverbank profiles, more detailed surrounding terrain, textured
  lots, balcony railings and expanded procedural architectural styles.
- Version-1 worlds remain loadable. New road paths and building choices are
  included in manual saves, five-minute autosaves and exported backups.

This remains a lightweight city simulation: traffic is illustrative, road
capacity feeds a citywide congestion metric, and there is no lane-level route
planning, grade-separated interchange editor or Cities: Skylines II asset set.

### Edition 6: zoning and district architecture

Housing and commerce now use **free density-based zoning**, rather than choosing
and paying for a specific building. Industry and offices also use zoning. Choose
Rectangle, Brush or Fill block; green lots are residential and blue lots are
commercial. Eligible land is within four connected land cells of a street;
highways do not provide frontage. The zoning tool highlights eligible lots.

Private development requires a road network connected to the map edge, available
power and water, demand and adequate happiness. Lots visibly pass through three
construction stages before a developer selects a building. The inspector explains
why a lot is waiting. Removing zoning cancels unfinished development and preserves
occupied buildings. Bulldozing a developed zoned lot allows redevelopment.
Service buildings remain individually placed and paid for.

Older saves migrate once: developed buildings stay intact; undeveloped legacy
housing/commercial tiles become zones. Zoning, density and construction progress
are included in existing verified saves and backups. Explicitly removed zoning
stays removed on reload.

The district renderer replaces residential, commercial and office massing with
pitched-roof houses, dormers, porches, gutters, recessed balconies, asymmetric
terraced towers, elliptical office facades, mullions and storefront awnings.
Terrain now has broader river valleys, layered hills, blended shore materials,
shoreline rocks, irregular tree crowns and woodland beyond the playable map.
It is still a lightweight procedural browser game, not commercial-game graphics
or a reproduction of Cities: Skylines II's simulation.

### Edition 7: rendering overhaul

- Detailed, textured architectural wall, door, window and cornice modules at
  close range, with simpler façades farther away.
- Photographic HDR daylight, reflected sky/ground lighting, depth-based contact
  shading, multisample antialiasing and a filmic display transform.
- Detailed 3D pine geometry nearby and compact tree impostors at distance;
  broadleaf vegetation uses four views rendered from a detailed CC0 tree model.
- Gameplay camera centers on the developed city with a closer starting view.
  Roads, shoreline water and vegetation materials have been retuned together.
- High quality enables contact shading and nearby detailed models. Low quality
  disables those effects, reduces pixel density and uses lighter geometry.

Asset sources and licenses are in `dist/assets/CREDITS.md`. `node tests/assets.test.cjs`
checks shipped model buffers, local texture dependencies, generated tree images
and the HDR file. Simulation and save formats are unchanged in this edition.

## Edition 8 visual revision

Compatible developed cells now share larger visual building sites; simulation cells and saved zoning are unchanged. Apartment families include slab towers, brick mid-rises, glass towers, balcony towers and stepped terraces. Close views use batched window recesses and sills with varied materials. Terrain color multiplication is corrected and developed block interiors gain small trees. This remains an original simplified browser city-builder, not a recreation of the commercial game engine or its assets.

## Edition 9 architecture and terrain

High-density housing and offices use contour-built floor plates: rounded, elliptical, lens-shaped and tapered profiles, continuous balconies, reflective physical glass, and batched facade ribs. Traditional masonry remains mixed into residential districts. Terrain now blends scanned grass at two world-space scales with soil at low banks and rocky slopes, with more detailed distant ridges and denser woodland. Existing city cells, roads, zoning, persistence and start controls are preserved. Browser checks cover rendered daytime/nighttime scenes; automated geometry tests validate every new profile family.

## Edition 10 city blocks and detail

Most urban development now forms street-facing podiums, perimeter courtyard blocks and varied masonry towers; sculpted towers are less frequent. Roofs include scanned surfaces, ventilation fans, connected ductwork and bounded equipment layouts. Near-camera broadleaf trees use a 2.98 MB simplified CC0 3D model, while distant trees retain lightweight views. Verge trees and instanced decorative pedestrians add street scale; pedestrian animation follows the pause/start state and does not modify simulated population. The home backdrop uses denser downtown blocks and a closer camera. Saved cities and zoning remain intact. This is still a simplified original browser game and does not reproduce Cities: Skylines II.

## Edition 11 building renderer rebuild

The private-building renderer has been replaced for housing, commerce, offices and industry. Buildings are generated at their real lot dimensions, including rectangular two-by-three parcels, rather than stretching a single-cell model. Road-facing masonry walls have physical piers, spandrels, recessed glazing, sills and mullions. New house, shop, warehouse, courtyard and tower forms include porches, awnings, balconies, stepped volumes, roof equipment and landscaping. Floor and vehicle dimensions now use a consistent scale.

City geometry is combined into shared material batches instead of drawing every building separately. Daylight, glass and scanned cladding have been retuned. The river now reflects the actual scene through Three.js's MIT-licensed Reflector, refreshed at a capped rate; Low graphics disables the reflection pass. Terrain materials add finer ground variation. Geometry regression tests cover parcel orientation, visible roof normals, finite surfaces, batching bounds and vehicle size.

This is a larger renderer replacement, but still an original procedural browser city-builder with lower visual and simulation complexity than Cities: Skylines II. Save format, five-minute autosave, manual save, multiple worlds, curved roads, zoning and the explicit home-screen start flow remain unchanged.

## Edition 12 architecture and terrain replacement

Urban architecture now uses continuous concave or curved floor outlines: L-shaped and U-shaped blocks, chamfered slabs, rounded offices, elliptical towers and terraced silhouettes. Facades follow those outlines at a consistent bay width, with recessed rooms, blinds, cornices, cantilevered balconies and glass railings. Roof triangulation preserves open courtyards, and mechanical plant is placed inside each actual footprint. Detached houses now have hip roofs, dormers, projecting bay windows, secondary wings, garages, porches and garden details. Building height varies independently from architectural family.

Surrounding terrain uses a cached, seeded, domain-warped ridged heightfield with 26 thermal erosion passes. The playable valley retains its previous elevation range. Scanned rock textures blend across steep faces, with ground grasses and riverbank reeds in undeveloped areas. Low graphics hides this ground cover. Atmospheric haze is reduced so distant landforms remain visible.

Automated tests additionally verify concave roof triangulation, roof orientation, deterministic terrain and the playable valley elevation boundary. These changes retain the save schema and all simulation controls. The result remains an original procedural game; it does not match the commercial game's visual detail or simulation breadth.

## Edition 13 imported architecture

Private development now uses 21 complete textured GLB building models assembled from Poly Haven's CC0 architectural kits: houses, masonry apartments, courtyard blocks, rounded towers, offices, shops and industrial buildings. Original modeled windows, doors and cornices retain their PBR textures. Models fit parcels with uniform scale, share indexed geometry and render as instances. Geometry is simplified before shipping; the two building libraries total about 21 MB. Service buildings retain their existing models.

Photogrammetry-based coastal rock patches replace primitive shoreline rocks, alongside the existing eroded terrain and scanned ground surfaces. The closer camera reveals facade detail. Saves, zoning, roads and explicit simulation start remain unchanged. Detailed models increase download and rendering costs; no universal frame-rate target is guaranteed.

To rebuild assets, download the glTF packages for `modular_urban_apartments_facade` and `modular_factory_facade` into `urban/` and `factory/` inside a working directory, each with `source.gltf` and its dependencies. Run `python3 scripts/build-model-library.py WORKING_DIRECTORY`, then use glTF Transform 4.x `prune` on each generated `buildings.gltf` to produce a GLB. Run `node scripts/optimize-models.mjs NODE_MODULES INPUT_GLB OUTPUT_GLB RATIO` with a node_modules directory containing glTF Transform and meshoptimizer, using ratios .025 for urban and .035 for industry. Asset tests validate geometry, texture dependencies, download budgets and runtime instancing.

## Edition 14 performance

Individual buildings outside the camera view are excluded from instanced draws. Beyond 18 world units, simplified meshes reuse the original textures; Low uses these meshes throughout. The distant library contains 220,112 triangles versus 1,141,712 across the original templates (81% fewer). Coastal patches now contain 3,527 triangles instead of 100,791. Fewer nearby trees use detailed geometry. Shadows use 2048 maps, and High reflections refresh at most four times per second at 384 pixels.

Balanced is the new default: shadows and nearby building details remain, while screen-space contact shading and scene reflections are disabled. High and Low remain selectable, and the preference persists separately from city saves. Settings shows measured FPS and rendered triangle counts. Runtime results depend on hardware and city size. Generate the separate distant geometry with `node scripts/build-lod.mjs NODE_MODULES` after building the source GLBs.

## Edition 15 running-city performance

Building models, textures, distance thresholds and graphics presets are unchanged. Static road scenery is batched by material, shadow state and spatial region without removing vertices. Cars share instanced geometry while retaining their existing shapes, materials and motion; curved road samples are cached when the road network changes.

Renderer invalidation now distinguishes buildings, roads, vegetation, zoning and occupancy. Camera movement and resident/economy updates no longer rebuild unrelated scenery or recolor the natural terrain. Road demolition correctly invalidates road scenery. Starting a city skips duplicate overlay/night rebuilds. Visibility matrices are uploaded only when the camera, quality or instance set changes, and paused pedestrians skip animation work. The game HUD displays live FPS. Regression tests verify unchanged geometry, vehicle movement and invalidation boundaries.

## Edition 16 outside connections and routed traffic

Every edge road now has a rendered regional-road extension and a roadside outside-connection sign. The city overview lists connections, reachable destinations, active trips and completed trips, with a camera shortcut to the connection. These are the same edge roads used by the existing development connectivity rule.

Vehicles enter from beyond the playable map, follow connected routes to developed residential/commercial/industrial/office frontage, stop at the destination and return through a reachable exit. A destination must have both an inbound and outbound route. Authored one-way direction is respected; legacy un-authored one-way cells use increasing grid-index direction. Curved paths reuse their sampled geometry. A bounded pool of 32 vehicles uses instanced rendering, with basic following distance and arrivals spaced in simulation time. Pausing freezes trips. Disconnected/empty road networks generate no destination trips; removing a used link cancels the affected trip. Valid trips remain across road additions.

This is destination routing, not the full commercial game's household, logistics, lane-changing or junction-priority simulation. Resident growth and the economy still use the existing aggregate model. Traffic agents are transient and restart outside the map after loading a city; roads, buildings, zoning and all existing city save data remain persistent. Residential trips currently represent visits, rather than individual persistent citizens. Trip labels do not imply delivered goods or migration changes to the economy.

## Edition 17 households and resident routines

Every simulated person in an occupied home now receives a stable resident ID and household membership. Existing population is migrated when the city starts; subsequent population growth/removal is reconciled with the saved roster. Households group up to three members at a home. The current simplified workforce includes two thirds of residents. Workers reserve reachable jobs within each workplace's capacity. Residents commute from their home to work, spend time working, visit a reachable shop, and return home; nonworkers can make shopping trips directly. These local trips replace the previous generic residential visits from outside.

The same directed road graph and cached curved-road geometry drive resident vehicles. The existing 32-vehicle pool is shared, with outside visitors capped at six so resident travel has capacity. People wait when no vehicle or route is available. Resident state, assignments, activity timers, visit counts and active-trip progress are saved with the world. Save validation accepts old worlds without this optional data and rejects malformed resident records. Population and tax/growth calculations still use the existing aggregate engine, so this is not a full household-economy simulation.

Open **City overview → Residents & households** to see individual activities, home/work addresses and visit history. Locate centers the camera on a resident's current car or building. Building inspection shows people who live or work there. Home/job demolition cleans up affected memberships and assignments. Pausing or returning home stops routines. In-progress resident trips resume after loading; transient outside visits continue to restart outside the city. This remains an original browser simulation with a smaller scope than Cities: Skylines II.

### Edition 26.1 — transit simulation optimization

Stop catchments reuse network geometry and compute distances once per stop. Dwelling buses share a passenger index instead of scanning the whole city for each line. Route choices, capacity, save format, and offscreen simulation remain unchanged. Regression checks cover catchment selection, road-change invalidation, and simultaneous boarding.

### Edition 27 — facade and rooftop architecture

The twenty original modern models now include recessed horizontal window reveals, balcony divisions, hollow parapets, detailed rooftop fans, and furnished pergola terraces on perimeter blocks. Four perimeter residential/retail models use shared brick color, normal and roughness maps with metre-scale UVs. Near geometry has 113,212 triangles across the full library; authored distant topology retains all window panes and wall openings, sharing the near vertex buffers and omitting only small detail (76,232 triangles). Buildings keep full details to 320 m in the normal graphics mode. Traffic and resident simulation are unchanged.

The modern GLB is 8,184,308 bytes. Packed, aligned signed-byte normals retain full-precision positions; 512-pixel embedded brick textures avoid duplicating the full scan download. Run `scripts/build-modern-library.py` with Python and Pillow to rebuild it and append its authored indices to the existing LOD cache. If rebuilding all libraries, run `build-lod.mjs` for the masonry/industrial libraries first, then the modern generator. Do not use generic geometric simplification on the modern facades: it can close window openings.

### Edition 28 — saved landforms and slope foundations

New worlds have seed-based inland relief: river shelves, coastal terraces, or rolling plains, with a flatter starter valley and the original outside-road elevation. `landformVersion: 1` is saved with the world; older saves retain their previous elevations. Terrain sculpting continues to add saved offsets to the same ground surface.

Loaded building models receive horizontal lot pads with retaining walls sampled along the perimeter. The walls use shared masonry material and merge into one draw batch per material, while buildings remain instanced and offscreen simulation continues independently. The initial camera accounts for ground height in new worlds. Tests cover continuity, saved profile compatibility, road-corridor preservation, rotated lot bounds, foundation contact, and district batching.

### Edition 29 — connected pedestrian travel

Parks & recreation now includes straight and curved pedestrian paths. Residents use connected footpaths and street sidewalks to reach homes, jobs, shops and bus stops. Short trips can be made entirely on foot; bus catchments use walkable distance instead of a straight line through buildings. Buildings, construction, water and roads without sidewalks block walking. Removing a connection makes affected residents wait at their current position until access returns.

Pedestrians displayed in a running city are actual saved residents. Their routes advance on the independent simulation clock, including when they are outside the camera view. Rendering uses four shared instanced body-part meshes and a 1,024 visible-person budget; that budget never limits the simulated population. Footpaths batch their full terrain-following geometry spatially. Route choices cache until network changes, and overlapping segments share graph nodes and edges. A synthetic 20-overlapping-path check reduced graph construction from 2,820 nodes / 165,580 directed edges to 141 nodes / 280 edges while retaining the exact route; measured local construction time was about 96 ms before and 4 ms after. This is a CPU microbenchmark, not an FPS claim.

Walking positions, destinations and purposes save with each world and resume after reload. The 125-test suite covers blocked routes, work/shop routines without rendering, saved progress, pause, reconnection, rendering culling, path costs/deletion, malformed imports and graph reuse alongside existing traffic, bus, terrain and persistence checks. Browser QA uses separate imported worlds; it verifies curved path placement, manual-save confirmation, reload and resident activity without modifying a player's existing city. The full commercial game's scope and visual fidelity remain beyond this release.

### Edition 30 — inhabited building grounds

Building lots now have category-specific grounds: private homes get entrance walks, rear patios, planted beds, fences and driveways where space permits; urban forecourts add seating and bicycle stands; shops and industry can have marked parking bays and service yards. These are visual site features, not a new parking or goods-delivery simulation. Detail placement uses each selected model's complete bounds so it does not cover buildings or spill into neighboring parcels. Ordinary grid roads now supply frontage information as curved roads do. Low-density homes use an appropriate coverage target and a broader set of complete models, avoiding neighborhoods made from one largest-fitting house.

All site props share geometry/materials and use the building instancer. Yard trees retain their complete nearby geometry, then switch to shared distant views outside 30 world units. The switch uses each tree's position so a tall building's center cannot incorrectly downgrade a nearby tree. Rendering does not change resident, walking or vehicle simulation. Tests cover site bounds, clear entrances, private gardens, urban furniture, model variety, geometry sharing, safe demolition and exact restoration of close tree geometry after zooming back in.

### Edition 31: reusable city and terrain rendering

Building batches retain their GPU buffers when capacity permits, cache immutable model transforms, and reuse unchanged foundation geometry. Terrain rebuilding reuses exact height samples and caches full-resolution natural meshes; closing an overlay restores cached natural colors. Geometry, textures, simulation timing, offscreen traffic and saves are unchanged.

The reproducible 201-lot CPU benchmark (`node scripts/benchmark-rebuild.mjs`) compared this revision with Edition 30: median repeated rebuild 10.80 to 2.02 ms, adding one building 11.39 to 2.44 ms, and replaced instance buffers 45 to 0. Geometry and visible transforms matched exactly. These are local CPU measurements, not browser FPS or end-to-end loading claims. All 139 automated tests and asset validation passed.

### Edition 32: lossless asset downloads

Modern buildings and distant indices now download as gzip copies (17,253,780 bytes to 3,959,500 bytes, 77% less transfer). Browser decompression restores the original bytes, including every vertex, texture and index. Distant indices begin downloading alongside the building catalogues. Unsupported browsers, missing archives and corrupt archives fall back to the original assets. Requests for these two assets abort after 45 seconds without incoming data; slow transfers continue while bytes arrive. Other asset loaders retain their existing behavior.

The loading indicator identifies pending asset groups. After changing modern buildings or LOD data, run `node scripts/compress-assets.mjs`; CI verifies the archives decode exactly to the current originals with `node scripts/compress-assets.mjs --check`.

### Edition 33.2: planted architecture

Modern buildings carry authored planter footprints and elevations. Their larger planters now contain shared broadleaf tree models instead of raised green blocks, including courtyard planting and gardens on the rear roofs of perimeter blocks. Canopies fit inside each bed after model normalization, scaling and road-facing placement. Corrected a sunken planter and moved mechanical equipment onto its supporting wing.

Trees share geometry and materials with existing landscaping. Roof planting uses complete models nearby and crossed tree images beyond 18 world units; it is never removed merely because the building uses distant geometry. This is visual planting, with no new resident or traffic behavior. Regenerated original modern models retain facade detail and lossless compressed delivery.

### Edition 34: civic architecture

Ten original detailed models now match the health, education, police and fire catalogue: clinic, hospital, wellness centre, elementary school, high school, college, police station, headquarters, fire station and rescue station. Recessed windows, brick and painted cladding, entrance canopies, distinct wings and garage bays replace their simpler fallback forms. The complete building library now contains 51 models. Existing saves select the correct facility, including default choices in older saves.

Models remain inside their existing lots and share the instanced renderer and authored distant geometry. Compressed modern-model transfer increases by 113,852 bytes. Service costs, capacity, simulation and save format are unchanged; larger facility footprints and emergency dispatch are not introduced in this release. All 149 tests pass, including model selection, street orientation, lot bounds and unchanged service state.

### Edition 35: remove unused startup downloads

The fallback architecture renderer now creates its existing detailed window bays directly. It no longer downloads or parses two unused legacy GLTF kits, eliminating 16 requests totaling 8,443,356 asset bytes from an uncached startup. Those bytes are original file sizes, not a measured transfer-time or FPS improvement. The active modern building library, terrain textures, trees and lighting remain unchanged.

`node scripts/verify-architecture-startup.mjs` compares with the fully loaded Edition 34 renderer (commit `319480d`). All 608 catalogue/variant/day/night/distance cases retain identical geometry, instance transforms, material properties and canvas texture drawing commands. Close-up detail is now available without waiting for those kits. The 150-test suite also covers startup with unavailable networking and continued offscreen vehicle, transit and pedestrian simulation.

### Edition 36: connected street frontage

Developed lots now connect to their actual roadside sidewalk with terrain-aware access paving. Urban buildings receive broader entrance aprons; low-density homes receive narrow walks. The surfaces follow the road-facing parcel edge, meet raised sidewalks, narrow around neighboring parcels, and skip water, blocked land, highways without sidewalks, distant road ends and abrupt elevation changes. They close the visible grass gap between existing lot paving and streets without changing property ownership or saves.

Access geometry shares the sidewalk material and is batched into spatial groups. It rebuilds on building/road/occupancy changes, not ordinary camera or population updates. This is visual access paving; existing resident and pedestrian routing is preserved. Automated checks cover straight and curved frontage, terrain, blocked approaches, demolition and static-render reuse. Local browser comparison uses the saved Curved frontage QA city; no player city is modified for verification.

### Edition 37.2: street-level architecture

Modern buildings now have ground-level doors, thresholds, frames and handles instead of repeating upper-floor windows to the pavement. The three modern commercial models also have transparent shop glazing, opaque recessed room backs, display shelving and original shared signage. Storefronts group several window bays into wider shop units with an entrance, and canopy-mounted signs remain visible from the street.

The library retains 30 modern models and 51 complete buildings overall. Full modern geometry increases from 126,012 to 128,196 triangles; its lossless compressed download grows by 33,974 bytes. Two additional materials are shared across storefronts. Distant topology retains glazing, signs, doors and room backs while omitting small display details. These are visual interiors and entrances, with no changes to resident routing, economy or save data. All 156 tests passed; browser QA checked the separate Streetfront architecture QA city in daylight and at night.

### Edition 38: scalable commuting and traffic checks

Car capacity now grows from 32 to as many as 512 slots with population (one slot per four residents), plus additional slots when required to restore saved journeys. Growing the fleet preserves existing agents and routes; population decline does not remove cars mid-trip. Large populations receive fair departure checks across twenty scheduling ticks, while small-city scheduling retains its previous cadence. Walking, buses, outside connections and five-minute saves continue independently of camera visibility.

Traffic uses conservative spatial lane bands for larger fleets, updating membership after each vehicle moves. Oblique routes fall back to a full active-agent scan; small fleets retain the original loop. The same exact collision, stopping-distance and intersection rules still decide movement. No building, terrain or vehicle geometry is reduced.

`node scripts/benchmark-traffic-spatial.mjs` compares 600 simulation steps over five trials with full-scan collision checks. On the development machine, median CPU times were 23.04 → 14.91 ms for 128 agents and 504.55 → 139.92 ms for 512; the 32-agent path was essentially unchanged. These are synthetic traffic CPU measurements, not browser FPS or whole-game speedups. All 162 tests pass, including exact 512-agent state comparison over 120 simulated seconds, arbitrary-heading corridor coverage, fleet growth preservation and fair resident scheduling.

### Edition 39: road-aligned developed sites

Dense residential, commercial and office zoning beside authored diagonal or curved roads can now form rotated sites across compatible neighboring cells. The complete site footprint is checked against every intersected cell, so it cannot cross roads, water, facilities, construction or density boundaries. Buildings use the resulting road-facing dimensions directly instead of shrinking into a grid-aligned rectangle. Paving, planted strips, entrance walks and terrain-following retaining walls use the same orientation.

This changes visual consolidation of developed zoning. The underlying zoning cells, ownership rules used by the simulation, residents and saved data remain unchanged; freeform property editing and individual resident entrances are still outstanding. Grid-aligned streets and low-density houses retain their existing lot planning. Demolition and road edits invalidate the cached site layout. The curved-road QA district contains 18 rotated sites; unchanged layouts reuse their plan. Geometry tests check every rendered model/grounds vertex against its reserved cells, including the complete detailed asset library.

### Edition 40.1: terrain surface shading and supported vegetation

Terrain grass now uses the same world-space projections for color, normal detail and roughness. Exposed rock normal detail blends three directional projections matching the rock color texture, so steep faces no longer receive only a top-down bump map. Derivative-based tangent frames orient the detail to each projection while preserving the underlying terrain normal. Existing terrain heights, scanned textures and building geometry are retained.

Scattered trees now sample the slope at their actual trunk position and skip faces steeper than approximately 35 degrees. Hilltop and gentle-slope trees remain; both detailed vegetation and the fallback tree renderer use the same filtered positions. The fallback also respects outside-road clearances. This is scenery placement and shading, with no changes to traffic, pedestrians or save data. Browser comparisons use the same sculpted Terrain surface QA fixture, with daylight and night shader checks; this release does not claim a measured FPS gain.

### Edition 41: full-sized civic sites

New health, education, police and fire facilities reserve complete sites from 40 × 40 m clinics to a 100 × 60 m college. Ten original campus models add separate wings, courtyards, entrance canopies, sports courts, garage bays and mechanical roofs while keeping windows and doors at metre scale. Existing single-cell facilities retain their saved footprints and compact models.

Choose a facility, press **R** to rotate, and click to place. The complete footprint is previewed; blocked sites spend no money. Road access can reach any site edge, capacity and upkeep count once, and inspecting or bulldozing any occupied cell addresses the whole facility. Facilities retain their ownership and orientation through manual save, five-minute autosave, save-and-exit, and backup import.

Facility road-access calculations inspect the perimeter rather than allocating and searching every occupied cell. Preview geometry is reused while the hovered site and validity remain unchanged. The 10 additional campus models use the existing shared materials and lossless asset compression; the modern catalogue is 11,495,408 raw bytes / 2,571,457 compressed bytes. This is not a measured FPS improvement. Traffic, bus, resident and walking clocks remain independent of render visibility.

### Edition 42: connected intersection surfaces

Drawn roads now share an intersection surface instead of crossing over each other's sidewalks, median strips and lane paint. The geometric planner handles four-way crossings, T-junctions, angled approaches, different carriageway widths, curves, and connections to older grid roads. Corner curbs follow the open approach mouths; crossings receive zebra markings and incoming stop lines. Branches ending inside another street's pavement extend visually to that street's centerline without changing their saved controls.

Signals now stand beside the actual approach sidewalks with smaller, correctly scaled heads. Their colors still use the existing traffic controllers. Road and sidewalk surface heights are consistent across old and drawn roads, and building access walks meet the sidewalk height.

Intersection detection uses a spatial hash to limit segment comparisons. Sampled render centerlines are shared with the road renderer, and static road geometry still rebuilds on network edits rather than camera movement. Tests compare vehicle positions and simulation time with and without repeated pavement rebuilds. This release does not claim a measured FPS gain or change the traffic routing/control model.

## Edition 43: pitched neighborhood houses

Low-density zoning now selects eight original house models: cottages, brick and winged bungalows, dormered and porch-front family homes, paired houses, and narrow townhouses. Real gable/hip roof planes, eaves, recessed sash windows, gutters, chimneys, and porch posts replace the previous taller low-density blocks. Detached housing and townhouse choices use their appropriate forms deterministically, including after reload.

The eight designs add 13,744 triangles across the asset library and 129,589 compressed bytes. They share the existing 13 materials and instancing system. Distant geometry retains the roof silhouette and every glass pane while omitting small roof courses, gutters and sills. No traffic, walking, or simulation timing behavior changes. The full suite passes 190 tests; asset compression round-trips exactly. Local browser comparison uses the same 68-lot world and camera position. This release improves neighborhood architecture; it does not establish Cities: Skylines II equivalence or a measured FPS improvement.

## Edition 44: connected residential lots

House front walks now use the authored entrance positions, including two separate entrances for paired homes. Front garden beds exclude both walks and driveway surfaces. Residential setbacks vary deterministically to leave usable front yards, and offset walks and driveway aprons continue from the lot boundary to the street sidewalk. Access strips still reject water, occupied land, highways without sidewalks, and abrupt terrain cliffs; multiple connections batch into the existing shared pavement draw.

The 193-test suite includes actual model entrance alignment, planting/pavement separation, multiple offset sidewalk connections, save immutability, and existing offscreen vehicle/pedestrian simulation checks. Browser QA reuses the Edition 43 neighborhood and camera view. These are visual lot connections; resident routing and vehicle simulation are unchanged, and no measured FPS improvement is claimed.

## Edition 45: partial vehicle-buffer uploads

Vehicle instancing now uploads only the changed interval of each matrix buffer. Packed slots retain car identity and transform revisions, so a vehicle entering view does not rewrite unrelated batches and vehicles that moved offscreen return at their current position. Pending upload intervals are retained until WebGL consumes them. Geometry, materials, simulation advancement, interpolation, and fleet capacity are unchanged.

The reproducible 512-vehicle, 300-frame fixture (`node scripts/benchmark-vehicle-uploads.mjs <previous-vehicles-module>`) compares every visible matrix and geometry buffer against Edition 44, including an offscreen interval and queued traffic. Scheduled matrix upload bytes fell from 31,257,600 to 1,420,800 (95.45%). Median CPU time was essentially unchanged (0.084 ms); this is not a measured FPS improvement. All 195 regression tests pass, including pending-write retention and offscreen movement restoration.

## Edition 46: geometric traffic controls

Traffic controllers now use the same sampled road intersections as the pavement renderer. Rasterized wide bends no longer invent traffic lights or stop-sign gates: a single curved highway that previously produced four controllers now produces zero. Distinct crossings are controlled separately at their actual centers. Stop envelopes include the painted approach area so front bumpers wait behind the stop bars. Controller identity and active reservations survive unrelated road additions.

Rendering and traffic share a cached road geometry plan. It invalidates on road values, including in-place control-point edits, while population, camera, and terrain-height changes reuse it. All 199 tests pass, including curved-road traversal without false stops, crossing positions, stop-bar clearance, cache invalidation, existing queues, saved trips, and offscreen simulation. Browser QA verified zero controls on an uninterrupted highway and three separate controls in the multi-crossing test layout. The routing graph still uses road cells; this release fixes junction control and does not claim a complete continuous lane-routing system.

## Edition 47: stable lanes through authored crossings

Route geometry now retains the road being travelled through cells shared by multiple authored roads. Previously, the first-built road supplied crossing-cell positions, causing straight traffic to wobble sideways through an angled intersection. The reproduced deviation was 0.137 world units (about 0.69 metres). Through routes now stay exactly on their expected offset in either direction and produce identical points regardless of construction order. Turns still switch onto the selected outgoing road and use continuous sampled geometry.

All 201 tests pass, including construction-order invariance, opposite-lane separation, complete turning trips, saved state immutability, and offscreen simulation. Browser QA shows outside-origin vehicles traversing the angled crossing without errors. This corrects generated route geometry; existing in-progress saved trips retain their points, and the underlying connectivity graph remains road-cell based.


## Edition 48: shared road lane layouts

Vehicle routes and road paint now share lane centers derived from pavement width, lane count, one-way direction, and median clearance. New trips distribute deterministically across available lanes instead of sharing one fixed lateral offset. Outside connections continue the actual road width, dividers, and median so highway traffic remains on pavement beyond the map boundary. Existing saved trips retain their route points. This is lane-aware route placement, not dynamic overtaking or a complete lane-changing simulation.

Regression coverage checks all eight road types, distinct lanes on wide roads, one-way reachability, and outside-connection pavement and paint. Rendering does not control traffic advancement, and building assets are unchanged.


## Edition 49: gradual lane merges at road-width changes

New vehicle routes now merge upstream of lane drops and spread out downstream of lane gains over a distance measured along the road. A highway outer lane joining a street previously changed lateral position over one sample; it now uses a smooth transition that finishes before narrower pavement. The measured largest heading change in the reproduced route fell from 14.37 to 1.41 degrees. Unchanged lane offsets use a fast path and retain their original points, including on curves. Existing saved journeys retain their route geometry.

Tests cover merges in both directions, pavement clearance, monotonic travel, sample-density independence, closely spaced transitions, and trips completing without a renderer. This remains predetermined route placement; dynamic overtaking and a full lane-choice planner are separate unfinished work.


## Edition 50: tapered road-width joins

Aligned authored roads now narrow smoothly over the wider approach instead of ending in a square pavement step. Pavement, shoulder, curb, edge paint, and lamp placement share the width profile. Extra lane dashes end before the merge; a median that meets an undivided road ends in a tapered tip. Equal-width roads and shared multi-arm junction surfaces keep their existing shape. Short approaches limit taper length to half the road so opposing transitions do not overlap.

Transition planning uses nearby endpoint buckets and the existing road-edit cache. It neither changes saved road controls nor advances agents. Tests check width continuity, exclusions at junctions, geometry normals and UVs, and vehicle-body clearance through the rendered taper in both directions. Legacy grid-road joins are not tapered yet.


## Edition 51: depth-aware water and shoreline wash

Water now changes from muted turquoise shallows to darker blue at depth, with a subtle animated wash at the waterline. The shader reads two compact height textures built directly from the existing near and far terrain meshes; it does not resample terrain heights or add a second water draw. Sculpting refreshes the near texture in place, and switching worlds disposes both textures with the reflection target. Reflection throttling, graphics controls, buildings, and simulation advancement are unchanged.

The two RGBA8 height maps use 792,200 bytes and preserve heights to within 0.002 world units. Regression checks verify encoding against rendered terrain, in-place sculpt refresh of the actual shader texture, resource disposal, and simulation independence. This adds water appearance, not physical flow or flooding simulation.


## Edition 52: bounded ground-cover draws

Grass and reeds retain every triangle, normal, color, and material. Their shared vertex buffers are spatially ordered so nearby views can omit invisible ranges in at most four draws. Broad views use one draw. Selection is cached for stationary cameras and recomputed for each actual render camera, including water reflections. Camera movement only changes draw ranges; it does not upload or regenerate blade geometry. World changes dispose all shared resources once.

`node scripts/benchmark-ground-cover.mjs <previous-ground-cover-module>` verifies an order-independent exact triangle digest against Edition 51. In the seeded plains fixture, submitted grass triangles fall from 28,956 to 10,941 in the street view and 9,974 in the neighborhood view (62–66% fewer). The overview remains one draw with all 28,956 triangles. These are geometry-submission measurements, not an FPS claim. Offscreen traffic and pedestrians are unaffected.


## Edition 53: camera-following detailed trees

The ten detailed tree slots now follow the nearest eligible trees as the camera moves, with a retention band to reduce boundary churn. Previously the full models were chosen once during terrain creation, leaving newly approached trees as flat cards. Promoting a tree hides exactly its billboard slot; moving away restores that slot. Original tree positions, shared models, and materials are retained, and a representation change requests a shadow refresh.

Billboards also respond to camera translation, which the previous orbit-angle-only check missed. Unchanged orientations keep their matrices; changed slots upload bounded intervals while preserving pending writes. Stationary cameras and unchanged night colors take fast paths. Tests verify nearest-tree replacement, representation exclusivity, detail toggling, translated-camera orientation, stable buffers, conservative bounds, and pending-write retention. The detailed-tree cap remains ten; no FPS improvement is claimed.

## Edition 54: varied high-density skylines

High-density parcels now mix full-scale courtyard blocks with slender, rounded and stepped towers. The selector balances height with distinct tower/plaza and perimeter coverage targets, and its architecture-family choice no longer correlates with the height seed. High-density commercial selection requires at least four floors. Geometry, textures, asset transfer size, owned parcel boundaries, and uniform model scaling are preserved.

A deterministic 120-position sample for each category and footprint expands two-by-two office parcels from two selected models to seven, high-density residential parcels from three to six, and commercial parcels from one to four. Single-cell high-density commercial lots still have only one appropriately sized multi-storey model; this release does not claim new model inventory. Selection is deterministic on reload and never writes to saved world data. Traffic and pedestrian simulation remain independent of renderer visibility.

Validation: 215 automated tests pass, including sampled selection diversity, density, footprint bounds, uniform scale, deterministic rebuilds and world immutability. Local browser QA imported a separate mixed skyline fixture, inspected full geometry, checked for console errors, and verified Save & Exit returns to the home screen with a new verified save time. No frame-rate improvement is claimed for this architecture-selection change.

## Edition 55: smaller building instance uploads

Camera movement and building edits upload only the span of changed occupied instance slots, rather than the complete allocated capacity of each model/material batch. Pending writes survive hidden batches and multiple visibility updates before the renderer consumes them. This applies to full-detail and distant models; geometry, textures, draw membership, simulation timing and offscreen agents are unchanged.

`node scripts/benchmark-building-uploads.mjs /path/to/previous-factory.mjs` compares the current factory against an earlier module using 400 actual catalogue buildings, their real distant geometry, and 240 frames of orbiting, zoom, offscreen views and detail toggles. Against Edition 54, scheduled instance-buffer bytes fell from 150,375,424 to 52,443,264 (65.1%). Every visible transform, geometry and material matched, and saved world data was unchanged. Uploads are consumed every third frame in this replay to test preservation of pending writes. These are scheduled buffer bytes, not measured GPU time or browser FPS.

## Edition 56: shadows independent of camera visibility

Building sun shadows now use a dedicated, cached instance set containing all building casters, including buildings outside the main camera. Previously the shadow pass used camera-culled near/far batches, so an offscreen tower could disappear from a refreshed shadow map. The shadow set uses the original full geometry and shares materials and vertex buffers. Colour and water-reflection passes receive zero instances from these shadow-only batches, avoiding duplicate visible geometry. Site trees cast one detailed silhouette without also casting their distant billboard representation.

Shadow instance buffers update only when their building transforms change, retain allocations on rebuild, and are disposed when their material/model batch disappears. This adds one instance matrix buffer per building batch and draws offscreen casters when the cached shadow map refreshes; it is a lighting correctness improvement, not a claimed frame-rate gain. Traffic, residents, walking, and save data are untouched.

## Edition 57: individual night-time window lighting

Modern building windows now have stable room-level light variation, with warm and occasional cooler colours, different brightness, and unlit panes. The pattern also depends on the building's world position, so copies of the same model no longer share the same lit-window grid. This is visual variation, not a claim that individual rooms track resident occupancy. Balcony railings and skylights are excluded by pane orientation and dimensions. Daytime emission remains zero, and the extra lighting calculations are bypassed during daylight.

Pane seeds are generated once from connected glass surfaces at asset ingestion. Full and distant geometry share the same additional two-float vertex attribute; geometry, material batching, model downloads, and textures remain unchanged. The entire catalogue's room attributes stay below 2 MB. Tests cover deterministic seeds, unchanged positions and indices, consistent lighting across each pane, shared near/far data, excluded railings/skylights, and day/night uniform changes. Browser QA checks actual shader compilation and the rendered night skyline.

## Edition 58: diagonal traffic queries
Traffic now builds additional 45-degree spatial buckets only when an ordinary axis query would scan most vehicles. Buckets follow sequential vehicle moves, so offscreen traffic, queues, buses and arrivals retain the same simulation. Building geometry, materials and shadows are unchanged.

A local five-trial median benchmark with 512 vehicles and 600 steps measured 563 → 216 ms on the 45-degree fixture (62% less simulation CPU time), 190 → 189 ms on the axis-aligned fixture, and 1040 → 1018 ms at 60 degrees. These are fixture CPU timings, not a browser FPS guarantee. Exact agent states matched Edition 57 in every trial. Run `node scripts/benchmark-diagonal-traffic.mjs /absolute/path/to/previous-traffic-spatial.mjs` against an exported Edition 57 module. Regression tests also compare diagonal journeys against full scans for 120 simulated seconds and check dense bucket crossings and resets.

## Edition 59: occupied-looking daytime façades
Modern upper-floor windows now have stable per-room glazing variation, partially lowered blinds, and soft recess shading. Blinds reduce reflections and transmitted room light at night. Pane edges use screen-space antialiasing instead of fine repeating stripes. Existing near/far geometry and room attributes are reused: no added vertices, draw calls, textures, or per-frame JavaScript updates. The shader adds modest arithmetic, so unchanged geometry alone does not guarantee identical frame times on every device. Traffic simulation and save formats are unchanged.

### Edition 60: lane-aware pavement wear

Paved roads now show subtle wheel-path darkening aligned with their lane widths, including curved roads, tapers, and outside highways. The finish fades at distance to avoid shimmering. It uses the existing pavement meshes and textures with no extra triangles, draw calls, or per-frame JavaScript updates. Static batching preserves the road attributes and leaves intersection surfaces unmarked. Building quality, save behavior, and offscreen traffic simulation are unchanged.

## Edition 61 — connected urban courtyards
Urban lots now have paved side passages, divided planted borders, rear courts with clear central access, and recessed planting behind front seating. Existing shared geometry and materials keep the added hardscape below 1,000 triangles per tested lot. Residential house layouts and traffic simulation are unchanged.
