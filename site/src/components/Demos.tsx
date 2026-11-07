// Live demos, each built with the library it shows. Keyed by registry id; libraries without one show a screenshot.
import NumberFlow from "@number-flow/react";
import { Command } from "cmdk";
import { Slider, Switch } from "glisse";
import { Bell, Check, Copy, Heart, Moon, Pause, Play, Sun } from "lucide-react";
import { motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { TextMorph } from "torph/react";
import { Drawer } from "vaul";
import { IconMorph, ShaderBg } from "./fx.tsx";

const btn = "press inline-flex h-10 items-center gap-2 rounded-xl px-4 font-medium";

function TorphDemo() {
  const steps = ["Processing", "Sending", "Transaction sent"];
  const [i, setI] = useState(0);
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid justify-items-center gap-4">
      <button className={`${btn} bg-s3`} onClick={() => (setCopied(true), setTimeout(() => setCopied(false), 1400))}>
        <IconMorph k={copied ? "c" : "n"}>{copied ? <Check size={15} /> : <Copy size={15} />}</IconMorph>
        <TextMorph>{copied ? "Copied" : "Copy link"}</TextMorph>
      </button>
      <button className={`${btn} bg-s2 shadow-[inset_0_0_0_1px_var(--color-line2)]`} onClick={() => setI((x) => (x + 1) % steps.length)}>
        <span className={`size-2 rounded-full transition-colors duration-300 ${i === 2 ? "bg-green" : "bg-amber"}`} />
        <TextMorph>{steps[i] ?? ""}</TextMorph>
      </button>
    </div>
  );
}

function NumberFlowDemo() {
  const [v, setV] = useState(4.2);
  return (
    <button onClick={() => setV((x) => (x === 4.2 ? 128.5 : x === 128.5 ? 96 : 4.2))} className="press text-6xl font-semibold tracking-[-0.04em]">
      <NumberFlow value={v} format={{ style: "currency", currency: "USD" }} />
    </button>
  );
}

function SonnerDemo() {
  const msgs = [["Deploy finished", "main · 42s"], ["3 new comments", "on Pricing"], ["Payment received", "$48.00 from Ana"]] as const;
  const [n, setN] = useState(0);
  return (
    <button className={`${btn} sweep bg-fg text-black`} onClick={() => { const m = msgs[n % msgs.length]!; toast(m[0], { description: m[1] }); setN(n + 1); }}>
      <Bell size={15} /> Show toast
    </button>
  );
}

function VaulDemo() {
  return (
    <Drawer.Root>
      <Drawer.Trigger className={`${btn} bg-fg text-black`}>Open drawer</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-3xl bg-s2 p-6 pb-10 shadow-[0_0_0_1px_var(--color-line2)] outline-none">
          <div className="mx-auto mb-6 h-1.5 w-10 rounded-full bg-white/20" />
          <Drawer.Title className="text-lg font-semibold">Fling me</Drawer.Title>
          <Drawer.Description className="mt-1 text-fg2">Drag down slowly, or flick fast. Velocity decides, not distance.</Drawer.Description>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function CmdkDemo() {
  return (
    <Command className="w-72 overflow-hidden rounded-xl bg-s1 shadow-[0_0_0_1px_var(--color-line2)]">
      <Command.Input placeholder="Type a command" className="h-10 w-full border-b border-line bg-transparent px-3 outline-none placeholder:text-fg3" />
      <Command.List className="p-1.5">
        {["Open project", "Toggle theme", "Copy link", "Invite teammate"].map((x) => (
          <Command.Item key={x} className="cursor-pointer rounded-lg px-2.5 py-2 text-fg2 data-[selected=true]:bg-s3 data-[selected=true]:text-fg">{x}</Command.Item>
        ))}
      </Command.List>
    </Command>
  );
}

function GlisseDemo() {
  return (
    <div className="relative grid w-full place-items-center gap-5 self-stretch overflow-hidden rounded-2xl p-10">
      <ShaderBg className="absolute inset-0" colors={["#0e3a8a", "#6ea8ff", "#f5d0a9", "#1b2b6b"]} speed={0.4} />
      <div className="relative flex items-center gap-4"><Switch aria-label="Wi-Fi" defaultChecked /><Switch aria-label="Bluetooth" /></div>
      <div className="relative w-56"><Slider aria-label="Volume" defaultValue={0.6} /></div>
    </div>
  );
}

function ShaderDemo() {
  return <ShaderBg className="absolute inset-0" colors={["#000000", "#5b7cff", "#f78fc4", "#05060d", "#3bd4e8"]} speed={0.5} />;
}

function MotionDemo() {
  return (
    <div className="relative grid size-full min-h-56 place-items-center">
      <motion.div drag dragSnapToOrigin dragElastic={0.3} whileTap={{ scale: 0.92 }} whileHover={{ scale: 1.05 }} transition={{ type: "spring", duration: 0.5, bounce: 0.35 }} className="size-20 cursor-grab rounded-3xl bg-gradient-to-br from-blue to-violet active:cursor-grabbing" />
      <span className="absolute bottom-3 text-[12px] text-fg3">Drag and let go</span>
    </div>
  );
}

function LucideDemo() {
  const [on, setOn] = useState(false);
  const pairs: [ReactNode, ReactNode][] = [[<Play size={20} />, <Pause size={20} />], [<Sun size={20} />, <Moon size={20} />], [<Heart size={20} />, <Heart size={20} className="fill-pink text-pink" />], [<Copy size={20} />, <Check size={20} />]];
  return (
    <button onClick={() => setOn(!on)} className="press flex gap-3 rounded-2xl bg-s1 p-3 shadow-[inset_0_0_0_1px_var(--color-line)]">
      {pairs.map((p, i) => (
        <span key={i} className="grid size-12 place-items-center rounded-xl bg-s3 [&>span]:size-5">
          <IconMorph k={on ? "b" : "a"}>{on ? p[1] : p[0]}</IconMorph>
        </span>
      ))}
    </button>
  );
}

export const demos: Record<string, () => ReactNode> = {
  torph: TorphDemo,
  "number-flow": NumberFlowDemo,
  sonner: SonnerDemo,
  vaul: VaulDemo,
  cmdk: CmdkDemo,
  glisse: GlisseDemo,
  "paper-shaders": ShaderDemo,
  motion: MotionDemo,
  lucide: LucideDemo,
};
