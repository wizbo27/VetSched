export type Role = 'admin' | 'doctor' | 'tech' | 'staff';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  minWeeklyHours?: number;
  minRestHours?: number;
}

export interface Shift {
  id: string;
  userId: string;
  startTime: string; // ISO String
  endTime: string; // ISO String
  shiftType: string;
}

export interface TimeOffRequest {
  id: string;
  userId: string;
  startDate: string; // ISO String
  endDate: string; // ISO String
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface ShiftSwap {
  id: string;
  shiftId: string;
  requestingUserId: string;
  targetUserId: string;
  status: 'pending' | 'accepted_by_target' | 'approved' | 'rejected';
  createdAt: string;
}

export interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  requiredRoles?: { admin: number; doctor: number; tech: number; staff: number; };
}
