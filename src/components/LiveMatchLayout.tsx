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
  const containerRef = React.useRef<HTMLDivElement>(null);
  const timelineRef = React.useRef<HTMLDivElement>(null);
  const actionsRef = React.useRef<HTMLDivElement>(null);
  const [info, setInfo] = React.useState({
    timeline: 0,
    actions: 0,
    containerHeight: 0,
    windowHeight: 0,
    vh: 0,
    safeAreaBottom: 0
  });

  React.useEffect(() => {
    const updateHeights = () => {
      if (timelineRef.current && actionsRef.current && containerRef.current) {
        // Get safe-area-inset-bottom value
        const safeAreaBottom = parseInt(
          getComputedStyle(document.documentElement)
            .getPropertyValue('env(safe-area-inset-bottom, 0px)')
            .replace('px', '')
        ) || 0;

        // Get --vh value
        const vh = parseFloat(
          getComputedStyle(document.documentElement)
            .getPropertyValue('--vh')
            .replace('px', '')
        ) || 0;

        setInfo({
          timeline: timelineRef.current.clientHeight,
          actions: actionsRef.current.clientHeight,
          containerHeight: containerRef.current.clientHeight,
          windowHeight: window.innerHeight,
          vh: vh * 100,
          safeAreaBottom
        });
      }
    };
    updateHeights();
    window.addEventListener('resize', updateHeights);
    return () => window.removeEventListener('resize', updateHeights);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`flex flex-col safe-top ${debug ? 'bg-red-500/10' : ''}`}
      style={{ height: 'calc(var(--vh, 1vh) * 100)' }}
    >
      {/* Debug overlay */}
      {debug && (
        <div className="fixed top-16 left-2 bg-black/90 text-white text-[10px] px-2 py-1 rounded z-50 font-mono max-w-[200px]">
          <div>Window: {info.windowHeight}px</div>
          <div>VH Calc: {info.vh.toFixed(0)}px</div>
          <div>Container: {info.containerHeight}px</div>
          <div>Timeline: {info.timeline}px</div>
          <div>Actions: {info.actions}px</div>
          <div>Safe Bottom: {info.safeAreaBottom}px</div>
        </div>
      )}

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
        {actionsHandle ? (
          <div className={debug ? 'bg-yellow-500/20' : ''}>{actionsHandle}</div>
        ) : null}
        {actions}
      </div>

      {children}
    </div>
  );
}
