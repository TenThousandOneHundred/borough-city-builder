# Mixed-use apartment source

`mixed-use.blend` contains two original buildings modeled against the actual Cities: Skylines II mixed-use reference linked in the project README. The packed masonry images, geometry, materials and comparison camera are editable in Blender.

Rebuild from the repository root with Blender 5.2:

```sh
blender --background --factory-startup --python scripts/build-mixed-use.py
node scripts/compress-assets.mjs
```

The script exports both buildings at their local origin before arranging the source scene for a comparison render. Near-only objects carry `lodDetail`; the runtime preserves the other objects for the distant index buffer. `streetFrontsJSON` records the shop and residential entrance metadata exported in the GLB. The `.blend1` backup is not part of the release.
