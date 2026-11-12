import type { SiteType } from "./schema.ts";

// Hand-written. `signals` are matched against a brief the way a look's are; phrase signals weigh more.
export default [
  {
    id: "3d-site",
    name: "3D site",
    signals: ["3d", "three.js", "threejs", "webgl scene", "immersive", "r3f", "spline", "3d model", "product configurator", "glb", "gltf"],
    needs: ["3d", "motion"],
    drops: ["background"],
    picks: { "3d": ["r3f", "three", "spline"], motion: ["gsap", "motion"], scroll: ["lenis"] },
    build: "One canvas carries the page; HTML sits over it. One WebGL context per page. Cap DPR at 2, compress models (Draco/Meshopt, KTX2 textures), show a poster until the scene loads, stop the render loop offscreen, and give reduced-motion and no-WebGL users a still image.",
    avoid: ["a second WebGL canvas (shader background) behind the scene", "scroll-jacking the camera without a skip", "uncompressed glTF over 5MB"],
  },
  {
    id: "motion-site",
    name: "Motion-led site",
    signals: ["scroll animation", "scroll-driven", "scroll driven", "scroll-triggered", "scrollytelling", "storytelling", "awwwards", "parallax", "pinned section", "webgl effect", "shader effect", "kinetic", "motion-heavy", "motion heavy", "animated site", "agency site", "creative studio"],
    needs: ["motion", "scroll", "text-effects"],
    drops: [],
    picks: { motion: ["gsap", "motion"], scroll: ["lenis"], "text-effects": ["gsap-splittext", "torph"], background: ["paper-shaders", "ogl"] },
    build: "Scroll is the timeline: GSAP ScrollTrigger pins and scrubs sections, Lenis smooths the wheel, SplitText reveals headlines. Animate only transform, opacity and clip-path. Each section is complete without its animation, so reduced-motion users (gsap.matchMedia) get the static layout.",
    avoid: ["animating body text", "more than one pinned scrub on screen at once", "layout properties (top, height) in scroll animations"],
  },
  {
    id: "media-site",
    name: "Media-led site",
    signals: ["photographer", "photography", "photo-led", "video hero", "background video", "video background", "video-led", "full-screen video", "film studio", "cinematic", "showreel", "lookbook", "full-bleed", "full bleed", "imagery", "campaign site"],
    needs: ["motion"],
    drops: ["background"],
    picks: { motion: ["motion", "gsap"], interaction: ["embla-carousel"], scroll: ["lenis"] },
    build: "Full-bleed photos and video carry the page; the UI stays quiet over them. Native video (autoplay muted loop playsinline) with a poster and preload=metadata, images with srcset, AVIF/WebP, width and height set; the first image eager with fetchpriority=high, the rest lazy. Text over media gets a scrim for contrast. Motion is reveals and slow scale settles on the media, never on the text.",
    avoid: ["shader or gradient backgrounds competing with the photos", "autoplaying video with sound", "carousels that hide most of the work"],
  },
] satisfies SiteType[];
