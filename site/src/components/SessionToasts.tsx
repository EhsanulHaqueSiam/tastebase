// Once per browser session, on whichever page comes first (after Design Index): a sponsorship ask, then a share ask,
// each for 5s through the site's sonner toaster (Palette.tsx). Nothing shows on the form pages themselves.
import { navigate } from "astro:transitions/client";
import { useEffect } from "react";
import { toast } from "sonner";
import { sharePage } from "../lib/utm.ts";

const KEY = "tb-toasts-shown";
const FIRST_MS = 1500, SHOWN_MS = 5000, GAP_MS = 1500;

export default function SessionToasts() {
  useEffect(() => {
    if (/^\/(sponsor|submit|feedback)$/.test(location.pathname)) return;
    try {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, "1");
    } catch {
      return; // no storage, no way to keep it to once: skip rather than nag on every page
    }
    const share = () =>
      toast("Enjoying tastebase?", {
        description: "Help someone else find it by sharing it.",
        duration: SHOWN_MS,
        action: { label: "Share", onClick: () => void sharePage("tastebase", "session-toast").then((r) => r === "copied" && toast("Link copied")) },
      });
    const t = setTimeout(() => {
      toast("tastebase is open source", {
        description: "Sponsors keep it free. Your product could be the first card here.",
        duration: SHOWN_MS,
        action: { label: "Sponsor", onClick: () => navigate("/sponsor") },
        onAutoClose: () => setTimeout(share, GAP_MS),
        onDismiss: () => setTimeout(share, GAP_MS),
      });
    }, FIRST_MS);
    return () => clearTimeout(t);
  }, []);
  return null;
}
