import { useState } from "react";
import type { Kind } from "../../../src/registry/schema.ts";
import { kindMeta } from "../lib/kinds.ts";

/** The library's favicon when captured, otherwise its initial on the kind's colour. */
export function LibMark({ lib, size = 32 }: { lib: { id: string; name: string; kind: Kind }; size?: number }) {
  const [broken, setBroken] = useState(false);
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-[28%] bg-s3 font-semibold shadow-[inset_0_0_0_1px_var(--color-line)]"
      style={{ width: size, height: size, fontSize: size * 0.42, color: kindMeta[lib.kind].color }}
    >
      {broken ? lib.name[0] : <img src={`/marks/${lib.id}.png`} alt="" className="size-[62%] object-contain" onError={() => setBroken(true)} />}
    </span>
  );
}
