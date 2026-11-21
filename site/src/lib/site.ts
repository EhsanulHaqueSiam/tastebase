// Client-safe: the production origin canonicals, OG images, JSON-LD and the sitemap point at, and the author.
export const ORIGIN = "https://tastebase.ehsanulsiam.workers.dev";
export const REPO = "https://github.com/EhsanulHaqueSiam/tastebase";
export const AUTHOR = { name: "Ehsanul Haque Siam", url: "https://github.com/EhsanulHaqueSiam" };

/** A page's canonical path: no trailing slash, no `.html`, "/" for the home page. */
export const canonicalPath = (path: string) => path.replace(/\.html$/, "").replace(/\/index$/, "/").replace(/(.)\/+$/, "$1") || "/";

/** Where the build writes a prerendered page's OG card (site/build.ts) and Markdown copy. */
export const ogImagePath = (path: string) => `/og${path === "/" ? "/index" : path}.jpg`;
export const markdownPath = (path: string) => (path === "/" ? "/index.md" : `${path}.md`);
