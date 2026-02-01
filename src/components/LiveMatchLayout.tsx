import { ReactNode } from 'react';
import { useMeasuredHeight } from '@/hooks/useMeasuredHeight';

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
  const { ref: actionsRef, height: actionsHeight } = useMeasuredHeight<HTMLDivElement>();

  return (
    <div
      className={`flex-1 flex flex-col safe-top overflow-hidden min-h-0 ${
        debug ? 'bg-red-500/10' : ''
      }`}
      style={actionsHeight ? { paddingBottom: actionsHeight } : undefined}
    >
      {header}

      <div className={debug ? 'bg-green-500/10' : ''}>{top}</div>

      <div
        className={`flex-1 p-4 overflow-hidden flex flex-col min-h-0 ${
          debug ? 'bg-orange-500/10' : ''
        }`}
      >
        <div className={`flex-1 overflow-hidden min-h-0 ${debug ? 'bg-yellow-500/10' : ''}`}>
          {timeline}
        </div>
      </div>

      <div
        ref={actionsRef}
        className={`fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-sm border-t border-border/30 px-4 pb-[env(safe-area-inset-bottom)] pt-2 ${
          debug ? 'bg-blue-500/20' : ''
        }`}
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
