import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlayerAutocomplete } from "@/components/PlayerAutocomplete";
import { SeasonStatsCard } from "@/components/SeasonStatsCard";
import { createDefaultSeasonName, type SeasonStats } from "@/lib/seasons";
import type { Season } from "@/types/match";

export interface SeasonDialogControls {
  openCloseSeason: () => void;
  openReopenSeason: (seasonId: string) => void;
  openRenameSeason: () => void;
}

interface SeasonDialogsProps {
  canEdit: boolean;
  canCloseSeason: boolean;
  canReopenSeason: boolean;
  activeSeasonStats: SeasonStats | null;
  selectedSeason?: Pick<Season, "id" | "name" | "status">;
  onCloseSeason: (name: string) => boolean;
  onReopenSeason: (seasonId: string) => boolean;
  onRenameSeason: (seasonId: string, name: string) => boolean;
  children: (controls: SeasonDialogControls) => ReactNode;
}

export function SeasonDialogs({
  canEdit,
  canCloseSeason,
  canReopenSeason,
  activeSeasonStats,
  selectedSeason,
  onCloseSeason,
  onReopenSeason,
  onRenameSeason,
  children,
}: SeasonDialogsProps) {
  const [pendingReopenSeasonId, setPendingReopenSeasonId] = useState<string | null>(null);
  const [showCloseSeason, setShowCloseSeason] = useState(false);
  const [nextSeasonName, setNextSeasonName] = useState(createDefaultSeasonName());
  const [showRenameSeason, setShowRenameSeason] = useState(false);
  const [seasonNameDraft, setSeasonNameDraft] = useState("");

  useEffect(() => {
    if (canEdit) return;
    setPendingReopenSeasonId(null);
    setShowCloseSeason(false);
    setShowRenameSeason(false);
  }, [canEdit]);

  const controls: SeasonDialogControls = {
    openCloseSeason: () => {
      setNextSeasonName(createDefaultSeasonName());
      setShowCloseSeason(true);
    },
    openReopenSeason: (seasonId) => setPendingReopenSeasonId(seasonId),
    openRenameSeason: () => {
      if (!selectedSeason) return;
      setSeasonNameDraft(selectedSeason.name);
      setShowRenameSeason(true);
    },
  };

  const confirmCloseSeason = () => {
    if (onCloseSeason(nextSeasonName)) setShowCloseSeason(false);
  };
  const confirmReopenSeason = (event: MouseEvent<HTMLButtonElement>) => {
    if (!pendingReopenSeasonId) return;
    if (onReopenSeason(pendingReopenSeasonId)) setPendingReopenSeasonId(null);
    else event.preventDefault();
  };
  const saveSeasonName = () => {
    if (!selectedSeason) return;
    if (onRenameSeason(selectedSeason.id, seasonNameDraft)) setShowRenameSeason(false);
  };

  return (
    <>
      {children(controls)}
      <AlertDialog
        open={canEdit && !!pendingReopenSeasonId}
        onOpenChange={(open) => {
          if (!open) setPendingReopenSeasonId(null);
        }}
      >
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Reopen this season?</AlertDialogTitle>
            <AlertDialogDescription>
              This will close the currently active season and mark the selected season as active.
            </AlertDialogDescription>
            {!canReopenSeason && (
              <p className="text-xs text-destructive">
                Finish the active match before reopening a season.
              </p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReopenSeason} disabled={!canReopenSeason}>
              Reopen Season
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={canEdit && showCloseSeason}
        onOpenChange={(open) => {
          setShowCloseSeason(open);
          if (!open) setNextSeasonName(createDefaultSeasonName());
        }}
      >
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Close Season</DialogTitle>
            <DialogDescription>
              Archive this season and start a new one with fresh match history.
            </DialogDescription>
          </DialogHeader>

          {activeSeasonStats && <SeasonStatsCard stats={activeSeasonStats} />}

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">New season name</label>
            <PlayerAutocomplete
              value={nextSeasonName}
              onChange={setNextSeasonName}
              players={[]}
              placeholder="Season name"
              autoFocus
            />
          </div>

          {!canCloseSeason && (
            <p className="text-xs text-destructive">
              Finish the active match before closing the season.
            </p>
          )}

          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowCloseSeason(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmCloseSeason}
              disabled={!canCloseSeason || !nextSeasonName.trim()}
            >
              Close &amp; Start New
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={canEdit && showRenameSeason}
        onOpenChange={(open) => {
          setShowRenameSeason(open);
          if (!open && selectedSeason) setSeasonNameDraft(selectedSeason.name);
        }}
      >
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Rename Season</DialogTitle>
            <DialogDescription>Long-pressing the season name opens this dialog.</DialogDescription>
          </DialogHeader>
          <PlayerAutocomplete
            value={seasonNameDraft}
            onChange={setSeasonNameDraft}
            players={[]}
            placeholder="Season name"
            autoFocus
            maxLength={80}
            onEnter={saveSeasonName}
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowRenameSeason(false)}>
              Cancel
            </Button>
            <Button onClick={saveSeasonName} disabled={!seasonNameDraft.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
