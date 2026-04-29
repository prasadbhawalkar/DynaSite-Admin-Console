# DynSite Admin - Google Apps Script (GAS) Instructions

This application requires a "Console" Google Apps Script deployed as a Web App to perform Drive and Spreadsheet operations.

## 1. Create the Script
1. Go to [script.google.com](https://script.google.com).
2. Create a new project named **DynSite Console Proxy**.
3. Replace the contents of `Code.gs` with the code below.

```javascript
/**
 * DynSite Console Proxy Script
 * Deployed as Web App (Execute as: Me, Access: Anyone)
 */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    // Determine Spreadsheet ID from various sources
    // Priority: URL Param > JSON Payload > Script Property
    const adminSpreadsheetId = e.parameter.spreadsheetId || 
                               data.adminSpreadsheetId || 
                               PropertiesService.getScriptProperties().getProperty('ADMIN_SPREADSHEET_ID');

    if (!adminSpreadsheetId) {
      return response({ success: false, message: 'Missing Admin Spreadsheet ID. Please provide via URL parameter, payload, or Script Properties.' });
    }

    if (action === 'getLastRow') {
      return handleGetLastRow(adminSpreadsheetId);
    } else if (action === 'provision') {
      return handleProvision(adminSpreadsheetId, data);
    } else {
      return handleGetLastRow(adminSpreadsheetId);
    }

    return response({ success: false, message: 'Invalid action' });
  } catch (error) {
    return response({ success: false, message: error.toString() });
  }
}

function handleGetLastRow(spreadsheetId) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = ss.getSheetByName('admin');
  const lastRow = sheet.getLastRow();
  
  if (lastRow < 2) return response({ success: false, message: 'No data found' });

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowData = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  const result = {};
  headers.forEach((header, index) => {
    result[header] = rowData[index];
  });

  return response({ success: true, data: result });
}

function handleProvision(spreadsheetId, params) {
  const adminSs = SpreadsheetApp.openById(spreadsheetId);
  const adminSheet = adminSs.getSheetByName('admin');
  const data = params.siteData;

  // 1. Create Folder (In the same parent folder as the Admin Spreadsheet)
  const adminFile = DriveApp.getFileById(spreadsheetId);
  const parentFolders = adminFile.getParents();
  const parentFolder = parentFolders.hasNext() ? parentFolders.next() : DriveApp.getRootFolder();
  const newFolder = parentFolder.createFolder(data.site_Number + " - " + data.site_Title);
  
  // 2. Copy Template Spreadsheet
  const templateSheetFile = DriveApp.getFileById(params.templateSheetId);
  const newSheetFile = templateSheetFile.makeCopy(data.site_Title + " Sheet", newFolder);
  const newSheetId = newSheetFile.getId();
  const newSheetUrl = newSheetFile.getUrl();

  // 3. Copy Template GAS Script (if standalone)
  let newGasUrl = "";
  let newGasId = "";
  if (params.templateGasId) {
    try {
      const templateGasFile = DriveApp.getFileById(params.templateGasId);
      const newGasFile = templateGasFile.makeCopy(data.site_Title + " Script", newFolder);
      newGasId = newGasFile.getId();
      newGasUrl = "https://script.google.com/d/" + newGasId + "/edit";
      
      // Add editor access if email provided
      if (data.site_contactEmail) {
        newGasFile.addEditor(data.site_contactEmail);
      }
    } catch(e) {
      console.warn("Failed to copy GAS script: " + e.toString());
    }
  }

  // 4. Add editor to spreadsheet and folder
  if (data.site_contactEmail) {
    try {
      newSheetFile.addEditor(data.site_contactEmail);
      newFolder.addEditor(data.site_contactEmail);
    } catch(e) {
      console.warn("Failed to add editor: " + e.toString());
    }
  }

  // 5. Update Admin Sheet
  const headers = adminSheet.getRange(1, 1, 1, adminSheet.getLastColumn()).getValues()[0];
  const newRow = headers.map(header => {
    // Dynamic fields generated during provision
    if (header === 'site_spreadsheetId') return newSheetId;
    if (header === 'site_spreadsheetName') return data.site_Title + " Sheet";
    if (header === 'site_spreadsheetURL') return newSheetUrl;
    if (header === 'site_gasScriptUrl') return newGasUrl;
    if (header === 'site_gasScriptID') return newGasId || params.templateGasId || "";
    
    // User provided fields or existing data mapping
    return data[header] !== undefined ? data[header] : "";
  });

  adminSheet.appendRow(newRow);

  // Return the full mapped data object for frontend state consistency
  const responseData = {};
  headers.forEach((header, index) => {
    responseData[header] = newRow[index];
  });

  return response({ 
    success: true, 
    message: 'Provisioned successfully',
    data: responseData
  });
}

function response(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## 2. Deploy as Web App
1. Click **Deploy** > **New Deployment**.
2. Select type: **Web App**.
3. Description: **DynSite Admin Proxy**.
4. Execute as: **Me** (Your Google Account).
5. Who has access: **Anyone**.
6. Click **Deploy**.
7. Copy the **Web App URL**.
8. **Optional (Secure Setup):** In the GAS editor, go to **Project Settings** (gear icon) > **Script Properties** > **Add script property**. Add `ADMIN_SPREADSHEET_ID` with your Master Spreadsheet ID as the value.

## 3. Spreadsheet Structure
Ensure your **Admin** sheet has exactly these header names in the first row (casing and underscores matter) for correct field mapping:
`site_Number`, `site_Title`, `site_Status`, `site_Description`, `site_Tagline`, `site_Primary_color`, `site_Secondary_color`, `site_Seo_description`, `validFrom`, `validTo`, `site_spreadsheetId`, `site_spreadsheetName`, `site_spreadsheetURL`, `site_gasScriptID`, `site_gasScriptUrl`, `site_contactEmail`, `site_gasScriptExecURL`, `site_VercelGitHubRepo`, `site_VercelGitHubRepoID`, `site_VercelDeployID`, `site_VercelURL`, `site_VercelVariables`

## 4. Configure the React App
1. Open the AI Studio project.
2. Go to **Settings** > **Secrets**.
3. Add/Update the following secrets:
   - `VITE_CONSOLE_GAS_URL`: Your deployed GAS Web App URL.
   - `VITE_ADMIN_SPREADSHEET_ID`: The ID of your Master Spreadsheet.
   - `VITE_TEMPLATE_SPREADSHEET_ID`: The ID of the Spreadsheet template to clone.
   - `VITE_TEMPLATE_GAS_ID`: The ID of the Script template to clone.
   - `VITE_VERCEL_TOKEN`: Your Vercel API Token.
   - `VITE_VERCEL_ORG_ID`: Your Vercel User/Team ID.

4. **Restart the dev server** in AI Studio after adding secrets.
