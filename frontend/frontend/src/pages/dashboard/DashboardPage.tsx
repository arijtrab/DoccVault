import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { AdminDashboardPage } from '../admin/AdminDashboardPage';
import { ManagerDashboardView } from './ManagerDashboardView';
import { UserDashboardView } from './UserDashboardView';

export const DashboardPage: React.FC = () => {
  const { role } = useAuth();

  if (role === 'admin') {
    return <AdminDashboardPage />;
  }

  if (role === 'manager') {
    return <ManagerDashboardView />;
  }

  return <UserDashboardView />;
};
