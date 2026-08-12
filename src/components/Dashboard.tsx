import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { format, isSameDay } from 'date-fns';
import { Shift, User } from '../types';

export function Dashboard() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});

  useEffect(() => {
    // Fetch users for display names
    const fetchUsers = async () => {
      const snap = await getDocs(collection(db, 'users'));
      const usersData: Record<string, User> = {};
      snap.forEach(doc => {
        usersData[doc.id] = { id: doc.id, ...doc.data() } as User;
      });
      setUsers(usersData);
    };
    fetchUsers();

    const unsubShifts = onSnapshot(collection(db, 'shifts'), (snap) => {
      const today = new Date();
      const sfts: Shift[] = [];
      snap.forEach(doc => {
        const data = doc.data() as Shift;
        if (isSameDay(new Date(data.startTime), today)) {
          sfts.push({ id: doc.id, ...data });
        }
      });
      setShifts(sfts.sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
    });

    return () => {
      unsubShifts();
    };
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Today's Overview</h2>
      
      <div className="grid grid-cols-1 gap-6">
        {/* Shifts */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-slate-900 mb-4 border-b pb-2">Staff on Duty</h3>
          <ul className="divide-y divide-slate-200">
            {shifts.map(shift => (
              <li key={shift.id} className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-medium text-slate-900">{users[shift.userId]?.name || 'Unknown'}</p>
                  <p className="text-sm text-slate-500 capitalize">{shift.shiftType} Shift</p>
                </div>
                <div className="text-sm text-slate-600">
                  {format(new Date(shift.startTime), 'h:mm a')} - {format(new Date(shift.endTime), 'h:mm a')}
                </div>
              </li>
            ))}
            {shifts.length === 0 && <li className="text-slate-500 py-3 text-sm">No staff scheduled today.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
