import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { mapProviders } from "@/lib/map-providers";
import { Navigation } from "lucide-react";
import { useState } from "react";

export function MapRoutePicker({ location }: { location: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="mt-3 w-full hover:bg-secondary hover:text-secondary-foreground"
      >
        <Navigation className="mr-2 h-4 w-4" />
        Route
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Open in maps</SheetTitle>
            <SheetDescription>{location}</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {mapProviders.map((provider) => (
              <a
                key={provider.label}
                href={provider.buildHref(location)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-12 items-center gap-3 rounded-xl border border-border/50 px-3 py-2 text-sm font-medium hover:bg-secondary"
              >
                <img src={provider.icon} alt="" className="h-7 w-7 object-contain" />
                {provider.label}
              </a>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
