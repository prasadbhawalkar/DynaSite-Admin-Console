/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AdminSiteData, ProvisionResponse } from '@/src/types';

const GAS_URL = import.meta.env.VITE_CONSOLE_GAS_URL;
const ADMIN_SPREADSHEET_ID = import.meta.env.VITE_ADMIN_SPREADSHEET_ID;
const TEMPLATE_SHEET_ID = import.meta.env.VITE_TEMPLATE_SPREADSHEET_ID;
const TEMPLATE_GAS_ID = import.meta.env.VITE_TEMPLATE_GAS_ID;

export async function fetchLastRow(): Promise<AdminSiteData | null> {
  if (!GAS_URL) {
    console.error('VITE_CONSOLE_GAS_URL is not defined');
    return null;
  }

  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'getLastRow',
        adminSpreadsheetId: ADMIN_SPREADSHEET_ID,
      }),
    });

    const result = await response.json();
    if (result.success && result.data) {
      return result.data as AdminSiteData;
    }
    return null;
  } catch (error) {
    console.error('Error fetching last row:', error);
    return null;
  }
}

export async function provisionSite(data: AdminSiteData): Promise<ProvisionResponse> {
  if (!GAS_URL) {
    throw new Error('VITE_CONSOLE_GAS_URL is not defined');
  }

  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'provision',
        adminSpreadsheetId: ADMIN_SPREADSHEET_ID,
        templateSheetId: TEMPLATE_SHEET_ID,
        templateGasId: TEMPLATE_GAS_ID,
        siteData: data,
      }),
    });

    const result = await response.json();
    return result as ProvisionResponse;
  } catch (error) {
    console.error('Error provisioning site:', error);
    return {
      success: false,
      message: 'Network error or server-side script failed.',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
