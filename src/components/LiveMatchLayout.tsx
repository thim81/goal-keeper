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
  return (
    <div className={`min-h-screen flex flex-col safe-top overflow-hidden ${debug ? 'bg-red-500/10' : ''}`}>
      {/* Fixed Header */}
      <div className={`flex-shrink-0 ${debug ? 'bg-blue-500/10' : ''}`}>
        {header}
      </div>

      {/* Fixed Scoreboard/Top Section */}
      <div className={`flex-shrink-0 ${debug ? 'bg-green-500/10' : ''}`}>
        {top}
      </div>

      {/* Scrollable Timeline - This grows to fill space */}
      <div className={`flex-1 overflow-y-auto overscroll-contain p-4 ${debug ? 'bg-orange-500/10' : ''}`}>
        {timeline}
      </div>

      {/* Fixed Actions at Bottom */}
      <div
        className={`flex-shrink-0 bg-background/80 backdrop-blur-sm border-t border-border/30 px-4 pt-2 ${
          debug ? 'bg-purple-500/20' : ''
        }`}
        style={{
          paddingBottom: `calc(0.5rem + env(safe-area-inset-bottom, 0px))`
        }}
      >
        {actionsHandle ? (
          <div className={debug ? 'bg-yellow-500/20' : ''}>{actionsHandle}</div>
        ) : null}
        {actions}
      </div>

      {children}
    </div>
  );
}
