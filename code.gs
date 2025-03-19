// Google Apps Script that serves the QR scanner app and handles API requests

/**
 * Serves the HTML app when accessed directly via browser
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('QRScannerApp')
    .evaluate()
    .setTitle('QR Entry Scanner')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
}

/**
 * Handles POST requests (only needed if accessing the API externally)
 */
function doPost(e) {
  // Set CORS headers for cross-origin access
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
  };
  
  // Handle pre-flight OPTIONS request
  if (e.method === "OPTIONS") {
    return ContentService.createTextOutput("")
      .setMimeType(ContentService.MimeType.TEXT)
      .setHeaders(headers);
  }
  
  try {
    // Parse the incoming JSON data
    const requestData = JSON.parse(e.postData.contents);
    const guid = requestData.guid;
    const timestamp = requestData.timestamp;
    const isTempExit = requestData.isTempExit || false;
    
    // Process the GUID
    let result;
    if (isTempExit) {
      result = processTempExit(guid);
    } else {
      result = processScannedGuid(guid);
    }
    
    // Return the result
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(headers);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: error.toString()
    }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(headers);
  }
}

/**
 * Processes a scanned QR code GUID and updates the spreadsheet
 * This is the main function called by the web app
 */
function processScannedGuid(guid) {
  try {
    // Log the incoming GUID for debugging
    Logger.log("Processing GUID: " + guid);
    
    const timestamp = new Date();
    
    // Get the active spreadsheet (the one containing this script)
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) {
      Logger.log("Could not access the active spreadsheet");
      return {
        success: false,
        message: "Could not access the spreadsheet"
      };
    }
    
    const sheet = spreadsheet.getActiveSheet();
    Logger.log("Successfully accessed sheet: " + sheet.getName());
    
    // Get all data at once to improve performance
    const lastRow = sheet.getLastRow();
    const sheetData = sheet.getRange(1, 1, lastRow, 15).getValues();
    Logger.log("Retrieved " + sheetData.length + " rows of data");
    
    // Define column indices (adjust these if your columns are different)
    // GUID is in column H (8th column, index 7)
    const guidColIndex = 7;
    // Entered is in column L (12th column, index 11)
    const enteredColIndex = 11;
    // EntryTime is in column M (13th column, index 12)
    const entryTimeColIndex = 12;
    
    // Search for the GUID in the data
    let rowIndex = -1;
    for (let i = 1; i < sheetData.length; i++) { // Start from 1 to skip header
      if (sheetData[i][guidColIndex] === guid) {
        rowIndex = i + 1; // +1 because rows are 1-indexed in Sheets
        Logger.log("Found GUID at row " + rowIndex);
        break;
      }
    }
    
    // If GUID not found
    if (rowIndex === -1) {
      Logger.log("GUID not found: " + guid);
      return {
        success: false,
        message: "GUID not found"
      };
    }
    
    // Check if temporarily out (re-entry case)
    const currentStatus = sheetData[rowIndex - 1][enteredColIndex];
    const isReentry = currentStatus === "temporarilyOut";
    
    // Check if already entered and not temporarily out
    if (currentStatus === "yes") {
      Logger.log("GUID already entered: " + guid);
      return {
        success: true,
        alreadyEntered: true
      };
    }
    
    // Update entered status
    sheet.getRange(rowIndex, enteredColIndex + 1).setValue("yes");
    
    // Format the timestamp consistently
    const formattedDate = Utilities.formatDate(
      timestamp,
      "GMT+3", // Adjust timezone as needed
      "yyyy-MM-dd HH:mm:ss"
    );
    
    // Get current entry time value (might be empty or have existing timestamps)
    let currentEntryTime = sheetData[rowIndex - 1][entryTimeColIndex] || "";
    
    // For first-time entry, just use the formatted date
    // For re-entry, append to existing entry time
    let updatedEntryTime;
    if (isReentry) {
      updatedEntryTime = currentEntryTime + " | IN: " + formattedDate;
    } else {
      // If it's a brand new entry (not reentry), use the new format
      updatedEntryTime = formattedDate;
    }
    
    sheet.getRange(rowIndex, entryTimeColIndex + 1).setValue(updatedEntryTime);
    Logger.log("Successfully updated entry for GUID: " + guid + (isReentry ? " (re-entry)" : ""));
    
    // Return success
    return {
      success: true,
      alreadyEntered: false,
      reentry: isReentry
    };
    
  } catch (error) {
    Logger.log("Error in processScannedGuid: " + error.toString());
    return {
      success: false,
      message: error.toString()
    };
  }
}

/**
 * Processes a temporary exit scan
 * This is called when the user scans a QR code in temporary exit mode
 */
