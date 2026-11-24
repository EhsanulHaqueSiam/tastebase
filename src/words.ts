// What counts as a word, shared by the engine and the site's search boxes (which cannot import the engine: it carries
// the registry).

// Framework names are stop words: the framework filter handles them, and "React" in a use case is not a job. So are
// the words that name a look ("in the Aurora look"): a look is not a job either.
export const STOP = new Set(
  "a an and the for of to in on over with my me i we our app ui page that this is it be like need want some use make build look style styled aesthetic vibe feel inspired react native vue svelte solid angular expo vanilla js".split(" "),
);
// Plurals fold onto the singular ("files" = "file", "heroes" = "hero", "glasses" = "glass", "stories" = "story"); "glass" keeps its s.
export function stem(w: string): string {
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && /(s|x|z|ch|sh|o)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

// Stemmed content words. Compounds that name one thing stay one word: a progress bar is a kit part, not progress in
// general (an upload toast).
export const stems = (text: string) =>
  text.toLowerCase().replace(/bottom sheet/g, "bottomsheet").replace(/progress bar/g, "progressbar").replace(/product page/g, "product page productpage").split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w)).map(stem);

