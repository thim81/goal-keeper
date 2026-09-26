import { Trophy, Target, AlertCircle, CircleDot } from "lucide-react";
import type { GoalType } from "@/types/match";

export const goalTypes: { type: GoalType; label: string; icon: typeof Trophy }[] = [
  { type: "normal", label: "Normal", icon: Trophy },
  { type: "head", label: "Header", icon: CircleDot },
  { type: "penalty", label: "Penalty", icon: Target },
  { type: "own-goal", label: "Own Goal", icon: AlertCircle },
];
