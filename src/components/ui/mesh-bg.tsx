"use client";

/** Scattered decorative shapes — playful confetti-like background */
export function PlayfulBg() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      {/* Top-left purple circle */}
      <div className="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-primary opacity-[0.12]" />
      {/* Top-right coral blob */}
      <div className="absolute -top-10 right-20 h-40 w-40 rotate-12 rounded-3xl bg-pop opacity-[0.14]" />
      {/* Mid-left teal ring */}
      <div className="absolute top-[40%] -left-12 h-32 w-32 rounded-full border-[6px] border-fresh opacity-[0.16]" />
      {/* Bottom-right yellow blob */}
      <div className="absolute -bottom-16 right-10 h-56 w-56 -rotate-12 rounded-full bg-sunny opacity-[0.14]" />
      {/* Bottom-left small circle */}
      <div className="absolute bottom-32 left-[20%] h-16 w-16 rounded-full bg-primary opacity-[0.12]" />
      {/* Mid-right coral ring */}
      <div className="absolute top-[25%] right-[8%] h-24 w-24 rounded-full border-[5px] border-pop opacity-[0.13]" />
      {/* Center-right small teal dot */}
      <div className="absolute top-[60%] right-[30%] h-10 w-10 rounded-full bg-fresh opacity-[0.12]" />
      {/* Top-center yellow ring */}
      <div className="absolute top-16 left-[45%] h-20 w-20 rounded-full border-[4px] border-sunny opacity-[0.15]" />
      {/* Dot pattern */}
      <div
        className="absolute inset-0 opacity-[0.045]"
        style={{
          backgroundImage:
            "radial-gradient(circle, var(--text-primary) 0.8px, transparent 0.8px)",
          backgroundSize: "28px 28px",
        }}
      />
    </div>
  );
}
