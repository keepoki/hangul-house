# Adaptive exhibition viewing

The user approved retaining premium Three.js scenes, adapting their rendering cost to measured device performance, providing high-quality image viewing on weak devices, and letting visitors choose their viewing method.

Preserve the existing dark exhibition, Korean copy, six rooms, camera tour, text alternative, keyboard controls, and physics workshop. The mode menu offers 자동 / 3D / 이미지 and safely remembers the explicit preference in localStorage. Image viewing uses genuine desktop and portrait renders of the existing exhibition, never approximations.

Automatic viewing starts with useful images, then attempts 3D without blocking navigation. Sustained measured slow frames lower pixel and reflection budgets before falling back to images. Manual 3D still adapts rendering cost but does not automatically switch away unless rendering fails. Initialization, idle time, intentional frame limits, and hidden tabs must not be mistaken for slow rendering. Fallback preserves the current room and explains the change accessibly; manual selection always wins over pending async work.

Approaches considered: adaptive 3D alone cannot serve unavailable WebGL; images alone lose the camera experience. The approved combined approach retains both. Rendered desktop images are 1920×1080; portrait images are 900×1200. Preserve high-detail geometry and textures at every rendering tier.

The existing public Site keeps its audience and URL. Verify behavior with automated tests and desktop/mobile browser inspection before publishing.
