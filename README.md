# Borough II
A standalone browser city simulation with a Cities: Skylines II inspired interface and a real Three.js 3D view. It is an original small game, not the commercial game or a reproduction of its complete simulation.

## Run
`python3 -m http.server 4173 --directory dist`
Open http://localhost:4173. No build or dependency installation is needed. Three.js 0.170.0 and OrbitControls are vendored with their MIT license. Google Fonts are optional; the interface has system font fallbacks.

## Main menu and game lifecycle
The site opens to a home screen with Continue, New Game, Load Game and Settings. The city in the menu background is a separate unsaved demonstration world. It never changes a player's save. No player simulation runs on the home screen. Continue/Play/Start New City begin simulation only after the player chooses them. The game menu pauses simulation. Save & Exit verifies a save before returning home. Failed saves keep the city open. Reloading or reopening the page returns to the home screen, with Continue available for the saved city.

## Features
48×48 seeded river, islands and plains worlds; rotatable and zoomable 3D camera; scanned CC0 grass, asphalt and brick surfaces; rolling terrain and banks; animated water; varied houses, apartments, shops and office towers; curbs, sidewalks, crosswalks, road lamps and bridge supports; trees, shadows, night lighting and cars. Drag roads and bridges; choose two-lane roads or four-lane avenues. Avenues cost more but support more traffic. Road paths are checked before construction, so a blocked or unaffordable path does not partially build. Paint low/high density housing, commerce, industry and offices with brush sizes 1, 2 and 4. Connected power and water gate development; capacity matters. Build healthcare, schools, police, fire protection, parks, recycling centers and bus depots. Services affect happiness, protection capacity, pollution or congestion. Taxes, upkeep and loan repayment affect the city budget. Milestones, demand indicators, inspection, bulldozing, information overlays, photo mode and graphics settings are included.

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
The dark translucent HUD, blue buttons, bottom category tools and build panels were guided by the [official Cities: Skylines II gameplay screenshots](https://www.paradoxinteractive.com/games/cities-skylines-ii/about). Models, interface artwork and game code here are original; the reference screenshots are not shipped as game assets.

## GitHub Pages
The `Publish game to GitHub Pages` workflow tests the engine and publishes `dist` on each push to main. Enable Pages with GitHub Actions as the source. All runtime modules and textures use relative URLs for project-site hosting. Asset credits and licenses are in `dist/assets/CREDITS.md` and `dist/vendor/THREE-LICENSE.txt`.

Moving from the original ChatGPT site to GitHub Pages creates a different storage origin. On the old site, open Load Game and Export each world; on the GitHub site, open Load Game and Import the JSON backup. Keep backups outside the public repository.
