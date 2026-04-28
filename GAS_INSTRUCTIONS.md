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

    if (action === 'getLastRow') {
      return handleGetLastRow(data);
    } else if (action === 'provision') {
      return handleProvision(data);
    }

    return response({ success: false, message: 'Invalid action' });
  } catch (error) {
    return response({ success: false, message: error.toString() });
  }
}

function handleGetLastRow(data) {
  const ss = SpreadsheetApp.openById(data.adminSpreadsheetId);
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

function handleProvision(params) {
  const adminSs = SpreadsheetApp.openById(params.adminSpreadsheetId);
  const adminSheet = adminSs.getSheetByName('admin');
  const data = params.siteData;

  // 1. Create Folder
  const parentFolder = DriveApp.getRootFolder(); // Or specify a specific parent ID
  const newFolder = parentFolder.createFolder(data.site_Title);
  
  // 2. Copy Template Spreadsheet
  const templateSheetFile = DriveApp.getFileById(params.templateSheetId);
  const newSheetFile = templateSheetFile.makeCopy(data.site_Title + " Sheet", newFolder);
  const newSheetId = newSheetFile.getId();
  const newSheetUrl = newSheetFile.getUrl();

  // 3. Copy Template GAS Script (if standalone)
  let newGasUrl = "";
  if (params.templateGasId) {
    const templateGasFile = DriveApp.getFileById(params.templateGasId);
    const newGasFile = templateGasFile.makeCopy(data.site_Title + " Script", newFolder);
    newGasUrl = "https://script.google.com/d/" + newGasFile.getId() + "/edit";
    
    // Add editor access if email provided
    if (data.Site_contactEmail) {
      try {
        newGasFile.addEditor(data.Site_contactEmail);
      } catch(e) {}
    }
  }

  // 4. Add editor to spreadsheet
  if (data.Site_contactEmail) {
    try {
      newSheetFile.addEditor(data.Site_contactEmail);
      newFolder.addEditor(data.Site_contactEmail);
    } catch(e) {}
  }

  // 5. Update Admin Sheet
  const headers = adminSheet.getRange(1, 1, 1, adminSheet.getLastColumn()).getValues()[0];
  const newRow = headers.map(header => {
    if (header === 'Site_spreadsheetId') return newSheetId;
    if (header === 'Site_spreadsheetName') return data.site_Title + " Sheet";
    if (header === 'Site_spreadsheetURL') return newSheetUrl;
    if (header === 'Site_gasScriptUrl') return newGasUrl;
    return data[header] || "";
  });

  adminSheet.appendRow(newRow);

  return response({ 
    success: true, 
    message: 'Provisioned successfully',
    data: {
      Site_spreadsheetId: newSheetId,
      Site_spreadsheetURL: newSheetUrl,
      Site_gasScriptUrl: newGasUrl
    }
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

## 3. Configure the React App
1. Open the AI Studio project.
2. Open the **Secrets** or **Settings** panel (or modify `.env`).
3. Set `VITE_CONSOLE_GAS_URL` to the URL you copied in the previous step.
4. Set the other required IDs:
   - `VITE_ADMIN_SPREADSHEET_ID`: ID of your Master Admin sheet.
   - `VITE_TEMPLATE_SPREADSHEET_ID`: ID of the sheet to clone.
   - `VITE_TEMPLATE_GAS_ID`: ID of the GAS project to clone (optional).
