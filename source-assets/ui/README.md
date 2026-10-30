# Zoning icons

Original Blender models and renders by this project. Visual reference: the official Cities: Skylines II zoning toolbar screenshot linked in the root README, inspected before and after implementation. No game assets were extracted.

Regenerate using Blender 5.2: `Blender --background --factory-startup --python scripts/build-zone-icons.py` from the repository root. Editable models are in zoning-icons.blend; eleven transparent 128-pixel icons are written to dist/assets/ui/zones. These are interface illustrations, not the in-world building models. First gray renders were discarded and materials corrected after visual comparison.
