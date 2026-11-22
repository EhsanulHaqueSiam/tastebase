import { useEffect, useState } from "react";

/** False until the page's own load finishes (true at once after a client navigation). Islands hold back images that
 * are not the first view's largest paint with it, so on a slow phone they do not share its bandwidth. */
export function useLoaded() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (document.readyState === "complete") return setLoaded(true);
    const on = () => setLoaded(true);
    addEventListener("load", on, { once: true });
    return () => removeEventListener("load", on);
  }, []);
  return loaded;
}
