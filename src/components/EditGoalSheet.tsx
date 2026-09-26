import { useState } from "react";
import { Trophy, CircleDot, Target, AlertCircle } from "lucide-react";
import { Goal, GoalEdit, GoalType } from "@/types/match";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { Button } from "./ui/button";
import { PlayerAutocomplete } from "./PlayerAutocomplete";

const goalTypes: { type: GoalType; label: string; icon: typeof Trophy }[] = [
  { type: "normal", label: "Normal", icon: Trophy },
  { type: "head", label: "Header", icon: CircleDot },
  { type: "penalty", label: "Penalty", icon: Target },
  { type: "own-goal", label: "Own Goal", icon: AlertCircle },
];

interface EditGoalSheetProps {
  goal: Goal;
  knownPlayers: string[];
  onClose: () => void;
  onSave: (id: string, changes: GoalEdit) => void;
}

export function EditGoalSheet({
  goal,
  knownPlayers,
  onClose,
  onSave,
}: EditGoalSheetProps) {
  const team = goal.team;
  const isMyTeam = team === "my-team";
  const selectedTypeClass = isMyTeam
    ? "border-primary bg-primary/10 text-primary"
    : "border-accent bg-accent/10 text-accent";
  const [scorer, setScorer] = useState(goal.scorer ?? "");
  const [assist, setAssist] = useState(goal.assist ?? "");
  const [type, setType] = useState(goal.type);
  const [time, setTime] = useState(goal.time);
  const validTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time);

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="bottom"
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="mx-auto max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-3xl bg-card safe-bottom"
      >
        <SheetHeader>
          <SheetTitle>Edit goal</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          {team === "my-team" && (
            <>
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">Scorer</div>
                <PlayerAutocomplete
                  value={scorer}
                  onChange={setScorer}
                  players={knownPlayers}
                  placeholder="Who scored?"
                />
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  Assist (optional)
                </div>
                <PlayerAutocomplete
                  value={assist}
                  onChange={setAssist}
                  players={knownPlayers}
                  placeholder="Who assisted?"
                />
              </div>
            </>
          )}
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-2">Goal type</div>
            <div className="grid grid-cols-4 gap-2" role="group" aria-label="Goal type">
              {goalTypes.map(({ type: value, label, icon: Icon }) => (
                <button
                  key={value}
                  aria-pressed={type === value}
                  onClick={() => setType(value)}
                  className={`flex flex-col items-center gap-2 p-2 rounded-lg border-2 ${type === value ? selectedTypeClass : "border-border bg-secondary text-muted-foreground"}`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs">{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label
              htmlFor="edit-goal-time"
              className="text-sm font-medium text-muted-foreground mb-2 block"
            >
              Time
            </label>
            <input
              id="edit-goal-time"
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className={`h-10 w-36 rounded-lg bg-secondary px-3 text-base text-foreground focus:outline-none focus:ring-2 ${isMyTeam ? "focus:ring-primary" : "focus:ring-accent"}`}
            />
          </div>
          <div className="flex gap-2">
            <Button
              className={`flex-1 ${isMyTeam ? "" : "bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent"}`}
              disabled={!validTime}
              onClick={() => {
                onSave(goal.id, {
                  team,
                  scorer: team === "my-team" ? scorer.trim() : undefined,
                  assist: team === "my-team" ? assist.trim() : undefined,
                  type,
                  time,
                });
                onClose();
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
