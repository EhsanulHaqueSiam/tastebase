// Once per browser session, on whichever page comes first (after Design Index): a share ask for 5s through the site's
// sonner toaster (Palette.tsx). Nothing shows on the form pages themselves, or in a page framed by /browse's sheet.
// Sponsors are asked for in the homepage's sponsor row and on /sponsor, not here.
import { useEffect } from "react";
import { toast } from "sonner";
import { sharePage } from "../lib/utm.ts";

const KEY = "tb-toasts-shown";
const FIRST_MS = 8000, SHOWN_MS = 5000; // "Enjoying it?" after a few seconds of use, not at first paint

export default function SessionToasts() {
  useEffect(() => {
    if (/^\/(sponsor|submit|feedback)$/.test(location.pathname) || document.documentElement.hasAttribute("data-embed")) return;
    try {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, "1");
    } catch {
      return; // no storage, no way to keep it to once: skip rather than nag on every page
    }
    const t = setTimeout(
      () =>
        toast("Enjoying tastebase?", {
          description: "Help someone else find it by sharing it.",
          duration: SHOWN_MS,
          action: { label: "Share", onClick: () => void sharePage("tastebase", "session-toast").then((r) => r === "copied" && toast("Link copied")) },
        }),
      FIRST_MS,
    );
    return () => clearTimeout(t);
  }, []);
  return null;
}
