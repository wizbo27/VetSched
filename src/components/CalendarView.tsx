import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, addDoc, getDocs, deleteDoc, doc, getDoc, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths, isSameMonth, addDays, subDays } from 'date-fns';
import { Shift, User, ShiftTemplate, TimeOffRequest } from '../types';
import { CalendarPlus, Trash2, X, List, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Filter, Wand2 } from 'lucide-react';
import clsx from 'clsx';

export function CalendarView({ role }: { role: string }) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  
  const [isAdding, setIsAdding] = useState(false);
  const [userId, setUserId] = useState('');
  const [shiftDate, setShiftDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [shiftType, setShiftType] = useState('');
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto Schedule states
  const [isAutoScheduleOpen, setIsAutoScheduleOpen] = useState(false);
  const [autoStartDate, setAutoStartDate] = useState('');
  const [autoEndDate, setAutoEndDate] = useState('');
  const [isAutoScheduling, setIsAutoScheduling] = useState(false);
  const [autoScheduleError, setAutoScheduleError] = useState<string | null>(null);

  // New states for view and filtering
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [roleFilter, setRoleFilter] = useState('all');
  
  // Date states
  const [listDate, setListDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  useEffect(() => {
    const fetchUsers = async () => {
      const snap = await getDocs(collection(db, 'users'));
      const uMap: Record<string, User> = {};
      let firstUserId = '';
      snap.forEach(d => {
        uMap[d.id] = { id: d.id, ...d.data() } as User;
        if (!firstUserId) firstUserId = d.id;
      });
      setUsers(uMap);
      if (firstUserId) setUserId(firstUserId);
    };
    fetchUsers();

    const fetchTemplates = async () => {
      const snap = await getDocs(collection(db, 'shiftTemplates'));
      const tMap = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShiftTemplate));
      setTemplates(tMap);
    };
    fetchTemplates();

    const unsubShifts = onSnapshot(collection(db, 'shifts'), (snap) => {
      const s = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shift));
      setShifts(s.sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
    });

    return () => unsubShifts();
  }, []);

  const handleAddShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !shiftDate || !startTime || !endTime || !shiftType) return;
    
    setIsSubmitting(true);
    setError(null);
    try {
      const startIso = new Date(`${shiftDate}T${startTime}`).toISOString();
      const endIso = new Date(`${shiftDate}T${endTime}`).toISOString();

      await addDoc(collection(db, 'shifts'), {
        userId,
        startTime: startIso,
        endTime: endIso,
        shiftType
      });
      
      setShiftDate('');
      setStartTime('');
      setEndTime('');
      setShiftType('');
      setIsAdding(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!autoStartDate || !autoEndDate) return;
    
    setIsAutoScheduling(true);
    setAutoScheduleError(null);
    
    try {
      // 1. Fetch settings (operating hours)
      const settingsSnap = await getDoc(doc(db, 'settings', 'general'));
      const settings = settingsSnap.exists() ? settingsSnap.data() : { is24Hours: true, openTime: '08:00', closeTime: '18:00' };

      // 2. Fetch approved time off
      const toSnap = await getDocs(query(collection(db, 'timeOffRequests'), where('status', '==', 'approved')));
      const timeOffs = toSnap.docs.map(d => d.data() as TimeOffRequest);

      // 3. Track assigned minutes for this generation step
      const userMinutes: Record<string, number> = {};
      Object.keys(users).forEach(uid => userMinutes[uid] = 0);
      
      // Calculate minutes for already scheduled shifts
      shifts.forEach(s => {
         const diff = new Date(s.endTime).getTime() - new Date(s.startTime).getTime();
         if (diff > 0 && userMinutes[s.userId] !== undefined) {
            userMinutes[s.userId] += diff / (1000 * 60);
         }
      });

      const startD = new Date(autoStartDate + 'T00:00:00');
      const endD = new Date(autoEndDate + 'T00:00:00');
      if (endD < startD) throw new Error('End date must be after start date');

      const days = eachDayOfInterval({ start: startD, end: endD });
      const newShifts: any[] = [];
      const batch = writeBatch(db);

      for (const day of days) {
        for (const template of templates) {
           // Skip if template is outside open hours (only check if NOT 24 hours)
           if (!settings.is24Hours) {
              if (template.startTime < (settings.openTime || '08:00') || template.endTime > (settings.closeTime || '18:00')) {
                 continue; // Shift doesn't fit standard operating hours
              }
           }
           
           const rolesNeeded = template.requiredRoles || { staff: 1 };

           for (const [roleName, requiredCount] of Object.entries(rolesNeeded)) {
             const reqCount = requiredCount as number;
             if (reqCount <= 0) continue;

             // Find how many we already have scheduled for this role, shift type, and day
             const alreadyScheduledCount = [...shifts, ...newShifts].filter(s => 
                s.shiftType === template.name && 
                isSameDay(new Date(s.startTime), day) &&
                users[s.userId]?.role === roleName
             ).length;

             let needed = reqCount - alreadyScheduledCount;

             while (needed > 0) {
               let bestUser = null;
               let minHoursDiff = Infinity;

               // Find the best user of this role
               for (const user of Object.values(users) as User[]) {
                 if (user.role !== roleName) continue;

                 // Skip users on approved time off today
                 const isOnTimeOff = timeOffs.some(to => {
                    if (to.userId !== user.id) return false;
                    const toStart = new Date(to.startDate + 'T00:00:00');
                    const toEnd = new Date(to.endDate + 'T23:59:59');
                    return day >= toStart && day <= toEnd;
                 });
                 if (isOnTimeOff) continue;

                 let tStart = new Date(`${format(day, 'yyyy-MM-dd')}T${template.startTime}`).getTime();
                 let tEnd = new Date(`${format(day, 'yyyy-MM-dd')}T${template.endTime}`).getTime();
                 if (tEnd <= tStart) tEnd += 24 * 60 * 60 * 1000; // Handle overnight shifts
                 
                 // Check if user is ALREADY scheduled for THIS exact shift
                 const alreadyInThisShift = [...shifts, ...newShifts].some(s => 
                   s.userId === user.id && s.shiftType === template.name && isSameDay(new Date(s.startTime), day)
                 );
                 if (alreadyInThisShift) continue;

                 const restMillis = (user.minRestHours || 0) * 60 * 60 * 1000;

                 // Check if user is already scheduled overlapping this time or violating rest window
                 const hasOverlap = [...shifts, ...newShifts].some(s => {
                    if (s.userId !== user.id) return false;
                    const sStart = new Date(s.startTime).getTime();
                    const sEnd = new Date(s.endTime).getTime();
                    
                    if (tStart < sEnd && tEnd > sStart) return true;
                    if (tStart >= sEnd && (tStart - sEnd) < restMillis) return true;
                    if (tEnd <= sStart && (sStart - tEnd) < restMillis) return true;
                    
                    return false;
                 });
                 if (hasOverlap) continue;

                 // Check hours constraint
                 const targetMinutes = (user.minWeeklyHours || 40) * 60;
                 const currentMinutes = userMinutes[user.id];
                 const deficit = currentMinutes - targetMinutes;

                 if (deficit < minHoursDiff) {
                    minHoursDiff = deficit;
                    bestUser = user;
                 }
               }

               if (bestUser) {
                 let tStart = new Date(`${format(day, 'yyyy-MM-dd')}T${template.startTime}`).getTime();
                 let tEnd = new Date(`${format(day, 'yyyy-MM-dd')}T${template.endTime}`).getTime();
                 if (tEnd <= tStart) tEnd += 24 * 60 * 60 * 1000;
                 
                 const duration = (tEnd - tStart) / (1000 * 60);
                 userMinutes[bestUser.id] += duration;
                 
                 const docRef = doc(collection(db, 'shifts'));
                 const shiftData = {
                   userId: bestUser.id,
                   shiftType: template.name,
                   startTime: new Date(tStart).toISOString(),
                   endTime: new Date(tEnd).toISOString()
                 };
                 newShifts.push(shiftData);
                 batch.set(docRef, shiftData);
                 needed--;
               } else {
                 // No one available for this role, stop trying to fill the remaining slots to prevent infinite loop
                 break;
               }
             }
           }
        }
      }

      if (newShifts.length > 0) {
        await batch.commit();
        setIsAutoScheduleOpen(false);
        setAutoStartDate('');
        setAutoEndDate('');
      } else {
        setAutoScheduleError('No shifts could be scheduled. Check templates, open hours, and staff availability.');
      }

    } catch (err: any) {
      console.error(err);
      setAutoScheduleError(err.message);
    } finally {
      setIsAutoScheduling(false);
    }
  };

  const handleDelete = async (id: string) => {

    try {
      await deleteDoc(doc(db, 'shifts', id));
    } catch (err: any) {
      console.error(err);

    }
  };

  const filteredShifts = shifts.filter(s => {
    if (roleFilter === 'all') return true;
    return users[s.userId]?.role === roleFilter;
  });

  const listShifts = filteredShifts.filter(s => isSameDay(new Date(s.startTime), listDate));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  return (
    <div className="bg-white rounded-lg shadow min-h-[600px] p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-slate-900">Schedule</h2>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('list')}
              className={clsx(
                "p-1.5 rounded-md transition-colors flex items-center gap-2 text-sm font-medium",
                viewMode === 'list' ? "bg-white shadow text-indigo-600" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={clsx(
                "p-1.5 rounded-md transition-colors flex items-center gap-2 text-sm font-medium",
                viewMode === 'calendar' ? "bg-white shadow text-indigo-600" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <CalendarIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Calendar</span>
            </button>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center mr-2 bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5">
            <Filter className="w-4 h-4 text-slate-400 mr-2" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-transparent border-none text-sm font-medium text-slate-700 focus:ring-0 p-0"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admins</option>
              <option value="doctor">Doctors</option>
              <option value="tech">Technicians</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          
          {role === 'admin' && (
            <>
              <button
                onClick={() => {
                  setIsAutoScheduleOpen(!isAutoScheduleOpen);
                  setIsAdding(false);
                }}
                className="flex items-center px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50"
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Auto Schedule
              </button>
              <button
                onClick={() => {
                  setIsAdding(!isAdding);
                  setIsAutoScheduleOpen(false);
                }}
                className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
              >
                {isAdding ? <X className="h-4 w-4 mr-2" /> : <CalendarPlus className="h-4 w-4 mr-2" />}
                {isAdding ? 'Cancel' : 'Add Shift'}
              </button>
            </>
          )}
        </div>
      </div>
      
      {isAutoScheduleOpen && role === 'admin' && (
        <div className="bg-indigo-50 rounded-lg p-6 mb-8 border border-indigo-200">
          <h3 className="text-lg font-medium text-indigo-900 mb-2 border-b border-indigo-200 pb-2">Auto Schedule Shifts</h3>
          <p className="text-sm text-indigo-700 mb-4">
            Automatically assign shifts for a date range based on custom templates, hospital hours, staff availability, and weekly minimums.
          </p>
          <form onSubmit={handleAutoSchedule} className="space-y-4 max-w-2xl">
            {autoScheduleError && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{autoScheduleError}</div>}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-indigo-900">Start Date</label>
                <input
                  type="date"
                  required
                  value={autoStartDate}
                  onChange={(e) => setAutoStartDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border-indigo-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-indigo-900">End Date</label>
                <input
                  type="date"
                  required
                  value={autoEndDate}
                  onChange={(e) => setAutoEndDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border-indigo-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                />
              </div>
            </div>
            
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isAutoScheduling || templates.length === 0}
                className="flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isAutoScheduling ? 'Processing...' : 'Run Auto Scheduler'}
              </button>
            </div>
            {templates.length === 0 && (
               <p className="text-xs text-red-600 mt-2 text-right">You must create Shift Templates in Settings first.</p>
            )}
          </form>
        </div>
      )}

      {isAdding && role === 'admin' && (
        <div className="bg-slate-50 rounded-lg p-6 mb-8 border border-slate-200">
          <h3 className="text-lg font-medium text-slate-900 mb-4 border-b pb-2">Schedule New Shift</h3>
          <form onSubmit={handleAddShift} className="space-y-4 max-w-3xl">
            {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-1">
                <label className="block text-sm font-medium text-slate-700">Staff Member</label>
                <select
                  required
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                >
                  {Object.values(users).map((u: User) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
              
              <div className="lg:col-span-1">
                <label className="block text-sm font-medium text-slate-700">Date</label>
                <input
                  type="date"
                  required
                  value={shiftDate}
                  onChange={(e) => setShiftDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                />
              </div>

              <div className="lg:col-span-1">
                <label className="block text-sm font-medium text-slate-700">Type</label>
                <select
                  required
                  value={shiftType}
                  onChange={(e) => {
                    const val = e.target.value;
                    setShiftType(val);
                    const tmpl = templates.find(t => t.name === val);
                    if (tmpl) {
                      setStartTime(tmpl.startTime);
                      setEndTime(tmpl.endTime);
                    }
                  }}
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                >
                  <option value="">-- Select Shift Type --</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-1">
                <label className="block text-sm font-medium text-slate-700">Start Time</label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                />
              </div>

              <div className="lg:col-span-1">
                <label className="block text-sm font-medium text-slate-700">End Time</label>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                />
              </div>
            </div>
            
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Shift'}
              </button>
            </div>
          </form>
        </div>
      )}
      
      {viewMode === 'list' ? (
        <div className="space-y-6">
          <div className="flex items-center gap-4 border-b border-slate-200 pb-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setListDate(subDays(listDate, 1))}
                className="p-2 border border-slate-300 rounded-md hover:bg-slate-50 text-slate-600 transition-colors"
                title="Previous day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input 
                type="date"
                value={format(listDate, 'yyyy-MM-dd')}
                onChange={(e) => setListDate(e.target.value ? new Date(e.target.value + 'T00:00:00') : new Date())}
                className="rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              />
              <button
                onClick={() => setListDate(addDays(listDate, 1))}
                className="p-2 border border-slate-300 rounded-md hover:bg-slate-50 text-slate-600 transition-colors"
                title="Next day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <h3 className="text-lg font-medium text-slate-900">
              Shifts on {format(listDate, 'MMMM d, yyyy')}
            </h3>
          </div>
          <div>
            {listShifts.length > 0 ? (
              listShifts.map(shift => (
                <div key={shift.id} className="py-3 flex justify-between items-center text-sm border-b border-slate-100 last:border-0 hover:bg-slate-50 px-2 rounded-md transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4">
                    <span className="font-medium text-slate-900 w-40">{users[shift.userId]?.name || 'Unknown Staff'}</span>
                    <span className={clsx(
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize w-24 justify-center',
                      users[shift.userId]?.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                      users[shift.userId]?.role === 'doctor' ? 'bg-blue-100 text-blue-800' :
                      users[shift.userId]?.role === 'tech' ? 'bg-green-100 text-green-800' :
                      'bg-slate-100 text-slate-800'
                    )}>
                      {users[shift.userId]?.role}
                    </span>
                    <span className="text-slate-600 capitalize w-24">{shift.shiftType} Shift</span>
                    <span className="text-slate-500">{format(new Date(shift.startTime), 'h:mm a')} - {format(new Date(shift.endTime), 'h:mm a')}</span>
                  </div>
                  {role === 'admin' && (
                    <button
                      onClick={() => handleDelete(shift.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete Shift"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 py-4 italic">No shifts scheduled for this date.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <h3 className="text-lg font-medium text-slate-900">
              {format(currentMonth, 'MMMM yyyy')}
            </h3>
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-2 border border-slate-300 rounded-md hover:bg-slate-50 text-slate-600"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setCurrentMonth(new Date())}
                className="px-3 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50 text-slate-600 text-sm font-medium"
              >
                Today
              </button>
              <button 
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-2 border border-slate-300 rounded-md hover:bg-slate-50 text-slate-600"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-lg overflow-hidden border border-slate-200">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="bg-slate-50 py-2 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                {day}
              </div>
            ))}
            
            {calendarDays.map((day, dayIdx) => {
              const dayShifts = filteredShifts.filter(s => isSameDay(new Date(s.startTime), day));
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, new Date());
              
              return (
                <div 
                  key={day.toISOString()} 
                  className={clsx(
                    "min-h-[120px] bg-white p-2 transition-colors relative group",
                    !isCurrentMonth && "bg-slate-50/50 text-slate-400"
                  )}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={clsx(
                      "text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full",
                      isToday ? "bg-indigo-600 text-white" : "",
                      !isToday && !isCurrentMonth ? "text-slate-400" : "",
                      !isToday && isCurrentMonth ? "text-slate-900" : ""
                    )}>
                      {format(day, 'd')}
                    </span>
                    {role === 'admin' && (
                      <button 
                        onClick={() => {
                          setShiftDate(format(day, 'yyyy-MM-dd'));
                          setIsAdding(true);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition-opacity p-1"
                        title="Add shift on this date"
                      >
                        <CalendarPlus className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-1 mt-1 overflow-y-auto max-h-[88px] no-scrollbar">
                    {dayShifts.map(shift => (
                      <div 
                        key={shift.id} 
                        className={clsx(
                          "text-[10px] sm:text-xs p-1 rounded border border-transparent hover:border-slate-300 group/shift relative truncate",
                          users[shift.userId]?.role === 'admin' ? 'bg-purple-50 text-purple-700' :
                          users[shift.userId]?.role === 'doctor' ? 'bg-blue-50 text-blue-700' :
                          users[shift.userId]?.role === 'tech' ? 'bg-green-50 text-green-700' :
                          'bg-slate-50 text-slate-700'
                        )}
                        title={`${users[shift.userId]?.name || 'Unknown'} - ${shift.shiftType}`}
                      >
                        <span className="font-medium">{users[shift.userId]?.name?.split(' ')[0]}</span>
                        <span className="text-slate-500 ml-1 hidden sm:inline">
                          {format(new Date(shift.startTime), 'h:mma').toLowerCase()}
                        </span>
                        
                        {role === 'admin' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(shift.id);
                            }}
                            className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/shift:opacity-100 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
