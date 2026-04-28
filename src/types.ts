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
  Site_spreadsheetId: string;
  Site_spreadsheetName: string;
  Site_spreadsheetURL: string;
  Site_gasScriptUrl: string;
  Site_contactEmail: string;
}

export type ProvisionStep = 'IDLE' | 'CREATING_FOLDER' | 'COPYING_SHEET' | 'COPYING_SCRIPT' | 'UPDATING_ADMIN' | 'COMPLETED' | 'ERROR';

export interface ProvisionResponse {
  success: boolean;
  message: string;
  data?: Partial<AdminSiteData>;
  error?: string;
}
