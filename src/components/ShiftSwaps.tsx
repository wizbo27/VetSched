import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ShiftSwap, Shift, User } from '../types';
import { format } from 'date-fns';
import { ArrowRightLeft, CheckCircle2, XCircle, Trash2, Clock } from 'lucide-react';
import clsx from 'clsx';

export function ShiftSwaps({ currentUser, role }: { currentUser: any, role: string }) {
  const [swaps, setSwaps] = useState<ShiftSwap[]>([]);
  const [shifts, setShifts] = useState<Record<string, Shift>>({});
  const [users, setUsers] = useState<Record<string, User>>({});
  
  const [myUpcomingShifts, setMyUpcomingShifts] = useState<Shift[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [selectedTargetUserId, setSelectedTargetUserId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch users
    const fetchUsers = async () => {
      const snap = await getDocs(collection(db, 'users'));
      const uMap: Record<string, User> = {};
      snap.forEach(d => {
        uMap[d.id] = { id: d.id, ...d.data() } as User;
      });
      setUsers(uMap);
    };
    fetchUsers();

    // Fetch all future shifts for contextual display and my upcoming shifts
    const unsubShifts = onSnapshot(collection(db, 'shifts'), (snap) => {
      const sMap: Record<string, Shift> = {};
      const myUpcoming: Shift[] = [];
      const now = new Date().getTime();
      
      snap.docs.forEach(doc => {
        const s = { id: doc.id, ...doc.data() } as Shift;
        sMap[s.id] = s;
        if (s.userId === currentUser.uid && new Date(s.startTime).getTime() > now) {
          myUpcoming.push(s);
        }
      });
      setShifts(sMap);
      setMyUpcomingShifts(myUpcoming.sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
    });

    // Fetch Swaps
    const unsubSwaps = onSnapshot(collection(db, 'shiftSwaps'), (snap) => {
      const allSwaps = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShiftSwap));
      setSwaps(allSwaps.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });

    return () => {
      unsubShifts();
      unsubSwaps();
    };
  }, [currentUser.uid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShiftId || !selectedTargetUserId) return;
    setIsSubmitting(true);
    setError(null);

    try {
      await addDoc(collection(db, 'shiftSwaps'), {
        shiftId: selectedShiftId,
        requestingUserId: currentUser.uid,
        targetUserId: selectedTargetUserId,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      setSelectedShiftId('');
      setSelectedTargetUserId('');
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (swapId: string, status: 'accepted_by_target' | 'approved' | 'rejected', shiftId?: string, targetUserId?: string) => {
    try {
      await updateDoc(doc(db, 'shiftSwaps', swapId), { status });
      
      // If admin approved, actually swap the shift
      if (status === 'approved' && shiftId && targetUserId) {
        await updateDoc(doc(db, 'shifts', shiftId), { userId: targetUserId });
      }
    } catch (err: any) {
      console.error(err);

    }
  };

  const handleDelete = async (id: string) => {

    try {
      await deleteDoc(doc(db, 'shiftSwaps', id));
    } catch (err: any) {
      console.error(err);

    }
  };

  const displaySwaps = role === 'admin' ? swaps : swaps.filter(s => s.requestingUserId === currentUser.uid || s.targetUserId === currentUser.uid);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Shift Swaps</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Request Form (Only if staff) */}
        <div className="bg-white rounded-lg shadow p-6 lg:col-span-1 h-fit">
          <h3 className="text-lg font-medium text-slate-900 mb-4 border-b pb-2 flex items-center">
            <ArrowRightLeft className="mr-2 h-5 w-5 text-slate-400" />
            Request Shift Swap
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
            
            <div>
              <label className="block text-sm font-medium text-slate-700">Select Shift to Give Away</label>
              <select
                required
                value={selectedShiftId}
                onChange={(e) => setSelectedShiftId(e.target.value)}
                className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              >
                <option value="">-- Select Shift --</option>
                {myUpcomingShifts.map(s => (
                  <option key={s.id} value={s.id}>
                    {format(new Date(s.startTime), 'MMM d')} ({format(new Date(s.startTime), 'h:mma')} - {s.shiftType})
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700">Request Coverage From</label>
              <select
                required
                value={selectedTargetUserId}
                onChange={(e) => setSelectedTargetUserId(e.target.value)}
                className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              >
                <option value="">-- Select Co-worker --</option>
                {Object.values(users).filter((u: User) => u.id !== currentUser.uid).map((u: User) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>
            
            <button
              type="submit"
              disabled={isSubmitting || myUpcomingShifts.length === 0}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Request Swap'}
            </button>
            {myUpcomingShifts.length === 0 && (
              <p className="text-xs text-slate-500 text-center mt-2">You have no upcoming shifts to swap.</p>
            )}
          </form>
        </div>

        {/* Swaps List */}
        <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
          <h3 className="text-lg font-medium text-slate-900 mb-4 border-b pb-2">
            {role === 'admin' ? 'All Swap Requests' : 'Your Swap Activity'}
          </h3>
          
          <div className="space-y-4">
            {displaySwaps.length === 0 ? (
              <p className="text-sm text-slate-500">No shift swap requests found.</p>
            ) : (
              displaySwaps.map((swap) => {
                const shift = shifts[swap.shiftId];
                if (!shift) return null; // shift might have been deleted

                const isRequesting = swap.requestingUserId === currentUser.uid;
                const isTarget = swap.targetUserId === currentUser.uid;
                
                return (
                  <div key={swap.id} className="border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-900">
                          {users[swap.requestingUserId]?.name} wants to give shift to {users[swap.targetUserId]?.name}
                        </span>
                        <span className={clsx(
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize',
                          swap.status === 'approved' ? 'bg-green-100 text-green-800' :
                          swap.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          swap.status === 'accepted_by_target' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        )}>
                          {swap.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                          {swap.status === 'accepted_by_target' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                          {swap.status === 'approved' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                          {swap.status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
                          {swap.status === 'accepted_by_target' ? 'Pending Admin' : swap.status}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600">
                        <span className="font-medium">Shift:</span> {format(new Date(shift.startTime), 'MMM d, yyyy')} from {format(new Date(shift.startTime), 'h:mm a')} to {format(new Date(shift.endTime), 'h:mm a')}
                      </div>
                      <div className="text-xs text-slate-500">
                        Requested on {format(new Date(swap.createdAt), 'MMM d, yyyy p')}
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      {/* Target User Actions */}
                      {isTarget && swap.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(swap.id, 'accepted_by_target')}
                            className="text-sm bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-md hover:bg-indigo-100 font-medium transition-colors"
                          >
                            Accept Cover
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(swap.id, 'rejected')}
                            className="text-sm bg-red-50 text-red-700 px-3 py-1.5 rounded-md hover:bg-red-100 font-medium transition-colors"
                          >
                            Decline
                          </button>
                        </>
                      )}

                      {/* Requesting User Actions (Cancel) */}
                      {isRequesting && swap.status === 'pending' && (
                        <button
                          onClick={() => handleDelete(swap.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Cancel Request"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}

                      {/* Admin Actions */}
                      {role === 'admin' && swap.status === 'accepted_by_target' && (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(swap.id, 'approved', swap.shiftId, swap.targetUserId)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                            title="Approve Swap"
                          >
                            <CheckCircle2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(swap.id, 'rejected')}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Reject Swap"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        </>
                      )}
                      
                      {/* Admin Override Action (Can approve even if pending) */}
                      {role === 'admin' && swap.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(swap.id, 'approved', swap.shiftId, swap.targetUserId)}
                            className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded hover:bg-slate-200"
                            title="Force Approve"
                          >
                            Force Approve
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(swap.id, 'rejected')}
                            className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded hover:bg-red-100"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
