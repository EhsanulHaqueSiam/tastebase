// "Try these" on a detail page: related listings in two columns, a running sponsor first (checked at view time).
import { useEffect, useState } from "react";
import type { Listing } from "../lib/categories.ts";
import { liveSponsors, sponsors, type Sponsor } from "../lib/sponsors.ts";
import { ListingCard } from "./ListingCard.tsx";

export default function TryThese({ related }: { related: Listing[] }) {
  const [ad, setAd] = useState<Sponsor>();
  useEffect(() => setAd(liveSponsors(sponsors)[0]), []);
  return (
    <div className="mt-3 grid grid-cols-2 gap-3 md:gap-5">
      {ad && <ListingCard sponsor={ad} compact where="detail-suggested" />}
      {related.map((r) => <ListingCard key={r.id} item={r} compact />)}
    </div>
  );
}
