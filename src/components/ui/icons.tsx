"use client";

import { motion } from "framer-motion";
import {
  Clapperboard,
  Tv,
  Gamepad2,
  Globe,
  ChefHat,
  Headphones,
  Play,
  Zap,
  Flame,
  Volume2,
  AudioLines,
  Music,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

const ICON_MAP: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  clapperboard: Clapperboard,
  tv: Tv,
  "gamepad-2": Gamepad2,
  globe: Globe,
  "chef-hat": ChefHat,
  headphones: Headphones,
  play: Play,
  zap: Zap,
  flame: Flame,
  volume2: Volume2,
  "audio-lines": AudioLines,
  music: Music,
};

export function Icon({
  name,
  className,
  size = 24,
}: {
  name: string;
  className?: string;
  size?: number;
}) {
  const IconComponent = ICON_MAP[name];
  if (!IconComponent) return null;
  return <IconComponent className={className} width={size} height={size} />;
}

export function SoundWave({
  className,
  animated = true,
  color = "bg-primary",
}: {
  className?: string;
  animated?: boolean;
  color?: string;
}) {
  const heights = [12, 20, 8, 24, 14, 26, 10, 18, 22, 6, 16, 24];
  return (
    <div className={`flex items-end gap-[3px] h-7 ${className ?? ""}`}>
      {heights.map((h, i) => (
        <motion.div
          key={i}
          className={`w-[3px] rounded-full ${color}`}
          style={{ height: animated ? undefined : h }}
          initial={animated ? { height: 3 } : false}
          animate={
            animated ? { height: [3, h, 3] } : undefined
          }
          transition={
            animated
              ? {
                  duration: 1.4 + i * 0.06,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.1,
                }
              : undefined
          }
        />
      ))}
    </div>
  );
}
