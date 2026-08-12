import React, { useState } from 'react';
import { auth } from '../lib/firebase';
import { LogOut, Calendar, Clock, Users, Zap, LayoutDashboard, Menu, X, Settings, ArrowRightLeft } from 'lucide-react';
import clsx from 'clsx';

interface LayoutProps {
  children: React.ReactNode;
  currentView: string;
  onNavigate: (view: string) => void;
  role: string;
}

export function Layout({ children, currentView, onNavigate, role }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const handleLogout = () => auth.signOut();

  const navigation = [
    { name: 'Dashboard', id: 'dashboard', icon: LayoutDashboard },
    { name: 'Calendar', id: 'calendar', icon: Calendar },
    { name: 'Shift Swaps', id: 'swaps', icon: ArrowRightLeft },
    { name: 'Time Off', id: 'timeoff', icon: Clock },
    { name: 'Staff', id: 'staff', icon: Users },
    { name: 'AI Optimizer', id: 'optimizer', icon: Zap, hide: role !== 'admin' },
    { name: 'Settings', id: 'settings', icon: Settings, hide: role !== 'admin' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex overflow-hidden">
      {/* Mobile sidebar backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/80 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={clsx(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 flex-shrink-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200">
          <h1 className="text-xl font-bold text-indigo-600">VetSched</h1>
          <button 
            onClick={() => setIsSidebarOpen(false)} 
            className="md:hidden text-slate-500 hover:text-slate-700"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navigation.map((item) => (
            !item.hide && (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setIsSidebarOpen(false);
                }}
                className={clsx(
                  currentView === item.id
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                  'group flex w-full items-center px-2 py-2 text-sm font-medium rounded-md'
                )}
              >
                <item.icon
                  className={clsx(
                    currentView === item.id ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500',
                    'mr-3 flex-shrink-0 h-5 w-5'
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </button>
            )
          ))}
        </nav>
        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-900 capitalize">{role}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <LogOut className="mr-3 h-5 w-5 text-slate-400" />
            Sign out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden flex items-center h-16 px-4 bg-white border-b border-slate-200">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 mr-2 text-slate-500 hover:text-slate-700 focus:outline-none"
          >
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold text-indigo-600">VetSched</h1>
        </div>

        <main className="flex-1 overflow-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
