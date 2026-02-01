import { ReactNode } from 'react';

interface LiveMatchLayoutProps {
  header: ReactNode;
  top: ReactNode;
  timeline: ReactNode;
  actions: ReactNode;
  actionsHandle?: ReactNode;
  debug?: boolean;
  children?: ReactNode;
}

export function LiveMatchLayout({
  header,
  top,
  timeline,
  actions,
  actionsHandle,
  debug = false,
  children,
}: LiveMatchLayoutProps) {
  const ACTIONS_HEIGHT = 236;

  return (
    <div className={`absolute inset-0 flex flex-col safe-top ${debug ? 'bg-red-500/10' : ''}`}>
      {header}

      <div className={debug ? 'bg-green-500/10' : ''}>{top}</div>

      <div
        className={`flex-1 p-4 flex flex-col overflow-hidden ${debug ? 'bg-orange-500/10' : ''}`}
        style={{ paddingBottom: `calc(${ACTIONS_HEIGHT}px + env(safe-area-inset-bottom))` }}
      >
        <div className={`flex-1 overflow-y-auto ${debug ? 'bg-yellow-500/10' : ''}`}>
          {timeline}
        </div>
      </div>

      <div
        className={`absolute bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-sm border-t border-border/30 px-4 pt-2 ${
          debug ? 'bg-blue-500/20' : ''
        }`}
        style={{
          minHeight: ACTIONS_HEIGHT,
          paddingBottom: `calc(0.5rem + env(safe-area-inset-bottom, 0px))`
        }}
      >
        {actionsHandle ? (
          <div className={debug ? 'bg-purple-500/20' : ''}>{actionsHandle}</div>
        ) : null}
        {actions}
      </div>

      {children}
    </div>
  );
}
