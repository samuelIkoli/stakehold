import { DIRECTIONS, EXTRA_SHORT, describePose, type Pose } from "@/lib/pose";
import { cx } from "./ui";

const DIR_EMOJI = ["👈", "👉", "👆", "🫵"];
const EXTRA_EMOJI = ["😁", "👍", "🙆", "✌️"];

export function PoseCard({ pose, compact, className }: { pose: Pose; compact?: boolean; className?: string }) {
  return (
    <div className={cx("rounded-3xl bg-ink p-5 text-bg", className)}>
      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold">Today&apos;s pose</div>
      <div className={cx("mt-3 grid grid-cols-3 gap-2", compact && "gap-1.5")}>
        <Tile big={String(pose.fingers)} label={`finger${pose.fingers > 1 ? "s" : ""}`} compact={compact} />
        <Tile big={DIR_EMOJI[pose.direction]} label={`point ${DIRECTIONS[pose.direction].replace("at the ", "")}`} compact={compact} />
        <Tile big={EXTRA_EMOJI[pose.extra]} label={EXTRA_SHORT[pose.extra]} compact={compact} />
      </div>
      <div className={cx("font-display mt-3 font-bold", compact ? "text-base" : "text-xl")}>{describePose(pose)}</div>
      {!compact && <div className="mt-1 text-xs opacity-60">Use one hand for the fingers, the other (or your face) for the extra.</div>}
    </div>
  );
}

function Tile({ big, label, compact }: { big: string; label: string; compact?: boolean }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-white/[0.07] px-2 py-3 text-center">
      <div className={cx("font-display font-extrabold leading-none", compact ? "text-3xl" : "text-5xl")}>{big}</div>
      <div className="mt-2 text-[11px] font-semibold uppercase tracking-wider opacity-70">{label}</div>
    </div>
  );
}
