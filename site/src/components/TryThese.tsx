// "Try these" on a detail page: related listings in two columns, a running sponsor first (checked at view time). Their
// screenshots wait for the page to load: on a phone they sit just under the page's own screenshot, its largest paint.
import type { Listing } from "../lib/categories.ts";
import { useSponsors } from "../lib/sponsors.ts";
import { useLoaded } from "../lib/loaded.ts";
import { ListingCard } from "./ListingCard.tsx";

export default function TryThese({ related }: { related: Listing[] }) {
  const ad = useSponsors()[0];
  const loaded = useLoaded();
  return (
    <div className="mt-3 grid grid-cols-2 gap-3 md:gap-5">
      {ad && <ListingCard sponsor={ad} compact late={!loaded} where="detail-suggested" />}
      {related.map((r) => <ListingCard key={r.id} item={r} compact late={!loaded} />)}
    </div>
  );
}
