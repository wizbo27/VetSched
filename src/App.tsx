/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Auth } from './components/Auth';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { CalendarView } from './components/CalendarView';
import { AIOptimizer } from './components/AIOptimizer';
import { TimeOff } from './components/TimeOff';
import { ShiftSwaps } from './components/ShiftSwaps';
import { StaffDirectory } from './components/StaffDirectory';
import { Settings } from './components/Settings';
import { User } from 'firebase/auth';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string>('staff');
  const [currentView, setCurrentView] = useState('dashboard');

  const handleLogin = (u: User, r: string) => {
    setUser(u);
    setRole(r);
  };

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <Layout currentView={currentView} onNavigate={setCurrentView} role={role}>
      {currentView === 'dashboard' && <Dashboard />}
      {currentView === 'calendar' && <CalendarView role={role} />}
      {currentView === 'optimizer' && <AIOptimizer />}
      {currentView === 'timeoff' && <TimeOff currentUser={user} role={role} />}
      {currentView === 'swaps' && <ShiftSwaps currentUser={user} role={role} />}
      {currentView === 'staff' && <StaffDirectory role={role} />}
      {currentView === 'settings' && <Settings role={role} />}
    </Layout>
  );
}

