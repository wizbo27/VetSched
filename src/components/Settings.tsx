import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, addDoc, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Settings as SettingsIcon, Save, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { ShiftTemplate } from '../types';

interface SettingsProps {
  role: string;
}

export function Settings({ role }: SettingsProps) {
  const [openTime, setOpenTime] = useState('08:00');
  const [closeTime, setCloseTime] = useState('18:00');
  const [is24Hours, setIs24Hours] = useState(false);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const [newTemplate, setNewTemplate] = useState({ name: '', startTime: '', endTime: '', requiredRoles: { admin: 0, doctor: 0, tech: 0, staff: 0 } });
  const [isSubmittingTemplate, setIsSubmittingTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editTemplate, setEditTemplate] = useState({ name: '', startTime: '', endTime: '', requiredRoles: { admin: 0, doctor: 0, tech: 0, staff: 0 } });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'general');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.openTime) setOpenTime(data.openTime);
          if (data.closeTime) setCloseTime(data.closeTime);
          if (typeof data.is24Hours !== 'undefined') setIs24Hours(data.is24Hours);
        }

        const templatesSnap = await getDocs(collection(db, 'shiftTemplates'));
        const t = templatesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShiftTemplate));
        setTemplates(t);

      } catch (err) {
        console.error('Error fetching settings:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role !== 'admin') return;
    
    setIsSaving(true);
    setMessage(null);
    
    try {
      await setDoc(doc(db, 'settings', 'general'), {
        openTime,
        closeTime,
        is24Hours,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setMessage({ text: 'Settings saved successfully', type: 'success' });
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplate.name || !newTemplate.startTime || !newTemplate.endTime) return;

    setIsSubmittingTemplate(true);
    try {
      const docRef = await addDoc(collection(db, 'shiftTemplates'), {
        name: newTemplate.name,
        startTime: newTemplate.startTime,
        endTime: newTemplate.endTime,
        requiredRoles: newTemplate.requiredRoles
      });
      setTemplates([...templates, { id: docRef.id, ...newTemplate }]);
      setNewTemplate({ name: '', startTime: '', endTime: '', requiredRoles: { admin: 0, doctor: 0, tech: 0, staff: 0 } });
    } catch (err: any) {
      console.error(err);
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setIsSubmittingTemplate(false);
    }
  };

  const startEditTemplate = (template: ShiftTemplate) => {
    setEditingTemplateId(template.id);
    setEditTemplate({
      name: template.name,
      startTime: template.startTime,
      endTime: template.endTime,
      requiredRoles: template.requiredRoles || { admin: 0, doctor: 0, tech: 0, staff: 0 }
    });
  };

  const handleSaveEditTemplate = async (id: string) => {
    if (!editTemplate.name || !editTemplate.startTime || !editTemplate.endTime) return;
    try {
      await updateDoc(doc(db, 'shiftTemplates', id), {
        name: editTemplate.name,
        startTime: editTemplate.startTime,
        endTime: editTemplate.endTime,
        requiredRoles: editTemplate.requiredRoles
      });
      setTemplates(templates.map(t => t.id === id ? { ...t, ...editTemplate } : t));
      setEditingTemplateId(null);
    } catch (err: any) {
      console.error(err);
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'shiftTemplates', id));
      setTemplates(templates.filter(t => t.id !== id));
    } catch (err: any) {
      console.error(err);
      setMessage({ text: err.message, type: 'error' });
    }
  };

  if (role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500 text-lg">You do not have permission to view this page.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center space-x-3 mb-6">
        <SettingsIcon className="h-6 w-6 text-indigo-600" />
        <h2 className="text-2xl font-bold text-slate-900">Admin Settings</h2>
      </div>

      {message && (
        <div className={`p-4 rounded-md text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Hospital Operating Hours */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-slate-900 mb-4 border-b pb-2">Hospital Operating Hours</h3>
        <p className="text-sm text-slate-500 mb-6">
          Set the default operating hours for the clinic. 
        </p>
        
        <form onSubmit={handleSave} className="space-y-6">
          <div className="flex items-center mb-4">
            <input
              id="is24Hours"
              type="checkbox"
              checked={is24Hours}
              onChange={(e) => setIs24Hours(e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="is24Hours" className="ml-2 block text-sm font-medium text-gray-900">
              Open 24/7
            </label>
          </div>

          {!is24Hours && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="openTime" className="block text-sm font-medium text-slate-700">Open Time</label>
                <input
                  type="time"
                  id="openTime"
                  required={!is24Hours}
                  value={openTime}
                  onChange={(e) => setOpenTime(e.target.value)}
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                />
              </div>
              
              <div>
                <label htmlFor="closeTime" className="block text-sm font-medium text-slate-700">Close Time</label>
                <input
                  type="time"
                  id="closeTime"
                  required={!is24Hours}
                  value={closeTime}
                  onChange={(e) => setCloseTime(e.target.value)}
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                />
              </div>
            </div>
          )}
          
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Hours
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Shift Templates */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-slate-900 mb-4 border-b pb-2">Custom Shift Templates</h3>
        <p className="text-sm text-slate-500 mb-6">
          Create predefined shifts (e.g., "Morning", "Night") that can be selected when scheduling staff.
        </p>

        <div className="mb-8">
          <h4 className="text-sm font-medium text-slate-700 mb-3">Add New Template</h4>
          <form onSubmit={handleAddTemplate} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs font-medium text-slate-700 mb-1">Shift Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Night Shift"
                  value={newTemplate.name}
                  onChange={e => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                />
              </div>
              <div className="w-full sm:w-32">
                <label className="block text-xs font-medium text-slate-700 mb-1">Start Time</label>
                <input
                  type="time"
                  required
                  value={newTemplate.startTime}
                  onChange={e => setNewTemplate({ ...newTemplate, startTime: e.target.value })}
                  className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                />
              </div>
              <div className="w-full sm:w-32">
                <label className="block text-xs font-medium text-slate-700 mb-1">End Time</label>
                <input
                  type="time"
                  required
                  value={newTemplate.endTime}
                  onChange={e => setNewTemplate({ ...newTemplate, endTime: e.target.value })}
                  className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">Required Staff (Count per Role)</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {['admin', 'doctor', 'tech', 'staff'].map(role => (
                  <div key={role} className="flex items-center space-x-2">
                    <span className="text-sm text-slate-600 capitalize w-12">{role}</span>
                    <input
                      type="number"
                      min="0"
                      value={newTemplate.requiredRoles[role as keyof typeof newTemplate.requiredRoles]}
                      onChange={e => setNewTemplate({ 
                        ...newTemplate, 
                        requiredRoles: { 
                          ...newTemplate.requiredRoles, 
                          [role]: Number(e.target.value) || 0 
                        } 
                      })}
                      className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmittingTemplate}
                className="w-full sm:w-auto flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <Plus className="h-4 w-4 mr-1" /> Add Template
              </button>
            </div>
          </form>
        </div>

        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-3">Existing Templates</h4>
          {templates.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No shift templates created yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Requirements</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {templates.map(template => (
                    <tr key={template.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-900">
                        {editingTemplateId === template.id ? (
                          <input
                            type="text"
                            required
                            value={editTemplate.name}
                            onChange={e => setEditTemplate({ ...editTemplate, name: e.target.value })}
                            className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border"
                          />
                        ) : (
                          template.name
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">
                        {editingTemplateId === template.id ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="time"
                              required
                              value={editTemplate.startTime}
                              onChange={e => setEditTemplate({ ...editTemplate, startTime: e.target.value })}
                              className="block w-24 rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border"
                            />
                            <span>-</span>
                            <input
                              type="time"
                              required
                              value={editTemplate.endTime}
                              onChange={e => setEditTemplate({ ...editTemplate, endTime: e.target.value })}
                              className="block w-24 rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border"
                            />
                          </div>
                        ) : (
                          <>{template.startTime} - {template.endTime}</>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {editingTemplateId === template.id ? (
                          <div className="grid grid-cols-2 gap-2">
                            {['admin', 'doctor', 'tech', 'staff'].map(role => (
                              <div key={role} className="flex items-center space-x-1">
                                <span className="text-xs capitalize w-10">{role}</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={editTemplate.requiredRoles[role as keyof typeof editTemplate.requiredRoles]}
                                  onChange={e => setEditTemplate({
                                    ...editTemplate,
                                    requiredRoles: {
                                      ...editTemplate.requiredRoles,
                                      [role]: Number(e.target.value) || 0
                                    }
                                  })}
                                  className="block w-12 rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-1 py-1 border"
                                />
                              </div>
                            ))}
                          </div>
                        ) : template.requiredRoles ? (
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(template.requiredRoles).filter(([_, count]) => (count as number) > 0).map(([role, count]) => (
                              <span key={role} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 capitalize">
                                {count} {role}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">None specified</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                        {editingTemplateId === template.id ? (
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => handleSaveEditTemplate(template.id)}
                              className="text-green-600 hover:text-green-900 p-1 rounded-md hover:bg-green-50 transition-colors inline-flex items-center"
                              title="Save"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingTemplateId(null)}
                              className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-50 transition-colors inline-flex items-center"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => startEditTemplate(template)}
                              className="text-indigo-600 hover:text-indigo-900 p-1 rounded-md hover:bg-indigo-50 transition-colors inline-flex items-center"
                              title="Edit template"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteTemplate(template.id)}
                              className="text-red-600 hover:text-red-900 p-1 rounded-md hover:bg-red-50 transition-colors inline-flex items-center"
                              title="Delete template"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
