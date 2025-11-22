// -----------------------------------------------------------------------------
// COPY THIS CODE INTO A NEW GOOGLE APPS SCRIPT PROJECT
// -----------------------------------------------------------------------------
// 1. Create a new Google Sheet.
// 2. Go to Extensions > Apps Script.
// 3. Paste this code into Code.gs.
// 4. Click "Deploy" > "New deployment".
// 5. Select type: "Web app".
// 6. Description: "Password Manager API".
// 7. Execute as: "Me".
// 8. Who has access: "Anyone". (Important for the app to access it without OAuth flow)
// 9. Click "Deploy" and copy the "Web App URL".
// -----------------------------------------------------------------------------

function doPost(e) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = JSON.parse(e.postData.contents);

    if (data.action === 'add') {
        // Add new password
        const id = new Date().getTime();
        const lastModified = new Date().toISOString();
        const comments = data.comments || '';
        sheet.appendRow([id, data.siteName, data.username, data.encryptedPassword, lastModified, comments]);
        return ContentService.createTextOutput(JSON.stringify({ result: 'success', id: id }))
            .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === 'edit') {
        // Edit password by ID
        const idToEdit = data.id;
        const range = sheet.getDataRange();
        const values = range.getValues();
        const lastModified = new Date().toISOString();

        for (let i = 0; i < values.length; i++) {
            if (values[i][0] == idToEdit) {
                // Update the row (ID stays same)
                // Columns: ID (0), SiteName (1), Username (2), Password (3), LastModified (4), Comments (5)
                sheet.getRange(i + 1, 2).setValue(data.siteName);
                sheet.getRange(i + 1, 3).setValue(data.username);
                sheet.getRange(i + 1, 4).setValue(data.encryptedPassword);
                sheet.getRange(i + 1, 5).setValue(lastModified);
                sheet.getRange(i + 1, 6).setValue(data.comments || '');

                return ContentService.createTextOutput(JSON.stringify({ result: 'success' }))
                    .setMimeType(ContentService.MimeType.JSON);
            }
        }
        return ContentService.createTextOutput(JSON.stringify({ result: 'error', message: 'ID not found' }))
            .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === 'delete') {
        // Delete password by ID
        const idToDelete = data.id;
        const range = sheet.getDataRange();
        const values = range.getValues();

        for (let i = 0; i < values.length; i++) {
            if (values[i][0] == idToDelete) {
                sheet.deleteRow(i + 1);
                return ContentService.createTextOutput(JSON.stringify({ result: 'success' }))
                    .setMimeType(ContentService.MimeType.JSON);
            }
        }
        return ContentService.createTextOutput(JSON.stringify({ result: 'error', message: 'ID not found' }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

function doGet(e) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const rows = sheet.getDataRange().getValues();
    const passwords = [];

    // Skip header row if it exists, or handle empty sheet
    if (rows.length > 0) {
        for (let i = 0; i < rows.length; i++) {
            // Columns: ID, SiteName, Username, Password, LastModified, Comments
            passwords.push({
                id: rows[i][0],
                siteName: rows[i][1],
                username: rows[i][2],
                encryptedPassword: rows[i][3],
                lastModified: rows[i][4] || null,
                comments: rows[i][5] || ''
            });
        }
    }

    return ContentService.createTextOutput(JSON.stringify(passwords))
        .setMimeType(ContentService.MimeType.JSON);
}
