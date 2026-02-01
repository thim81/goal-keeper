import React, { ReactNode } from 'react';

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
  const timelineRef = React.useRef<HTMLDivElement>(null);
  const actionsRef = React.useRef<HTMLDivElement>(null);
  const [heights, setHeights] = React.useState({ timeline: 0, actions: 0 });

  React.useEffect(() => {
    const updateHeights = () => {
      if (timelineRef.current && actionsRef.current) {
        setHeights({
          timeline: timelineRef.current.clientHeight,
          actions: actionsRef.current.clientHeight,
        });
      }
    };
    updateHeights();
    window.addEventListener('resize', updateHeights);
    return () => window.removeEventListener('resize', updateHeights);
  }, []);

  return (
    <div
      className={`flex flex-col safe-top ${debug ? 'bg-red-500/10' : ''}`}
      style={{ height: 'calc(var(--vh, 1vh) * 100)' }}
    >
      {/* Fixed Header */}
      <div className={`flex-shrink-0 ${debug ? 'bg-blue-500/10' : ''}`}>
        {header}
      </div>

      {/* Fixed Scoreboard/Top Section */}
      <div className={`flex-shrink-0 ${debug ? 'bg-green-500/10' : ''}`}>
        {top}
      </div>

      {/* Scrollable Timeline - This grows to fill space */}
      <div
        ref={timelineRef}
        className={`flex-1 overflow-y-auto overscroll-contain p-4 relative ${debug ? 'bg-orange-500/10' : ''}`}
      >
        {debug && (
          <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded z-50">
            Timeline: {heights.timeline}px
          </div>
        )}
        {timeline}
      </div>

      {/* Fixed Actions at Bottom */}
      <div
        ref={actionsRef}
        className={`flex-shrink-0 bg-background/80 backdrop-blur-sm border-t border-border/30 px-4 pt-2 relative ${
          debug ? 'bg-purple-500/20' : ''
        }`}
        style={{
          paddingBottom: `calc(0.5rem + env(safe-area-inset-bottom, 0px))`
        }}
      >
        {debug && (
          <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded z-50">
            Actions: {heights.actions}px
          </div>
        )}
        {actionsHandle ? (
          <div className={debug ? 'bg-yellow-500/20' : ''}>{actionsHandle}</div>
        ) : null}
        {actions}
      </div>

      {children}
    </div>
  );
}
