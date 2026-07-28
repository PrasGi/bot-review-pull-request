import * as React from 'react';
import { Sidebar, SidebarProvider } from './Sidebar';
import { Header } from './Header';

type AppShellProps = {
  children: React.ReactNode;
  title?: React.ReactNode;
};

function AppShellInner({ children, title }: AppShellProps): React.ReactElement {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-6 py-6 relative z-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function AppShell({ children, title }: AppShellProps): React.ReactElement {
  return (
    <SidebarProvider>
      <AppShellInner title={title}>{children}</AppShellInner>
    </SidebarProvider>
  );
}

export { AppShell };
export type { AppShellProps };
