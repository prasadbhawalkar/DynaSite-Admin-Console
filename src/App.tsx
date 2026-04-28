/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  PlusCircle, 
  ExternalLink, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Copy,
  FolderPlus,
  RefreshCw,
  Search,
  Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AdminSiteData, ProvisionStep } from '@/src/types';
import { fetchLastRow, provisionSite } from './services/dynSiteService';

const DEFAULT_DATA: AdminSiteData = {
  site_Number: '',
  site_Title: '',
  site_Status: 'ACTIVE',
  site_Description: '',
  site_Tagline: '',
  site_Primary_color: '#3B82F6',
  site_Secondary_color: '#64748B',
  site_Seo_description: '',
  validFrom: new Date().toISOString().split('T')[0],
  validTo: '',
  Site_spreadsheetId: '',
  Site_spreadsheetName: '',
  Site_spreadsheetURL: '',
  Site_gasScriptUrl: '',
  Site_contactEmail: ''
};

export default function App() {
  const [lastRowData, setLastRowData] = useState<AdminSiteData | null>(null);
  const [formData, setFormData] = useState<AdminSiteData>(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const [provisioningStep, setProvisioningStep] = useState<ProvisionStep>('IDLE');
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<Partial<AdminSiteData> | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
    const data = await fetchLastRow();
    if (data) {
      setLastRowData(data);
      // Auto-increment site number if it's a numeric pattern like S001
      const nextSiteNum = incrementSiteNumber(data.site_Number);
      setFormData({
        ...data,
        site_Number: nextSiteNum,
        site_Title: `${data.site_Title} (New)`,
        Site_spreadsheetId: '',
        Site_spreadsheetName: '',
        Site_spreadsheetURL: '',
        Site_gasScriptUrl: '',
      });
    } else {
      setError('Failed to fetch master data. Please check your GAS Web App URL and Spreadsheet Permissions.');
    }
    setLoading(false);
  };

  const incrementSiteNumber = (current: string) => {
    const match = current.match(/([a-zA-Z]*)(\d+)/);
    if (match) {
      const prefix = match[1];
      const num = parseInt(match[2], 10) + 1;
      return `${prefix}${num.toString().padStart(match[2].length, '0')}`;
    }
    return current;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProvision = async () => {
    setShowConfirm(false);
    setProvisioningStep('CREATING_FOLDER');
    setError(null);

    try {
      const result = await provisionSite(formData);
      if (result.success) {
        setProvisioningStep('COMPLETED');
        setSuccessData(result.data || {});
        // Reload master data to see new last row
        loadInitialData();
      } else {
        setProvisioningStep('ERROR');
        setError(result.error || result.message || 'An unknown error occurred during provisioning.');
      }
    } catch (err) {
      setProvisioningStep('ERROR');
      setError(err instanceof Error ? err.message : 'Provisioning failed.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          <p className="text-slate-600 font-medium">Fetching Admin Console data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <header className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-blue-600 rounded-lg text-white">
              <Settings className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">DynSite Admin</h1>
          </div>
          <p className="text-slate-500">Master Provisioning & Management Console</p>
        </div>
        
        <button 
          onClick={loadInitialData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4 text-slate-500" />
          Refresh Registry
        </button>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Current State Column */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-semibold text-slate-700">Last Registered Site</h2>
              {lastRowData && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  lastRowData.site_Status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
                }`}>
                  {lastRowData.site_Status}
                </span>
              )}
            </div>
            <div className="p-5">
              {lastRowData ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-slate-400 font-medium uppercase mb-0.5">Reference ID</p>
                      <p className="font-mono font-bold text-lg text-blue-600">{lastRowData.site_Number}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-medium uppercase mb-0.5 text-right">Validity</p>
                      <p className="text-sm font-medium">{lastRowData.validFrom} — {lastRowData.validTo || '∞'}</p>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-xs text-slate-400 font-medium uppercase mb-0.5">Title & Tagline</p>
                    <p className="font-semibold text-slate-800">{lastRowData.site_Title}</p>
                    <p className="text-xs text-slate-500 italic">{lastRowData.site_Tagline}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: lastRowData.site_Primary_color }}></div>
                      <span className="text-xs font-mono text-slate-500">{lastRowData.site_Primary_color}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: lastRowData.site_Secondary_color }}></div>
                      <span className="text-xs font-mono text-slate-500">{lastRowData.site_Secondary_color}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 space-y-2">
                    {lastRowData.Site_spreadsheetURL && (
                      <a 
                        href={lastRowData.Site_spreadsheetURL} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-xs hover:bg-blue-50 hover:text-blue-600 transition-colors group"
                      >
                        <span className="flex items-center gap-2">
                          <Copy className="w-3.5 h-3.5" />
                          Site Sheet
                        </span>
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    )}
                    {lastRowData.Site_gasScriptUrl && (
                      <a 
                        href={lastRowData.Site_gasScriptUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-xs hover:bg-purple-50 hover:text-purple-600 transition-colors group"
                      >
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5" />
                          GAS Endpoint
                        </span>
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-8 flex flex-col items-center justify-center text-slate-400">
                  <Search className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-sm">No registry data found</p>
                </div>
              )}
            </div>
          </section>

          {provisioningStep !== 'IDLE' && (
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-5"
            >
              <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                Provisioning Status
                {provisioningStep === 'COMPLETED' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                {provisioningStep === 'ERROR' && <AlertCircle className="w-4 h-4 text-red-500" />}
              </h3>
              
              <div className="space-y-4">
                <StatusItem 
                  label="Create Environment Folder" 
                  isActive={provisioningStep === 'CREATING_FOLDER'} 
                  isDone={['COPYING_SHEET', 'COPYING_SCRIPT', 'UPDATING_ADMIN', 'COMPLETED'].includes(provisioningStep)}
                />
                <StatusItem 
                  label="Clone Template Spreadsheet" 
                  isActive={provisioningStep === 'COPYING_SHEET'} 
                  isDone={['COPYING_SCRIPT', 'UPDATING_ADMIN', 'COMPLETED'].includes(provisioningStep)}
                />
                <StatusItem 
                  label="Deploy App Script Instance" 
                  isActive={provisioningStep === 'COPYING_SCRIPT'} 
                  isDone={['UPDATING_ADMIN', 'COMPLETED'].includes(provisioningStep)}
                />
                <StatusItem 
                  label="Register to Admin Console" 
                  isActive={provisioningStep === 'UPDATING_ADMIN'} 
                  isDone={provisioningStep === 'COMPLETED'}
                />
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg flex gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                  <p className="text-xs text-red-700 leading-relaxed">{error}</p>
                </div>
              )}

              {provisioningStep === 'COMPLETED' && (
                <button 
                  onClick={() => setProvisioningStep('IDLE')}
                  className="w-full mt-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Start New Request
                </button>
              )}
            </motion.section>
          )}
        </div>

        {/* Form Column */}
        <div className="lg:col-span-8">
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
              <h2 className="font-semibold text-slate-700">Site Provisioning Form</h2>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Visual Identity */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Identity & Naming</h3>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Site #</label>
                      <input 
                        type="text" 
                        name="site_Number"
                        value={formData.site_Number}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Site Title</label>
                      <input 
                        type="text" 
                        name="site_Title"
                        value={formData.site_Title}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Global Marketing Hub"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Tagline</label>
                    <input 
                      type="text" 
                      name="site_Tagline"
                      value={formData.site_Tagline}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Empowering commerce globally"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                    <textarea 
                      name="site_Description"
                      rows={3}
                      value={formData.site_Description}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      placeholder="Describe the purpose of this site instance..."
                    />
                  </div>
                </div>

                {/* Configuration */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Parameters & Branding</h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                      <select 
                        name="site_Status"
                        value={formData.site_Status}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="DRAFT">Draft</option>
                        <option value="DISABLED">Disabled</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Primary Email</label>
                      <div className="relative">
                        <Mail className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
                        <input 
                          type="email" 
                          name="Site_contactEmail"
                          value={formData.Site_contactEmail}
                          onChange={handleInputChange}
                          className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="admin@example.com"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Primary Color</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="color" 
                          name="site_Primary_color"
                          value={formData.site_Primary_color}
                          onChange={handleInputChange}
                          className="w-8 h-8 rounded-lg overflow-hidden border-none p-0 cursor-pointer"
                        />
                        <input 
                          type="text" 
                          name="site_Primary_color"
                          value={formData.site_Primary_color}
                          onChange={handleInputChange}
                          className="flex-1 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Secondary Color</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="color" 
                          name="site_Secondary_color"
                          value={formData.site_Secondary_color}
                          onChange={handleInputChange}
                          className="w-8 h-8 rounded-lg overflow-hidden border-none p-0 cursor-pointer"
                        />
                        <input 
                          type="text" 
                          name="site_Secondary_color"
                          value={formData.site_Secondary_color}
                          onChange={handleInputChange}
                          className="flex-1 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Valid From</label>
                      <input 
                        type="date" 
                        name="validFrom"
                        value={formData.validFrom}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Valid To</label>
                      <input 
                        type="date" 
                        name="validTo"
                        value={formData.validTo}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3 text-slate-500">
                  <div className="p-2 bg-slate-100 rounded-full">
                    <FolderPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider">Drive Action</p>
                    <p className="text-xs">Create folder: <span className="font-semibold">{formData.site_Title}</span></p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button 
                    disabled={provisioningStep !== 'IDLE'}
                    onClick={() => setFormData(DEFAULT_DATA)}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
                  >
                    Reset Form
                  </button>
                  <button 
                    disabled={provisioningStep !== 'IDLE'}
                    onClick={() => setShowConfirm(true)}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all transform hover:-translate-y-0.5"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Provision Site
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setShowConfirm(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6"
            >
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 text-blue-600">
                  <Copy className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Provision Instance?</h3>
                <p className="text-slate-500 mt-2 text-sm">
                  This will create a new folder, clone template assets, and update the master registry for <span className="font-semibold text-slate-900">"{formData.site_Title}"</span>.
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 mb-6 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Environment ID</span>
                  <span className="font-mono font-bold text-blue-600">{formData.site_Number}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Permissions for</span>
                  <span className="font-medium">{formData.Site_contactEmail || 'N/A'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setShowConfirm(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleProvision}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                >
                  Confirm & Provision
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusItem({ label, isActive, isDone }: { label: string, isActive: boolean, isDone: boolean }) {
  return (
    <div className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${isActive ? 'bg-blue-50 text-blue-700' : isDone ? 'text-slate-400' : 'text-slate-300'}`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
        isDone ? 'bg-green-100 text-green-600' : 
        isActive ? 'bg-blue-200 text-blue-700' : 
        'bg-slate-100 text-slate-400'
      }`}>
        {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : 
         isActive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 
         <div className="w-1.5 h-1.5 bg-slate-400 rounded-full" />}
      </div>
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}
