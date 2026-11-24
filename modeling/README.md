# GDG V3.1 — first-person exterior mesh

Original generated meshes. Coordinates: meters, camera points -Z. GLB: pre-posed material-colored components, not a skeleton or animation rig. Joined glove OBJ: continuous original triangulated surface; import for sculpting/retopology. Material groups in GLB can be joined and welded before retopology. The game uses the same surface triangles in quantized JS buffers, with its own grayscale weave/twill/rubber/metal textures. No external assets introduced in this pass.

- emptyL / emptyR: relaxed open hand
- carryL / carryR: parcel pose
- torch: right hand, sleeve, flashlight
- `build_viewmodel.py`: parametric source; requires numpy, scipy, scikit-image, trimesh, Pillow.
- `mesh-report.json`: source geometry component, triangle count, closure and connectedness.

Next: artist retopology with joint loops, unified rest pose, UV unwrap/bake, skeleton + skin weights, actual deformation and browser performance QA. Pre-posed GLBs are not morph-compatible.
