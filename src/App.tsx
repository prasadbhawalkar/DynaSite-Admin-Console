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
import { AdminSiteData, ProvisionStep, VercelDeploymentResponse } from '@/src/types';
import { fetchLastRow, provisionSite, deployToVercel } from './services/dynSiteService';

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
  site_spreadsheetId: '',
  site_spreadsheetName: '',
  site_spreadsheetURL: '',
  site_gasScriptID: '',
  site_gasScriptUrl: '',
  site_contactEmail: '',
  site_gasScriptExecURL: '',
  site_VercelGitHubRepo: '',
  site_VercelGitHubRepoID: '',
  site_VercelDeployID: '',
  site_VercelURL: '',
  site_VercelVariables: ''
};

export default function App() {
  const [lastRowData, setLastRowData] = useState<AdminSiteData | null>(null);
  const [formData, setFormData] = useState<AdminSiteData>(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const [provisioningStep, setProvisioningStep] = useState<ProvisionStep>('IDLE');
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<Partial<AdminSiteData> | null>(null);

  // Vercel Deployment States
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState<VercelDeploymentResponse | null>(null);

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
          site_spreadsheetId: '',
          site_spreadsheetName: '',
          site_spreadsheetURL: '',
          site_gasScriptID: '',
          site_gasScriptUrl: '',
          site_gasScriptExecURL: '',
          site_VercelGitHubRepo: data.site_VercelGitHubRepo || '',
          site_VercelGitHubRepoID: data.site_VercelGitHubRepoID || '',
          site_VercelDeployID: '',
          site_VercelURL: '',
        });
      } else {
        setError('Registry synchronization failed. Please ensure your Google Apps Script is deployed as a Web App (Access: Anyone) and your Secret Keys (GAS URL & Spreadsheet ID) are correctly configured in AI Studio.');
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
    setDeploymentResult(null);

    try {
      const result = await provisionSite(formData);
      if (result.success) {
        setProvisioningStep('COMPLETED');
        const updatedSuccessData = {
          ...result.data,
          site_Number: formData.site_Number,
          site_Title: formData.site_Title,
          site_VercelGitHubRepo: formData.site_VercelGitHubRepo,
          site_VercelGitHubRepoID: formData.site_VercelGitHubRepoID,
          site_VercelVariables: formData.site_VercelVariables
        };
        setSuccessData(updatedSuccessData);
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

  const handleDeploy = async () => {
    const dataToDeploy = successData || lastRowData;
    
    if (!dataToDeploy || !dataToDeploy.site_spreadsheetId || !dataToDeploy.site_gasScriptUrl) {
      setError("Please ensure valid site data is available (either provision a new site or check global registry).");
      return;
    }

    setIsDeploying(true);
    setError(null);
    setDeploymentResult(null);

    const vProjectName = `${dataToDeploy.site_Number}-${dataToDeploy.site_Title}`.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    
    // Construct environment variables
    const envVars: Record<string, string> = {
      'VITE_DYNSITE_SPREADSHEET_ID': dataToDeploy.site_spreadsheetId || '',
      'VITE_DYNSITE_GAS_URL': dataToDeploy.site_gasScriptUrl || ''
    };

    // Add additional variables from string (key=value, key=value)
    if (dataToDeploy.site_VercelVariables) {
      const extraVars = dataToDeploy.site_VercelVariables.split(',').map(v => v.trim()).filter(v => v.includes('='));
      extraVars.forEach(pair => {
        const [k, v] = pair.split('=').map(s => s.trim());
        if (k) envVars[k] = v || '';
      });
    }

    try {
      const result = await deployToVercel({
        projectName: vProjectName,
        repoName: dataToDeploy.site_VercelGitHubRepo || '',
        repoId: dataToDeploy.site_VercelGitHubRepoID || '',
        envVars
      });
      setDeploymentResult(result);
      if (!result.success) {
        setError(result.error || 'Vercel deployment failed.');
      }
    } catch (err) {
      setError('Vercel deployment failed.');
    } finally {
      setIsDeploying(false);
    }
  };

  const getEffectiveEnvVars = (data: Partial<AdminSiteData> | null) => {
    if (!data) return [];
    const vars = [
      { key: 'VITE_DYNSITE_SPREADSHEET_ID', value: data.site_spreadsheetId || '' },
      { key: 'VITE_DYNSITE_GAS_URL', value: data.site_gasScriptUrl || '' }
    ];
    
    if (data.site_VercelVariables) {
      const extraVars = data.site_VercelVariables.split(',').filter(v => v.trim()).map(v => v.trim());
      extraVars.forEach(pair => {
        const [k, v] = pair.split('=').map(s => s.trim());
        if (k) vars.push({ key: k, value: v || '' });
      });
    }
    return vars;
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
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5 tracking-wider">Ref ID / #</p>
                      <p className="font-mono font-bold text-lg text-blue-600">{lastRowData.site_Number}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5 tracking-wider">Status</p>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        lastRowData.site_Status === 'ACTIVE' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-slate-50 text-slate-500 border border-slate-100'
                      }`}>
                        {lastRowData.site_Status}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5 tracking-wider">Identity</p>
                    <p className="font-bold text-slate-800">{lastRowData.site_Title}</p>
                    <p className="text-[11px] text-slate-500 italic leading-snug">{lastRowData.site_Tagline}</p>
                    <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">{lastRowData.site_Description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 py-2 border-y border-slate-50">
                    <div>
                      <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Theme Colors</p>
                      <div className="flex gap-2">
                        <div className="w-4 h-4 rounded shadow-sm border border-black/5" style={{ backgroundColor: lastRowData.site_Primary_color }}></div>
                        <div className="w-4 h-4 rounded shadow-sm border border-black/5" style={{ backgroundColor: lastRowData.site_Secondary_color }}></div>
                        <span className="text-[10px] font-mono text-slate-400">{lastRowData.site_Primary_color}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Validity</p>
                      <p className="text-[10px] font-medium">{lastRowData.validFrom} — {lastRowData.validTo || '∞'}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="pt-2">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Technical Assets</p>
                      <DetailRow label="SEO Description" value={lastRowData.site_Seo_description} truncate />
                      <DetailRow label="Spreadsheet ID" value={lastRowData.site_spreadsheetId} isMono />
                      <DetailRow label="Spreadsheet URL" value={lastRowData.site_spreadsheetURL} truncate />
                      <DetailRow label="GAS Script ID" value={lastRowData.site_gasScriptID} isMono />
                      <DetailRow label="GAS Script URL" value={lastRowData.site_gasScriptUrl} truncate />
                      <DetailRow label="GAS Exec URL" value={lastRowData.site_gasScriptExecURL} truncate />
                    </div>

                    <div className="pt-2">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Cloud Configuration</p>
                      <DetailRow label="Contact Email" value={lastRowData.site_contactEmail} />
                      <DetailRow label="GitHub Repo" value={lastRowData.site_VercelGitHubRepo} />
                      <DetailRow label="GitHub Repo ID" value={lastRowData.site_VercelGitHubRepoID} />
                      <DetailRow label="Vercel URL" value={lastRowData.site_VercelURL} />
                      <DetailRow label="Vercel Deploy ID" value={lastRowData.site_VercelDeployID} isMono />
                    </div>

                    <div className="pt-2">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 text-right opacity-50 italic">Registry Metadata</p>
                      <DetailRow label="Variables" value={lastRowData.site_VercelVariables} truncate />
                    </div>
                    
                    <div className="mt-4 space-y-2">
                      <ExternalLinkButton label="View Spreadsheet" href={lastRowData.site_spreadsheetURL} icon={<Copy className="w-3 h-3" />} />
                      <ExternalLinkButton label="GAS Endpoint" href={lastRowData.site_gasScriptUrl} icon={<Loader2 className="w-3 h-3" />} />
                      <ExternalLinkButton label="GAS Exec URL" href={lastRowData.site_gasScriptExecURL} icon={<RefreshCw className="w-3 h-3" />} />
                    </div>
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

          {/* Provisioning Status */}
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

              {provisioningStep === 'COMPLETED' && (
                <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-3">
                  <p className="text-xs font-medium text-slate-500">Instance ready! Next step:</p>
                  <button 
                    onClick={handleDeploy}
                    disabled={isDeploying}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-black text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-all disabled:opacity-50"
                  >
                    {isDeploying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                    Deploy to Vercel
                  </button>
                  <button 
                    onClick={() => { setProvisioningStep('IDLE'); setSuccessData(null); setDeploymentResult(null); }}
                    className="w-full py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors"
                  >
                    Close Provisioning
                  </button>
                </div>
              )}

              {error && provisioningStep !== 'COMPLETED' && (
                <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg flex gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                  <p className="text-xs text-red-700 leading-relaxed">{error}</p>
                </div>
              )}
            </motion.section>
          )}

          {/* Deployment Results Pop-up UI (Section) */}
          <AnimatePresence>
            {deploymentResult && (
              <motion.section
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className={`rounded-xl border shadow-sm p-5 ${deploymentResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`font-bold text-sm ${deploymentResult.success ? 'text-green-800' : 'text-red-800'}`}>
                    Vercel Deployment Result
                  </h3>
                  <button onClick={() => setDeploymentResult(null)} className="text-slate-400 hover:text-slate-600">×</button>
                </div>
                
                {deploymentResult.success ? (
                  <div className="space-y-4">
                    <div className="bg-white/60 p-3 rounded-lg border border-green-100">
                      <p className="text-[10px] text-green-600 font-bold uppercase mb-1">Deployment ID</p>
                      <p className="font-mono text-xs text-slate-700 break-all">{deploymentResult.deploymentId}</p>
                    </div>
                    <div className="bg-white/60 p-3 rounded-lg border border-green-100">
                      <p className="text-[10px] text-green-600 font-bold uppercase mb-1">Domain URL</p>
                      <a href={`https://${deploymentResult.url}`} target="_blank" rel="noreferrer" className="flex items-center justify-between text-xs font-bold text-blue-600 group">
                        {deploymentResult.url}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-red-700">{deploymentResult.error}</p>
                )}
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        {/* Form Column */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          {/* Frame 1: Site Identity & Core Details */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-slate-700">Site Identity & Core Details</h2>
            </div>
            
            <div className="p-6">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Site #</label>
                        <input 
                          type="text" 
                          name="site_Number"
                          value={formData.site_Number}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Site Title</label>
                        <input 
                          type="text" 
                          name="site_Title"
                          value={formData.site_Title}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="Global Marketing Hub"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Primary Color</label>
                        <div className="flex items-center gap-2">
                          <input type="color" name="site_Primary_color" value={formData.site_Primary_color} onChange={handleInputChange} className="w-8 h-8 rounded-lg overflow-hidden border-none p-0 cursor-pointer shrink-0" />
                          <input type="text" name="site_Primary_color" value={formData.site_Primary_color} onChange={handleInputChange} className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Secondary Color</label>
                        <div className="flex items-center gap-2">
                          <input type="color" name="site_Secondary_color" value={formData.site_Secondary_color} onChange={handleInputChange} className="w-8 h-8 rounded-lg overflow-hidden border-none p-0 cursor-pointer shrink-0" />
                          <input type="text" name="site_Secondary_color" value={formData.site_Secondary_color} onChange={handleInputChange} className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Tagline</label>
                      <input 
                        type="text" 
                        name="site_Tagline"
                        value={formData.site_Tagline}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Description</label>
                      <textarea 
                        name="site_Description"
                        rows={2}
                        value={formData.site_Description}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Contact Email</label>
                      <input 
                        type="email" 
                        name="Site_contactEmail"
                        value={formData.site_contactEmail}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Owner email for Drive access"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Status</label>
                        <select name="site_Status" value={formData.site_Status} onChange={handleInputChange} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                          <option value="ACTIVE">Active</option>
                          <option value="DRAFT">Draft</option>
                          <option value="DISABLED">Disabled</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Valid From</label>
                        <input type="date" name="validFrom" value={formData.validFrom} onChange={handleInputChange} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Valid To</label>
                      <input type="date" name="validTo" value={formData.validTo} onChange={handleInputChange} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">SEO Description</label>
                    <textarea 
                      name="site_Seo_description"
                      rows={4}
                      value={formData.site_Seo_description}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    />
                  </div>
                  <div className="md:col-span-2 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Sheet ID</label>
                      <input type="text" name="Site_spreadsheetId" value={formData.site_spreadsheetId} readOnly className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-mono text-slate-500" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Sheet Name</label>
                      <input type="text" name="Site_spreadsheetName" value={formData.site_spreadsheetName} readOnly className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-mono text-slate-500" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Sheet URL</label>
                      <input type="text" name="Site_spreadsheetURL" value={formData.site_spreadsheetURL} readOnly className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-mono text-slate-500" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">GAS Script ID</label>
                      <input type="text" name="Site_gasScriptID" value={formData.site_gasScriptID} readOnly className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-mono text-slate-500" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">GAS Deployment URL</label>
                      <input type="text" name="Site_gasScriptUrl" value={formData.site_gasScriptUrl} readOnly className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-mono text-slate-500" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">GAS Exec URL</label>
                      <input type="text" name="Site_gasScriptExecURL" value={formData.site_gasScriptExecURL} readOnly className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-mono text-slate-500" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3 text-slate-500">
                  <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg">
                    <FolderPlus className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Phase 1: Registration</p>
                    <p className="text-xs text-slate-500 italic">Create Google Assets & Folder</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button 
                    disabled={provisioningStep !== 'IDLE'}
                    onClick={() => setFormData(DEFAULT_DATA)}
                    className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-slate-600"
                  >
                    Reset
                  </button>
                  <button 
                    disabled={provisioningStep !== 'IDLE'}
                    onClick={() => setShowConfirm(true)}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all transform hover:-translate-y-0.5 active:scale-95"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Provision Site
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Frame 2: Technical Deployment Configuration */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-slate-700">Deployment & Environment Configuration</h2>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
                <div className="space-y-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5" />
                    Source & Variables
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Vercel GitHub Repository</label>
                      <input 
                        type="text" 
                        name="site_VercelGitHubRepo"
                        value={formData.site_VercelGitHubRepo}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                        placeholder="e.g. prasad-bh/dyn-template"
                      />
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Vercel GitHub Repository ID</label>
                      <input 
                        type="text" 
                        name="site_VercelGitHubRepoID"
                        value={formData.site_VercelGitHubRepoID}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                        placeholder="e.g. prasad-bh/dyn-template"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Custom Environment Variables String</label>
                      <input 
                        type="text" 
                        name="site_VercelVariables"
                        value={formData.site_VercelVariables}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none mb-4"
                        placeholder="KEY=VALUE, KEY2=VALUE2"
                      />
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-3">Deployment Row Mapping (Console Values)</p>
                      <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/30">
                        <div className="bg-slate-100/50 px-3 py-2 flex justify-between text-[9px] font-black uppercase text-slate-400 border-b border-slate-100">
                          <span>Variable Name</span>
                          <span>Assigned Value</span>
                        </div>
                        <div className="divide-y divide-slate-50 bg-white">
                          {getEffectiveEnvVars(successData ? (successData as AdminSiteData) : (lastRowData || formData)).map((env, idx) => (
                            <div key={idx} className="px-3 py-2 flex justify-between items-center gap-4 hover:bg-slate-50 transition-colors">
                              <span className="font-mono text-[10px] text-blue-600 font-bold shrink-0">{env.key}</span>
                              <span className="font-mono text-[10px] text-slate-500 truncate max-w-[250px] text-right">
                                {env.value || <span className="text-slate-300 italic">pending...</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Cloud Runtime
                  </h3>
                  
                  <div className="p-5 bg-slate-900 text-white rounded-2xl shadow-xl shadow-slate-200/50 space-y-6 border border-slate-800">
                        <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                          <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Target Instance</p>
                            <p className="text-sm font-mono text-blue-400 font-bold">
                              {successData ? successData.site_Number : (lastRowData ? lastRowData.site_Number : 'NONE')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 font-mono">
                              {successData ? (successData.site_Title || formData.site_Title) : (lastRowData?.site_Title || 'No Title')}
                            </p>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-black ${successData ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                              {successData ? 'NEW PROVISION' : 'EXISTING REGISTRY'}
                            </span>
                          </div>
                        </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Active Deployment ID</p>
                        <p className="text-[10px] font-mono text-slate-300 bg-white/5 p-2 rounded border border-white/5 break-all leading-relaxed">
                          {lastRowData?.site_VercelDeployID || 'No active deployment recorded'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Production URL</p>
                        <div className="flex items-center gap-2 bg-blue-500/10 p-2 rounded border border-blue-500/20">
                          <ExternalLink className="w-3 h-3 text-blue-400 shrink-0" />
                          <a 
                            href={lastRowData?.site_VercelURL?.startsWith('http') ? lastRowData.site_VercelURL : `https://${lastRowData?.site_VercelURL}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-[11px] font-mono text-blue-300 hover:text-blue-200 transition-colors truncate"
                          >
                            {lastRowData?.site_VercelURL || 'https://---'}
                          </a>
                        </div>
                      </div>
                    </div>
                    
                    <button 
                      onClick={handleDeploy}
                      disabled={isDeploying || (!successData && !lastRowData)}
                      className="w-full py-3.5 bg-white text-black rounded-xl text-xs font-black shadow-lg shadow-black/20 hover:bg-slate-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95 translate-y-2"
                    >
                      {isDeploying ? <Loader2 className="w-5 h-5 animate-spin" /> : <ExternalLink className="w-5 h-5" />}
                      EXECUTE CLOUD DEPLOYMENT
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {error && provisioningStep === 'IDLE' && !isDeploying && (
             <div className="mt-8 p-4 bg-red-50 border border-red-100 rounded-xl flex gap-4">
              <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-red-800">System Error</h4>
                <p className="text-xs text-red-700 mt-1 leading-relaxed">{error}</p>
              </div>
            </div>
          )}
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
                  <span className="font-medium">{formData.site_contactEmail || 'N/A'}</span>
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

function DetailRow({ label, value, isMono = false, truncate = false }: { label: string, value?: string, isMono?: boolean, truncate?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-slate-50 text-[10px]">
      <span className="text-slate-400 font-bold uppercase tracking-tighter">{label}</span>
      <span className={`text-slate-600 font-medium ${isMono ? 'font-mono' : ''} ${truncate ? 'truncate max-w-[180px]' : ''}`}>
        {value || <span className="text-slate-300">N/A</span>}
      </span>
    </div>
  );
}

function ExternalLinkButton({ label, href, icon }: { label: string, href?: string, icon: React.ReactNode }) {
  if (!href) return null;
  return (
    <a 
      href={href} 
      target="_blank" 
      rel="noreferrer"
      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-[10px] font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors group border border-slate-100"
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <ExternalLink className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 transition-opacity" />
    </a>
  );
}
