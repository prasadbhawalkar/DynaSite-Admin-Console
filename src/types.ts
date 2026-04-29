/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AdminSiteData {
  site_Number: string;
  site_Title: string;
  site_Status: string;
  site_Description: string;
  site_Tagline: string;
  site_Primary_color: string;
  site_Secondary_color: string;
  site_Seo_description: string;
  validFrom: string;
  validTo: string;
  site_spreadsheetId: string;
  site_spreadsheetName: string;
  site_spreadsheetURL: string;
  site_gasScriptID: string;
  site_gasScriptUrl: string;
  site_contactEmail: string;
  site_gasScriptExecURL: string;
  site_VercelGitHubRepo: string;
  site_VercelGitHubRepoID: string;
  site_VercelDeployID: string;
  site_VercelURL: string;
  site_VercelVariables: string;
}

export type ProvisionStep = 'IDLE' | 'CREATING_FOLDER' | 'COPYING_SHEET' | 'COPYING_SCRIPT' | 'UPDATING_ADMIN' | 'COMPLETED' | 'ERROR';

export interface ProvisionResponse {
  success: boolean;
  message: string;
  data?: Partial<AdminSiteData>;
  error?: string;
}

export interface VercelDeploymentResponse {
  success: boolean;
  deploymentId?: string;
  url?: string;
  error?: string;
}
