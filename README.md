# Borough II
A standalone browser city simulation with a Cities: Skylines II inspired interface and a real Three.js 3D view. It is an original small game, not the commercial game or a reproduction of its complete simulation.

## Edition 167 — Reference-based zoning tray

The zoning panel now uses a shallow density tray, colored category icons and a separate painting box. Eleven original icons were modeled and rendered in Blender, including six distinct housing forms. The editable Blender scene and authoring script are included. Tool mode, road-following depth and brush size remain reachable; narrow screens fold them into Zoning options. Names, lot dimensions and unlock requirements remain available in the detail row and tooltips.

Compared before and after with the actual [official Cities: Skylines II zoning toolbar screenshot](https://images.ctfassets.net/u73tyf0fa8v1/RoDwM6O0tjoyKwLkWYQWZ/c57e1feaa1260b839eb469eea2d416a0/1_Zoning_toolbar.png?fm=webp&q=75&w=1920). The tray composition and isometric green/blue/yellow/purple icon language are closer; exact icon shapes, theme selection, signature-building controls and the broader game remain different. At 1280 × 720, the former 1040 × 337.39 panel becomes a 520 × 119 tray plus 220 × 106.19 controls, about 76% less combined panel area, excluding the dock and hints.

All 980 release checks pass, plus syntax, existing 3D assets and lossless compression checks. All eleven PNGs are 128 × 128 RGBA with clear margins and unclipped bounds, totaling 182,537 bytes. Icons are pre-rendered images with no per-frame scene work. Browser QA covered every zoning family, progression locks, brush sizes, roadside depth, drawing-mode selection, category switching and 800 × 600 / 390 × 844 layouts. Painting and erasing four cells worked; a roadside drag created 36 cells in four multi-cell lots, and those lots remained after manual save/reload. Browser warning/error log was empty.

This is feature update three after optimization 164. Edition 168 is the next optimization pass; the overall reference-fidelity goal remains unfinished.

## Edition 166 — Compact road picker

Replaced the oversized road cards with a shallow thumbnail shelf grouped into Small, Medium, Large and Highways. All twelve road types remain available, with names, costs and unlock requirements shown in a shared detail row on hover or keyboard focus. Drawing modes, parallel settings, zoning sides and snapping live in a compact box beside the shelf. On smaller screens, Tool options expands beneath the shelf. The build dock becomes shorter while Roads is open.

The layout was compared before and after against the actual [Cities: Skylines II road-tool screenshot](https://www.galaxus.at/Files/7/5/3/3/5/2/9/1/CSll_BuildingRoad-2_png_jpgcopy.jpg), with categories checked against the [official Road Tools feature](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/road-tools). At 1280 × 720, the old picker occupied 1000 × 276 pixels; the new shelf is 520 × 117 with a separate 220 × 124 tool box, about 68% less combined panel area. This measurement excludes the bottom dock and hints. The original vector thumbnails and available controls are not an exact reproduction of the commercial game.

All 980 release checks pass, along with syntax, building assets and compressed-asset verification. Browser checks cover all road families, locked options, straight/curved/grid/replace/roundabout modes, parallel gap/side settings, snapping, category switching and 800 × 600 / 390 × 844 layouts. No browser warnings or errors were observed. This interface change adds no scene geometry or simulation work. This is feature update two after optimization 164.

## Edition 165 — Camera-relative movement

WASD and arrow keys now move continuously in the direction the camera is facing, rather than making seven-unit jumps along fixed map axes on keyboard repeats. Forward/back follow the ground-projected viewing direction, and left/right strafe across that view. The direction updates while rotating. Camera height, tilt and zoom remain unchanged during keyboard movement. Diagonals have the same speed as straight movement; a short acceleration ramp makes starting smooth, with an immediate stop on release. Speed scales with zoom and Shift doubles it. Middle-button panning stays on the ground plane.

Held input clears on blur, tab visibility changes, text focus, dialogs, home, and system-key shortcuts. Ctrl/Cmd+S still saves. Existing right-drag rotation and construction controls are preserved. The settings help and game hints explain the new bindings.

All 980 checks pass, plus syntax, building assets and compressed-asset checks. Direction tests cover eight headings, three pitches, overhead fallback, rotation during a held key, diagonal speed, 30/60/144 Hz timing, repeat events, release, modifiers, focus and menu guards. Native held-key tests in the real game verified forward before/after a 90-degree turn, sideways movement, Shift speed and zero movement while the game menu is open. No model, texture, terrain or simulation detail was changed. This is feature update one after optimization 164.

## Edition 164 — Forest rendering optimization

The eight broadleaf draw groups now share one material and one occupied instance batch. Tree setup assigns each tree to its existing species in a single pass instead of repeatedly copying and filtering the entire forest. Empty species groups are omitted. A normal mixed forest uses three canopy groups rather than ten, while retaining every saved position, height, species, rotation, atlas, shadow and close model. Different materials still remain separate, and camera movement retains the same buffers and nearest-ten-tree detail rule.

Isolated warm CPU measurements for assembling 1,600 / 6,400 / 12,800 trees changed from 1.07 / 2.15 / 6.11 ms to 0.69 / 1.47 / 3.57 ms. These are setup measurements, not whole-game frame-rate claims. All building models, textures, terrain, simulation rules and save data are unchanged.

In five matched 1280 × 720 browser views, median draw counts fell by seven (47→40 for region views, 28→21 for the neighborhood, 27→20 close up), with identical drawn triangle counts. GPU time ranged from 13.9% lower to 2.8% higher; frame times remained broadly similar. The initial comparison with differing viewport widths was discarded. Before/after woodland screenshots retain the same visible detail.

The actual Cities: Skylines II tree photograph was inspected before and after this pass. This scheduled optimization preserves the current artwork; it does not resolve the remaining differences in canopy shape, lighting, terrain, buildings or simulation. The next optimization is due after three further feature updates.

## Edition 163 — Blender-authored mature conifers

The enlarged sapling used for conifer stands is replaced by two original Blender assets: a tapered spruce with layered branches and a raised, asymmetric pine crown. The shapes were built against the actual [Cities: Skylines II tree photograph in City Corner #11](https://www.paradoxinteractive.com/games/cities-skylines-ii/news/autumn-breeze). The initial regular pine was rebuilt into separate crown masses after comparison, and the distant lighting and viewing angles were revised after inspecting the game renderer. Editable Blender source and the authoring/baking script are included.

Nearby trees use actual bark, branch and needle geometry. Distant trees use Blender-baked views from four elevations and eight directions, with tree rotation shared by the detailed models, canopy cards and shadows. This replaces the old startup-time sapling bake. The existing ten-tree close-model cap, stationary-camera skip, saved tree positions, clearance rules and simulation behavior remain unchanged. Spruce has 54,156 triangles and pine 26,280, compared with the former sapling's 122,235. The new compressed model plus two atlases total 8,704,121 bytes versus 9,569,091 bytes across the former eight runtime files. Uncompressed fallback downloads remain available.

A fixed ten-conifer close view reduced drawn triangles from 1,254,806 to 782,615 and median GPU time from 12.69 to 10.54 ms. Four wider views ranged from 3.6% lower to 3.7% higher GPU time; median frames were 16.6–18.6 ms. These are scoped local measurements, not a general FPS guarantee. Cropping proven-transparent atlas margins preserved every visible branch while halving card width. Early measurements with competing renderers were discarded.

All 966 release checks pass, along with syntax, 91 building-asset checks and lossless-compression verification.

Validation and browser measurements are recorded in `references/edition163-reference-audit.md` in the working checkout. The assets have checked geometry, 64 unclipped atlas views, matching instance rotations, bounded close detail and exact compression round trips. Browser side and overhead comparisons still show differences in fine canopy coverage and lighting between the full model and distant views. Overall game fidelity remains incomplete; these assets are not an exact match to the commercial game.

This is feature three after optimization 160. Edition 164 is the next optimization pass.

## Edition 162 — Extra Large regions and merit-funded expansion

All seven landscapes now offer Extra Large maps: 96 × 96 build cells, sixteen purchasable districts and four times the area of Standard (78% more than Large). Each starts with one west-edge district in Progression mode. The first 100 residents award two merits, enough to purchase one more district through the Land button. Extra Large milestone rewards total thirty merits, covering all fifteen remaining districts by Great City. Standard and Large reward receipts are unchanged. Sandbox owns the whole region from the beginning.

The new-game screen explains the expansion rules and uses seven new previews sampled from the actual Extra Large terrain. Purchases save immediately, reject insufficient merits and preserve ownership across reloads. Existing cities keep their map sizes; choose Extra Large when creating a new city. Building detail, traffic simulation and the five-minute autosave interval are unchanged.

All 961 release checks pass, plus syntax, 91 building-asset checks and lossless-compression verification. New coverage exercises starter growth and outside access on every Extra Large landscape, all sixteen land-selection targets, full merit-funded expansion, rejected purchases, mixed-size saves, and roads/sculpting beyond the former Large boundary. Browser QA verified an Extra Large new game and manual save/home flow, then purchased B3 for two merits in a naturally simulated test city. Reloading and continuing retained both owned districts and the zero-merit balance, with no browser warnings or errors. Empty and 196-resident overview views displayed 60 FPS on the test machine; this is a spot check, not a guarantee for developed cities. Larger regions require more terrain memory and can take longer to open.

This is feature two after optimization 160; the next scheduled optimization remains 164. The unfinished mature-conifer asset work is separate from this release.

## Edition 161 — Connected woodland and open meadows

New cities distribute their existing tree-cell budget into connected woodland and broad clearings, guided by the actual Mountain Village photographs in the official [Maps & Themes diary](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/maps-themes). Tree pairs vary in age and height, and neighboring stands share broadleaf or imported tree varieties. The existing detailed models, materials and ten-tree close-model limit are retained. Close models now match the variety used by their distant canopy cards. No new tree asset was authored.

The first photo comparison exposed an abrupt density change at the map edge. The revision continues the woodland field and close spacing for another 32 world units before thinning distant pairs. Scenic trees have a fixed 1,360-instance ceiling, and selection adds no per-frame terrain or woodland sampling. The seven maps at both sizes retain their previous number of tree-bearing cells; all fourteen previews now use the actual new natural-tree positions.

Forest metadata and cleared cells persist in saves. Older cities retain their saved tree layout, while a corrected Large-map exclusion prevents distant scenery trees from appearing inside the expanded buildable area. Water, steep slopes, road earthworks, outside entrances and occupied lots still exclude natural trees. Manual saving, five-minute autosave, selectable worlds, merits and independent simulation remain enabled.

All 950 checks pass, including deterministic groves for all fourteen map/size combinations, original tree-cell budgets and building-variant RNG, real road clearing and save/reload, legacy saves, wetness/slope exclusions, distant-tree limits, interleaved staged jobs, and matching near/distant tree varieties. Historical simulation and tree-geometry fingerprints remain unchanged using explicit old-world fixtures. Syntax, 91 building-asset checks and lossless-compression checks also pass.

Two browser comparisons across four fixed views retained 27–46 draw calls and 16.4–16.8 ms median frames. GPU medians ranged from 3.5% lower to 5.6% higher than the baseline; this is not a general FPS improvement or a guarantee for populated cities. In separate alternating CPU measurements, woodland preparation was similar or lower in six of seven Large maps; Crescent Bay rose from 40.0 to 40.8 ms. New-world forest selection adds roughly 1–2 ms at creation. Cold terrain caches can still produce longer individual preparation steps. Browser QA created Woodland QA 161, verified a manual save at 11:07:27 PM on October 29, saved/exited, reloaded and continued with the same day-eight funds and land, then saved day 14 at 11:09:26 PM. No browser warnings or errors were observed. The five-minute timer is retained and tested; this check did not retime a full interval.

The reference comparison is still incomplete: regional scale, mountain and river shape, lighting/fog, tree silhouettes and canopy materials differ substantially. This is a woodland-placement update, not visual equivalence. It is feature one after optimization 160; the next scheduled optimization is 164, after three feature releases.

## Edition 160 — Preserve roads during neighborhood growth

This is the optimization pass after features 157–159. Completed or demolished roadside lots now prepare their changed terrain and access paths while borrowing the existing pavement, bridge plans, road surfaces and materials. The visible roads, traffic lights and GPU buffers stay in place through the swap. Ordinary road edits still rebuild the road network. Cancellation and failure release only privately prepared terrain/access resources; late construction changes are reconciled before the final terrain is shown.

Terrain sampling also stops calculating unused relief noise and mountain ridges during distant shoreline-only queries. Each regional height sample shares one shoreline distance between water, regional relief and the scenic valley transition. The shape, resolution, vertex normals, colors and indices of all fourteen current map meshes remain byte-identical to published Edition 159. Older terrain and bridge fingerprints remain covered. No asset, tree density, material or rendering detail was reduced; no new asset was authored.

In the actual browser, alternating one warm-up and three measured samples per version gave Large-map terrain generation medians of 464→355 ms for Highland Pass (23%), 409→357 ms for Lake District (13%), 414→375 ms for Crescent Bay (9%) and 397→352 ms for River Delta (11%). River and island results were within 2% of the prior build, without an improvement. A separate fixed 294-resident growth fixture measured CPU preparation at 474→297 ms (37%) when retaining roads rather than reconstructing them. These are scoped CPU measurements, not an overall frame-rate guarantee.

All 933 release checks pass. Added tests freeze every terrain buffer and both shoreline/relief fields across the inland cache boundary, require one shoreline query per regional height, and check sculpting and world switches. Growth and demolition must match complete reconstruction at terrain versions 2 and 3 while retaining road object identities and avoiding road-buffer disposal. Failed/cancelled preparations and construction finishing during preparation are covered. Existing independent traffic/walking, manual save, five-minute autosave, selectable worlds, progression and land-purchase checks remain enabled. Asset and compression checks pass.

Browser QA grew the same neighborhood from 294 to 310 residents through the normal interactive refresh path, confirming retained road buffers without console warnings/errors. The prior-edition save continued at its saved day and funds, and manual saving succeeded.

The official [Mountain Village reference photograph](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/maps-themes) was inspected again. Before/after browser views of the same neighborhood retain its visible models and terrain. This optimization does not resolve the remaining differences in regional scale, forest distribution, mountain detail, lighting, buildings or simulation; exact Cities: Skylines II parity remains incomplete. The next optimization is due after three further feature updates.

## Edition 159 — Broad regional valleys

New cities use continuous regional terrain instead of narrow stepped shelves and the artificial trench around the starting road. River Valley has broad lowlands, lakes and coastal maps have low rolling hills, and Highland Pass keeps tall bordering ridges with a usable central valley. Distant riverbanks on the newer map types also descend over a wider transition. All fourteen map previews were resampled from the actual selected-size terrain.

The official [Waterway Pass and Mountain Village photographs](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/maps-themes) were inspected before implementation and compared afterward. In the same 294-resident test neighborhood with identical roads, houses and camera, the cliff-like shelves disappear. The first pass still left a sharp scenic Highland river cut; it was revised to widen the bank. Region scale, mountain detail, forest distribution, lighting and buildings still differ substantially. This is not exact visual parity. No new model asset was authored; new building assets continue to require Blender.

Only newly created worlds use terrain version 3. Existing saved cities retain their original terrain, including sculpted elevations, roads and fitted lots. The terrain mesh resolution and existing building models are unchanged. Versioned geometry caching still provides separate buffers for each renderer. Land purchases, progression, manual saving, five-minute autosave, multiple worlds and independent traffic/walking simulation remain available.

All 913 release checks pass. Historical height, road, vegetation and economic-state fingerprints explicitly retain their original terrain version. New checks cover both map sizes, finite continuous slopes, submerged water, dry starter neighborhoods, usable lowlands, distinct mountain relief, sculpted mixed-version saves, land balances, unchanged mesh resolution, cache isolation and final bridge/pavement contact on new terrain. Model and compressed-asset verification passes. Browser QA created a Large progression city, manually saved, returned home, reloaded and continued with its day, funds and one owned tile retained. A full pre-existing local test storage correctly rejected saving; verification continued on a separate empty test origin without deleting saved cities.

Alternating CPU terrain-generation measurements (one warm-up, three measured samples per version) gave medians of 497→468 ms for Large River Valley, 554→661 ms for Highland Pass and 858→848 ms for Coastal Islands. These are generation timings, not FPS measurements; Highland adds preparation cost. This is feature update three after optimization 156. The next release is an optimization pass, with no reduction in terrain or building detail.

## Edition 158 — Street-level hillside lots

Completed roadside zoning parcels on steep ground now use cut-and-fill terrain at the street entrance. The former rule raised the entire yard to its highest natural point, producing enormous foundation blocks in the Large River Valley test city. The new plan removes buried terrain underneath the actual rotated parcel, fits the existing house and grounds to the sidewalk datum, and blends unconstrained garden edges into soil slopes. Property constraints and street edges retain solid retaining walls. Flat parcels, legacy tile buildings and civic sites retain their existing placement. Saved elevation data, road controls, building identities and models remain unchanged.

The official [residential construction and row-house photos](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/zones-signature-buildings) were inspected before implementation and compared afterward. The first pass left excessive concrete behind gardens; it was revised to use soil transitions where space is available. The steep River Valley neighborhood still has unnatural terrace transitions and different lighting, landscaping and overall scale. This does not establish full visual parity. No model asset was authored in this update; future asset work must use Blender.

Terrain fitting is cached between construction changes and uses the existing scheduled preparation path during interactive growth. Lot planning yields after groups of 16 parcels; finished road preparation reconciles any construction that changed meanwhile. Existing model buffers remain instanced. One invisible picking mesh uses two triangles per graded lot and is disposed when replaced; it adds no rendering draw. Manual saving, five-minute autosave, land merits, multiple worlds and independent traffic/walking simulation remain enabled.

All 906 release checks pass. Seven added checks cover real naturally grown hillside lots, street elevation, removal of buried terrain, selectable yards, source-height preservation, smooth soil transitions, cache/resource lifetime, disconnection/fallback restoration, construction/demolition, save/reload and construction finishing during staged road preparation. In a fixed 294-resident Large River fixture, median CPU planning increased from 609 to 699 ms and terrain fitting from 209 to 364 ms; this is additional construction work, now scheduled rather than added to each frame. The fitted near-terrain total changed from 35,133 to 39,450 triangles, with fewer wall triangles. These measurements do not establish an FPS improvement. Browser QA selected a lowered cottage and confirmed its six residents and road connection, manually saved, returned home, and reloaded/continued the 480-resident city without console warnings or errors. This is feature update two after optimization 156; optimization is due after the next feature update.

## Edition 157 — Land selection over the actual city

The centered land dialog is replaced by a landscape camera mode with terrain-following tile borders, cyan multi-selection and a compact purchase tray above the icon dock. The official [Maps & Themes purchase screenshot](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/maps-themes) guided the composition. An initial larger tray and pale outlines were compared with that photo and revised. Buildable land area comes from each selected tile's terrain; there are no invented resource readouts. Select tiles by clicking the landscape, right-click to deselect, or use keyboard focus, arrow keys and Enter. Escape, Close or changing tools restores the previous city camera.

Multiple tiles can be purchased together for two merits each, including separated tiles, as the reference allows purchasing land anywhere. Development still needs actual road access; unowned gaps remain protected. The batch purchase validates everything before mutation, saves immediately, and restores the ownership and merit balance if saving fails. Existing cities and Sandbox remain fully owned, and prior merit receipts stay valid.

The view adds three drawing batches and at most 12,096 overlay triangles while open. Terrain geometry is prepared only on opening; selection changes reuse buffers, unchanged selections skip color uploads, and camera movement only updates accessible label positions. Closing disposes all six owned geometry/material resources. A narrow viewport fits the entire region and temporarily reduces distant fog, restoring the previous fog and camera limits afterward. Existing terrain and building assets, simulation timing, manual saving and five-minute autosave are retained. This is feature update one after optimization 156; another optimization is due after three feature releases.

The release suite covers 899 checks. New checks exercise separated and atomic multi-tile purchases, merit persistence, all tile-center ray picks at both map sizes, camera restoration, bounded render batches, resource disposal, narrow-screen projection and save-failure rollback. Browser QA imported a naturally grown 294-resident city, observed its 300-resident milestone, selected C1 and C3 on the landscape, spent four merits, and verified 3/9 owned tiles with zero merits after Save & Exit, reload and Continue. Keyboard selection and a 390 × 844 embedded browser viewport were also checked.

The reference comparison remains incomplete overall: the region is much smaller, landforms and forest patterns differ, and lighting, foundations and the broader HUD still differ. In particular, the river test city's close view exposes tall foundation/retaining faces that need further landscape integration. This update improves the purchase workflow and its composition, not full game equivalence. No building asset was created; future asset work must use Blender and actual game photos.

## Edition 156 — Terrain loading optimization

This is the scheduled optimization pass after feature updates 152–155. Terrain sampling skips the distant erosion field where its contribution is exactly zero, reuses the already computed shoreline wetness, and leaves coordinate scoping at public entry points instead of repeating it in private helpers. Terrain resolution, colors, slopes, normals, tree density, building models and independent simulation remain unchanged.

In an alternating before/after browser comparison, generating the full Large River Valley terrain fell from 519.1 to 417.8 ms (19.5%), and Large Highland Pass from 582.4 to 411.9 ms (29.3%). These are median CPU geometry-generation measurements after one warm-up, with three measured samples per version. They do not establish overall load-time or FPS improvement. A separate six-case Node comparison measured 7–28% less generation time across River Valley, Highland Pass and Coastal Islands at both map sizes.

All 894 automated checks pass. Six frozen Edition 155 fingerprints verify every terrain position, normal, UV, color and triangle index, including the distant landscape. Sculpting, cache isolation, mixed-size worlds, startup scenery and save/continue checks remain covered. Browser QA reopened the existing Large city with 222 residents and verified manual saving with its buildings and land retained. Asset requests initially timed out during concurrent heavy local testing and used the existing uncompressed fallback; the city subsequently loaded its models. No rendering exceptions were observed.

The official [Maps & Themes terrain photos](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/maps-themes) were inspected again. The reference has much broader regional scale, more varied forest coverage, more natural bank profiles and different atmospheric lighting. The current land-purchase dialog also differs from its in-world tile view. This optimization preserves current visuals; it does not close those fidelity gaps or establish equivalence. New assets must be authored in Blender and compared with actual game photographs, per the user's updated requirement. The next scheduled optimization is after three subsequent feature updates.

## Edition 155 — Larger maps and merit-funded land expansion

New game offers **Large** maps with a 72 × 72 construction grid, 2.25 times the area of the original 48 × 48 maps. Every landscape has a preview generated from its selected size. Building and road scale remain unchanged. Large maps are divided into nine 480 × 480 metre districts; Standard maps have four. New progression cities begin with one owned district and a west-edge road connection. Sandbox starts with all land available. Existing saved cities retain their original dimensions and unrestricted land.

The **Land & merits** control opens a terrain overview showing owned, adjacent and locked districts. Milestones award 2, 2, 3, 3, 4 and 4 merits; a neighboring district costs two. Awards use a saved receipt and are never repeated after population loss or reload. Purchases save immediately, restoring ownership and the balance if saving fails. Boundaries appear in the 3D city. Road footprints and curves, widening, footpaths, facilities, roadside zoning and terrain tools enforce ownership; purchasing land makes its roadside cells available without discarding cached geometry.

Coordinate helpers now respect each world's dimensions, including suspended road-building steps, terrain meshes, water depth, traffic, walking, transit and saved indices. Terrain detail and building models retain their previous scale and quality. The land overview is static and boundary lines are rebuilt on ownership changes or finished terrain edits; neither adds per-frame map sampling. Old and large cities can coexist in the same save store.

Validation includes natural residential growth on all seven Large landscapes, roads/traffic/zoning/sculpting beyond the previous boundary, rejection of construction on unowned land, duplicate-merit protection, mixed-size save/reload, and interleaved geometry jobs. Browser QA imported a naturally grown 86-resident city, observed 114 residents and its first two merits, purchased district B2, and verified two owned districts with zero merits after reload/continue. The land dialog also fits a 390px viewport. The complete existing suite and new expansion tests run before Pages deployment.

## Edition 154 — Landscape library and four new maps

New game now presents a compact landscape library, a selected-map preview, terrain and land-area details, and separate city-name and game-mode controls. Seven keyboard-selectable maps replace the three abstract CSS thumbnails. The layout adapts to narrow screens with a horizontal map gallery. All previews are small static WebP renders sampled from the same terrain and fixed map seeds used by the game; they add no rendering work during play.

Four new playable landscapes join River Valley, Coastal Islands and Great Plains: **Lake District**, **Crescent Bay**, **Highland Pass**, and **River Delta**. Their shared shoreline and relief fields drive simulation water cells and rendered terrain. Every map retains a dry west-edge entrance and a usable starting neighborhood. The fields use a bounded cache; existing saved terrain remains unchanged. The map catalog now uses fixed seeds so the selected preview matches the new city's landscape.

Nine map checks cover connected starting roads, utility-supported residential growth in all seven maps, independent saved worlds, reproducible terrain, distinct shorelines, and continuous finite heights. Existing engine, terrain, startup and historical-height checks pass. Browser QA verified lake and highland starts, manual save/home/reload/continue, keyboard selection, all preview images, and the 390px layout without horizontal dialog overflow. Five-minute autosave and progression remain available. The complete release suite runs before Pages deployment.

To regenerate previews, run `node scripts/sample-map-previews.mjs`, then `python3 scripts/render-map-previews.py` with NumPy and Pillow installed. The intermediate sampled fields stay under ignored/local references; only the resulting WebP previews and map statistics ship.

## Edition 153 — Remove the automatic overview sidebar

The City Overview sidebar has been removed from the game. Starting or continuing a city leaves the map clear. The city-name button opens milestones, the population counter opens residents and households, and the top-left layers button opens Information views. Traffic policy, outside-connection location, household statistics and utility capacity remain available in compact contextual views above the build dock. Trip counters, the generic advice card and the long mixed-purpose overview are gone.

The information panel shows only the selected topic: land use, traffic, utilities or pollution. Utility demand and capacity have simple meters and an explicit no-supply state. Selecting another tool or closing Views restores the normal map. This organization follows the selected-view approach described in the official [Traffic AI development diary](https://colossalorder.fi/news/development-diary-2-traffic-ai/); it does not claim full interface or simulation parity. Static panel backgrounds avoid adding live blur work.

Browser QA verified the clear start screen, opening and closing Views, changing and restoring the default intersection policy, live utility values, population-to-household navigation and city-name-to-milestone navigation. No browser warnings or errors were reported. Progression and road-input checks pass; the complete existing release suite runs before Pages deployment. Saving, five-minute autosave, multiple worlds and simulation behavior are unchanged.

## Edition 152 — City progression and build dock

New cities default to population-based progression, with an optional Sandbox mode. Seven stages run from Founding Village to Great City (0, 100, 300, 650, 1,200, 2,000 and 3,500 residents). The starting set includes local roads, detached housing, shops, industry, power and water. Later milestones unlock denser housing, wider roads, highways, advanced utilities and city services, with one-time grants from ₡5,000 to ₡35,000. The milestone screen lists every unlock and its population requirement; locked construction cards remain visible and explain their requirement.

Earned milestones use each world's saved peak population and never relock when population falls. Rewards are applied once in the economic tick and their receipt survives save, autosave, export/import and continue. Road construction, replacement, facilities, zoning and bus-line creation check the same rules before changing the city. Existing saves retain their unrestricted access; City milestones offers an explicit option to enable progression, preserving all built assets and marking past milestones reached without retroactive grants. Internal world creation without a mode retains its historical unrestricted behavior; the New game screen explicitly defaults to progression.

The build toolbar is now a compact dark dock with consistent icons, category labels, clearer selection/focus, and lock indicators. It keeps static backgrounds rather than a live backdrop blur. Construction cards display legible lock requirements, and the milestone dialog adapts to narrower screens. Rendering detail, simulation speed, offscreen traffic and the five-minute autosave interval are unchanged.

Validation: 870 checks passed before the final road-replacement preview safeguard; 31 focused progression, replacement and road-input checks then passed. Browser QA created a progression city, verified unavailable housing stays locked after save/home/reload, and imported a naturally grown 96-resident test city. The next simulated day reached 100 residents, awarded its ₡5,000 grant, and made row houses selectable while apartments remained locked. The release workflow runs the complete suite before publishing.

## Edition 151 — Retain prepared road scenery buffers

Road graphics preparation now uploads the actual instance buffers that the new scene will display. Previously it cloned repeated scenery, uploaded the clone's instance attributes, then disposed those attributes; the final city draw still had to upload the real instances. Shared base geometry no longer causes distinct instance batches to be skipped. Preparation temporarily borrows meshes without changing their parent, suppresses their draw callbacks, and restores visibility, shadow, culling and renderer state even if interrupted. The long outside-connection markings also yield between individual stripes instead of being built in a single uninterrupted step. Road geometry, buildings, terrain, textures and vegetation detail are unchanged.

All 30 focused local graphics, road-job, cancellation, scenery and frozen-geometry checks pass. Root-module syntax and asset integrity checks pass. A background terrain-worker experiment also passed correctness tests, but two browser comparisons took longer overall (3.75/4.12 seconds versus 2.83/3.11 seconds); it was rejected and is not included. The broad local suite was stopped to avoid competing with browser measurements; the full release suite runs in GitHub before deployment. Current timings vary with other active applications, so this release fixes redundant graphics work without claiming that every placement hitch is eliminated.

Manual saving after a connected ₡200 street in Residential Streets QA 147 was verified at 2:17:14 PM on October 29, retaining 288 residents. Five-minute autosave, world selection, home/continue behavior and independent simulation are unchanged.

## Edition 150 — Reduce uninterrupted road preparation work

Terrain fitting now uses a finer spatial lookup inside each construction cell, retaining the exact original partition order while skipping distant polygons. Finished terrain buffers are packed in cancellable batches instead of one uninterrupted allocation/copy step. Each preparation phase yields before starting, and the final visible swap gets its own frame opportunity. These changes retain the existing road, terrain, building and vegetation geometry. A larger per-triangle cache was tested and rejected because it slowed the browser despite reducing calculations.

All 862 local checks passed, including frozen terrain-buffer comparisons, road edits, cancellation, save/continue, and source ownership. A focused lookup fixture reduced a native triangle's candidates from 512 to 8 without losing any overlapping partition. In a separate CPU terrain fixture, four warmed runs had median fitting times of 368.4 ms before and 329.6 ms after the spatial lookup. This is a bounded CPU result, not an FPS claim. The full browser comparison became inconclusive under severe system memory pressure (about 20 GB of swap); some samples became much slower, so no claim is made that road-placement lag is eliminated. Further profiling of large cities and the final traffic/scene swap remains necessary.

Normal game QA placed a ₡300 connected street in Residential Streets QA 147, manually saved at 1:08:57 PM on October 29, used Save & Exit, and reloaded/continued with the street, 288 residents and 96 households intact. The new junction was retained. Browser warnings/errors were empty. Five-minute autosave, multiple worlds and offscreen simulation remain enabled.

The previously prepared vehicle rebuild is included: distinct sedan, SUV and cargo-van forms with tapered bodies, crowned roofs, inset glass, curved wheel openings, circular rims and thin lamps. The official [traffic reference](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/traffic-ai) guided the comparison; window, body and lighting fidelity still differ and full visual parity remains unachieved. Sedans/SUVs use 730 triangles and vans 718. Shared prototypes and per-instance paint reduce a 192-vehicle fleet from 24 material draws to 15, while its triangle count rises from 88,272 to 139,872. Movement no longer reuploads unchanged paint colors; bus geometry and simulation behavior remain unchanged. This workload comparison does not establish a frame-rate improvement.

This release includes an immediate road optimization in response to the reported lag; continue the scheduled optimization cadence after three visual/feature updates.

## Edition 149 — Prepare road graphics before the visible swap

Road replacement now warms the real drawing programs and vertex/index buffers in scheduled batches while the old city remains visible. Zero-count draws go to a private one-pixel target. The helper restores the active render target, cube face, mip level, shadow-update settings, XR setting and geometry draw ranges after every batch, including errors. It borrows geometry/materials, disposes its own temporary resources, and remains cancellable before the road swap. Road geometry, terrain, textures, vegetation density and independent traffic simulation are not simplified.

In the same three-avenue, 48-row-house browser fixture, two warmed before/after comparisons reduced the longest frame gap from 71.7 to 36.7 ms and 48.0 to 34.8 ms. The latter conservative repeat completed in 2.49 versus 2.33 seconds, with the final swap changing from 20.4 to 17.1 ms. Cold measurements remained much worse (a 227.7 ms frame gap in the updated version), so this reduces repeated-placement hitches rather than eliminating every stall or guaranteeing FPS. Preparation CPU work and cold graphics resources still need further optimization.

This release also finishes the previously prepared single-storey housing work: a long porch modular home and a solar hipped ranch, guided by the official [residential construction reference](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/zones-signature-buildings). Both have shallow roofs, recessed windows, raised open porches and steps; detached-home driveways are limited to a single-car width. They join natural low-density zoning selection. All 68 previous modern models and 89 previous distant models retain their frozen fingerprints. The two new near models total 4,692 triangles, and the compressed building downloads grow by 49,481 bytes. Overall visual parity with the reference remains incomplete.

All 854 local checks passed, including graphics-state restoration, cancellation, borrowed-resource ownership, exact road/terrain geometry, natural housing selection, rotated lots and unchanged old building buffers. Normal game QA placed a connecting street for ₡400 in Residential Streets QA 147, verified manual save at 9:34:25 PM on October 28, then Save & Exit and full reload/Continue retained the road, 288 residents and 96 households. The final test-city save was 9:36:39 PM. Browser warnings/errors were empty. Five-minute autosave and multiple worlds remain unchanged.

## Edition 148 — Smoother road placement without reduced detail

Driveway meshes and tree placement now prepare in small cancellable steps before the visible road changes. The final scene update reuses that work when its buildings and occupancy still match; it rebuilds safely if they changed while construction was pending. Grass triangle packing also yields within both its spatial partition and vertex-remapping loops. Shader preparation includes the staged driveway material. Leaving a world releases the hidden scenery without altering the visible roads or saved state.

The same deterministic three-avenue, 48-row-house browser fixture was checked before and after. In the warmed repeat, the final swap fell from 32.0 to 17.2 ms, the largest preparation slice from 41.1 to 15.7 ms, and the largest frame gap during preparation from 50.7 to 27.1 ms. Total construction remained about 1.53 seconds in both versions. The first pair varied more (80.7 to 18.1 ms swap), so the warmed repeat is the conservative comparison. These are bounded local measurements, not a universal FPS guarantee; larger cities can still hitch during road topology and agent updates.

Tree positions, sizes, species and elevations match Edition 147 on all three terrain types. Existing exact triangle tests preserve grass, terrain and driveway geometry. Building assets, texture resolution and vegetation density are unchanged, and matching-layout screenshots retain the same roads and neighborhood. Manual save, Continue and save-and-exit were checked in the populated local world. The full local suite passed 846 tests, with focused cancellation and ownership checks also passing after release preparation. Offscreen simulation and five-minute autosave remain enabled. This completes the scheduled optimization after updates 145–147.

## Edition 147 — Rebuilt street-house facades and front gardens

The raised-stoop and dormer row-house models now have taller, narrower recessed sash windows, quieter frame profiles, projecting entrance surrounds, wall lamps and address plates. Raised-stoop homes retain open entrance railings and gain a window air conditioner. Dormer homes have a steeper roof, a repositioned dormer with a real roof opening, and fine roof seams. The official [residential style and row-neighborhood pictures](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/zones-signature-buildings) guided the proportions, entries and low front planting. These improve the street frontage; the reference still differs in facade variety, balconies, surrounding density, street activity and lighting. Overall equivalence remains unachieved.

Raised-stoop parcels reserve deeper front lawns with a separate clear path to each door. Low shrub groups keep ground-floor windows visible; their shared mesh uses individual folded leaf blades around an interior crown. Rear gardens and the closer sidewalk frontage of dormer homes remain. Planting, fences and entrance routes remain within rotated owned lots and outside the house footprints.

Both houses remain under the existing 2,300-triangle per-model budget: raised stoops increased from 2,144 to 2,244 triangles, and dormers from 2,002 to 2,138. The other 66 modern building models and all five embedded textures are byte-identical. Distant models keep their real openings and roof silhouettes, while omitting small roof seams and hardware. Shrubs share one foliage draw and stay below 600 triangles per shared model.

At the same close camera in a 24-lot browser fixture, the dormer scene changed from 1,771,123 to 1,776,563 triangles with 60 draws in both. The planted stoop scene changed from 1,767,371 to 1,803,473 triangles and 59 to 60 draws. Sampled median frame intervals were 23.7/17.7 ms for dormers and 23.9/19.8 ms for stoops before/after. These separate warm captures showed no slowdown, but are not controlled evidence of a speed increase or a universal FPS guarantee. Road scheduling, texture resolution and independent simulation are unchanged.

The full local run exercised 841 checks: 837 passed and four old asset/height expectations flagged the intentional rebuild. All 14 affected industrial oracle checks and the house-height check passed after correction. The original non-industrial aggregate fingerprint is retained; every untouched near model and 87 untouched distant models still compare against frozen released data. All 11 focused terrace/garden tests pass, including window rays at both detail levels, entrances, party walls, roofs, natural multi-cell growth, save identity, rotated bounds and clear garden paths. Syntax checks passed for 107 root modules, and all five compressed bundles verify exactly.

Browser QA imported a separately named city grown through the normal zoning engine, with 288 residents, 96 households and 24 developed destinations. Manual save verified October 28 at 8:25:40 PM; Save & Exit at 8:28:27 PM survived full reload and Continue with those residents and households retained. Day and night views showed intact windows without browser errors. The five-minute autosave interval remains unchanged and was not retimed. This is feature update three after optimization 144; Edition 148 is due to focus on optimization.

## Edition 146 — Individual row-house finishes

Row houses now use eight deterministic combinations of muted masonry, slate/brown roofs, painted trim and doors. Each individual home in a repeated row receives its own combination. The official [residential style reference](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/zones-signature-buildings) guided the quieter brick palette and varied joinery. The existing recessed windows, roof silhouettes, brick/normal textures, baked weathering and room lighting are retained. This narrows the palette/repetition difference; the reference still has richer facade detail, street planting, lighting and surroundings, so overall visual equivalence remains unachieved.

Colors travel with each instance through camera culling, near/far detail changes and demolition/reordering. Uncolored replacements reset reused slots, and unchanged instances avoid repeat color uploads. All row houses share one separately configured brick material, keeping other building categories unchanged. Model geometry, textures and compressed bundles are byte-for-byte unchanged, and no extra building draw batches are introduced.

In a paired 24-lot browser scene with the same world and close camera, the warmed before/after samples both rendered 70 calls and 1,441,171 triangles. Median frame intervals were 18.6 ms for both; the 95th-percentile intervals were 20.8 ms before and 21.1 ms after. Earlier warm-up samples included a shadow refresh and are not used for this comparison. These are bounded scene observations, not a universal FPS guarantee. The road construction scheduling and shader preparation improvements from 145 remain intact.

The 839-check local run passed 838 checks and exposed the expected shared-material budget assertion. After updating the budget for the single shared residential brick finish and asserting its isolation from other categories, all 44 model-library tests passed. All six new finish tests passed, including natural zoning growth, save/reload identity, unchanged authored buffers, batching, culling, relocation and slot reuse. Syntax checks passed for 107 root modules, and all five compressed bundles verified. Day/night browser views showed intact window lighting without console errors.

Local game QA verified manual save at 8:05:47 PM on October 28, Save & Exit at 8:06:16 PM, and the saved city retained after full reload. Five-minute autosave remains unchanged and was not retimed. This is feature update two after optimization 144; the broader visual and simulation goal remains active.

## Edition 145 — Road placement frame pacing and clean starter-road joins

Visible construction now yields to animation frames instead of continuously queueing short tasks. Hidden construction uses tasks, with a timeout fallback if a pending frame becomes hidden. Curb profiles reuse identical terrain samples and yield within long strips, retaining all vertices, normals and texture coordinates. Replacement road and grass shader programs are prepared with the city render target, lighting and fog while the old materials still exist, avoiding premature program eviction during the swap. Building assets, texture resolution, vegetation density and offscreen simulation remain unchanged.

In the three-avenue browser fixture, the unchanged scheduling/handoff measured a 143 ms maximum frame gap and drew 17 frames during a 1.45-second placement. The final update measured a 66 ms maximum gap and 182 frames during a 3.13-second placement; the first displayed frame after the swap arrived in 40 ms versus 113 ms. This deliberately exchanges construction completion time for camera/render responsiveness. It does not eliminate every hitch: individual geometry steps reached 57 ms and the final scene update took 51 ms. Earlier cold shader measurements were substantially worse, so these are bounded fixture observations, not universal FPS claims.

The pending starter-road correction is included: authored road raster cells no longer become phantom legacy branches. A street continuing the starter road forms a continuous bend without a false third crossing or traffic light. Shared geometry and traffic topology trim dead-end overhangs only as far as all real contacts permit, preserving one-way grid access. Legacy frontage follows actual legacy neighbors, and planted trees are excluded from crossing asphalt. The close comparison used the official [Road Tools images](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/road-tools): real T/four-way crossings retain their markings and rounded curbs. Overall visual equivalence remains unachieved.

The full local suite passed 832 checks before the final frame-budget adjustment; all 12 scheduler/build-job checks also passed, including an additional visible/hidden scheduling case. Geometry hashes remain identical across unchanged starter, district, river and island fixtures. Tests cover cancellation during program preparation, renderer-target restoration, in-progress saves, road connectivity, real crossing preservation and street-tree clearance. The original 54 released zoning counts remain checked; a separate exhaustive oracle applies only the intentional legacy-neighbor correction. All root JavaScript syntax checks and model/texture/compressed-asset integrity checks pass.

Browser QA resumed Road Performance QA 143 with its saved roads and one real controlled intersection. Manual save verified October 28 at 7:39:25 PM, Save & Exit stored 7:39:35 PM, and full reload retained that save. The five-minute autosave interval remains unchanged and was not retimed. This combines feature update one after optimization 144 with an immediate user-requested placement optimization.

## Edition 144 — Smaller road-placement pauses

Road construction now yields within terrain surface copying, shoulder and boundary preparation, terrain fitting, curb and lane-marking preparation, and static mesh batching. The construction grid is prepared before the final scene swap and reuses shared height samples. The completed road and terrain retain their geometry, materials and detail; buildings, trees, grass density and offscreen simulation are unchanged. Cancellation frees temporary batching buffers and the staged grid. Saves and the five-minute autosave interval retain their existing behavior.

In the same three-avenue browser fixture, two final released-version placements had longest construction work slices of 59 and 71 ms. The updated placements measured 44 and 32 ms; the warmed final scene swap fell from 42–55 ms to 37 ms. Total preparation was 1.05–1.06 seconds before and 1.16–1.45 seconds after. This trades some completion time for shorter uninterrupted work, not a claim of instant construction or universally higher FPS. Initial cold/load-sensitive measurements varied much more (up to 417 ms before and 70 ms after); final frame gaps still ranged around 107–127 ms. Individual geometry operations and final scene work can still cause a hitch.

Released road geometry hashes match byte for byte for starter, district, river and island fixtures. Terrain/pavement oracles, in-progress save and cancellation tests pass. The new construction-grid test preserves every vertex while at least halving repeated height queries. A road-marking test now intercepts the equivalent generator hook, preserving its original edge-stripe assertions. All 106 JavaScript modules pass syntax checks and all model/texture assets and five lossless compressed bundles verify unchanged.

Local browser QA resumed Road Performance QA 143, placed a two-lane street for ₡650, and verified manual save at 7:02:26 PM on October 28. Save & Exit stored 7:03:42 PM; full reload and Continue restored the extended road and its two controlled intersections without browser warnings or errors. The five-minute autosave interval was not retimed. This is an additional performance update following optimization 143; the next feature cycle has not begun.

## Edition 143 — Responsive road placement

Road edits prepare an invisible replacement in short, cooperative work slices while the current city and traffic remain visible. Road meshes, fitted terrain, and grass are ready before the scene is swapped. Placement, road replacement and road demolition use this path from the game update. A small “Building road…” indicator appears while construction finishes; further map edits wait, while camera movement, saving and returning home remain available.

Unchanged local terrain footprint partitions are reused, and already uploaded asphalt textures transfer to the new renderer. Building models, road and terrain geometry, textures, grass density and simulation fidelity are unchanged. Saving during preparation records the complete road immediately; leaving the world cancels and disposes unfinished visual work. The normal five-minute autosave remains unchanged.

A browser comparison on the three-avenue test city measured the previous placement blocking for 3.83 seconds with zero intervening animation frames. The sliced path displayed 32 and 34 frames during two placements; its longest work slices were 299 and 333 ms, with final swaps of 165 and 148 ms. Total preparation took 4.54 and 4.91 seconds, so this reduces freezing rather than promising instantaneous construction or higher steady-state FPS. Hardware load affects these timings. Larger networks can still have brief stalls in unsliced setup and final scene updates.

All 815 regression checks pass, along with syntax checks for 105 JavaScript modules and asset integrity checks. Local game verification covered a real street drag, verified manual save, save-and-exit, reload and Continue, with the road retained and no console warnings or errors. This is the scheduled optimization after feature editions 140–142. Regression checks cover exact synchronous/asynchronous geometry, frozen terrain and pavement output, cancellation, repeated edits, in-progress saves, resource disposal, and grass detail.

## Edition 142 — Highway ramps and a complete one-way lane range

Roads now includes a one-lane highway ramp, a two-lane one-way highway and a four-lane one-way highway alongside the existing three-lane motorway. The catalog contains twelve styles. Each new highway has 3.75-metre lanes, paved shoulders, safety barriers, one-way travel and no roadside zoning. The menu uses the singular label for one lane and explains that traffic follows the drawing direction. The new styles use the existing highway speed behavior.

When a new highway overlaps another highway at a ramp entrance or exit, edge paint and barriers stop inside the shared pavement. A narrower approach's divider paint also stops where the wider highway's lane pattern takes over. A spatial lookup computes these cuts during road construction; it adds no per-frame work. Worlds without the new highway types retain their previous edge geometry. These are original ramp connections, not a full reproduction of Cities: Skylines II's lane-specific acceleration/deceleration system or interchange presets.

The official [Road Tools highway reference](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/road-tools) guided the narrower ramps and unobstructed openings. Local browser inspection exposed overlapping approach paint, which was corrected before release. Focused tests cover exact lane widths, source-specific forward/reverse reachability, a vehicle completing an exit journey, entrance routing, saved road types, barrier openings and wider-road paint priority. Existing buildings and terrain retain their assets and geometry quality. Large construction rebuilds remain synchronous; no frame-rate improvement is claimed.

The full local suite passed 805 checks; after the final divider correction, all 26 focused checks passed, including one additional case. Syntax and asset integrity checks passed. The browser menu was checked in Landscape QA 122 with 226 residents and 82 households. Manual save verified on October 28 at 6:05:26 PM, and Save & Exit returned home with a 6:05:48 PM save. No browser warnings or errors were recorded. The five-minute autosave interval remains unchanged; this check did not retime it. This is feature update three after optimization 139; Edition 143 is the next dedicated optimization. The broader visual and simulation equivalence goal remains unachieved.

## Edition 141 — Two-rail bridges and joined safety barriers

Bridge parapets now have two slender horizontal metal rails, guided by the official [Road Tools highway reference](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/road-tools). Ground-level highway barriers locate bridge boundaries precisely instead of dropping an entire sampling interval. Over the final ten metres, they flare outward and rise into the bridge's lower rail. Ordinary exposed ends retain their lowered terminals, and junction openings remain clear.

Metal bridge sweeps omit redundant samples with a maximum 5 mm deviation at the original sampled rail edges. Concrete decks, piers, abutments, contact clipping and all bridge grades remain unchanged: comparisons against committed Edition 140 retain identical concrete geometry hashes across ten terrain/road fixtures. The new lower rail adds geometry; the nine-style bridge fixture ranges from 18,192 to 18,395 total bridge triangles, below the explicit 19,000 budget. Rails remain static and use the existing metal material batch. This is not a general frame-rate guarantee.

All 800 checks pass, along with JavaScript syntax and asset integrity checks. Local browser views covered close bridge decks and the flared approaches, with no recorded warnings or errors. Tests check both horizontal rails and the open gap between them, exact shore joins, unobstructed junctions, unchanged concrete and saved-world inputs. The game still differs visibly from the reference in terrain, bridge structures and vegetation; commercial-game equivalence is unachieved. This is feature update two after optimization 139, with optimization due after feature 142.

## Edition 140 — Highway shoulder barriers

Authored ground-level highways now have corrugated metal safety rails on both paved shoulders, with posts every 2.5 metres and lowered end sections. Barriers follow curves, road widths and grades, leave junction mouths open, and stop before bridge spans so the existing bridge rails remain unobstructed. Existing legacy outside connections retain their current appearance.

The official [Road Tools highway image](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/road-tools) guided the roadside rails. Local close-up comparisons covered curved parallel highways and river bridges. The barriers are a step toward the reference; terrain, bridge designs, vegetation and the complete simulation still differ from the commercial game.

All new rails and posts share one static mesh before road batching, with no per-frame construction. The first dense version was reduced to regular 3.75-metre rail samples, while posts keep their spacing. This adds visible geometry and one material batch; it is not a measured FPS improvement. Road controls, traffic routing, buildings and save data are unchanged. All 798 checks pass (794 existing checks plus four new cases); syntax and asset integrity checks also pass. Four focused checks cover grades, curved/tapered roads, junction and bridge openings, and unchanged inputs. This is feature update one after optimization 139.

## Edition 139 — Faster road terrain and city setup

This is the scheduled optimization after features 136–138. Road terrain fitting skips unnecessary candidate lists and per-triangle data allocation, and writes retained indices into a bounded typed buffer. Road paint builds refinement buffers only when a triangle actually needs subdivision. Both paths retain the previous geometry, surface queries, attribute order and saved-world data.

Opening a city now builds its trees, rocks, ground cover and zoning grid once, after the road terrain is ready. Empty cities, terrain fallbacks and later model loading still finish their scenery before returning. Existing building, tree, terrain and road detail is preserved; resident and traffic simulation clocks are unchanged.

Alternating browser comparisons with assets already loaded measured city setup at 984/996 ms before versus 854/852 ms after for the curved-road fixture, and 893/835 ms versus 769/733 ms for the bridge fixture: about 13–14% faster. These measurements cover synchronous city setup, excluding asset downloads and first-frame GPU upload/presentation; they do not establish a general FPS improvement. Separate CPU road-and-terrain construction medians improved by 3–13% across four scenes, with exactly matching geometry hashes. Isolated paint refinement was 13–30% faster across those scenes with identical output. Large construction rebuilds remain synchronous.

The official [Road Tools highway reference](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/road-tools) was inspected again. Before/after browser views of curves and bridges, including night lighting, retain the same pavement, markings, terrain and scenery. Reference images are not shipped. Visual and simulation equivalence with Cities: Skylines II remains unachieved.

All 794 automated checks pass across 103 test files, including 12 paint-output regression cases, nine terrain/query cases and seven startup lifecycle cases. All 101 root JavaScript modules pass syntax checking; all 89 building assets and five lossless delivery bundles verify. Local browser QA restored Landscape QA 122 with 226 residents and 82 households, verified manual saving at 7:52:55 PM on October 27, and returned home at 7:53:38 PM. A full reload retained that save; Continue restored the city and resumed simulation. Final Save & Exit stored day 83 at 7:56:48 PM. No browser warnings or errors were recorded. The five-minute autosave interval is unchanged; its actual timer was observed in Edition 138, not retimed in this release.

## Edition 138 — Highway shoulders and clearer road paint

Highways now reserve paved shoulders inside their existing asphalt footprints. The three-lane one-way highway has 2.25 m shoulders and three 3.75 m lanes; the divided highway has 1.5 m outer shoulders. Divider paint, edge lines, tyre wear and vehicle positions use the same carriageway layout. Existing urban road lane positions stay unchanged. Legacy outside connections retain their old lane and edge placement, including after an authored highway is removed from a starter road.

Thin ribbon markings now use pixel coverage filtering so distant stripes stay more continuous without increasing their physical width. The cached paint materials preserve normal lighting, shadows and depth testing; their support data survives terrain conformance and static batching. This smooths stripe sides; dash ends retain their existing geometry. Paint positions and pavement geometry are unchanged. The old repeated free-flow motorway chevrons are removed, and tyre tracks have lower contrast and fade at a distance. Existing dash lengths remain unchanged.

The official [Road Tools highway and road pictures](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/road-tools) were inspected before implementation and compared with the finished browser views. Paved shoulders, continuous edge lines and quieter tyre wear move the roads closer to those references. Browser comparisons covered curves, straight divided highways, intersections by day and night, and bridge decks from close and low angles. Reference images are not shipped. The surrounding terrain, vegetation, structures and full simulation still differ from Cities: Skylines II; visual equivalence remains unachieved.

All 766 automated checks pass across 100 test files, including real moving vehicles in each highway lane, older-road removal compatibility, paint surface clearances, static batching, saved worlds and independent simulation. All 101 root JavaScript modules pass syntax checking; all 89 building assets and five lossless delivery bundles verify. Local browser QA restored Parallel QA 137 with both saved curved carriageways and verified a manual save on day 35 at 7:24:24 PM on October 27. No browser warnings or errors were recorded. Manual saving and the five-minute autosave interval remain in place.

Two alternating-order comparisons at 1280×720 measured whole-scene GPU medians of 9.58/9.56 ms before and 9.35/9.31 ms after. Frame medians were 16.7 ms before and 16.9/16.7 ms after; render-submission CPU medians remained 0.5–0.6 ms. Each sample used 10 warm-up frames and 80 measured frames with lighting, shadows, water and postprocessing active. World data, camera and permanent surface index stayed unchanged. This bounded comparison shows no measured frame-rate regression in the fixture; it is not a general FPS guarantee. Large construction rebuilds remain synchronous. Building, tree and terrain assets retain their detail. This is feature update three after optimization 135; Edition 139 is the next dedicated optimization.

## Edition 137 — Parallel roads and separate carriageways

Straight and Curved road tools now have a Parallel roads option, with a 4–48 metre clear gap, either side, and opposite travel direction for one-way roads. A new three-lane one-way highway brings the road catalog to nine styles. The preview shows both pavements, their direction arrows, lengths, gap and combined price. Construction validates and charges both roads together; an invalid or unaffordable pair leaves the city unchanged. Parallel mode is available for straight and curved roads, not grids, replacement, roundabouts or footpaths.

The second curve is fitted at a constant normal distance from the first, rather than translated sideways. Its fitted sections are saved as one continuous road, so each construction creates two authored roads and zoning can span internal curve joins. The fit has a maximum certified error of 20 cm and a bounded preview sample count. Existing straight and quadratic roads retain their original sampling and save compatibility. Limited-access highways do not create roadside zoning.

Traffic and building access retain the identity of each road inside shared map squares. Nearby parallel roads no longer connect through adjacent or overlapping raster tiles; vehicles need a real centerline intersection or valid junction extension. Residents retain their actual frontage source, and buses reuse one pinned road position for each stop across incoming and outgoing journeys. The stop attachments are retained in saves: removing that road suspends the line instead of moving its stop to a neighboring carriageway, including after reloading. Numeric-only older lines remain unchanged when read and gain saved attachments on their first road edit. Short connectors crossing a genuine gap can now be built and priced even when their map squares already contain roads; near-miss endpoints do not count as connections.

The official [Road Tools parallel-carriageway picture](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/road-tools) was inspected before implementation and compared with the finished fixture. The two continuous carriageways, grass separation and three-lane markings are closer to that reference. A depth-bias experiment did not improve distant paint aliasing and was removed. Nearby lane paint is continuous, but thin markings still break up at overview distances. Building, tree and terrain assets are unchanged. Reference images are not shipped; visual and simulation equivalence with the commercial game remains unachieved.

All 751 automated checks pass across 97 test files, including chained-road saves, construction rollback, exact gap bounds, one-way routes, source-specific frontage, saved bus attachments and unchanged economic-state oracles. All 100 root JavaScript modules pass syntax checking; existing building assets and all five lossless asset bundles verify unchanged.

Local browser QA created Parallel QA 137, built a curved motorway pair for ₡4,680, and verified manual save on day 14 at 6:47:36 PM on October 27. Save & Exit stored 6:47:43 PM; a full reload retained the city and timestamp, and Continue restored both roads. An isolated WorldStore fixture also round-tripped the complete chained controls exactly. No browser warnings or errors were recorded in the game. Final Save & Exit stored day 31 at 6:54:11 PM. Manual saving and the five-minute autosave interval remain in place; no fresh five-minute interval was established in this browser run.

A bounded production CPU fixture measured typical curve planning plus quoting at 7.06 ms median (8.45 ms p95); adding 50,000 resident records gave 7.25 ms median. The API maximum 32-section secondary curve took 6.18 ms median. A separate 1280×720 browser fixture recorded 6.4 ms median total preview-update CPU time, 7.40 ms whole-frame GPU time and a 16.7 ms frame interval over 80 measured frames. The guide uses four persistent drawing objects; world data and permanent road geometry stayed unchanged during the measurement. These are bounded construction-tool measurements, not a general FPS claim. Scene rebuilding remains synchronous and can briefly pause construction. This is feature update two after optimization 135; the next scheduled optimization follows features 136–138.

## Edition 136 — Three-click street grids

Roads now includes Grid mode: click a corner, set the first edge, then set the perpendicular depth. Target block sizes are 80, 96, 128 or 160 metres, with up to eight blocks in either direction. The tool supports all eight road styles; one-way grids use a connected perimeter loop and alternating internal streets. Right-click steps back, Escape cancels, and changing tools or leaving the city clears unfinished drafts. Connection, angle and length snapping remain available. Alt releases snapping while the grid keeps its rectangular shape.

The whole grid is priced before construction. Shared intersection tiles are charged once, compatible existing edges can be reused, and invalid or unaffordable grids leave the city unchanged. Successful placement creates ordinary roads with real junctions, driving routes and roadside zoning; it uses the existing save format. Resident records are not copied while the pointer moves, and the scene rebuilds once for the completed grid.

The official [Road Tools Grid mode picture](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/road-tools) was inspected before implementation and compared with successive browser previews. Revisions added rounded outer corners, separate asphalt and sidewalk shading, stronger construction-axis dashes, 90° markers and dimensions on the actual grid edges. The original preview still uses four persistent drawing objects and shared buffers. Label layout work is batched and unchanged labels reuse their measurements. Reference images are not shipped; this is an original grid tool, and commercial-game equivalence remains unachieved.

All 690 automated checks pass, including construction rollback, complete pricing, existing-edge reuse, one-way reachability, resident journeys, geometric zoning and production pointer interactions. All 96 root JavaScript modules pass syntax checking; all five lossless asset bundles retain identical decoded contents. Existing building, tree and terrain assets are unchanged.

Browser QA created a separate Grid QA 136 world and built a 1×3 grid connected to its starter road for ₡2,550. Right-click correctly returned to the first-edge step without building. Manual save verified at 6:05:09 PM on October 27; Save & Exit stored 6:05:22 PM. A full reload returned to home with that entry, and Continue restored the grid, its five controlled intersections and roadside zoning. No browser warnings or errors were recorded. The five-minute interval remains covered by existing clock tests; this check did not establish a fresh hosted five-minute autosave.

In a bounded 1280×720 preview fixture, the final median grid quote took 0.9 ms and guide update 2.8 ms, with a 16.7 ms median frame interval. A separate maximum 8×8-grid CPU fixture quoted in 6.66 ms median; adding 50,000 resident records to a smaller fixture did not increase its quote time. These observations do not establish a general FPS improvement. Road/terrain rebuilding remains synchronous and can pause during construction. This is feature update one after optimization 135; the next scheduled optimization follows features 136–138.

## Edition 135 — Shorter catch-up pauses and faster city calculations

Delayed simulation work now yields between complete fixed steps after an 8 ms work target while the page is visible. Unprocessed time stays pending in the active session; no resident, vehicle, journey or fixed step is discarded to meet the work target. Hidden pages retain the previous larger catch-up batches so throttled browser timers can continue advancing the city. The 8 ms target is not a hard limit: an individual fixed step can take longer. Pause, speed changes and switching worlds preserve their existing behavior. As before, saves store completed city state; pending catch-up time is not retained after leaving or reloading a world.

Economic updates now reuse the same connected-road set and ordered legacy zoning access within one city day. Fine zoning planning reuses its already resolved layout. These are local calculations, not persistent caches; changes to roads, ground, zoning sides and utilities are observed on the next update. Building, tree, terrain and road detail are unchanged.

Four deterministic 120-day comparisons against the committed Edition 134 engine match entire saved-world states, returned statistics and every random factory/output sequence. They include mixed legacy/fine construction, road disconnection/reconnection, interior road and ground changes, zoning-side edits and lost/restored utilities. Paired CPU tests measured 120-day calculations plus an inert UI at 234→209 ms for a starter city, 1088→891 ms for a populated grid and 887→766 ms for fine zoning growth: about 10–18% less work. This does not establish a browser FPS improvement.

Two alternating-order catch-up comparisons used 4,872 residents and 512 vehicle slots after a ten-second delay. The largest single callback changed from 604/513 ms to 30.3/29.4 ms, with bounded-callback medians of 10.23/9.97 ms. All 200 fixed steps completed, pending time reached zero and final resident/traffic states matched exactly. Work is spread over more callbacks, so full catch-up can take longer; total simulation accuracy is retained. A separate empty-city browser check found similar running and paused frame timing, so it did not establish a running-only simulation bottleneck.

A candidate road/terrain containment optimization was tested and rejected because its timings were inconsistent. The final road/terrain implementation remains Edition 134's. The official Road Tools reference and final visual comparison from that edition continue to apply. This is the scheduled optimization after feature updates 132–134; commercial-game equivalence remains unachieved.

All 646 automated checks pass, including exact economic-state and resident/traffic catch-up comparisons. All 95 root JavaScript modules pass syntax checking, and lossless asset bundles retain identical decoded contents. Browser QA restored the previous curved-road city, verified manual save on day 88 at 5:02:24 PM on October 27, returned home with Save & Exit, and retained its save through a full page reload. Continue restored the curve and resumed the city; final Save & Exit stored day 102 at 5:04:29 PM. No browser warnings or errors were recorded. These are local persistence checks; this release did not wait for a fresh hosted five-minute autosave.

## Edition 134 — Road snapping and construction guides

Road placement now snaps to the actual centerlines and endpoints of authored streets and paths. Curved and diagonal roads no longer expose off-road raster tile centers as connection points. Nearby endpoint selection is deterministic, legacy road elbows follow their rendered curve, and a spatial index is reused during each drawing session. The tool offers road-connection snapping, relative 45° angle alignment and optional 8 m length steps. Hold Alt to place freely; its key transitions immediately refresh the current preview. Saved road controls remain plain coordinates.

The cyan preview now includes the full road-and-sidewalk footprint, outlined edges, white center dashes, control rings, a wider alignment circle, bend-handle lines and angle guides. Floating labels show centerline distance, quoted cost, snapping and an explicitly approximate endpoint grade. The grade is measured from the current surface, not a promise of the final construction profile. Invalid roads are red. Right-click steps back through a curve; right-drag still rotates the camera. The smaller road toolbar leaves more map visible. Replacement and roundabout controls are unavailable for pedestrian paths.

The official [Road Tools pictures](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/road-tools), particularly the crossing-road construction overlay, were inspected before implementation. Browser comparison prompted wider center dashes, an alignment circle, separated short-road labels and a more compact toolbar. These original drawing aids move the tool closer to that reference; the game is not visually or mechanically equivalent to Cities: Skylines II. Reference images are not shipped.

The drawing aid uses four persistent objects and reuses their GPU buffers between pointer updates. Its geometry is separate from driving/walking surfaces, has a bounded station count and never changes money, roads or simulation state until a successful build. Permanent road geometry, building/tree/terrain assets and independent offscreen simulation are unchanged. This feature release does not establish an overall FPS improvement; large road rebuilds can still pause.

All 637 automated checks pass, including 25 focused snapping, guide and production-input tests. All 95 root JavaScript modules pass syntax checking; all 89 building assets, texture/HDR dependencies and existing lossless delivery bundles verify. Pointer tests cover preview/commit agreement, curve stages, cancellation, stationary Alt transitions, cache invalidation and plain saved coordinates.

In the browser, a separate QA city built a curved road for ₡650, right-click stepped back through the bend, and manual save was verified on day 39 at 4:27:08 PM on October 27. Save & Exit stored 4:27:28 PM; reopening the game retained that entry, and Continue restored the built curve. The resumed city advanced to day 57 before pausing. No warnings or errors were recorded. At 1280×720, two alternating curved-preview comparisons measured GPU medians of 8.86/8.98 ms before and 8.83/9.03 ms after, with frame medians of 16.6–16.8 ms in both versions. Main-view draw calls rose from 103 to 107 while the guide was active. These are bounded scene observations, not a general FPS guarantee. This is feature update three after optimization 131. Edition 135 is the next dedicated optimization pass.

## Edition 133 — Continuous bridge junctions

Bridge-side intersections now resolve one shared modest-grade surface, with smooth transitions along their connected approaches. The side street no longer drops from the bridge elevation to the ground at the bridge lookup boundary. The corrected junction and its clipped approach ribbons share the same asphalt offset; their former overlap lift is removed. Concrete sweeps retain their original samples and add only missing grade-break stations or locally long gaps. This does not alter saved road controls, widths, zoning or resident routes.

The grade correction is local and spatially indexed. Separate crossings and unconnected roads retain their original profiles. Free road ends keep their full-width heights and tangents. If an approach ends too close to the junction to fit a continuous transition, that junction retains its previous profile instead of introducing a new endpoint cliff. Wet-deck clearance is preserved. No building, vegetation or texture quality has been reduced.

The official [Road Tools pictures](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/road-tools), including crossing roads and hillside cut-and-fill, were inspected before the work. The first browser comparison showed the large bridge-junction step removed. A close view exposed coplanar grass and retaining-wall caps; the concrete now has a closed 3 cm raised coping. Actual corner checks found 47 coplanar cap/soil triangles before and none after; its closest clearance is 2.997 cm. The different warm and gray retaining faces use the same material, with different surface directions; no unsupported material replacement was made. The reference pictures are not shipped, and commercial-game visual equivalence remains unachieved.

All 612 checks in 82 local test files pass. All 93 root JavaScript modules pass syntax checking, and existing model/texture integrity plus lossless delivery checks pass. The actual river junction has 145 checked asphalt triangles with a maximum 2.81% grade, compared with the previous nearly vertical ridge. Concrete support, water clearance, short dead ends, adjacent junctions, cap closure and save compatibility are covered. An independent comparison with the published Edition 132 meshes found all 50 samples on unrelated crossings and all 6,367 height queries outside the correction unchanged, with identical original bridge profiles and horizontal vehicle/pedestrian routes.

After the Mac was unlocked, the final close-up and low road-level browser views confirmed the smooth junction and the disappearance of the green/white cap flicker. Day and night views were compared again with the reference. No browser warnings or errors were recorded. The full game restored the older 226-resident, 82-household QA city; manual save was verified on day 67 at 2:52:49 PM on October 27, and Save & Exit returned home at 2:53:08 PM. A full reload retained the same city and timestamp. Continue restored 226 residents and 82 households and advanced to day 70; final Save & Exit stored day 74 at 2:54:32 PM. Existing clock tests cover the five-minute autosave interval; this release did not wait a fresh five minutes for a new hosted autosave test.

At 1280×720, two alternating daytime comparisons measured GPU medians of 15.02/15.93 ms before and 13.67/15.80 ms after, with frame medians of 18.3/20.0 ms versus 16.9/19.8 ms. Night GPU medians were 20.47/17.12 ms versus 14.39/16.58 ms, and frame medians 16.6/20.6 ms versus 16.9/19.7 ms. Draw-call counts were unchanged. The river main-view triangle count grew by 387 in daytime and 181 at night. These are bounded scene observations under the machine's current load, not a general FPS guarantee.

Four alternating CPU measurements after two warmups retained stable geometry hashes within each edition, unchanged saves and natural grids, and no terrain fallback. Total construction medians were 1,165→1,127 ms for the starter scene, 13,241→10,088 ms for the district, 5,191→6,267 ms for the river, and 4,049→3,430 ms for islands. The Mac had severe memory pressure and large trial spreads; these elapsed results do not establish a controlled speedup or regression. River process-CPU medians rose about 2.9%, while elapsed medians rose 20.7%. Large rebuilds can still pause. The comparison includes road construction and near/far terrain fitting, excluding GPU, buildings, textures, vegetation refresh and traffic. Draw counts stayed unchanged; total road-and-ground triangles increased by 133 in the river and 723 on islands, with no increase in the two dry scenes.

This is feature update two after optimization 131. Feature 134 precedes the next dedicated optimization, Edition 135.

## Edition 132 — Road grades and fitted terrain

Dry roads now use smooth longitudinal profiles and compatible junction elevations. Terrain is cut or filled around the final pavement and sidewalk boundaries. Small differences blend into a shoulder; larger differences and constrained building plots receive solid retaining walls. Wet bridge crossings remain open, and their existing dry-end elevation constraints are retained. Zoning fills and lot outlines, paths, ground picking and vegetation use the resulting surface.

Road-shaped terrain is derived from the original ground rather than written into saves. Rebuilding does not accumulate elevation changes, deleting a road restores the natural surface, and occupied building plots keep their foundations. The road controls, resident and traffic routes, independent offscreen simulation, manual saves, five-minute autosaves and home/Continue flow are preserved. The wall material neutralizes the photograph's warm tint while retaining its detail and uses three shared CC0 [Concrete Wall 008](https://polyhaven.com/a/concrete_wall_008) maps, credited in `dist/assets/CREDITS.md`, adding 1,456,883 image bytes. Existing building, tree and terrain textures are unchanged.

The official [Road Tools pictures](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/road-tools), particularly the hillside cut-and-fill example, guided the road shelves and retaining faces. The reference pictures are not shipped. This release improves those specific features; visual and simulation equivalence with the commercial game remains unachieved.

Close views exposed missing retaining panels caused by collapsed terrain triangles; walls now follow the construction outline and fit their tops to the emitted ground. Actual hill coverage includes 496 cross-sections and 2,976 rays through both wall sides. One river junction retains the older abrupt bridge-height transition and its steep shoulder wedges; correcting that junction profile is separate from this release. Ordinary roads and hill retaining walls do not have those missing-panel gaps.

All 601 checks in 81 local test files pass, including 31,866 actual hill/river asphalt probes, the independent retaining-wall coverage test, structural-copy picking and disposal, occupied-plot refresh, terrain undo, zoning alignment and existing save/routing/offscreen simulation checks. All 93 root JavaScript modules pass syntax checking; model/texture integrity and lossless asset delivery checks pass.

Road terrain fitting adds construction work compared with Edition 131. The final cost fixes reuse ordered query storage, avoid repeated wall-contact scans and skip terrain rebuilds for occupied plots outside the maximum possible road-work corridor. All final road, ground and wall buffers remain byte-identical to the verified pre-optimization output in five scenes. A translated-shape cache was rejected because its extra memory and key processing showed no convincing planning benefit. Heavy memory pressure made CPU timing runs unstable, so these changes do not establish a rebuild-latency or frame-rate guarantee; large road edits and nearby plot changes still require additional terrain work.

In the final 1280×720 district comparison under that load, GPU medians were 45.33/40.02 ms before and 43.68/37.74 ms after; frame medians were 67.3/63.9 ms before and 65.6/61.2 ms after. Main-view triangles rose from 868,009 to 947,097, and main-view draw calls from 305 to 309. These paired observations do not demonstrate a broad FPS improvement or a guarantee for other cities and devices.

The final night bridge comparison was less consistent: GPU medians were 19.33/17.17 ms before and 30.43/19.11 ms after, with 35.6/31.7 ms versus 50.3/34.9 ms frame intervals. Main-view triangles rose from 472,681 to 487,312 and calls from 28 to 29. This records added rendering cost in that scene under the observed conditions; it is not presented as a performance win. Neither comparison scene recorded browser warnings or errors.

Local full-game verification restored the older QA city with 226 residents and 82 households. Manual save succeeded on day 53, Save & Exit stored the 9:30:45 PM timestamp, and a full reload returned to home with the same city and timestamp. Continue restored those residents and households and advanced to day 54; final Save & Exit stored day 60 at 9:32:09 PM on October 26. No browser warnings or errors were recorded. Road rebuilding remains synchronous, and transitions/edits can pause under load. The five-minute save interval remains covered by the existing clock tests; this run did not wait a fresh five minutes to claim a new hosted autosave test.

This is feature update one after optimization 131. Features 133–134 precede the next dedicated optimization, Edition 135.

## Edition 131 — Faster road rebuilds with identical detail

This is the dedicated optimization after feature updates 128–130. Pavement clipping reuses immutable polygon bounds and query storage, avoids per-query sets, and borrows already ordered spatial buckets when possible. Bridge grading reuses shared longitudinal probes; bridge sweeps reuse station/offset heights within one build. Concrete fitting rejects safely separated planes before clipping. Street-light projection skips triangles outside the light pool and retains polygons unchanged when a clipping edge contains all their vertices. Temporary caches are discarded at the end of their build or projection.

The finished road meshes are unchanged. Complete starter, district, river and island builds, including outside connections, have identical hashes for every geometry attribute/index byte, transform, material property, visibility and shadow flag. Paint subdivision, bridge profiles, concrete contact geometry, curbs, markings and light-pool boundaries retain their Edition 130 output. Building/tree/terrain assets, draw detail, roads in saves, routing and independent offscreen simulation are unchanged. A trial general marking cache was rejected because its overhead slowed inexpensive outside-road queries; the final release does not include it. A separate denser surface-index experiment is deferred.

In four alternating measurements after two warmups, complete CPU road-rebuild medians fell from 49.08 to 45.50 ms in the starter world (7.3%), 306.05 to 259.57 ms in the district (15.2%), 199.09 to 172.07 ms on river terrain (13.6%), and 220.40 to 203.91 ms on islands (7.5%). The timed work includes construction, outside extensions, pavement clipping, bridge grading, light projection, paint and batching, with fresh worlds and garbage collection outside each timed interval. Canvas sign rasterization is mocked; GPU, buildings and traffic are excluded. This reduces road editing/rebuild work, not the cost of every rendered frame or a guarantee of lag-free play on every map.

The same official Road Tools reference pictures were inspected again and the finished junction/night-bridge views compared with Edition 130. No road detail was lost; this is an optimization of the current rendering, not commercial-game visual equivalence. At 1280×720, alternating district GPU medians were 10.04/9.57 ms before and 9.53/9.93 ms after; frame medians remained 16.6 ms, with identical 305–607 draw calls and 868,009 main-view triangles. Night bridge GPU medians were 6.66/6.28 ms before and 7.04/6.01 ms after, with 16.7–16.9 ms frames and identical draw/triangle counts. These scene comparisons show no consistent frame-rate gain or regression.

All 565 checks in 76 local test files pass, including fixed release geometry oracles, all eight bridge road styles, boundary clipping, unchanged saves, and prior routing/offscreen simulation tests. All 91 root JavaScript modules pass syntax checks, and model/texture integrity plus lossless asset delivery checks pass. The older local QA city continued with 226 residents and 82 households, was manually saved on day 42, saved on exit and reloaded with the same home entry. Continue restored those residents and households and advanced to day 43 before pausing; final Save & Exit stored the 4:14:33 PM timestamp on October 26. No browser warnings/errors were recorded in the game or comparison scenes. Hosted publication verification is recorded separately.

Feature updates 132–134 precede the next scheduled dedicated optimization, Edition 135.

## Edition 130 — Joined pavement and graded bridge approaches

Road intersections now use one pavement surface. Overlapping approach strips are clipped to the actual junction outline, with shared boundary vertices and preserved textures; outside-connection overlaps receive the same treatment. Cars and buses follow the finished road triangles while retaining their position/revision caches. Upgrade previews no longer register as driving surfaces. Street lamps are placed after the surface is finalized, and their light pools are clipped to the actual pavement triangles.

Bridge approaches preserve natural dry-end heights and slopes, then smoothly reduce crossfall into a level or gently graded deck. Duplicate samples that corrupted bridge-height queries are removed. Longer approaches receive structural support. Concrete decks and abutments are fitted beneath the final asphalt planes, including intersections, while preserving the original underside and railings. This changes rendered road geometry without moving saved controls, zoning, routes, or independently advancing traffic/resident simulation. One tested river avenue still terminates on naturally steep terrain (36.6% maximum across the width); its endpoint is preserved. Other tested crossing approaches are below 12%. Road grading does not cut or fill the whole terrain.

The official [Road Tools pictures](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/road-tools) were inspected before implementation and compared again with the river approach, island crest, junction and bridge side views. The first profile pass exposed concrete through the pavement; it was rejected and corrected using the finished asphalt triangles. The result removes the intersecting slabs and gives continuous road joins, but commercial-game visual equivalence remains unachieved. Reference pictures are not shipped. Building, tree and terrain assets are unchanged; no new image download is introduced.

At 1280×720, two alternating district comparisons measured GPU medians of 17.24/16.90 ms before and 16.91/16.68 ms after, with the same 305–607 draw calls and essentially unchanged submitted geometry. Frame intervals were 28.8–29.5 ms. Extra preview tabs were closed for these measurements; another game and normal applications were running, so these are comparative scene measurements, not an isolated FPS guarantee. Complete CPU road rebuilds with outside connections cost more: starter medians 39.47→50.78 ms, larger district 212.00→331.57 ms, river 95.85→233.39 ms and islands 122.59→217.01 ms. All fitting and clipping happens during rebuilds. This cost is an explicit target for the next optimization, without removing detail or pausing offscreen simulation.

The final night bridge comparison measured GPU medians of 13.31/13.12 ms before and 13.60/12.70 ms after, with unchanged draw counts and frame medians of 24.2–25.0 ms. The clipped light pools add only local nighttime geometry; daytime pools remain hidden. The first fan-based lighting projection was rejected because it produced wedges across elevated roads.

All 558 checks in the complete local suite pass, including regressions for single pavement coverage, exact seams, all road styles, real terrain clearance, intact bridge undersides, preview isolation, cached vehicle heights and projected light-pool triangle interiors. JavaScript syntax, asset integrity and lossless delivery checks pass. The existing local QA city was manually saved at 226 residents, 82 households and day 38, then saved on exit and reloaded. Continue restored the residents and households; simulation advanced to day 39 before pausing. The home screen retained the final 4:43:56 PM save. No browser warnings or errors were recorded. Local persistence checks and hosted publication verification are recorded separately.

This is feature update three after optimization 127. Edition 131 is the next dedicated optimization, prioritizing road rebuild cost while retaining the finished geometry, building detail and independent offscreen simulation.

## Edition 129 — Road surfaces and sidewalks

Roads use a fine-grained CC0 asphalt photograph with continuous, metre-scale color, normal and roughness mapping across strips and junctions. The original yard and roof textures remain separate. Sidewalks have smaller concrete slabs with filtered joints, 17.5 cm curb rises and 20 cm bevels. Rendered corner tangents meet their approaches, including joins between old and authored street widths. Lane paint sits about 1 cm above the actual triangulated asphalt, with bounded refinement on uneven surfaces. Pedestrian feet, entrance aprons, signal poles and bridge rail feet follow the rebuilt surfaces without moving their routes or road footprints.

The official [Road Tools pictures](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/road-tools) were inspected before implementation and compared with the resulting street and junction close-ups. The first asphalt pass was too dark and was brightened after comparison. The broad repeated cracks, oversized slab joints and tall curb edges are replaced. Borough's road layouts, streetscape detail, steep bridge grading, terrain and overall rendering still differ from Cities: Skylines II. The extreme island bridge test retains a pre-existing exposed deck band at its abrupt approach; this release does not redesign road grades. No reference images or game assets are shipped.

All 536 checks in 69 test files pass, along with production module syntax, asset integrity and lossless compression checks. Tests compare actual road triangles, curved and mixed-width joins, natural river/island crests, bus-stop ramp edits, pedestrian height caches, unchanged routes and save state. Paint refinement happens only during construction, with a depth limit and hard per-mesh output cap. The on-map starter streets add no paint triangles; the hilly outside approaches require extra refinement. No new road material groups or per-frame road geometry uploads are introduced. The three original 1K road photographs total 2,115,624 bytes.

The existing local test city loaded, was manually saved at 226 residents, 82 households and day 25, returned home, survived a page reload, and continued with the same residents and households. Continuing resumes time; the final paused check was day 33. No browser errors or warnings were recorded. In the final alternating 1280×720 comparisons, frame medians stayed near 16.6 ms before and after. Street-level GPU medians were 7.92/7.90 ms before and 7.83/7.90 ms after; the district view was 10.41/9.89 ms before and 11.00/9.75 ms after. Draw counts were unchanged. Visible triangles increased by about 1.8–2.2% as paint followed uneven surfaces; buildings and vegetation retained their models and detail settings. The six-junction stress scene refined 6,706 paint triangles to 53,230, once during road construction. These are scene-specific comparisons, not a universal frame-rate guarantee; earlier runs were affected by another game running on the Mac. Including outside connections, median road construction cost rose from 12.30 to 55.49 ms in the starter world and from 85.26 to 167.45 ms in the larger fixture. Its road buffers grew from 4.68 to 9.15 MB, mostly from paint on the hilly outside approaches. This work happens during road construction/rebuilds, not every frame, and is a candidate for the next scheduled optimization.

This is the second feature release after Edition 127's optimization. Edition 131 remains the next dedicated optimization, after feature releases 128–130.

## Edition 128 — Industrial surface materials

Industrial walls, metal roofs, storage containers and dumpsters now use shared photographic wear, normal and roughness maps. Their original paint palettes remain, with restrained luminance variation from the source photograph. Metre-scale UVs stay continuous across panels and ribs; pitched roofs, pipes, silo shells and conical caps retain their actual surface dimensions. Timber grain wraps around each log and follows its length. The cut ends use filtered growth rings and small radial cracks in one shared material, leaving pallet wood unchanged. The texture setup waits for loading before the city is ready, with per-map failure recovery and bounded filtering.

The official [Supply Chains industrial pictures](https://www.paradoxinteractive.com/games/cities-skylines-ii/add-ons/cities-skylines-ii-supply-chains) were inspected before implementation and compared with the resulting processing and timber yards afterward. The material pass improves surface detail; overall visual equivalence with the reference game has not been achieved. Reference game images are not shipped. The new 1K texture sets are CC0 Poly Haven assets, credited in `dist/assets/CREDITS.md`; six shared files add 3,260,845 bytes of image download. Industrial metre-scale UVs add 28,024 bytes to the compressed model. All other modern buildings, geometry positions/normals/colors/triangles, embedded textures and distant-model files remain unchanged. The Edition 127 yard batching savings remain in place.

In a 1280×720 comparison of 24 industrial lots, main-view draw calls stay at 128 in the overview and 106 at street level; submitted triangles stay at 741,420 and 712,063. Two alternating overview GPU trials measured 12.23/11.90 ms before and 11.98/12.80 ms after. Street-view trials measured 13.32/14.04 ms before and 13.28/12.64 ms after. Another game was running on the machine; whole-frame intervals ranged from 58.8 to 86 ms, so these measurements do not establish an isolated FPS improvement or guarantee. The new textures add shading work while preserving geometry, batching and offscreen simulation.

All 513 checks pass in the final local suite, alongside module syntax, asset integrity and lossless compression checks. Local full-game checks covered Continue, manual save, Save & Exit and reload to the home screen. The saved and reloaded city showed 218 residents and the same 3:12:58 PM timestamp. The final local game and comparison scene recorded no browser warnings or errors. The earlier shader declaration error was corrected before final verification.

This is feature update one after optimization 127. Features 129–130 precede the next dedicated optimization in Edition 131.

## Edition 127 — Industrial rendering optimization

This is the dedicated optimization after feature updates 124–126. Industrial props whose distant geometry is identical to their full geometry now use one instance buffer across both distance bands. Only container corrugation retains a separate distant mesh. The original two-pass chain-link shader and transparency ordering are retained. Existing visibility rules, reflection coverage and camera-independent shadow casters remain unchanged. Trials with additional per-prop culling and single-pass wire were rejected because they did not demonstrate a consistent overall benefit.

Every released prop vertex, triangle, normal, UV, near/far/shadow mesh, texture and material finish is unchanged. The factory, terrain, traffic, residents, walking, save format and simulation clock are unchanged. Unchanged model and distant-mesh assets retain their Edition 126 URLs so existing browser caches can be reused. Comparison against the same industrial reference pictures and Edition 126 gate/timber/night views found no lost detail. The gate, timber-yard and night scene regions are pixel-identical (669,600 checked pixels per view, excluding the comparison controls). This is a rendering-cost reduction, not a claim of visual equivalence with the reference game.

In twelve alternating CPU trials of 24 rotated yards, instance-buffer storage fell from 985,088 to 694,272 bytes (29.5%). Construction medians were 30.43/30.47 ms, cold batch assembly 7.06/7.00 ms, unchanged rebuilds 0.01184/0.01182 ms and moving-camera updates 0.1342/0.1318 ms before/after. Submitted geometry and transforms are identical. A separate 1280×720 full-district browser comparison reduced overview main-pass draw calls from 138 to 128; street-level calls stayed at 106. Overview GPU medians were 8.70/8.52 ms before and 8.69/8.76 ms after; street-view medians were 10.22/10.61 ms before and 10.13/10.19 ms after. Frame intervals remained around 16.5–16.8 ms. These results demonstrate buffer savings with preserved detail, not a general FPS increase or a guarantee for every city/device.

All 497 checks in the full local invocation pass, including three new regressions comparing complete geometry, material finishes, visible world transforms and shadows against the released duplicate-buffer behavior. The comparisons cover near/far boundaries, reflection-only visibility, detail settings, moved lots and demolition. Module syntax, asset integrity and lossless compression checks pass. In the local full game, manual save and Save & Exit stored the QA city at 228 residents, day 15 and ₡992,839; reloading returned to the home screen with that population and save timestamp. No browser warnings or errors were recorded.

The next feature cycle is 128–130, followed by dedicated optimization 131.

## Edition 126 — Industrial service yards and loading access

Industrial grounds now reserve clear approaches from the actual loading doors, a connected manoeuvring area and a truck-width street gate. Office entrances keep separate walks and fence openings. Full-size containers, stacked timber, hollow steel pipes, palletized goods and dumpsters occupy the remaining space according to the building's industrial form. Staff parking is limited to four spaces and only appears when both the bays and their aisle fit. Shallow lots keep clear ground instead of shrinking props or blocking a door. The arrangements are deterministic and remain inside the existing rotated property boundary.

The official [Economy & Production picture](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/economy-production) and [Supply Chains pictures](https://www.paradoxinteractive.com/games/cities-skylines-ii/add-ons/cities-skylines-ii-supply-chains) were inspected before work and compared again with the warehouse and timber-yard close-ups. The first chain-link rendering broke into isolated dots; filtered transparency now retains the continuous diamond pattern. Round pipe bores face inward and stay circular at their actual placed dimensions. The reference still has richer weathering, equipment and yard activity. Existing freight and resident simulation is preserved; these changes describe the physical grounds and their rendered road connections. Reference pictures are not shipped.

Every lot shares the same prop buffers and materials. Fine container corrugations disappear only in distant geometry, while complete containers, storage silhouettes and fence frames remain. Fine wire is visible nearby and does not create noisy shadow-map detail. No existing building triangle or texture changes: the modern GLB's complete binary payload and the distant mesh binary match Edition 125 byte-for-byte. Ten authored loading-door records add 137 bytes to compressed delivery. The fence texture is generated locally once and introduces no external image dependency.

A controlled 1280×720 browser comparison of the same 24 industrial lots measured overview GPU medians of 9.00/9.00 ms before and 9.39/9.42 ms after. Street-view medians were 10.49/9.83 ms before and 9.03/8.91 ms after. Frame intervals stayed around 16.6–16.7 ms in all four alternating trials per view. Overview main-pass draws increased from 139 to 164, so the next optimization will address the additional yard cost. Earlier trials in which the browser viewport changed size were discarded. These measurements describe this scene and device, not a general FPS guarantee; building detail, terrain and offscreen simulation are unchanged.

All 494 checks in the final full local invocation pass. The first invocation exposed a joined-zoning fixture whose random road IDs could produce only one lot size; the fixture now scopes repeatable IDs, restores the original generator afterward and retains the six-form footprint/save assertions. Module syntax, asset integrity and lossless compression validation also pass. Manual save and Save & Exit stored the local QA city at 230 residents, day 13 and ₡992,627; a page reload returned to the home screen with the same saved population and timestamp. The browser reported no errors or warnings.

This is feature update three after optimization 123. Edition 127 is the next dedicated optimization pass, including the measured cost of these yards.

## Edition 125 — Purpose-built industrial architecture

Industrial zoning now grows five original forms: a compact trade depot, a small manufacturing workshop, a four-dock distribution hall, sawtooth-roof works and a processing yard with smooth round silos, ladders, pipework and an exposed steel gantry. Corrugated walls, pitched metal roofs, rooflights, loading shutters, raised docks, bollards and separate office entrances replace the repeated apartment-like industrial facades. Factories and warehouses choose their own forms. New industrial lots vary from two to six frontage cells, selecting full-scale architecture that fits the reserved land; existing parcel frames and capacities are preserved.

The official [Economy & Production](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/economy-production) and [Supply Chains pictures](https://www.paradoxinteractive.com/games/cities-skylines-ii/add-ons/cities-skylines-ii-supply-chains) were inspected before work and compared again with close-up and district views. Inspection led to darker linear metal colors, corrected upward-facing roof seams, separated rooflight surfaces and closed silo caps. Subpixel roof ribs no longer create noisy shadows: the new industrial models cast shadows from their intact distant silhouettes, while fine detail remains in the near color pass. The reference has substantially richer weathering, yards, equipment, lighting and surroundings; this release does not establish visual equivalence. Reference pictures are not shipped.

The five forms share the existing material library and require 15,380 near triangles or 4,764 distant triangles. All 63 older modern buildings and all 84 older distant models remain byte-identical. Compressed model and distant-mesh delivery grows by 153,444 bytes; no new texture download is introduced. Rebuild with `python3 scripts/build-modern-library.py` (Pillow required), then `node scripts/compress-assets.mjs`.

In a 24-lot browser comparison with natural model selection, all five forms appear. Two alternating overview comparisons measured GPU medians of 8.52/8.43 ms before and 8.09/8.26 ms after. Street-level comparisons measured 11.14/10.75 ms before and 10.62/10.59 ms after. Median frame intervals stayed around 16.5–16.8 ms in both views. The more varied assets add draw batches (80 to 113 in the overview's main pass); these scene-specific measurements are not a general FPS guarantee. No terrain, tree, detail setting or offscreen simulation quality is reduced.

All 488 checks in the full local invocation pass, including five new industrial regressions. Module syntax, model integrity and lossless compression validation also pass. In the full local game, manual save and Save & Exit stored the QA city at 230 residents, day 11 and ₡992,421; reloading returned to the home screen with the same saved population. No browser errors or warnings were recorded.

This is feature update two after optimization 123. Edition 126 is the third feature update; Edition 127 is the next dedicated optimization pass.

## Edition 124 — Intact masonry facades at city-view distances

Rebuilt the distant meshes for all 16 imported urban buildings. The former reduction tore holes through window frames and sometimes collapsed wall details. The replacement anchors the corners of connected frames and ornaments, preserves surface attributes, keeps small roofs and entrance details intact, and orders triangles for vertex-cache reuse. Distant meshes share their full-detail vertex buffers. Identical imported finishes also reuse material objects while retaining the five existing wall palettes; draw counts are unchanged. The original full-detail models and textures are unchanged, and all 68 modern/industrial distant models retain identical decoded geometry.

The official [Zones & Signature Buildings pictures](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/zones-signature-buildings) and [Office Evolution pictures](https://www.paradoxinteractive.com/games/cities-skylines-ii/add-ons/cities-skylines-ii-office-evolution) were inspected before work and compared again with the facade, courtyard, tower and district views. The first trial still lost frames and was rejected. The finished distant windows retain coherent frames and recessed surfaces. Architecture, lighting and scene composition still differ from the reference game; this is a concrete rendering repair, not commercial-game equivalence. Reference images are not shipped.

Across all 16 models, 96.4–98.6% of sampled wall, glass and frame surfaces remain within the probe tolerance, versus 38.1–94.3% in the old meshes. A new regression test requires at least 95% retention on every model. The repaired catalogue uses 441,570 distant triangles, 44.2% of its full-detail count. The distant binary shrinks from 9,833,848 to 7,874,304 bytes through shared attributes; compressed delivery increases by 93,757 bytes because the valid topology contains more triangles than the broken version. Reproduce with `node scripts/rebuild-masonry-lod.mjs /path/to/node_modules` (meshoptimizer required), then `node scripts/compress-assets.mjs`.

Two alternating comparisons of a fixed 24-building district containing 12 masonry and 12 modern buildings retained overview frame medians around 16.6 ms. GPU medians rose from 10.17/10.22 to 12.43/11.89 ms. In the closer street view, frame medians rose from 20.8/19.9 to 23.1/22.8 ms and GPU medians from 16.00/15.34 to 18.73/18.61 ms. A deliberately masonry-only district also has a higher GPU cost. The repair therefore improves visible buildings at a measurable rendering cost; it is not an FPS improvement or a guarantee for large cities. Instancing, visibility culling, terrain, tree quality and offscreen simulation remain intact.

All 482 automated tests pass, alongside syntax, asset integrity and lossless-compression checks. Full-game checks resumed the older Landscape QA 122 save, then verified manual save, Save & Exit and reload with exactly 238 residents, day 8 and ₡992,106. The home screen remains idle until Continue or New game. The build is reproducible, unchanged asset data was compared byte-for-byte, and the automated suite covers facade surfaces, material sharing, valid indices, geometry budgets and existing game behavior.

This is feature update one after optimization 123. The next dedicated optimization follows updates 124–126, in Edition 127.

## Edition 123 — Less work for identical grass

Grass and reeds now share each leaf corner between neighboring triangles instead of storing the same corner repeatedly. Fixed-size arrays replace growing number arrays during preparation. Spatial packing preserves the exact triangle order, coordinates, normals and colors from Edition 122, including leaves crossing chunk boundaries. The main view and water-reflection camera also retain independent visibility plans; switching between unchanged views no longer repeats the chunk search. Moving or changing either camera still invalidates its own plan.

Across plains, river and island maps, grass buffer memory falls by about 33%. Median preparation CPU time changes from 111.1 to 51.2 ms, 89.1 to 42.8 ms, and 56.5 to 30.6 ms respectively across seven measured trials after warmup. A 20,000-switch camera fixture reduces visibility work from 20–30 ms to about 7 ms and performs zero extra chunk searches after the two views are prepared. These are ground-cover measurements, not total city-start or overall FPS claims. Reproduce with `GIT_BIN=/path/to/git node scripts/benchmark-ground-cover-indexed.mjs 0191971`.

Three alternating browser trials reduced median grass preparation from 134.7 to 86.9 ms in the street view and from 139.3 to 84.0 ms in the wider city view. Frame intervals remained around 16.6 ms with identical draw and triangle counts. GPU timings varied rather than establishing a consistent speedup: the wider-view trials ranged from 9.15–10.47 ms before and 8.98–10.52 ms after. Close-up grass and riverbank comparisons retain the previously inspected reference-driven appearance. This optimization introduces no new visual feature or reference asset. Building/tree models, textures, terrain heights, detail settings and offscreen simulation remain unchanged.

All 480 local checks pass, together with syntax, asset integrity and lossless compression validation. Frozen Edition 122 triangle-stream hashes match on all three terrain types, and 24 camera selections per map match the former implementation. Shared 32-bit indices, empty cover, chunk boundaries, reflection restoration and camera-projection changes are covered. The previous saved city retained exactly 192 residents, day 4 and ₡991,769 through manual save, Save & Exit and reload in the full local game. No browser errors or warnings were recorded.

This completes the optimization after feature updates 120–122. The next dedicated optimization follows feature updates 124–126, in Edition 127.

## Edition 122 — Fine grass and road-following verges

Ground vegetation now uses thin, curved leaf ribbons with darker roots and varied tips. Short verge grass follows the actual sampled road widths, tapers, junctions and footpaths; grass no longer vanishes from entire square road tiles. Empty zoning retains vegetation until construction occupies its land. Occupied lots, all four outside-road approaches and the whole plant footprint stay clear. Reeds occupy gentler damp banks, steep slopes stay bare, and local road edits do not reshuffle distant plants. Path edits refresh the cover even when their coarse tile occupancy stays unchanged.

The official [Maps & Themes pictures](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/maps-themes) and terrain comparison in the official [Steam announcements](https://steamcommunity.com/app/949230/announcements/) were inspected before work and compared again with the finished street, meadow and riverbank close-ups. The first version left almost no reeds on the riverbanks; the planting threshold was revised to include gentler damp land. The oversized triangular grass spikes are replaced, but the terrain, lighting and broader landscape still differ from the reference game. Reference images are not shipped.

The original shared buffers, reflection-aware visibility and four-draw limit remain. Grass has no animation or per-frame geometry uploads. In two alternating street-view comparisons, GPU medians changed from 15.23/14.87 to 15.47/15.05 ms, with frame medians around 19–20 ms. In the wider city view they changed from 8.56/9.06 to 10.32/10.18 ms, while frame medians stayed at 16.6 ms and draws stayed at 128. The finer geometry therefore has a measurable GPU cost; these scene-specific results are not a general FPS guarantee. Building and tree models, textures, detail settings, terrain heights and resident simulation are unchanged.

All 475 checks in the full local invocation pass, including seven new vegetation and refresh regressions. Module syntax, model integrity and lossless compression checks pass. In the full local game, the 192-resident test city was manually saved at day 3 with 64 households and ₡991,707, returned home, survived a page reload, and continued with the same residents and households. Continuing resumes simulation, which advanced to day 4 and ₡991,769 during the check. No browser errors or warnings were recorded.

This is feature update three after optimization 119. Edition 123 is the next dedicated optimization pass.

## Edition 121 — Crossing signals and roundabout priority

Pedestrians now wait at signal-controlled crossings and continue to the opposite curb when a signal changes mid-crossing. Drivers yield to people waiting at an uncontrolled crossing or already crossing. A car or held bus occupying the markings clears before anybody steps off the curb. Residents and bus passengers share these rules, show their waiting reason, and continue simulation offscreen. Restored walkers already in a crossing keep their position and priority. Transient crossing plans are cached per route and are rebuilt when roads or bus-stop crossings change.

Controlled crossings have paired red/green pedestrian signals facing across the road. Their original standing/walking silhouettes use two instanced meshes; normal frames only update colors when the phase changes. The official [Traffic AI reference picture](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/traffic-ai) was inspected before work and compared again afterwards. The first close-up exposed block-shaped poles and protruding traffic-light bulbs, so the fixtures were revised to round poles, rounded housings and recessed lenses. The reference still has broader differences in road proportions, urban surroundings and lighting; this release does not establish visual equivalence. Reference pictures are not shipped.

The previous saved QA city exposed a roundabout deadlock: entering and circulating vehicles treated each other as leaders. Gap checks now continue to the actual merge, give priority to circulating traffic, and use ring spacing only for cars on the ring. All 24 vehicles in the dense two-lane approach regression finish their journeys. The exported 226-resident QA save completed 87 vehicle trips over ten simulated minutes, compared with zero before the correction, without changing its roads or teleporting residents. Congestion elsewhere in that test city remains.

All 468 checks in the local full-suite invocation passed (467 regression cases plus the asset-file check). The final fixture revision additionally passed its 11 targeted checks. Syntax, asset integrity and lossless compression checks pass. Building models, terrain, vegetation, texture downloads and detail settings are unchanged.

The same-city CPU comparison measured 90 simulated seconds after warmup: 32 slots 462.8 → 459.0 ms, 128 slots 1,966.6 → 2,582.7 ms, and 512 slots 10,101.7 → 10,683.2 ms. New crossing decisions and waits intentionally change journeys; these are CPU fixture measurements, not FPS claims. The larger fixture adds about 0.32 ms per simulation step. The browser rendering comparison was noisy and is not used to claim a speedup. Two pedestrian signal draw calls are shared city-wide.

The full local game retained 226 residents, 82 households, 131 assigned jobs, 58 travelling residents, day 27 and ₡994,096 through manual save and Save & Exit. A page reload returned to the home screen with the same saved city.

This is feature update two after optimization 119. Edition 122 is the third feature update; the dedicated optimization follows in Edition 123.

## Edition 120 — Sidewalk routes and usable crossings

Walking now follows both sidewalks along the actual street geometry. Residents use the marked approach crossings and corner pavements at ordinary junctions, and the outer sidewalks at roundabouts. Door-to-sidewalk links cannot shortcut through driving lanes. Curved streets, road widths and tapers share the rendered road plan. Explicit pedestrian paths remain usable. Saved walkers keep their position and find a new route after a road edit or reload; an old saved position inside a driving lane can leave it without teleporting.

Bus stops now receive a shared crossing when there is no nearby junction crossing. Stops shared by several lines use one crossing, and removing the last line removes it. Their markings, median openings, walking connections and lowered curb ramps use the same geometry. Junction crossings also have ramps while the outer pavement stays at its normal height. These are automatic stop-access crossings; a manual per-crossing control and pedestrian signals/driver yielding remain future work.

The intersection and roundabout pictures in the official [Road Tools feature](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/road-tools) were inspected before this rebuild. Their continuous sidewalks, approach crossings and road-edge transitions informed the changes. Reference pictures are not shipped. Existing building models, terrain, vegetation, detail settings, saved lot frames and the Edition 119 vehicle-following optimization are unchanged.

The two-sided network has more routes to consider, so it uses cached road plans, a spatial pavement mask, retained curve points and a destination bound for shortest-path searches. In the 624-node legacy-grid fixture, the complete sidewalks use 4,206 nodes. Across 120 uncached routes, median CPU cost increases from 3.84 to 32.90 ms; a repeated cached batch remains about 0.055 ms. Rebuilding its walking links increases from 1.95 to 11.72 ms. These costs occur when preparing roads or planning new journeys; they are not per-frame costs. Reproduce with `node scripts/benchmark-pedestrian-network.mjs` and set `GIT_BIN` if needed.

In a static browser comparison of the same 216-resident city, the junction ramps add 320 rendered triangles and no draw calls. Two alternating comparisons measured GPU medians of 9.74/10.04 ms and 9.24/8.91 ms before/after, with median frame intervals at 33.3 ms in all four runs. This covers that scene and device, not every possible city.

All 459 regression tests pass, together with module syntax, complete model/texture integrity and lossless-compression checks. New cases cover both sides of streets, curved lanes, crossing detours, bus-stop additions/removal, two-arm bends, ramps on slopes, shortest-path optimality and saved walking progress.

The full-game browser check retained 226 residents, 82 households, 131 job assignments, 56 travelling residents, day 39 and ₡990,721 through manual save, Save & Exit, page reload and Continue. The city retained its medium roundabout and two bus-stop crossings. No browser warnings or errors were recorded.

This is feature update one after optimization 119. Updates 121 and 122 precede the next dedicated optimization in Edition 123.

## Edition 119 — Less traffic work per simulation step

This is the scheduled optimization after feature updates 116–118. Profiling the 4,872-resident city identified vehicle-following scans as the largest simulation cost. Drivers now query a conservative nearby rectangle through small spatial cells, bounded by the distance that can affect braking, movement or intersection clearance during the step. Vehicle lengths, long buses, turning speed limits and sequential movement remain accounted for. Starting drivers retain the previous distant-queue diagnostic through an unbounded fallback when necessary. Signals, yielding, routes, acceleration, movement and offscreen simulation are unchanged.

The frozen Edition 118 comparison checks the entire saved world, every vehicle, queue summaries and completed journeys after each trial. For 90 simulated seconds, the 128-slot city decreases from a median 577.6 to 320.9 ms of CPU work (44%), and the 512-slot city from 3,407.0 to 1,554.6 ms (54%). Cities with working roundabouts decrease from 657.1 to 359.7 ms at 128 slots (45%) and 4,100.5 to 1,757.5 ms at 512 slots (57%). Small fleets retain the direct scan; their timing variation is not attributed to this index optimization. These results cover traffic, transit, walking and resident scheduling, excluding rendering, GPU work and engine growth ticks. They are not overall FPS claims. In the actual in-app browser, two alternating trials for each scene reduced simulation CPU time by 20% for 128 slots, 22% for 512 slots, and 28% for 512 slots with roundabouts. Every saved world and journey also matched the frozen release in those browser comparisons.

All 450 regression tests pass. Additional cases cover arbitrary headings, sequential index moves, long avenues, exact lane and stopping boundaries, held buses, dwelling vehicles, tiny time steps, distant queue messages, unusual vehicle lengths and full-scan adapters. Reproduce the three alternating trials for each of five scenes with `node scripts/benchmark-traffic-following.mjs` (set `GIT_BIN` if the system Git wrapper is unavailable).

The full local game retained 262 residents, day 38 and ₡990,204 through manual save, Save & Exit, a page reload and Continue. It resumed simulation with residents still assigned to their homes and journeys. The browser reported no warnings or errors.

The only runtime behavior changes are the following query and its spatial search. All other changed game source bodies differ only in version strings. Geometry, materials, building/tree assets, terrain, detail settings, rendering visibility and save format remain unchanged. Buildings stay pinned to Edition 114 assets and broadleaf trees to Edition 117. This performance pass preserves the previously inspected visual references and introduces no new visual feature.

## Edition 118 — Working roundabouts

Roads now includes a Roundabout tool: select an existing crossing, preview a small, medium or large island, then build or resize it. Inspect also opens these controls. The previous signal/stop choice returns when the roundabout is removed. The tool checks funds, road angles, dry and sufficiently level land, nearby junctions, occupied lots, footpaths and bus stops. Existing homes are never demolished by this operation. Connecting roads must have the roundabout removed before they can be replaced or deleted.

The official [Road Tools roundabout reference picture](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/road-tools) was inspected before implementation. The new geometry has smooth perimeter curb transitions, textured grass islands, raised concrete aprons, yield signs, circulating arrows and approach crossings. Reference images are not shipped. This release supports one circulating lane on two-way streets with sidewalks; it does not implement multilane spiral roundabouts or highway/one-way connections.

Cars, residents and buses use the same clockwise lane geometry, yield to circulating vehicles and keep spacing around bends. Several separated entries can operate together. Walking routes follow perimeter sidewalks and cross the approach roads. Zoning excludes the footprint. Road-edit rebuilding reprojects active resident trips and bus services while retaining destinations, passengers and saved progress. Roundabouts persist with ordinary manual saves, five-minute autosaves, backup exports and save-on-exit. Old worlds remain compatible.

All 443 regression tests pass, plus module syntax, asset integrity and lossless compression checks. New coverage includes all sizes, three/four-arm junctions, invalid saves, placement conflicts, road/path protections, clockwise turns, multiple simultaneous vehicles, walking connectivity, bus routes, spatial yield queries, active residents and buses, and finite shared geometry. Browser testing verified resizing through the actual road tool, manual save, home-screen exit and reload with 224 residents and the selected size retained.

An alternating static browser comparison in the same 216-resident, 21-building test city measured GPU medians of 10.84/9.52 ms without a roundabout and 11.79/10.44 ms with one. Median frame intervals remained 16.6–16.7 ms. The circle added 304 rendered triangles and 15 draw calls in that view. This is a small-scene comparison, not an overall performance guarantee: the actual game at its wider camera view reported about 30 FPS. The 84 building assets, textures and detail settings are unchanged, with building asset URLs retained at Edition 114 and tree assets at Edition 117. Edition 119 is the optimization pass after feature updates 116–118.

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
