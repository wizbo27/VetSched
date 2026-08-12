import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User as AuthUser } from 'firebase/auth';
import { TimeOffRequest, User } from '../types';
import { CheckCircle2, XCircle, Trash2, Clock, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';

interface TimeOffProps {
  currentUser: AuthUser;
  role: string;
}

export function TimeOff({ currentUser, role }: TimeOffProps) {
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch users so we can display their names
    const fetchUsers = async () => {
      const snap = await getDocs(collection(db, 'users'));
      const usersData: Record<string, User> = {};
      snap.forEach((d) => {
        usersData[d.id] = { id: d.id, ...d.data() } as User;
      });
      setUsers(usersData);
    };
    fetchUsers();

    // Query Time Off Requests
    let q = query(collection(db, 'timeOffRequests'));
    if (role !== 'admin') {
      q = query(collection(db, 'timeOffRequests'), where('userId', '==', currentUser.uid));
    }

    const unsub = onSnapshot(q, (snap) => {
      const reqs = snap.docs.map(d => ({ id: d.id, ...d.data() } as TimeOffRequest));
      setRequests(reqs.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()));
    }, (err) => {
      console.error("Error fetching time off requests:", err);
    });

    return () => unsub();
  }, [currentUser.uid, role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate || !reason) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await addDoc(collection(db, 'timeOffRequests'), {
        userId: currentUser.uid,
        startDate,
        endDate,
        reason,
        status: 'pending'
      });
      setStartDate('');
      setEndDate('');
      setReason('');
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'timeOffRequests', id), { status });
    } catch (err: any) {
      console.error(err);

    }
  };

  const handleDelete = async (id: string) => {

    try {
      await deleteDoc(doc(db, 'timeOffRequests', id));
    } catch (err: any) {
      console.error(err);

    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Time Off Requests</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Request Form */}
        <div className="bg-white rounded-lg shadow p-6 lg:col-span-1 h-fit">
          <h3 className="text-lg font-medium text-slate-900 mb-4 border-b pb-2 flex items-center">
            <Calendar className="mr-2 h-5 w-5 text-slate-400" />
            Request Time Off
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
            
            <div>
              <label className="block text-sm font-medium text-slate-700">Start Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700">End Date</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700">Reason</label>
              <textarea
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                placeholder="Why do you need time off?"
              />
            </div>
            
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>
        </div>

        {/* Requests List */}
        <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
          <h3 className="text-lg font-medium text-slate-900 mb-4 border-b pb-2">
            {role === 'admin' ? 'All Requests' : 'Your Requests'}
          </h3>
          
          <div className="space-y-4">
            {requests.length === 0 ? (
              <p className="text-sm text-slate-500">No time off requests found.</p>
            ) : (
              requests.map((req) => (
                <div key={req.id} className="border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-900">
                        {role === 'admin' ? (users[req.userId]?.name || 'Unknown User') : 'You'}
                      </span>
                      <span className={clsx(
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize',
                        req.status === 'approved' ? 'bg-green-100 text-green-800' :
                        req.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      )}>
                        {req.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                        {req.status === 'approved' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                        {req.status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
                        {req.status}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600">
                      {format(new Date(req.startDate + 'T00:00:00'), 'MMM d, yyyy')} - {format(new Date(req.endDate + 'T00:00:00'), 'MMM d, yyyy')}
                    </div>
                    <div className="text-sm text-slate-500 italic">
                      "{req.reason}"
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    {role === 'admin' && req.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(req.id, 'approved')}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                          title="Approve"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(req.id, 'rejected')}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Reject"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </>
                    )}
                    {req.userId === currentUser.uid && req.status === 'pending' && (
                      <button
                        onClick={() => handleDelete(req.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Delete Request"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
