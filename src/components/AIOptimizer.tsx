import React, { useState } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Zap, Loader2 } from 'lucide-react';

export function AIOptimizer() {
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runOptimization = async () => {
    setLoading(true);
    setError(null);
    try {
      const [shiftsSnap, timeOffSnap, settingsSnap] = await Promise.all([
        getDocs(collection(db, 'shifts')),
        getDocs(collection(db, 'timeOffRequests')),
        getDoc(doc(db, 'settings', 'general'))
      ]);

      const shifts = shiftsSnap.docs.map(d => d.data());
      const timeOffRequests = timeOffSnap.docs.map(d => d.data());
      const settings = settingsSnap.exists() ? settingsSnap.data() : { openTime: '08:00', closeTime: '18:00' };

      const res = await fetch('/api/optimize-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shifts, timeOffRequests, settings })
      });

      if (!res.ok) throw new Error('Failed to get recommendations');
      
      const data = await res.json();
      setRecommendation(data.recommendation);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Zap className="h-6 w-6 text-indigo-600" />
          <h2 className="text-2xl font-bold text-slate-900">AI Schedule Optimization</h2>
        </div>
        <p className="text-slate-600 mb-6">
          Analyze the current schedule, staff shifts, and time-off requests to identify gaps, overlaps, or potential burnouts using AI.
        </p>

        <button
          onClick={runOptimization}
          disabled={loading}
          className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {loading ? 'Analyzing...' : 'Run Optimization'}
        </button>

        {error && (
          <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {recommendation && (
          <div className="mt-8 border-t pt-6">
            <h3 className="text-lg font-medium text-slate-900 mb-4">AI Recommendations:</h3>
            <div className="prose prose-indigo max-w-none text-slate-700 whitespace-pre-wrap">
              {recommendation}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
