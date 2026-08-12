import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User } from '../types';
import { UserPlus, Trash2, Edit2, Check, X } from 'lucide-react';
import clsx from 'clsx';

interface StaffDirectoryProps {
  role: string;
}

export function StaffDirectory({ role }: StaffDirectoryProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [userRole, setUserRole] = useState<'admin' | 'doctor' | 'tech' | 'staff'>('staff');
  const [minWeeklyHours, setMinWeeklyHours] = useState<string>('40');
  const [minRestHours, setMinRestHours] = useState<string>('8');
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'doctor' | 'tech' | 'staff'>('staff');
  const [editMinWeeklyHours, setEditMinWeeklyHours] = useState<string>('');
  const [editMinRestHours, setEditMinRestHours] = useState<string>('8');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const u = snap.docs.map(d => ({ id: d.id, ...d.data() } as User));
      setUsers(u.sort((a, b) => a.name.localeCompare(b.name)));
    });
    return () => unsub();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role !== 'admin') return;
    setError(null);
    try {
      await addDoc(collection(db, 'users'), {
        email,
        name,
        role: userRole,
        minWeeklyHours: Number(minWeeklyHours) || 0,
        minRestHours: Number(minRestHours) || 0
      });
      setEmail('');
      setName('');
      setUserRole('staff');
      setMinWeeklyHours('40');
      setMinRestHours('8');
      setIsAdding(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (role !== 'admin') return;
    try {
      await deleteDoc(doc(db, 'users', id));
    } catch (err: any) {
      console.error(err);

    }
  };

  const startEdit = (user: User) => {
    setEditingId(user.id);
    setEditName(user.name);
    setEditRole(user.role);
    setEditMinWeeklyHours(user.minWeeklyHours !== undefined ? String(user.minWeeklyHours) : '40');
    setEditMinRestHours(user.minRestHours !== undefined ? String(user.minRestHours) : '8');
  };

  const saveEdit = async (id: string) => {
    try {
      await updateDoc(doc(db, 'users', id), {
        name: editName,
        role: editRole,
        minWeeklyHours: Number(editMinWeeklyHours) || 0,
        minRestHours: Number(editMinRestHours) || 0
      });
      setEditingId(null);
    } catch (err: any) {
      console.error(err);

    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Staff Directory</h2>
        {role === 'admin' && (
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            {isAdding ? <X className="h-4 w-4 mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
            {isAdding ? 'Cancel' : 'Add Staff'}
          </button>
        )}
      </div>

      {isAdding && role === 'admin' && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-medium text-slate-900 mb-4 border-b pb-2">Manually Add Staff</h3>
          <form onSubmit={handleAdd} className="space-y-4 max-w-2xl">
            {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                  placeholder="jane@clinic.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Role</label>
                <select
                  value={userRole}
                  onChange={(e: any) => setUserRole(e.target.value)}
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                >
                  <option value="staff">Staff</option>
                  <option value="tech">Technician</option>
                  <option value="doctor">Doctor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Min Hrs/Wk</label>
                <input
                  type="number"
                  min="0"
                  max="168"
                  required
                  value={minWeeklyHours}
                  onChange={(e) => setMinWeeklyHours(e.target.value)}
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                  placeholder="40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Min Rest (Hrs)</label>
                <input
                  type="number"
                  min="0"
                  max="168"
                  required
                  value={minRestHours}
                  onChange={(e) => setMinRestHours(e.target.value)}
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                  placeholder="8"
                />
              </div>
            </div>
            
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Save Member
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Name
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Email
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Role
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Min Hrs/Wk
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Min Rest Window (Hrs)
              </th>
              {role === 'admin' && (
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === u.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border"
                    />
                  ) : (
                    <div className="text-sm font-medium text-slate-900">{u.name}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-slate-500">{u.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === u.id ? (
                    <select
                      value={editRole}
                      onChange={(e: any) => setEditRole(e.target.value)}
                      className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border"
                    >
                      <option value="staff">Staff</option>
                      <option value="tech">Technician</option>
                      <option value="doctor">Doctor</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span className={clsx(
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize',
                      u.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                      u.role === 'doctor' ? 'bg-blue-100 text-blue-800' :
                      u.role === 'tech' ? 'bg-green-100 text-green-800' :
                      'bg-slate-100 text-slate-800'
                    )}>
                      {u.role}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === u.id ? (
                    <input
                      type="number"
                      min="0"
                      max="168"
                      value={editMinWeeklyHours}
                      onChange={(e) => setEditMinWeeklyHours(e.target.value)}
                      className="block w-24 rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border"
                    />
                  ) : (
                    <div className="text-sm text-slate-500">{u.minWeeklyHours ?? 'N/A'}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === u.id ? (
                    <input
                      type="number"
                      min="0"
                      max="168"
                      value={editMinRestHours}
                      onChange={(e) => setEditMinRestHours(e.target.value)}
                      className="block w-24 rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border"
                    />
                  ) : (
                    <div className="text-sm text-slate-500">{u.minRestHours ?? 'N/A'}</div>
                  )}
                </td>
                {role === 'admin' && (
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {editingId === u.id ? (
                      <div className="flex justify-end space-x-2">
                        <button onClick={() => saveEdit(u.id)} className="text-green-600 hover:text-green-900">
                          <Check className="h-5 w-5" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600">
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end space-x-3">
                        <button onClick={() => startEdit(u)} className="text-indigo-600 hover:text-indigo-900">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(u.id)} className="text-red-600 hover:text-red-900">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