function processTempExit(guid) {
  try {
    // Log the incoming GUID for debugging
    Logger.log("Processing temporary exit for GUID: " + guid);
    
    const timestamp = new Date();
    
    // Get the active spreadsheet (the one containing this script)
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) {
      Logger.log("Could not access the active spreadsheet");
      return {
        success: false,
        message: "Could not access the spreadsheet"
      };
    }
    
    const sheet = spreadsheet.getActiveSheet();
    Logger.log("Successfully accessed sheet: " + sheet.getName());
    
    // Get all data at once to improve performance
    const lastRow = sheet.getLastRow();
    const sheetData = sheet.getRange(1, 1, lastRow, 15).getValues();
    Logger.log("Retrieved " + sheetData.length + " rows of data");
    
    // Define column indices (adjust these if your columns are different)
    // GUID is in column H (8th column, index 7)
    const guidColIndex = 7;
    // Entered is in column L (12th column, index 11)
    const enteredColIndex = 11;
    // EntryTime is in column M (13th column, index 12)
    const entryTimeColIndex = 12;
    
    // Search for the GUID in the data
    let rowIndex = -1;
    for (let i = 1; i < sheetData.length; i++) { // Start from 1 to skip header
      if (sheetData[i][guidColIndex] === guid) {
        rowIndex = i + 1; // +1 because rows are 1-indexed in Sheets
        Logger.log("Found GUID at row " + rowIndex);
        break;
      }
    }
    
    // If GUID not found
    if (rowIndex === -1) {
      Logger.log("GUID not found: " + guid);
      return {
        success: false,
        message: "GUID not found"
      };
    }
    
    // Check if already entered
    if (sheetData[rowIndex - 1][enteredColIndex] !== "yes") {
      Logger.log("Cannot mark as temporarily out - not entered: " + guid);
      return {
        success: true,
        notRegistered: true
      };
    }
    
    // Update entered status to temporarily out
    sheet.getRange(rowIndex, enteredColIndex + 1).setValue("temporarilyOut");
    
    // Format the timestamp consistently
    const formattedDate = Utilities.formatDate(
      timestamp,
      "GMT+3", // Adjust timezone as needed
      "yyyy-MM-dd HH:mm:ss"
    );
    
    // Append to entry time
    const currentEntryTime = sheetData[rowIndex - 1][entryTimeColIndex];
    const updatedEntryTime = currentEntryTime + " | OUT: " + formattedDate;
    sheet.getRange(rowIndex, entryTimeColIndex + 1).setValue(updatedEntryTime);
    
    Logger.log("Successfully marked temporary exit for GUID: " + guid);
    
    // Return success
    return {
      success: true,
      notRegistered: false
    };
    
  } catch (error) {
    Logger.log("Error in processTempExit: " + error.toString());
    return {
      success: false,
      message: error.toString()
    };
  }
}

/**
 * Include HTML templates
 * This allows you to break your HTML into multiple files if needed
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Get the column headers to verify column names and positions
 */
function getColumnHeaders() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Create a mapped object that shows column index for each header
    const headerMap = {};
    headers.forEach((header, index) => {
      headerMap[header] = index;
    });
    
    Logger.log(headerMap);
    return headerMap;
  } catch (e) {
    Logger.log("Error getting headers: " + e.toString());
    return { error: e.toString() };
  }
}

/**
 * Test function to verify the script is working
 */
function testProcessGuid() {
  const result = processScannedGuid("TEST_GUID");
  Logger.log(result);
}

/**
 * Test function for temporary exit
 */
function testTempExit() {
  const result = processTempExit("TEST_GUID");
  Logger.log(result);
}

/**
 * Function to explicitly get and log spreadsheet information for debugging
 */
function getSpreadsheetInfo() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const info = {
      name: ss.getName(),
      url: ss.getUrl(),
      id: ss.getId(),
      sheets: ss.getSheets().map(s => s.getName())
    };
    Logger.log(info);
    return info;
  } catch (e) {
    Logger.log("Error getting spreadsheet info: " + e.toString());
    return { error: e.toString() };
  }
}

/**
 * Initialize the spreadsheet with the necessary columns if they don't exist
 * This is useful for setting up a new spreadsheet for QR code tracking
 */
function initializeSpreadsheet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();
    
    // Check if we need to add the Entered and EntryTime columns
    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    
    let enteredColExists = false;
    let entryTimeColExists = false;
    
    headers.forEach(header => {
      if (header === "Entered") enteredColExists = true;
      if (header === "EntryTime") entryTimeColExists = true;
    });
    
    // Add Entered column if needed
    if (!enteredColExists) {
      sheet.getRange(1, lastCol + 1).setValue("Entered");
    }
    
    // Add EntryTime column if needed
    if (!entryTimeColExists) {
      sheet.getRange(1, lastCol + (enteredColExists ? 2 : 1)).setValue("EntryTime");
    }
    
    return {
      success: true,
      message: "Spreadsheet initialized successfully"
    };
  } catch (e) {
    return {
      success: false,
      message: e.toString()
    };
  }
}
