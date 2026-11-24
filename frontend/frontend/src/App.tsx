import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DocumentProvider } from './context/DocumentContext';
import { DashboardLayout } from './layouts/DashboardLayout';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { MyDocumentsPage } from './pages/documents/MyDocumentsPage';
import { UploadPage } from './pages/upload/UploadPage';
import { SharingPage } from './pages/sharing/SharingPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { ApprovalsPage } from './pages/approvals/ApprovalsPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { PublicSharePage } from './pages/sharing/PublicSharePage';
import { TeamWorkspacePage } from './pages/team/TeamWorkspacePage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

export default function App() {
  return (
    <AuthProvider>
      <DocumentProvider>
        <HashRouter>
          <Routes>
            {/* Authenticated Workspace with ProtectedRoute */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="documents" element={<MyDocumentsPage />} />
              <Route
                path="approvals"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'manager', 'user']}>
                    <ApprovalsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="upload" element={<UploadPage />} />
              <Route path="sharing" element={<SharingPage />} />
              <Route path="team" element={<ProtectedRoute allowedRoles={['admin', 'manager', 'user']}><TeamWorkspacePage /></ProtectedRoute>} />
              <Route path="settings" element={<SettingsPage />} />
              <Route
                path="admin"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboardPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Authentication Screens */}
            <Route path="/auth/login" element={<LoginPage />} />
            <Route path="/auth/register" element={<RegisterPage />} />
            <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
            <Route path="/s/:linkId" element={<PublicSharePage />} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </DocumentProvider>
    </AuthProvider>
  );
}
