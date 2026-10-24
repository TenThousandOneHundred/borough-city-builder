# Borough II
A standalone browser city simulation with a Cities: Skylines II inspired interface and a real Three.js 3D view. It is an original small game, not the commercial game or a reproduction of its complete simulation.

## Edition 117 — Fuller tree canopies

Broadleaf trees now keep all 30,250 leaf pieces from the original CC0 model. The earlier whole-tree reduction had removed or severely shrunk much of the canopy. Reconstructing each piece from its texture-space outline restores the crown while reducing it to two triangles per piece. Original positions, bark geometry and all nine texture images remain intact. The matching four-elevation atlas has 43–57% more nontransparent canopy pixels than Edition 116, with the same distant instancing, view transitions and near-tree selection limit.

The Lakeland landscape picture in the official [Maps & Themes feature](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/maps-themes) and the [Poly Haven source tree](https://polyhaven.com/a/tree_small_02) were inspected before rebuilding. These informed the fuller foliage and forest silhouettes. Reference pictures and the full-resolution source are not shipped.

The model has 60,500 leaf triangles and uses opaque depth for its opaque JPEG foliage, avoiding the old double transparency pass. Leaf normals and UVs use compact normalized attributes; unused secondary leaf UVs are omitted. The original 4 MiB model budget is retained. The compressed model is 2,464,093 bytes, an increase of 444,988 bytes; the new atlas remains below 650 KiB. All 84 building assets and the resident, traffic, zoning and save logic are unchanged. Only the changed tree downloads receive new asset version URLs; building assets remain pinned to Edition 114.

All 433 regression tests pass, along with module syntax, asset integrity and lossless compression checks. The new tests verify every leaf component, lighting orientation, unchanged bark and textures, and fuller coverage at all four elevations. Rebuilding from the original source and Edition 116 model reproduces the shipped GLB byte for byte using `scripts/rebuild-tree-canopy.mjs`; `scripts/bake-tree-atlas.html` renders the matching distant views.

A local full-game check verified manual saving, reload, Continue, Save & Exit and the persisted world card: 412 residents, day 147 and ₡1,005,633. A separate 24-property fixture retained identical lots, models, garden layouts and 288 residents through save/reload. Neither browser reported errors or warnings.

In that fixture's close-up view at a 1600×900 drawing resolution, ordinary geometry fell from 2,630,893 to 2,221,117 triangles and from 169 to 168 draws. Two alternating comparisons measured GPU medians of 24.99/26.28 ms and 25.24/26.27 ms before/after. The fuller screen coverage still adds about 1 ms of GPU time on this host; frame intervals varied substantially and this is not an FPS-improvement claim. Distant trees retain the same geometry cost. The less efficient draft models were discarded before publication.

This is feature update two after optimization 115. Edition 118 is the third feature update; Edition 119 is the next dedicated optimization.

## Edition 116 — Complete private gardens

Detached and attached homes now receive complete private grounds: full-height side and rear privacy fences, optional continuous rear hedges, low street fences with entrance openings, rounded shrubs, and individual rear patios. Where a yard has enough space it can grow a weatherboard shed with a pitched roof and its own access path, or an open timber pergola with a table and benches. Attached homes keep separate gardens aligned with their party walls. Narrow yards omit furniture that cannot fit. Driveways retain clear access, and grounds follow the saved road-facing property instead of the global grid.

The neighborhood and residential-construction pictures in the official [Zones & Signature Buildings feature](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/zones-signature-buildings) were inspected before implementation. Their enclosed properties, boundary planting, outbuildings and rear outdoor space informed this work. This was a focused picture review; the reference pictures and game assets are not shipped.

All props use a small shared geometry and material catalogue, including individual fence planks, continuous clipped hedge profiles, shed doors and windows, and open pergola rafters. No new model or texture downloads are needed. The existing 84 building models, terrain, building detail and independent resident simulation are unchanged. New gardens are deterministic when an existing city is reloaded.

All 429 regression tests pass, together with module syntax, asset integrity and lossless compression checks. Tests cover rotated bounds, clear entrances and driveways, separate row-house gardens, tiny yards, geometry sharing, demolition and ordinary zoning growth on straight and curved streets. The full game retained 406 residents, day 141 and exactly ₡1,004,640 through manual save and reload, then returned home through Save & Exit. A separate 24-property browser fixture retained identical building choices and garden layouts and all 288 residents. No browser errors or warnings were recorded.

Two alternating comparisons in the same 24-property scene measured GPU medians of 9.02/9.64 ms and 8.78/9.33 ms before/after; median frame intervals stayed at 16.6–16.7 ms. Ordinary rendering increased from 151 to 159 draws and 460,439 to 736,047 triangles. These are measurements for this scene and device, not a guarantee for every city. In a separate 40-property CPU fixture, planning rose from 0.0019 to 0.0078 ms per lot; the complete shared grounds use 13 material/geometry batches. Reproduce that comparison with `node scripts/benchmark-private-gardens.mjs f7c413e` (set `GIT_BIN` if needed).

This is feature update one after optimization 115. Updates 117 and 118 precede the next dedicated optimization in Edition 119.

## Edition 115 — Faster city preparation without reducing detail

Shared garden-tree geometry now has its local bounds calculated once, then transformed separately for each tree. Previously, each building clone rescanned every tree vertex. A weak cache avoids keeping removed geometry alive, and revisions or replacements of ordinary and interleaved position buffers invalidate the cached bounds. Geometry, textures, material identities, instance positions, distant detail and full shadow geometry remain unchanged. No resident, traffic, zoning or save logic changes.

A comparison against Edition 114 using the actual shipped models, 168 buildings and 4,985 instanced parts reduced median building-preparation CPU time from 386.7 ms to 14.1 ms across seven measured trials. Every resulting bound, visible transform and shadow transform matched exactly. Two alternating browser comparisons of the same full city gave 877.7/431.8 ms and 803.3/453.7 ms before/after. These measure city preparation with assets already loaded; they are not network-download timings or a claim about overall frame rate. Reproduce the targeted comparison with `node scripts/benchmark-detail-bounds.mjs b55a24d` (set `GIT_BIN` if needed).

All 424 regression tests pass, together with module syntax, model integrity and lossless compression checks. New tests cover shared scans, moved and rotated instances, changed buffers, camera movement, reflection and quality settings, demolition and unchanged full shadows. A local full-game check retained 264 residents, day 147 and exactly ₡1,002,184 through manual save and reload, then verified Save & Exit returns home. No browser errors or warnings were recorded. All asset files are unchanged; building downloads remain pinned to Edition 114.

This completes the scheduled optimization after feature updates 112–114. The next dedicated optimization follows updates 116–118, in Edition 119.

## Edition 114 — More complete row-house streets

Row-housing zones now grow two additional original terrace styles: three-storey brick homes with raised entrance steps and flat parapet roofs, and three-storey homes with a pitched roof, street-facing dormer and ground-level entrance. Their party walls meet without side eaves, while individual doors, recessed sash windows, stone lintels, roof drainage and chimneys give each home its own frontage. The roof has an actual opening around the dormer. A saved multi-cell lot can contain several attached homes; their geometry is instanced at uniform scale rather than stretched. Rear garden dividers now continue the shared walls instead of following offset door positions.

The two row-house pictures in the official [Zones & Signature Buildings feature](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/zones-signature-buildings) were inspected before modeling. The continuous street fronts, different roof forms and separate entrances informed the new geometry. This is a focused picture review. The pictures and commercial-game assets are not shipped.

All 420 regression tests pass, together with module syntax, model integrity and lossless compression checks. New tests cast rays through the actual near and distant window and dormer geometry, verify wall-to-wall placement and garden boundaries, exercise ordinary zoning growth, and compare saved parcel geometry and deterministic model selection after reload. All 61 previous authored models remain byte-identical. The full game loads a normally grown test city with 264 residents; manual save and full reload retain it without browser errors or warnings.

The new models contain 2,144 and 2,002 triangles close up, dropping to 834 and 748 at distance with every window and opening retained. They share existing materials and textures. The combined compressed model and distant-index downloads increase by 42.3 KiB; the modern catalogue stays below 3 MiB compressed. Only these changed model downloads and their manifest advance to Edition 114. Existing housing and apartment detail remains intact, and no new per-frame simulation work is added.

In the same 24-lot scene, ten lots naturally select the new styles while fourteen retain earlier styles. Two alternating comparisons against Edition 113's saved model library and placement code give GPU medians of 9.00/9.03 ms and 8.84/8.69 ms before/after, with median frame intervals of 16.4–16.8 ms. Ordinary draws increase from 116 to 131 and triangles from 509,855 to 531,871. These measurements cover this scene and device; they do not guarantee that every city runs at the same rate. A separate fixture save/reload preserves all 24 lots, the model choices and 288 residents.

This is feature update three after optimization 111. Edition 115 is the next scheduled dedicated optimization pass.

## Edition 113 — Replace existing roads

Choose Replace in the road toolbar, or inspect a street and choose Replace road type, to switch an existing section among all eight road types. Curved roads keep their controls and direction. Older tile streets become sampled sections while retaining crossings and separate zoning-side settings. The preview shows the price, replacement width and any whole building lots that would be removed. Widening into occupied land requires the explicit removal checkbox; insufficient funds or an unapproved demolition leaves the city unchanged.

Unaffected homes retain their saved lot dimensions, occupants and access. Manual saves and reloads retain the road type and zoning-side setting. Moving cars and buses are projected onto the replacement lanes while keeping their identity, destination and journey; bus passengers stay assigned to their trip. One-way edges now use the selected road's direction without making its crossing street one-way. A separate pedestrian path crossing the replacement footprint must be removed first. This update does not add elevation editing or a one-way reversal control.

The road-type and tree-lined-street pictures in the official [Road Tools feature](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/road-tools) were inspected before implementation. They informed the section replacement and width preview. This was a focused picture review; reference pictures are not shipped in the game.

All 416 regression tests pass, along with asset integrity, lossless compression and module syntax checks. Full-game local browser checks verified a narrowed avenue with 96 residents, left-side zoning, the eight-lot widening warning and disabled Apply button before removal was selected, a curved tree-lined upgrade, and exact funds and residents after save/reload. A further automated bus check verifies actual aboard passengers through a replacement and a subsequent completed circuit. The local browser reported no errors or warnings.

In a 241-parcel fixture, 25 measured runs give median CPU costs of 5.6 ms to quote, 5.9 ms to replace and 26.7 ms to rebuild zoning after the edit. These are edit-operation timings, not overall frame-rate measurements. Lane reprojection runs only when a road is replaced. No building models or textures were added or reduced; model downloads remain pinned to Edition 108. This is feature update two after optimization 111. Edition 114 is the third feature update, followed by the scheduled optimization in Edition 115.

## Run
`python3 -m http.server 4173 --directory dist`
Open http://localhost:4173. No build or dependency installation is needed. Three.js 0.170.0, OrbitControls and Reflector are vendored with their MIT license. Google Fonts are optional; the interface has system font fallbacks.

## Main menu and game lifecycle
The site opens to a home screen with Continue, New Game, Load Game and Settings. The city in the menu background is a separate unsaved demonstration world. It never changes a player's save. No player simulation runs on the home screen. Continue/Play/Start New City begin simulation only after the player chooses them. The game menu pauses simulation. Save & Exit verifies a save before returning home. Failed saves keep the city open. Reloading or reopening the page returns to the home screen, with Continue available for the saved city.

## Features
48×48 seeded river, islands and plains worlds; rotatable and zoomable 3D camera; scanned CC0 grass, asphalt and brick surfaces; rolling terrain and banks; animated water; varied houses, apartments, shops and office towers; curbs, sidewalks, crosswalks, road lamps and bridge supports; trees, shadows, night lighting and cars. Drag roads and bridges; choose from eight road types and use straight or curved paths. Avenues cost more but support more traffic. Road paths are checked before construction, so a blocked or unaffordable path does not partially build. Paint six residential forms, commerce, industry and offices. Road-aligned 8 m cells combine into varied multi-cell building lots; Along road, Rectangle, Brush and Fill follow connected streets. Low, medium and high residential demand account for existing vacancies and construction. Connected power and water gate development; capacity matters. Build healthcare, schools, police, fire protection, parks, recycling centers and bus depots. Services affect happiness, protection capacity, pollution or congestion. Taxes, upkeep and loan repayment affect the city budget. Milestones, demand indicators, inspection, bulldozing, information overlays, photo mode and graphics settings are included.

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

## Edition 62 — exact tree selection with less camera work
Camera movement now uses a bounded, reusable nearest-tree selection instead of allocating and sorting all tree candidates. The same ten closest eligible models, distances, tie order and hysteresis are retained. No geometry, textures, shadows or simulation rules change. Run `node scripts/benchmark-tree-selection.mjs` for the isolated CPU comparison.

## Edition 63: muted roof gardens and weathered roof surfaces

Raised planting now uses varied, muted foliage and soil tones instead of a flat bright green surface. Flat upper roofs have subtle weathering. The variation is baked into existing vertex colours when assets load and shared by near and distant models. This adds no shaders, meshes, textures, draw calls or per-frame work. Ground paving and pitched roofs retain their existing finish. Simulation scheduling and offscreen traffic are unchanged.

## Edition 64: precise site vegetation culling

Trees within large building lots now use cached individual visibility bounds. Trees outside the camera and its water reflection are omitted from color draws, while their full shadow silhouettes remain present. Close visible trees keep their original geometry and existing distance thresholds. This affects rendering only, not traffic or residents.


## Edition 65: less repetitive office districts
Independent seeded architectural choices separate parcel coverage from building height and model choice. High-density offices mix more podium, stepped and rounded towers with perimeter blocks while retaining uniform metre-scale fitting and shared detailed meshes. The 144-lot regression district selects seven silhouettes, reduces its most repeated model from 91 to 61 lots, and uses 5,964,265 full-detail building triangles instead of 6,781,475 (12% fewer). This is a geometry comparison, not an FPS claim. Selection happens on building creation; traffic, offscreen simulation, shadows and saving are unchanged.


## Edition 66: road-following zoning and saved building lots
Zoning cells follow the tangent of straight and curved streets. Rectangle selection follows the selected road side, and fill stays on that side. Junction conflicts and overlapping cells are discarded. The grid is cached across population changes; overlay cells batch by color rather than requiring a draw call per cell. This remains Borough's larger, simplified cell scale, not the commercial game's exact 8-metre zoning implementation.

New development reserves one persistent lot across multiple cells, with construction and population held by one building owner. Detached homes use 2–4 cells, row houses 2–4, medium apartments 4–6 and high apartments 4–9. Single cells stay vacant. Detached homes, row houses, medium apartments and high apartments are separate zoning choices; each uses its corresponding existing model family. Lots start at the street-facing row. Tight curves can leave unbuildable wedges. Demolishing any lot member removes the entire building; roads, footpaths, facilities and terrain tools respect reservations. Saves validate ownership and retain the exact footprint. Previously built cities retain their existing buildings. Mixed-use and low-rent zoning are not implemented.

Reference study: the official Zones & Signature Buildings development diary, and selected frames from AgoAgo Game's “Cities Skylines 2 - All the Building Zone Sizes!” (1:06 and 2:04). BonBonB's low-density tutorial failed playback early; neither video was watched continuously end to end. Reference images are not shipped.


## Edition 67: zoning clearance at junctions
The whole rotated zoning cell is checked against nearby road and sidewalk ribbons, including highways. Center-cell eligibility alone missed cell corners crossing angled junctions. A spatial index restricts these checks to nearby road segments; the result remains cached across population updates. Rectangle overlap uses projected extents instead of allocating corner arrays for every comparison. Wide legacy roads now offset zoning by their actual width. Existing saved lots and simulation progress are not changed.

## Edition 68: apartments above shops
Mixed-use zoning grows multi-cell apartments with ground-floor shops. These lots house residents, provide jobs and accept shopping visits. Residents working or shopping in their own building complete those activities without spawning a road trip. Uses the existing detailed mixed-use models and shared rendering assets. The simulation remains simplified; rent, shop inventory and separate commercial leases are not modeled.

## Edition 69: keep buildings in river reflections
Building visibility includes the reflected camera volume, using one cached conservative bound per building. Buildings just outside the main view remain available to the river reflection. Toggling reflections invalidates visibility immediately. Unchanged views reuse instance buffers; shadow geometry and independent traffic/resident simulation are preserved. This fixes missing reflected buildings, rather than lowering geometry quality to reduce startup shadow work.

## Edition 70: row-house frontage and private gardens
Saved road-facing row-house lots now fit repeated full-size paired or terrace homes across their frontage, instead of placing a single small model in a large lawn. Each authored front door receives a separate garden walk; rear fences divide gardens between entrances. Repeated houses share model geometry and materials and remain in existing instance batches. Lot ownership, resident counts, simulation and saves are unchanged. More visible homes add geometry, so this is a frontage-fidelity improvement rather than an FPS gain.

## Edition 71: exact pedestrian pose reuse
Waiting passengers retain their exact body-part transforms as simulation time advances. Moving people update only changed instance slots, preserving pending GPU writes until consumed. Ground heights are reused at unchanged positions and invalidated after terrain edits. Projection changes recalculate visibility even while paused. The optimization affects rendering only: walking, traffic and household clocks remain independent. A 200-passenger CPU fixture compares final matrices against the previous renderer; this is not a whole-game FPS benchmark.

## Edition 72: independent roadside zoning

New zoning uses 8-metre cells in six rows along eligible streets. Brush, rectangle and connected fill tools paint those cells; houses, row housing, apartments and businesses grow into multi-cell lots. Each occupied lot has a stable address, its own construction progress and residents, an exact rotated footprint, and an independently selectable model. Several lots can share a terrain tile. Existing saved tile-based buildings remain supported.

The inspector lists lot dimensions, residents and road access. Bulldozing one lot preserves neighboring buildings and reconciles displaced residents. Roads, footpaths and facilities check occupied lot footprints before placement; earthworks protect their foundations. Replacing a removed street reconnects eligible frontage without moving buildings. The compact zoning panel leaves more of the map available for painting.

Residents, cars, walking and transit resolve both legacy tile addresses and independent lot addresses. Their simulation remains independent of render visibility. Building geometry and materials stay shared, population-only updates retain model roots, and exact parcel occupancy controls vegetation removal. Medium-density apartment selection includes several fitting full-detail models.

The development collection serializes with the existing WorldStore save, import and export format. It does not change the storage key or replace existing worlds.

Edition 72.1 also preserves selection, brush, fill and erasing for existing legacy zoning. New zoning continues to use independent cells.

Edition 72.2 replaces whole-grid scans for each independent lot reservation with direct road/side/cell lookups (at most 36 cells). It keeps the same saved parcels and does not change model geometry or simulation advancement. `scripts/benchmark-fine-lots.mjs` compares the prior module against the current implementation: a 5,400-cell fixture produced identical 154 parcels over 3,898 attempts, with median reservation CPU time of 755.8 ms before and 6.6 ms after on the development machine. This is a focused CPU benchmark, not a browser FPS claim.

## Edition 73: apartment streets with varied footprints

Medium-density apartment growth now tries 16 road-aligned lot shapes, from compact 2×2 cells to narrow 2×6 sites and wider 6×6 parcels, with deterministic preferences per frontage. Existing occupied parcels keep their saved geometry. Two original full-detail models add a three-storey brick walk-up and a five-storey narrow balcony apartment with a set-back top floor. Both retain shared material/geometry batching, detailed window openings and distant geometry. The catalogue now contains 71 buildings. Modern model compressed transfer grows by approximately 32 KB; distant data grows by approximately 2 KB compressed.

Verification covers deterministic growth, independent residents, save/reload stability and un-stretched model fitting for all supported apartment footprints. The 12.25 MiB raw modern asset ceiling accounts for the two additional models; geometry precision and per-building triangle limits are retained.

## Edition 74: elevation-aware tree canopies

Distant broadleaf trees now blend four views baked from the existing detailed tree model (ground level through overhead). Cards tilt with the camera, retaining a canopy silhouette in aerial views. Close-range tree meshes are unchanged. A separate light-facing depth shader selects the sun-facing canopy and keeps shadows independent of player-camera rotation; camera movement does not force a city-wide shadow redraw. The 547 KiB RGBA atlas replaces four runtime texture downloads totaling roughly 1.2 MiB. Tree positions and gameplay state are unchanged.

To reproduce the atlas, serve the repository root and open `scripts/bake-tree-atlas.html`, then use its download link. It renders the existing `broadleaf.glb` at 0, 30, 60 and 90 degrees into four 512px panels. Save the PNG as `dist/assets/trees/broadleaf-elevations.png`. Tests cover elevation math, pitched-card bounds, vertical camera motion, retained instance buffers, stable shadows and the atlas format/download limit.

## Edition 75: lossless catalogue and tree transfers

All three complete building catalogues and the detailed broadleaf model now use the existing bounded-inactivity, lossless gzip loader. Previously only the modern catalogue and distant indices used it. Raw files remain available as a compatibility and corrupt/missing-compressed-file fallback. No models, texture resolution, geometry, materials, simulation agents or save data are removed.

The three newly compressed files transfer 21,025,526 bytes instead of 23,838,036 bytes, a reduction of 2,812,510 bytes (11.8%). Their embedded JPEG textures already compress well, so the gain is smaller than for the modern geometry. `node scripts/compress-assets.mjs --check` verifies every decoded asset byte and file-specific transfer budgets. This is a download-size reduction, not a measured FPS improvement.

## Edition 76 — six residential zoning categories
Low-rent apartments join detached homes, row houses, medium apartments, mixed-use housing and towers. Low-rent development reserves 4×4 through 6×6 roadside cells per building, selects existing detailed balcony/perimeter apartment assets, and supports up to 40 residents per block in the simplified simulation. This category does not yet simulate household income or actual rent payments. Housing palette descriptions explain the lot sizes. Saved plots, residents and independent traffic simulation remain intact. No new model downloads or per-frame geometry work were added.

Reference: Paradox's [Zones & Signature Buildings](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/zones-signature-buildings), and AgoAgo Game's [building zone sizes demonstration](https://www.youtube.com/watch?v=hRlGRd-80vk).

## Edition 77 — purpose-built apartment blocks
Two original low-rent buildings replace reuse of general apartment models: a six-floor staggered slab and an eight-floor wider block, each with a taller stair core. Smaller individual windows, brick ground floors, opaque balcony panels, privacy screens, roof equipment and shared entrances distinguish these from glass towers. Sites at least five cells wide and deep select the wider block; smaller sites retain the compact one. New low-rent growth varies its multi-cell lot dimensions; existing saved footprints and residents are retained.

The catalogue now contains 73 buildings (52 modern). The new full and distant assets add 168,934 compressed bytes, use at most ten material batches per model, and share geometry through the existing instancing pipeline. The raw modern-library budget is 13.5 MiB; its compressed transfer remains below 3 MiB. This is an architecture addition, not a measured frame-rate improvement.

The two new models contain 5,382 and 10,676 triangles. Their distant versions retain the window and wall openings using 2,786 and 5,184 triangles. Existing-model geometry budgets remain unchanged; the enlarged 52-model modern catalogue stays below 196,000 triangles.

## Edition 78 — avoid copying single-lane traffic buckets
Lane-neighbor queries now scan the existing spatial bucket directly when the complete conservative search corridor occupies one bin, including diagonal lanes. Multi-bin queries retain their existing path. Buckets still update after each vehicle move; every active vehicle continues to advance regardless of rendering. No building, terrain, traffic capacity or simulation frequency was reduced.

A deterministic 512-vehicle benchmark over 60 simulated seconds measured median CPU time of 283.7 ms before and 200.8 ms after (six timed runs after warmup, alternating execution order). All vehicle states, queues and completed-trip counts matched the previous implementation exactly. This is simulation CPU time, not browser FPS. Reproduce with `node scripts/benchmark-traffic-corridor.mjs /path/to/previous-traffic-spatial.mjs`; the baseline is `dist/traffic-spatial.js` from commit `d18f4e1`.

## Edition 79 — road-aligned intersection approach markings
Drawn roads now receive directional approach arrows at connected junctions when there is enough road length. Arrows follow the sampled road tangent and shared lane centers, skip outgoing one-way approaches, and avoid neighboring junctions. Through approaches show forward guidance; terminal T-junction approaches show the available left/right exits. These are guidance markings, not newly imposed lane restrictions. Short approaches and roads without sidewalks omit the markings.

The paint is generated only when the road geometry rebuilds, uses the existing road-marking material, and enters static batching. No new textures, render-loop updates or simulation rules were added. Reference comparison: the street-level frame near 45:47 in SkilzBuildz's “I Built a Complete City on One Tile (Start to Finish)” showed the missing approach-arrow detail.

## Edition 80 — Road-connected zoning and building lots
Roadside zoning now rejects cells behind missing frontage at curves, junctions and blocked service sites. Each available column extends continuously from its road. Developed housing displays one saved lot rather than an internal cell checkerboard, including when its road is removed. The six existing residential categories retain their distinct multi-cell footprints and models. Changes do not add per-frame work or alter traffic advancement.

## Edition 81 — Attached terrace housing
Oriented row-house lots use the terrace model with solid party walls, flush side roof edges and no side gutters. Repeated homes meet along their boundaries with uniform scaling and individually connected entrances and rear gardens. New row zoning varies between one-, two- and three-cell frontages; existing saved parcel boundaries stay intact. The revised asset removes 504 full-detail triangles, keeps the existing shared instance batches, and changes compressed catalogue transfer by about 1.2 KB. Traffic and resident simulation are unchanged.

## Edition 82 — Zoning interaction cache
Available roadside cells are reused while road geometry, tile blockers and parcel revisions stay unchanged. Population, money and camera movement do not rebuild availability. Regression checks compare cached results to a fresh world after zoning, reservation, demolition, service blockers, road removal, water changes and state replacement. A 6,210-cell / 510-parcel fixture measured 150 repeated queries at 1,193 ms before and 19 ms after (seven alternating measured runs, one warmup); this is query CPU time, not an FPS claim. All cell geometry and world data match the uncached baseline. Traffic and resident advancement remain independent of rendering.

## Edition 83 — Consistent lot surfaces
Grass, asphalt and paving use world-space texture coordinates on horizontal lot surfaces, so colour, normal and roughness maps maintain their scale across rotated and differently sized properties. All three shared ground materials are initialized together, keeping gardens and paths consistent regardless of which building category loads first. The existing geometry and texture files are reused. Zoning cells and lot tinting now appear only while zoning or in the zoning information view; normal city views show the terrain and completed grounds without the grid overlay.

## Edition 84 — Coastal maps and inland terraces
New Coastal Islands worlds use a seeded mainland coastline, bays, a sea channel and two offshore islands with irregular coves. Tile water, rendered shorelines and inland relief use one shared cached signed coast field. New river and island maps have broad development shelves with steeper rocky transitions. Terrain version 2 is stored in the save; existing version-one and unversioned worlds retain their original sampled heights and shorelines. Starter roads remain on connected mainland, and foundation/camera height handling supports the new terrain. Existing terrain mesh resolution, texture assets and offscreen traffic simulation are retained.

Edition 84 also varies detached-house footprints from 2×2 to 4×4 roadside cells instead of favoring two-cell-wide plots. Zoning drag feedback shows road-relative dimensions, area, and the distinction between cells and building lots. Existing developed parcels retain their saved geometry. Reference: Cities: Skylines official Zones & Signature Buildings feature video (PBwwZ4XnW34), inspected zoning and residential sections.

Edition 85 rebuilds the compact courtyard apartment as two stepped residential wings with hipped roofs, brick and render facades, chimneys, seating and a pergola around an open garden. The catalogue remains 73 buildings; existing instancing and distant geometry preserve the new roof silhouette. No traffic or resident simulation behavior changes.

Edition 86 adds a compact hipped-roof apartment for 2×2 roadside lots. A 60-parcel selection audit previously chose one model for all 60 sites; the expanded catalogue selects two distinct forms at their authored scale. The new model adds roughly 9 KB compressed and reuses the existing materials and instancing pipeline.

Edition 87 skips rebuilding instance batches when all cached building entries and distant-model geometries are unchanged. Camera visibility still updates; additions, demolition, transforms, explicit revisions, mutable buildings and late LOD changes invalidate the shortcut. A 201-lot differential CPU fixture preserves geometry and visible transforms, with warm unchanged rebuilds around 0.15 ms versus 1.7 ms; alternating addition measurements remain around 1.1 ms. These are CPU measurements, not browser FPS. Traffic and resident simulation scheduling is unchanged.


## Edition 88 — Road-following zoning and planned building lots
The zoning brush follows the street's cell coordinates around curves, including fast drags in either direction. Before construction starts, each zoned frontage is divided into varied multi-cell lots. Demand chooses when those lots develop instead of allowing a random starting cell to fragment its waiting neighbors. Where another allowed width fits, the planner avoids leftover frontage narrower than the housing type permits. High-density and mixed-use districts also vary their lot proportions.

Pale outlines distinguish building lots from the smaller 8-metre zoning cells, including before construction. They are drawn in one terrain-following line batch. Lot plans are cached until zoning, occupancy or roads change. Existing buildings, parcel IDs, saved geometry, resident journeys and save handling are retained. The six residential categories remain detached homes, row houses, medium apartments, mixed-use buildings, low-rent blocks and towers.

Reference: the official [Zones & Signature Buildings video](https://www.youtube.com/watch?v=PBwwZ4XnW34) zoning and housing excerpts and [developer diary](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/zones-signature-buildings). Footage and pictures are reference material, not shipped assets. This is the first feature update after the Edition 87 optimization; the next dedicated optimization pass is due after three feature updates. Review reference pictures before each new visual feature.


## Edition 89 — Apartment window depth and open balconies
Four existing apartment designs now have recessed glazing, painted perimeter frames and separate sash bars: the compact hipped apartment, brick neighborhood walk-up, small courtyard apartment and narrow balcony apartment. The narrow building uses open metal balcony railings at its front and rear instead of opaque wraparound panels. Frames, glazing and front railings remain in the distant topology; individual-window night lighting continues to work.

The close-up and neighborhood pictures in the [official Netherlands Region Pack diary](https://www.paradoxinteractive.com/games/cities-skylines-ii/modding/dev-diary-netherlands-region-pack) guided the frame proportions and balcony treatment. All new geometry is original. Adjacent coplanar wall bands were merged without changing any openings; the other 49 modern models retain identical bounds and material surface areas. The modern library decreases from 195,944 to 192,622 triangles and from 13,724,964 to 13,519,708 bytes. The four rebuilt models themselves use more detail; these aggregate geometry figures are not an FPS claim. No simulation or save behavior changes. This is feature update two since the Edition 87 optimization; one more feature update precedes the next dedicated optimization pass.

## Edition 90 — Gabled and gambrel suburban homes

Low-density zoning can now develop two additional original detached houses: a compact two-storey brick home with a broad roof dormer, and a gambrel garden home with steep lower roof slopes and shallower upper slopes. Both have recessed attic glazing, framed dormers, roof tiles, shallow entrance canopies, gutters and rear solar panels. The house dimensions fit the existing lot system without stretching; their authored door positions provide garden walks and road access. The shared house catalogue now contains eight detached designs plus the paired and terrace forms.

The low-residential pictures in the [official Netherlands Region Pack diary](https://www.paradoxinteractive.com/games/cities-skylines-ii/modding/dev-diary-netherlands-region-pack) guided roof profiles, dormer proportions and brickwork. Roof geometry is cut around the dormers so it cannot cover their windows. Gable brick UVs use physical horizontal/vertical distances, including triangular ends. Solar panels use non-emissive metal, while individual windows retain night lighting. Distant topology keeps the roof silhouettes, dormers, every window and the solar panels.

The two models share existing materials and add 1,596 triangles and 2,939 compressed bytes across the model and distant-index downloads. The 55-model modern library remains within its unchanged 196,000-triangle, 13.5 MiB raw and 3 MiB compressed budgets. All 53 previous modern models retain identical geometry and attributes. No save or simulation behavior changes. This is the third feature update since Edition 87; the next update must be a dedicated optimization pass before adding more features.

## Edition 91 — Direct zoning overlay batches

Zoning overlays and drag previews now write their terrain-following vertices directly into the final color/opacity batches. A large redraw previously created thousands of small meshes, geometries and materials, then merged and disposed them. The new path allocates only the final batches. Standalone hovered-cell highlights keep their existing path.

The 5,956-cell CPU fixture decreased from 89.79 ms to 16.24 ms median per warm overlay redraw across seven measured runs. These are CPU redraw timings, not an FPS guarantee. The comparison verifies byte-identical position, normal, UV and index buffers, matching material colors/opacity, the same five draws and 59,500 vertices including terrain-following lot outlines. Additional tests cover 32-bit indices for large batches, occupied/construction preview colors and release of replaced buffers.

In the local browser fixture with 5,956 cells and 26 developed lots, median overlay redraw time decreased from 61 to 20.5 ms and full-area fill-preview time from 61.7 to 17.6 ms. Each measurement used nine redraws after a warmup. These short samples measure the redraw operation, not overall game frame rate or all devices.

Building models, terrain assets, traffic, walking, simulation clocks and save data are unchanged. Run `node scripts/benchmark-zoning-render.mjs /path/to/previous-renderer.mjs` to compare against a prior renderer with its imports resolved. This is the dedicated optimization pass after Editions 88–90; the feature-update counter resets to zero.

## Edition 92 — Roadside strips and complete-depth building lots

The default zoning mode is now **Along road**: choose a depth of two to six 8-metre cells, then drag along the frontage. The selection stays on the street side where the drag began, including curved roads and drags that move beyond the cell grid. Rectangle, brush and block fill remain available. Housing has six illustrated choices under Residential; commercial, industrial and office zoning have their own tabs.

New lot planning varies building frontage while consuming the available painted depth. It respects changes in the painted depth along a street, rather than randomly choosing shallow lots that leave inaccessible rear cells. Detached houses can own two to four cells of frontage and two to six cells of depth; apartments support larger multi-cell sites. A single zoning cell still cannot develop by itself. Existing occupied parcels keep their saved boundaries, buildings and resident homes.

Reference: the zoning and housing excerpts of the official [Zones & Signature Buildings feature video](https://www.youtube.com/watch?v=PBwwZ4XnW34) and its [developer diary](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/zones-signature-buildings). No game assets are copied or included.

Validation includes roadside selections on both sides of curves, full painted-depth coverage, isolated multi-cell lots through actual growth, all residential types, and existing-parcel save compatibility. The local browser mouse test painted 52 cells into four outlined lots; those zones survived manual save and reload. The responsive menu keeps the tool instructions above the panel as its controls wrap.

A deterministic 5,956-cell benchmark planned 5,952 cells into lots, up from 3,084. Median full replanning CPU time was 14.55 ms versus 9.56 ms for the older, partial-coverage planner; cached queries remained approximately 0.13 ms and roadside selection averaged 0.21 ms. This is operation timing, not an FPS guarantee. The existing geometry, assets, batching and independent simulation scheduling are retained. Run `node scripts/benchmark-roadside-zoning.mjs /path/to/previous-engine.cjs` to repeat the comparison.

This is the first feature update after the Edition 91 optimization; the next dedicated optimization pass follows three feature updates.

## Edition 93 — Small office districts and buildable zoning depths

The Offices tab now separates low-density workplaces from high-density towers. Two original two- and three-storey buildings grow on multi-cell lots: a glazed corner office with projecting facade fins, and a wider masonry office with a glass entrance wing. Both have flat parapet roofs, rooftop equipment and solar arrays. They retain their authored proportions and street-facing entrances. Low-density workplaces provide six jobs per development level; residents can take these jobs and travel to them through the existing simulation. Existing office IDs and capacities remain compatible with saved cities.

The roadside depth control now uses the same minimum depth as the lot planner. Selecting low-rent apartments automatically raises a three-cell depth to four and disables the shallower choices. Mixed-use, high-density housing, high commercial and office towers need at least three; smaller buildings permit two. This fixes painted strips that looked valid but could never become the selected apartment type. Road-following strips, varied multi-cell lot widths, all six residential types and saved occupied boundaries are retained.

References reviewed in the browser: the official [Zones & Signature Buildings feature video](https://www.youtube.com/watch?v=PBwwZ4XnW34), [Zones, Zoning, Zoned developer walkthrough](https://www.youtube.com/watch?v=5eO3Bp5MnJQ), and the small-office district picture in the [developer diary](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/zones-signature-buildings). Review covered the zoning and housing excerpts, not continuous end-to-end playback. Reference pictures and video assets are not included in the game.

The new models use shared materials and the existing instancing/distance system. Together they add 1,622 triangles and 27,294 bytes to compressed building downloads. The modern library has 57 models and 195,840 triangles, with all existing geometry, material and transfer budgets unchanged. The depth adjustment runs when selecting a tool, adding no per-frame zoning work. These are asset and operation checks, not a frame-rate guarantee. Tests cover small-office growth, housing depth eligibility, uniform model scale, save/reload and residents completing work trips independently of rendering.

This is the second feature update after the Edition 91 optimization. The next dedicated optimization pass follows one more feature update.

## Edition 94 — Live building-lot previews and connected grounds

Zoning drags now preview the same multi-cell, street-facing lots that the growth planner will use. Pale outlines and a building-lot count distinguish a house or apartment site from the smaller 8-metre cells. Amber cells identify selected land that cannot currently form a lot of that type; adding adjoining land or frontage can make it usable. The preview combines the selection with existing zoning, supports all six residential categories, and leaves occupied buildings and saved world data untouched. Repeated pointer movement within the same cell reuses the preview. This improves feedback; the road-aligned grid, varied lot sizes and six housing categories were already present in Editions 88–93.

Apartment and office grounds now use broad lawns, compact sitting areas and connected pedestrian paths instead of repeated long paving strips. Small-office rear parking courts require an actual side driveway; shallow shop setbacks no longer draw parking bays without room for a manoeuvring aisle. Bay dimensions are 2.5×5 metres with a 6-metre aisle. Off-centre modeled entrances receive their own sidewalk connections, and benches and racks stay clear of paths. Parking markings are visual site details, not a new vehicle-parking simulation. Lawn shading uses the surrounding terrain's temperate palette.

Reference review included selected zoning and housing footage in the official [Zones & Signature Buildings feature video](https://www.youtube.com/watch?v=PBwwZ4XnW34) (0:29, 0:34, 0:39 and 1:04) and [Zones, Zoning, Zoned developer walkthrough](https://www.youtube.com/watch?v=5eO3Bp5MnJQ) (1:01 and 2:03), plus the office/commercial photographs in the [zoning diary](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/zones-signature-buildings) and apartment grounds in the [Netherlands Region Pack diary](https://www.paradoxinteractive.com/games/cities-skylines-ii/modding/dev-diary-netherlands-region-pack). These are excerpt/frame reviews, not a claim of continuous full-video viewing. Reference assets are not shipped.

All 331 automated checks pass. Tests compare preview lots with committed planning for every residential category, cover single cells and construction/occupied reservations, check preview cleanup, and verify grounds stay inside lots without obstructing entrances. Browser mouse checks painted 27 cells into three housing lots and 44 cells into four apartment lots; both strips survived manual save, reload and Continue. A fresh cache version was verified after catching an older local engine module during development.

The 60-lot hardscape comparison falls from 19,436 to 10,466 triangles (about 46% fewer); isolated hardscape material/geometry batches increase from seven to nine. Planning is about 0.005 ms per lot. In a 5,956-cell city, live lot preview planning measured 9.68 ms for changed selections and 0.38 ms for cached selections. These are local operation measurements, not an FPS guarantee. The 78 building models, model downloads, instancing and independent traffic/resident simulation remain intact. Run `scripts/benchmark-site-grounds.mjs` and `scripts/benchmark-zone-preview.mjs` for these measurements.

This is the third feature update since Edition 91. The next update must be a dedicated optimization pass before adding more features.

## Edition 95 — Faster roadside zoning queries

Roadside strip, brush, rectangle and fill selections now reuse an index of each road frontage. Live building-lot previews copy only the affected frontages instead of the entire city's zoning state. Layout cache checks compare road and ground fields directly, avoiding thousands of temporary strings on unchanged maps. Edits to roads, curves, terrain and building occupancy still invalidate the appropriate caches. Construction previews remain isolated from saved parcel ownership.

The paired comparison uses the Edition 94 engine and layout modules against the current modules on the same deterministic 5,956-cell city. With 238 occupied lots, median changed-selection planning decreased from 4.16 to 1.87 ms and a long roadside brush stroke from 4.82 to 0.38 ms. Every compared preview and selection is identical, and the world data remains unchanged. Run `node scripts/compare-zone-preview.mjs` to repeat it; set `GIT_BIN` if Git is installed outside the usual path.

The browser comparison measured changed-selection planning at 3.7 versus 2.0 ms and the long brush stroke at 4.3 versus 0.4 ms, with identical output. These are local zoning-operation timings, not overall frame rates or a guarantee for other devices. Actual game checks painted 11 cells into three outlined lots, verified a manual save, returned home, reloaded and continued with the zones retained.

The building models, textures, terrain geometry, resident travel and simulation scheduling are unchanged. This is the dedicated optimization pass after Editions 92–94; the feature-update counter resets to zero.

## Edition 96 — Historic row-house streets

Row-housing zones can now grow two additional original three-storey brick terraces: a stepped-gable house and a curved bell-gable house. Both have narrow sash windows recessed into the masonry, white stone frames and crown trim, an attic window, a separate paneled entrance, pitched roofs, a chimney and a small lifting beam. Shared side walls have no windows or projecting eaves. Their authored proportions fit the existing multi-cell lots, and each repeated entrance connects to the street with its own path. Selection is deterministic across save/reload.

The street-block picture in the [official Netherlands Region Pack diary](https://www.paradoxinteractive.com/games/cities-skylines-ii/modding/dev-diary-netherlands-region-pack) guided the continuous frontage, narrow facade rhythm and varied gable silhouettes. The [reference picture](https://images.ctfassets.net/u73tyf0fa8v1/mTNclPfojdDwaa9FM2pZ7/a7328b3bceb4f4babd2f01871244ff94/cs2-nl-pack-7.jpg?fm=webp&q=75&w=1920) was inspected before modeling; it is not shipped as an asset.

The two models add 3,760 triangles to the shared library and about 28 KiB to the combined compressed model/distant downloads. All 57 existing modern models retain identical full-detail geometry, attributes and metadata. The complete modern library now has 59 models and 199,600 triangles. Existing models retain their 196,000-triangle budget; the two new models have a separate combined 4,000-triangle limit. Raw and compressed asset budgets and the 13 shared materials are unchanged. Distant terraces retain the front faces of every frame and sash while omitting tiny side returns; windows and roof silhouettes stay intact. These asset figures are not an FPS guarantee.

The same 47-lot browser district selects 13 existing gabled terraces, 15 bell-gable terraces and 19 stepped-gable terraces. At the fixed test camera, the full scene rises from 62 to 78 draw calls and 452,690 to 504,259 triangles. The added visual variety has a measurable rendering cost; instancing and distant detail still apply. Automated checks cover ordinary zoning growth, road-facing multi-cell placement, authored door access, unchanged save state, reload selection, brick UV direction and the actual recessed attic opening.

This is feature update one after the Edition 95 optimization. Two more feature updates precede the next dedicated optimization pass.


## Edition 97 — Zoning along connected streets

The Along road tool now follows a street across separately drawn straight and curved sections, including extensions of the starter road. It keeps the same physical side when the next section was drawn backwards. At a T junction it follows a clear straight continuation; it stops at an ambiguous fork. It does not jump to nearby disconnected streets or continue through highways. Removing a connecting road invalidates the cached street chain.

The brush, live lot outlines, committed zoning and growth use the same selected cells. The six existing housing choices keep distinct building forms and multi-cell footprints: detached homes, row houses, medium apartments, apartments over shops, low-rent blocks and towers. Existing occupied lots, geometry, residents and save addresses are unchanged. This update fixes a continuous-street selection gap; it does not replace the zoning grid or add new building models.

Reference: reviewed excerpts of the official [Zones & Signature Buildings video](https://www.youtube.com/watch?v=PBwwZ4XnW34) and [Zones, Zoning, Zoned developer video](https://www.youtube.com/watch?v=5eO3Bp5MnJQ), alongside the [zoning developer diary](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/zones-signature-buildings). Reference footage is not shipped as an asset.

Validation: 342 automated tests pass, including both sides of joined curves, reverse-drawn sections, starter-road extensions, demolition, T junctions, ambiguous forks, disconnected streets, closed loops, all six housing forms and saved lot ownership. A real browser drag selected 220 squares across three sections. After simulated growth, 13 apartment buildings occupied 200 squares in four lot sizes, housing 296 residents. In the actual game, 33 painted squares formed four planned lots and survived manual save, save-and-exit, reload and Continue.

The local browser's joined-street hit-test and strip selection measured 0.10 ms median and 0.20 ms p95 over 200 warmed samples. A paired 5,956-cell preview benchmark retained identical outputs and save data; existing single-section preview and brush times remained comparable with Edition 96. These measure CPU operations, not overall FPS. Street connections are cached and only consulted by zoning tools. Rendering assets and simulation scheduling are unchanged; model and distant-geometry URLs retain their previous asset versions to reuse browser downloads.

This is feature update two after the Edition 95 optimization. One further feature update precedes the next dedicated optimization pass.

## Edition 98 — Masonry apartment facades and individual balconies

Two existing medium-density apartment models have been rebuilt: a six-storey brick block and an eight-storey cream-and-brick setback building. Narrow framed windows, substantial wall panels, individual open balconies with actual door openings, cornices and roof vents replace their broad glass bands and continuous balconies. Their model names and floor counts are retained. They grow through the existing road-facing, multi-cell zoning system; this update adds no housing categories or save fields.

The street picture in the official [Zones & Signature Buildings diary](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/zones-signature-buildings) guided the masonry proportions, framed windows and open railings. The [reference picture](https://images.ctfassets.net/u73tyf0fa8v1/6hxkmLpCK8YFmCE7JdecpV/2475f2f3e512f2de35d227928b9c34b8/4_Mixed_use.png?fm=webp&q=75&w=1920) was inspected before modeling. It is not included in the shipped assets.

All other 57 modern models retain identical geometry, attributes, metadata and distant topology. The modern catalogue remains 59 models and 13 shared materials. Its total increases by 130 triangles, from 199,600 to 199,730; combined compressed modern and distant downloads increase by 1,839 bytes. The changed models retain seven and eight material draws respectively by sharing compatible painted surfaces. Distant detail retains window frames, doors, balcony slabs and main railings. Existing geometry and transfer budgets remain unchanged.

All 343 automated checks pass, including raycast checks for open railings, balcony door height, recessed windows and correct street entrances at both detail levels. Day, night and grown-neighborhood browser checks show the models loading without console warnings or errors. The same local street layout grows 16 buildings over 220 squares in five lot sizes, housing 352 residents. At the fixed camera, the new scene uses 286 draws and 1,132,476 triangles versus 288 draws and 1,131,668 triangles with the prior assets. Model selection adapts to the revised bounds, so this is a whole-scene comparison, not an isolated per-model comparison. These asset and scene counts are not frame-rate measurements.

This is feature update three after the Edition 95 optimization. The next update must be a dedicated optimization pass before further features.

## Edition 99 — Faster pedestrian route searches

Pedestrian route planning now reuses numeric search buffers and a compact priority queue instead of allocating new maps and queue objects for every journey. The search stops once the remaining queue cannot improve the selected destination. Stable queue ordering retains the same paths when costs tie. Search buffers are transient and separate from saves, residents and route results; roads and footpaths still invalidate the existing route cache.

A paired comparison against Edition 98 plans 120 uncached journeys across 624 sidewalk nodes. Median CPU time decreased from 9.04 to 3.60 ms in Node and from 7.80 to 3.60 ms in the browser. Both implementations produced identical path points and lengths and left the world unchanged. The browser figure was measured after the full test suite finished, using alternating implementation order and eleven measured batches after warmup. These are route-planning timings, not overall FPS or a guarantee for other devices. Run `GIT_BIN=/path/to/git node scripts/benchmark-walking-search.mjs 19cf122` to repeat the command-line comparison.

All 345 checks pass. Additional cases compare weighted searches with an independent shortest-path oracle, cover equal-cost paths, unreachable destinations, changing graph sizes, search-generation rollover, retained results and road removal/reconnection. Existing walking, bus, resident, offscreen movement and save-restoration tests continue to pass. The browser comparison loads the full game renderer without warnings or errors.

Building models, terrain, textures, rendering detail, simulation speed and save formats are unchanged. Existing model asset URLs remain pinned to Edition 98 to reuse cached downloads. This is the dedicated optimization after Editions 96–98; the feature-update counter resets to zero.

## Edition 100 — Shopfront apartments and larger mixed-use lots

Mixed-use zoning now permits three- through six-cell frontages. This allows the larger courtyard block to grow at its authored scale alongside smaller shopfront apartments. Previously, new mixed-use lots were limited to three or four cells wide, which excluded the courtyard model whenever a smaller full-scale model fitted. New lots still follow the road and consume the painted depth; occupied parcels retain their saved boundaries, buildings and resident addresses.

The two existing mixed-use models have narrower framed apartment windows, textured masonry, broader ground-floor display windows, sloped fabric canopies and separate apartment entrances between shops. The smaller five-storey model has individual open balconies; the larger six-storey block retains its open courtyard, roof terraces and stepped wings. The modeled apartment doors now provide the positions used for their sidewalk connections. No new save fields or building categories are introduced.

The [mixed-use street picture](https://images.ctfassets.net/u73tyf0fa8v1/6hxkmLpCK8YFmCE7JdecpV/2475f2f3e512f2de35d227928b9c34b8/4_Mixed_use.png?fm=webp&q=75&w=1920) from the official [Zones & Signature Buildings diary](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/zones-signature-buildings) was inspected before modeling. It guided the distinction between shop displays, apartment windows, masonry and canopies. Reference images are not shipped as assets.

The other 57 modern models retain identical geometry, attributes, metadata and distant topology. The catalogue remains 59 modern models and 13 shared materials. Total geometry decreases by 592 triangles, from 199,730 to 199,138, and combined compressed modern/distant downloads decrease by 11,240 bytes. The smaller model uses ten material draws instead of eleven; the larger uses eleven instead of thirteen. Distant geometry retains window frames, panes, shop signs, balcony structure and doors while omitting small recess returns, blinds and inward roof faces. Existing geometry and transfer budgets are unchanged.

All 347 tests pass, including normal growth of both mixed-use models at full scale, varied lot widths, stable save/reload selection, preserved occupied sites, visible apartment doors, transparent shop displays with room backs, open courtyard space and framed windows at both detail levels. Day/night and neighborhood browser checks load without console warnings or errors. The test street grows 15 buildings over 360 cells in four lot sizes, housing 360 residents: ten small shopfronts and five courtyard blocks. At the same camera with the same lots and model counts, the complete scene decreases from 72 to 70 draws and from 481,356 to 478,632 triangles. These are asset and scene costs, not overall FPS measurements.

This is feature update one after the Edition 99 optimization. Two more feature updates precede the next dedicated optimization pass.

## Edition 101 — Layered grass, outcrops and riverbanks

The terrain surface now blends regional green and drier grass, irregular rock outcrops and vegetated pockets on slopes. Low banks transition through granular sediment to darker, smoother wet ground. Rock faces have non-repeating bedding variation. Color, normal detail and roughness share the same surface boundaries, and each world's seed determines its regional pattern. Near and distant terrain use the same world-space coordinates and seed.

The Waterway Pass and Lakeland pictures in the official [Autumn Breeze visual update](https://www.paradoxinteractive.com/games/cities-skylines-ii/news/autumn-breeze) were inspected before implementation. Their grass variation, broken vegetation edges and narrow shoreline transitions guided this pass. The reference pictures are not included in the game.

Flat grass skips the three rock-color and three rock-normal texture samples. Explicit gradients are calculated before conditional shading, so mip selection and tangent frames remain valid at material boundaries. Shared masks also avoid recalculating the same noise for color, normals and roughness. The full-detail rock path still uses the scanned color and normal textures. Mesh resolution, textures, building models and simulation detail are retained. Existing cities retain their elevations and road/building alignment, and model downloads remain pinned to Edition 100 for cache reuse.

A matched river overview used exactly 45 draws and 473,723 triangles for both surfaces. In alternating old/new measurements, median GPU rendering time was 16.49/12.10 ms and 15.29/11.14 ms. Frame intervals were near 16.7 ms in three runs and 18.8 ms in the first baseline run. These measurements cover this scene on the test device; they do not establish performance for every city or computer.

Coastal backdrops also have an inland slope transition instead of a near-vertical wall at the sea edge. This affects the scenic hills outside the editable map. Across three seeds, all 9,409 sampled city elevations per world and the outside road approach are byte-identical to Edition 100. The steepest sampled one-unit coastal height change falls from 18–87 units to below three. Legacy landform versions retain their original heights.

All 348 tests pass, including coastal continuity, historical terrain, saves, road-following zoning, household travel and independent offscreen simulation. Browser checks cover river and coastal terrain, grassland, near/distant cameras, day/night shading and shader compilation.

This is feature update two after the Edition 99 optimization. Edition 102 is the third feature update; Edition 103 is reserved for the next dedicated optimization pass.

## Edition 102 — Detailed water and broken reflections

Water now uses two animated layers of small ripple normals, with different scales, directions and drift rates. These replace the long, uniformly spaced sine-wave bands. Reflections distort with the surface, fade safely at the reflection-image boundary, and become stronger at shallow viewing angles. The water body is darker at depth, with a narrow sediment-colored shallow margin based on the rendered riverbed and the viewing direction. Small patches of shore wash, sun highlights and distance haze complete the surface. The shader also uses the renderer's display transform when contact shading is disabled.

The Port and Passenger Port screenshots in the official [Ports & Beyond diary](https://www.paradoxinteractive.com/games/cities-skylines-ii/news/bridges-and-ports-dev-diary-ports) were inspected before implementation. Their ripple scale, broken reflections, dark deeper water and restrained shallow edges guided this update. These reference pictures are not shipped as game assets.

A 128×128 procedural gradient texture is baked once in memory and sampled at two scales. Its base level is 64 KiB, with mip filtering for distant views; it adds no network download. Each world's GPU texture is owned and disposed separately. The existing reflection target remains 384×384 and refreshes at most four times per second. No additional terrain geometry or reflection passes are introduced, and building/model quality and independent resident simulation are retained. This changes water rendering; water levels and terrain/save data are unchanged.

All 350 tests pass, including ripple continuity, independent texture ownership, complete disposal, shoreline edits, saves and resident movement. Browser checks cover low-angle and overhead views, rivers and coasts, day/night, reflections disabled, and all three graphics settings. The existing local QA save was not opened; its listing and original Balanced setting were retained.

In alternating old/new coastal runs, median GPU time was 11.38/11.02 ms and 11.33/10.88 ms. Both versions used 45 draws and 435,202 triangles on ordinary frames, and 88 draws and 874,501 triangles when refreshing reflections. The riverbank runs measured 14.04/13.64 ms and 12.78/12.40 ms. Median frame intervals stayed at 16.6–16.7 ms. These are matched-scene measurements on the test device, not a guarantee for every city or computer.

This is feature update three after the Edition 99 optimization. The next update, Edition 103, is the scheduled dedicated optimization pass.

## Edition 103 — Local road-edit refresh

Road edits now rebuild legacy buildings only when a changed road is inside the rectangle used to find that lot's frontage. The rectangle includes the complete width and depth of a multi-cell lot. Independent zoning parcels retain their saved frames and model roots unless the parcel or building actually changes. Adding a distant road no longer recreates every house, apartment and landscaped site in the city.

Road geometry, driveway and sidewalk access, traffic routes, street life and zoning overlays still refresh after road edits. Nearby additions, removals and curves still update legacy facades. Growth, demolition, changed parcel frames, night lighting, overlays and forced refreshes retain their existing behavior. Building models, textures, terrain, LOD settings and resident simulation are unchanged.

All 356 tests pass. Six new checks cover local and distant road edits, curved frontage, multi-cell dependency bounds, retained independent parcels, construction, service buildings and access/traffic refresh. The differential CPU benchmark uses shipped building assets and compares exact mesh geometry, materials and transforms with Edition 102; world data also matches. In a 90-building legacy district, median building-refresh time falls from 29.78 to 2.16 ms. In a 300-building independent district it falls from 111.50 to 3.63 ms. These CPU measurements exclude road geometry, traffic graph work, GPU rendering and image decoding.

A separate browser comparison includes the complete refresh, with real textures, trees, roads, access paving and traffic. In alternating runs of the same 100-building independent district, a distant road edit takes 1,754.9/198.6 ms and 1,785.9/192.6 ms before/after. Building roots recreated per edit fall from 100 to zero; all four runs retain the same 7,394 component meshes and vertex/index counts. The interval through the edit's next frame drops from 1,852.8 to 306.5 ms and from 1,882.4 to 269.8 ms. This measures an editing interruption in this test scene, not steady-state FPS or every city's performance. Removing a complete street in the browser retains all 100 occupied model roots while removing its traffic nodes and the disconnected access paving.

This is the scheduled optimization after feature updates 100–102. The feature-update counter resets to zero; the next dedicated optimization follows updates 104–106.

## Edition 104 — Curtain-wall office facades and screened roofs

The glass podium, stepped, elliptic and slender office towers now have separate recessed vision panes and dark floor-edge glass panels. Continuous projecting metal mullions and thin horizontal transoms give the facades a finer structural grid. The stepped and slender towers also have vertical edge fins. Entrances have paired piers, a canopy and doors at the saved access points. Open-top roof screens surround the mechanical equipment, with angled louvres at close range and the same rim and silhouette at a distance.

The high-density office district picture in the official [Zones & Signature Buildings diary](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/zones-signature-buildings) was inspected before implementation. Its slender facade grids, dark floor bands, vertical edges and screened roof equipment guided these original models. The reference picture is not included in the game.

The four rebuilt models share the existing material catalogue and add 2,548 triangles in total, or 1.3% of the authored-model catalogue. Adjacent transom strips share geometry. Internal transoms, small mullion returns and roof louvres are omitted from distant topology, with closed floor panels behind the omitted trim. Window openings, floor panels and facade profiles remain. Compressed model and distant-geometry downloads increase by 39,313 bytes. The geometry, UVs, material assignments and metadata of the other 55 authored models match the Edition 103 baseline hashes.

A matched browser district contains 24 offices, six of each form, on the same road-facing lots. Ordinary-frame draw calls decrease from 149 to 145, while triangles increase from 487,797 to 493,273 (1.1%). The browser-loaded counts match the final generated assets. Alternating old/new GPU medians were 40.12/26.22 ms and 25.47/36.30 ms; frame intervals were 45.5/33.4 ms and 33.5/41.4 ms. This variation prevents a reliable FPS comparison. Geometry and draw-call costs are bounded, but these measurements do not establish lag-free play or equal performance for every city.

All 359 automated tests pass. They include facade depth, non-emissive floor panels, open roof screens at both detail levels, unchanged model hashes, varied office selection and the existing distant-geometry budget. Asset integrity and lossless compression checks also pass.

This is feature update one after the Edition 103 optimization. The next dedicated optimization follows updates 104–106.

## Edition 105 — Continuous river bridges

Road crossings now have continuous concrete decks, longitudinal beams, piers with crossheads, shore abutments and open edge railings. The structure follows straight and curved roads, including existing grid roads, and adapts to the road's width and sidewalk. Compatible end-to-end segments are joined before planning a crossing, so extending a road or loading an old grid bridge does not create a separate arch and support at every segment. Railings stop at intersection openings.

The elevated-road picture in the official [Road Tools diary](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/road-tools) was inspected before implementation. Its continuous concrete slab, supporting piers and open roadside barriers guided the original bridge geometry. The [reference picture](https://images.ctfassets.net/u73tyf0fa8v1/RLQU0m7sInUxQVu3TRolN/402a675022ffcb1196de4872c64937a2/cities-skylines-ii-road-tools-6-stacked-roads.jpg?w=1920&q=75&fm=webp) is not shipped with the game.

A single graded crossing profile now supplies the pavement, sidewalk, structure and vehicle/pedestrian display heights. It removes the shoreline dips from the previous water-dependent road height. The grade is derived again from road controls and terrain when the city loads or its roads change. Bridge plans and height indexes are transient; world data, road paths, zoning ownership and resident journeys are retained. Stationary vehicles and waiting pedestrians invalidate their cached display height when a road is rebuilt.

The deck and rails share two material buffers before joining the existing spatial road batches. Nearby height samples use a small spatial index instead of scanning every bridge. Building models, textures, terrain geometry and independent simulation are retained. No new image or model downloads are required; existing model asset URLs remain pinned to Edition 104.

Regression checks cover reversed street extensions, curve edges, approach endpoints, open driving lanes, deck/soffit face orientation, piers, intersection openings, width transitions, all road styles, restored cities, demolition and stationary vehicle/pedestrian height invalidation. Asset integrity, compression and module syntax checks pass. The release workflow verifies the complete regression suite before publishing.

In the matched river scene, ordinary draw calls decrease from 35 to 34 and triangles increase from 459,249 to 467,509. Alternating old/new GPU medians were 9.22/9.38 ms and 9.23/9.90 ms. Frame intervals varied between 55.7 and 72.4 ms, so this is not evidence of consistently smooth frame rates. The added structure costs about 0.2–0.7 ms of GPU time in these runs. CPU height queries for 400 moving vehicles over 60 frames measured 29.14 ms before and 32.72 ms after, an increase of about 0.06 ms per frame. Warm bridge planning measured 1.88 ms. These figures cover this fixture and test device, not every city or computer.

This is feature update two after the Edition 103 optimization. Edition 106 is the third feature update; Edition 107 remains the next dedicated optimization pass.

## Edition 106 — Usable zoning along curved roads

Curved zoning blocks now fit their front edge to the road across the entire block. Previously, the tangent grid could clip the inside pavement edge; rejecting those front cells then removed all the cells behind them, leaving narrow spokes instead of usable apartment lots. Both sides retain rectangular, road-facing parcels while crossing roads, water, occupied lots and genuinely tight wedges remain excluded. Straight-road grids are unchanged. Existing developed parcels retain their exact saved frames, occupants and road access.

Residential zoning still has six distinct forms: detached homes, attached row houses, medium apartments, mixed-use apartments over shops, low-rent blocks and high-rise apartments. Along-road zoning now starts medium and mixed apartments four cells deep and larger apartment blocks six cells deep. Each category remembers its chosen depth during the session. Buildings continue to grow across multiple cells with varied widths; a single painted cell does not become a house.

Reference review covered the zoning and housing sections of the official [Zones & Signature Buildings feature video](https://www.youtube.com/watch?v=PBwwZ4XnW34), [Zones, Zoning, Zoned developer video](https://www.youtube.com/watch?v=5eO3Bp5MnJQ), their transcripts, and the [official zoning guide](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/zones-signature-buildings). This was a focused section review, not continuous viewing of the entire videos.

All 370 local checks pass, including new curved-frontage coverage, road and cell collision checks, six housing growth/save cases and an Edition 105 parcel fixture. The browser comparison increases a four-cell-deep curved strip from 389 cells / 33 planned lots to 478 cells / 38 planned lots. A grown 26-building neighborhood with six lot sizes and 496 residents retained its development data through save/reload. Browser checks also confirm the per-category depth defaults and remembered custom selections.

In an alternating four-curve benchmark, median cold grid generation is 56.88 ms before and 57.06 ms after; cached queries are 0.022 ms before and 0.023 ms after. These are CPU operation timings, not a frame-rate guarantee. No models, textures, simulation scheduling or per-frame work were added. Existing model downloads remain pinned to Edition 104. Edition 107 remains the next dedicated optimization pass after feature updates 104–106.

## Edition 107 — Faster zoning reconstruction

The scheduled optimization after updates 104–106 reduces the work needed to recreate zoning when loading a city or changing roads. Layout construction prepares rectangle axes and bounds once, searches only spatial bins touched by each cell, and avoids allocating a duplicate-check set for every candidate. Exact rectangle collision tests still reject the same overlaps. Private collision records are discarded after construction; saved cells and parcels contain no new fields.

All 54 layouts compared against the frozen Edition 106 implementation match field-for-field and in insertion order. Both implementations run on the same machine so platform differences in trigonometric rounding do not invalidate the comparison. They cover straight and curved streets, every road type, crossings, joined sections, map boundaries, water obstacles, islands, rivers, and both legacy and fine grids. The browser comparison also retains the same 478 selected cells, 40 planned lots and 14 unused cells. Building assets, terrain, detail levels, traffic and resident scheduling are unchanged, and model downloads remain pinned to Edition 104. This pass preserves the previously inspected zoning reference rather than adding a new visual feature.

All 371 local checks pass. In alternating complete-zoning rebuild benchmarks, the empty curved district improves from 54.98 to 18.86 ms and a district with 241 occupied parcels improves from 57.83 to 22.66 ms. Cached queries stay around 0.05 ms. The browser fixture improves from 16.2 to 5.0 ms over 20 measured samples with identical returned cells and world data. These measurements cover zoning CPU work, not complete frame rate. Repeat the comparison with `GIT_BIN=/path/to/git node scripts/benchmark-zoning-collisions.mjs`.

This completes the optimization pass following feature updates 104–106. The next three feature updates are 108–110, followed by optimization 111.


## Edition 108 — Apartments with neighborhood-sized courtyards

Medium-density zoning can now select two original apartment blocks sized for common four-cell-deep sites. A 28-metre U-shaped building and a 36-metre L-shaped building have broad five- or six-storey street wings, lower four-storey garden wings, recessed framed windows, separate balconies, rooftop equipment and open planted courts. They fill the gap between compact walk-ups and the existing large perimeter blocks. The normal deterministic model selector chooses them from the same saved parcel dimensions; no zoning, population, household journeys or save format changes are required.

The broad masonry fronts, separate balconies and window proportions were compared with the [official mixed-use picture](https://images.ctfassets.net/u73tyf0fa8v1/6hxkmLpCK8YFmCE7JdecpV/2475f2f3e512f2de35d227928b9c34b8/4_Mixed_use.png?fm=webp&q=75&w=1920) in the [Zones & Signature Buildings diary](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/zones-signature-buildings), alongside the previously reviewed developer-video apartment frame. Reference pictures are not shipped. These are original models, not game assets.

All 374 local checks pass, including both new models' open courts, connected wings, visible entrances, natural selection on rotated lots, uniform metre scale, deterministic reloads and unchanged fingerprints for all 59 previous authored models. The library now contains 82 complete building assets. The new forms use 4,618 and 4,752 triangles close up, dropping to 2,912 and 2,952 at distance while retaining their windows and silhouettes. They share the existing materials and textures. The compressed model and distant-index downloads together increase by 104.6 KiB; the modern catalogue remains below 3 MiB compressed.

In the browser comparison, the same 24 saved apartment lots select eight of the new buildings and retain seven other apartment forms. Two alternating before/after comparisons measured GPU medians of 9.95/9.31 ms and 10.15/9.32 ms. Median frame intervals remained 16.6–16.7 ms. Ordinary triangles decreased from 685,064 to 608,236, while draws increased from 149 to 158. These measurements cover this scene and test device, not every city.

This is the first feature update after optimization 107. Feature updates 109 and 110 precede the next scheduled optimization, Edition 111.

## Edition 109 — Consistent roadside zoning and individual intersections

Rectangle and brush zoning now use the connected street's coordinates across separately drawn straight, curved and reversed road sections. A drag along a bend no longer falls back to a world-axis rectangle or a straight brush chord through the middle of the block. Fill continues over adjacent drawing seams while respecting occupied lots, different zoning, missing land and crossing streets. A cached, transient street-coordinate index avoids repeated whole-grid searches; existing cell IDs, saved parcels, housing models and resident homes are unchanged.

The zoning panel now reports selected cell count, building-lot count, the selected housing form and actual lot dimensions. Each 8 × 8 m cell is land; several cells become one building site. Detached houses, row houses, medium apartments, mixed-use buildings, low-rent blocks and residential towers retain their distinct growth rules and varied multi-cell footprints. The official [zoning feature video](https://www.youtube.com/watch?v=PBwwZ4XnW34), its zoning/housing transcript sections and the [developer zoning diary](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/zones-signature-buildings) informed this review. This was a focused review, not continuous viewing of the entire video.

The previously prepared intersection controls are included: Inspect an intersection to select the city default, traffic lights or all-way stops. Stop-controlled approaches display original octagonal stop signs instead of red traffic lights. Each junction keeps its own saved override. Changing controls retains vehicle routes and existing junction reservations, so cars already in the crossing can clear it. Static control geometry is rebuilt only when control settings or placements change.

All 381 local tests pass, including joined-road selections in both directions, fill barriers, all six housing forms, exact saved parcel restoration, independent junction policies and traffic clearance. Module syntax checks pass. In a 100-sample cached selection benchmark, the joined-road brush decreased from 2.34 to 0.15 ms per operation. Rectangle selection stayed around 0.08–0.09 ms; fill increased from 0.11 to 0.25 ms while covering the full 676-cell connected block instead of only 132 cells. These measure CPU selection work, not complete frame rate. No building models, textures or per-frame zoning work were added; model downloads remain pinned to Edition 108.

This is feature update two after optimization 107. Edition 110 is the third feature update; Edition 111 remains the next dedicated optimization pass.


## Edition 110 — Housing demand and vacancies

Low, medium and high residential density now have independent construction demand. Detached houses use low density; row houses, apartments and mixed-use buildings share medium density; low-rent blocks and towers share high density. Empty apartments reduce demand for more apartments without also removing demand for detached houses. Mixed-use growth additionally requires commercial demand. Already reserved construction finishes, and residents can still move into available homes when demand for additional buildings is low. Existing road-facing multi-cell parcels, six housing forms and saved occupants are retained.

The HUD demand bars open a panel with occupied, vacant and under-construction resident capacity for each density. It explains the effects of jobs relative to population, residential taxes, happiness, vacant housing and construction. Building inspection also shows capacity and demand. These are original simplified formulas using the game's existing city metrics; this update does not add age, student, income or rental-market simulation. Capacity counts resident places rather than households.

The demand-panel image and housing discussion in the official [Zones & Signature Buildings diary](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/zones-signature-buildings) were inspected before implementation. Focused zoning and apartment frames from the [feature video](https://www.youtube.com/watch?v=PBwwZ4XnW34) and [developer video](https://www.youtube.com/watch?v=5eO3Bp5MnJQ) informed the existing road-aligned multi-cell behavior. Current video playback stalled after the Mac locked; no continuous full-video viewing is claimed. Reference images are not shipped in the game.

All 387 regression tests pass, including six new checks covering density-specific supply, construction, mixed-use demand, move-ins despite vacancies, taxes, road access and exact save restoration. Asset integrity, lossless compression and module syntax checks pass. In the rendered local browser fixture, population grows from 24 to 172 over 30 simulated days; 124 of 144 medium-density places become occupied. The Save and reload control verifies matching demand, occupants and lots. The remaining full-game interaction checks were interrupted by the locked Mac.

In an alternating 100-sample benchmark of a 241-parcel district, complete city-analysis CPU time measures 0.231 ms before and 0.200 ms after (95th percentiles 0.711 and 0.540 ms). Existing world data and non-demand metrics match. This measures analysis during simulation/UI updates, not rendering or overall FPS. No per-frame work, geometry, texture or model downloads were added; model assets remain pinned to Edition 108.

This is feature update three after optimization 107. Edition 111 is the next scheduled dedicated optimization pass.


## Edition 111 — Faster traffic at busy intersections

The scheduled optimization after updates 108–110 reduces repeated junction occupancy scans. Approaching drivers use the existing, sequentially updated vehicle index to search the less crowded coordinate axis, then apply the same strict circular clearance test. Held buses, dwelling cars and newly arrived vehicles still block crossings. Vehicles that have become inactive no longer update stale index entries. Small fleets keep their direct scan. Signal timing, stop waits, crossing ownership, lane following, acceleration, routes and simulation scheduling are unchanged.

A profile of a 4,872-resident city with 512 vehicle slots identified traffic as the main simulation CPU cost. The final alternating benchmark compares against the frozen Edition 110 traffic, junction and spatial-index source in the same runtime. Across three trials, the 128-slot city decreases from 767.8 to 476.0 ms and the 512-slot city from 6,163.6 to 3,637.9 ms for 1,800 simulation steps (90 simulated seconds), reductions of 38% and 41%. The benchmark includes traffic, transit, walking and resident scheduling; it excludes rendering, GPU work and engine growth ticks. These are CPU-operation measurements, not an overall FPS guarantee. The 32-slot case retains the direct-scan behavior and is reported in the benchmark without attributing its timing variation to the new junction search.

All 390 regression tests pass, plus the separate asset integrity, lossless compression and module syntax checks. New tests cover random positions and sequential movement, strict circle and bucket boundaries, inactive slots, held buses, dwell periods, signal/stop changes and road removal in an occupied city. The frozen-release comparison preserves every vehicle state, resident journey, queue summary, completed trip count and world field. The comparisons run without rendering, so offscreen simulation remains independent of camera visibility.

Only traffic and spatial-query behavior changes; all other changed game sources contain version updates only. Building and terrain geometry, textures, detail settings and visual source bodies are unchanged. Model asset URLs remain pinned to Edition 108. This pass preserves the previously reviewed visual references and adds no new visual feature. Browser playtesting remains unverified because the Mac was locked during the work.

Reproduce the CPU comparison with `node scripts/benchmark-junction-occupancy.mjs d194293` (set `GIT_BIN` if a particular Git executable is needed). This completes the scheduled optimization; the feature counter resets to zero. The next dedicated optimization follows updates 112–114, in Edition 115.


## Edition 112 — Choose which side of a road can develop

Road construction now has Both sides, Left side, Right side and No zoning settings. Inspect an existing road to change its setting, with a direction arrow and a preview of its available cells. Where drawn segments cross, choose the segment in the inspector. Older tile roads apply the change to one continuous straight section, stopping at crossings, gaps and road-type changes. Highways remain unzoneable.

Disabling a side removes its candidates before zoning-grid collision resolution, allowing neighboring streets to reclaim usable frontage. It does not demolish homes, relocate occupants or cancel reserved construction. Existing multi-cell lots keep their saved geometry and road access. Unused painted fine cells remain saved and return when that frontage is available again. Side choices survive manual save, exit and reload; older worlds default to both sides. The inspector and road-build controls remain usable in smaller viewports through scrolling and measured hint placement.

The two official before/after roadside-zoning pictures in [City Corner #3 — Anniversary Free Update](https://steamcommunity.com/games/949230/announcements/detail/523118649476645035) were reviewed before implementation. They illustrate removing competing zoning beside a curved street. Reference pictures are not shipped. This is a focused picture review, not a claim of watching the whole accompanying video.

All 403 regression tests pass, plus asset integrity, lossless compression and module syntax checks. Tests cover curves, reversed directions, independent crossing segments, legacy sections, recovering neighboring frontage, disabled paint, occupied parcels, construction, save restoration and inspector controls. The 54 frozen-layout comparisons still reproduce unmodified-world cell geometry and order. Changing zoning retains building roots, batches, road surfaces and traffic setup; a simulation comparison retains exact resident journeys and vehicle states without rendering.

In an alternating CPU benchmark against Edition 111, cached available-grid queries remain about 0.05 ms. Complete curved-city rebuild medians change from 20.6 to 21.8 ms without buildings and 22.6 to 23.9 ms with 241 parcels. In a separate district, changing a side costs a median 25.3 ms for the grid and 5.0 ms for the preview. The selection overlay uses two draw calls and updates on changes, not each frame. These are operation timings, not overall FPS measurements. Building and terrain assets are unchanged and model downloads stay pinned to Edition 108. Live browser clicks and visual layout remain unverified because the Mac is locked.

This is feature update one after optimization 111. Updates 113 and 114 precede the next dedicated optimization in Edition 115.
