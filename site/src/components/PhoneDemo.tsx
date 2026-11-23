// A library's hand-made demo (Demos.tsx) inline on its page below lg, where the live-site panel and its Demo tab are hidden.
import { demos } from "./Demos.tsx";

export default function PhoneDemo({ id }: { id: string }) {
  const Demo = demos[id];
  return Demo ? (
    <div className="dots relative grid min-h-56 place-items-center overflow-hidden rounded-xl bg-s1 p-6 shadow-[inset_0_0_0_1px_var(--color-line)]">
      <Demo />
    </div>
  ) : null;
}
