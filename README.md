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
