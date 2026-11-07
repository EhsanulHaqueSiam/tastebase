import { GrainGradient } from "@paper-design/shaders-react";
import { motion, useReducedMotion } from "motion/react";

/** Closing band: the wordmark wipes up out of a grain-gradient shader. */
export default function Footer() {
  const reduce = useReducedMotion();
  return (
    <footer className="relative isolate mt-24 overflow-hidden pt-24 pb-36">
      <div className="absolute inset-0 -z-10 opacity-70" aria-hidden>
        <GrainGradient colorBack="#000000" colors={["#5b7cff", "#b197fc", "#f78fc4", "#3bd4e8"]} softness={0.7} intensity={0.4} noise={0.35} shape="wave" speed={reduce ? 0 : 0.3} style={{ width: "100%", height: "100%" }} />
      </div>
      <div className="absolute inset-x-0 top-0 -z-10 h-1/2 bg-gradient-to-b from-black to-transparent" />
      <motion.div
        initial={{ clipPath: "inset(0 0 100% 0)", y: 40 }}
        whileInView={{ clipPath: "inset(0 0 0% 0)", y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 1.1, ease: [0.77, 0, 0.175, 1] }}
        className="px-4 text-center text-[clamp(64px,17vw,260px)] leading-[0.85] font-semibold tracking-[-0.06em] mix-blend-plus-lighter"
      >
        tastebase
      </motion.div>
      <div className="mx-auto mt-10 flex max-w-6xl flex-wrap justify-between gap-4 px-4 text-[13px] text-fg2">
        <span>Every library here belongs to its authors. We only write the notes.</span>
        <span className="flex gap-4"><a href="/browse" className="hover:text-fg">Browse</a><a href="/#mcp" className="hover:text-fg">MCP</a><a href="https://github.com/EhsanulHaqueSiam/tastebase" className="hover:text-fg">GitHub</a></span>
      </div>
    </footer>
  );
}
