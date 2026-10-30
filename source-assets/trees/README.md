# Mature conifers

Original geometry authored with Blender 5.2.2 LTS by `scripts/build-mature-conifers.py`. The editable `mature-conifers.blend` contains the two mesh objects, vertex colors and bark/needle materials. No commercial game model or texture is included.

Visual reference: [Cities: Skylines II — City Corner #11](https://www.paradoxinteractive.com/games/cities-skylines-ii/news/autumn-breeze), the “Tree LODs after” game photograph. The slender layered conifer and raised asymmetric pine crown were compared in Blender and the game's browser renderer. The labels describe their modeled forms; exact species identification was not provided by the source.

Regenerate with Blender:

```
blender --background --factory-startup --python scripts/build-mature-conifers.py
node scripts/compress-assets.mjs
```

Append `-- --preview` to render a comparison before the full atlas bake. Preview mode also exports geometry/source; run the full bake and compression before using the runtime assets so geometry and atlases match.

Each 3072 × 1536 transparent atlas contains thirty-two 384-pixel panels. From the bottom upward, rows use elevations 0, 30, 60 and 90 degrees. Columns use eight azimuths at 45-degree intervals. Blender renders around the asset's horizontal bounds center at 54% of its height. The runtime normalizes the full model to unit height and uses the same center and 1.2-height framing for its camera-facing card. All views fit within the central half of each panel, so the runtime crops the transparent horizontal margins to a 0.6-height-wide card. Tests require every meaningful alpha pixel to remain inside that crop. A per-instance yaw keeps both forms aligned. Nearby models remain capped at ten total trees; distant trees share two instanced materials and their shadow variants.

The assets improve mature-tree form; they do not establish exact visual parity with the reference game's trees, lighting or rendering.
