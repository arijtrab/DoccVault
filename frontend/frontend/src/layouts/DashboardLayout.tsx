import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/navigation/Sidebar';
import { Navbar } from '../components/navigation/Navbar';
import { ToastContainer } from '../components/common/ToastContainer';
import { DocumentPreviewModal } from '../components/documents/DocumentPreviewModal';
import { ShareModal } from '../components/documents/ShareModal';
import { AuditLogsModal } from '../components/documents/AuditLogsModal';

export const DashboardLayout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
      {/* Sidebar */}
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <Navbar onToggleMobileSidebar={() => setMobileOpen(!mobileOpen)} />
        
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Global Modals & Notifications */}
      <DocumentPreviewModal />
      <ShareModal />
      <AuditLogsModal />
      <ToastContainer />
    </div>
  );
};
