// Global variables
const SPREADSHEET_ID = '1HjR4tYETYG4gzLz0DSqsoTQbRLbgrkS5Rpm5Mt0DOwc'; // ใส่ ID ของ Google Sheet ใช้เก็บข้อมูล
const SHEET_QUEUE = 'Queue';
const SHEET_COUNTERS = 'Counters';
const SHEET_USERS = 'Users';
const SHEET_SETTINGS = 'Settings';
const SHEET_ANNOUNCEMENT_CONFIG = 'AnnouncementConfig'; // New sheet for announcement patterns
const SHEET_SOUND = 'Sound';
const SHEET_SLIDESHOW_IMAGES = 'SlideshowImages'; // New sheet for slideshow images

// Global constants for Queue sheet column indices (0-based for array access from getValues())
const Q_COL_ID_IDX = 0;
const Q_COL_STATUS_IDX = 1;
const Q_COL_CREATED_AT_IDX = 2;
const Q_COL_CALLED_AT_IDX = 3;
const Q_COL_COUNTER_ID_IDX = 4;
const Q_COL_REASON_FOR_SKIP_IDX = 5;

// Global constants for Sound sheet column indices
const SND_COL_ID_IDX = 0;
const SND_COL_NAME_IDX = 1;
const SND_COL_LINK_IDX = 2;
const SND_COL_DESC_IDX = 3; // New: Description
const SND_COL_TYPE_IDX = 4; // New: Sound Type (e.g., digit_0, start_call, general_purpose)

// Global constants for SlideshowImages sheet column indices
const SLI_COL_ID_IDX = 0;
const SLI_COL_IMAGE_URL_IDX = 1;
const SLI_COL_TITLE_IDX = 2;
const SLI_COL_DISPLAY_ORDER_IDX = 3;
const SLI_COL_IS_ACTIVE_IDX = 4;
// Global constants for Counters sheet column indices
const CTR_COL_NAMESOUNDID_IDX = 3; // New: NameSoundID (links to Sound sheet ID)

// Helper function to check for valid dates
function isValidDate(d) {
  return d instanceof Date && !isNaN(d);
}


// เปิดหน้าเว็บแอพ
function doGet(e) {
  let template;
  let htmlOutput;

  // ตรวจสอบพารามิเตอร์ 'page' ใน URL
  if (e && e.parameter && e.parameter.page && e.parameter.page.toLowerCase() === 'display') {
    template = HtmlService.createTemplateFromFile('display');
    htmlOutput = template.evaluate();
    // display.html มี <title> และ viewport meta tag ของตัวเองอยู่แล้ว
    // สามารถตั้งค่า XFrameOptionsMode เพื่อความสอดคล้องหาก display.html อาจถูกฝัง
    htmlOutput.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    // หากต้องการ override title จาก display.html สามารถทำได้ที่นี่ เช่น
    // htmlOutput.setTitle('หน้าจอแสดงผลคิว'); 
  } else {
    // ค่าเริ่มต้นคือ index.html สำหรับ Single Page Application (SPA)
    template = HtmlService.createTemplateFromFile('index');
    htmlOutput = template.evaluate();
    htmlOutput.setTitle('ระบบเรียกคิวออนไลน์')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return htmlOutput;
}

// ฟังก์ชันสำหรับรวมไฟล์
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ฟังก์ชันสำหรับเริ่มต้นระบบ (initialize)
function initializeSystem() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // สร้าง Sheet ถ้ายังไม่มี
  if (!ss.getSheetByName(SHEET_QUEUE)) {
    const queueSheet = ss.insertSheet(SHEET_QUEUE);
    // Add CounterID and ReasonForSkip columns for full functionality
    queueSheet.appendRow(['ID', 'Status', 'CreatedAt', 'CalledAt', 'CounterID', 'ReasonForSkip']);
  }
  
  if (!ss.getSheetByName(SHEET_COUNTERS)) {
    const counterSheet = ss.insertSheet(SHEET_COUNTERS);
    counterSheet.appendRow(['ID', 'Name', 'Status', 'NameSoundID']); // Added NameSoundID
    // เพิ่มช่องบริการเริ่มต้น
    counterSheet.appendRow([1, 'ช่องบริการ 1', 'active', null]);
  }
  
  if (!ss.getSheetByName(SHEET_USERS)) {
    const userSheet = ss.insertSheet(SHEET_USERS);
    userSheet.appendRow(['Username', 'Password', 'Role',]);
    // เพิ่ม admin เริ่มต้น
    userSheet.appendRow(['admin', 'admin123', 'admin']);
  }
  
  if (!ss.getSheetByName(SHEET_SETTINGS)) {
    const settingsSheet = ss.insertSheet(SHEET_SETTINGS);
    settingsSheet.appendRow(['Key', 'Value']);
    const defaultSettings = {
      'OrganizationName': 'ชื่อหน่วยงาน (กรุณาตั้งค่า)',
      'NextQueueNumber': '1',
      'MediaURL': '',
      'DisplayType': 'slideshow',
      'SoundURL': '',
      'TicketTitle': 'บัตรคิว', // Default ticket title
      'AutoPrintEnabled': 'disabled',
      'TicketWidth': '80', // mm
      'TicketHeight': '150', // mm
      'SlideshowInterval': '7',
      'SlideshowTransition': 'fade'
    };
    for (const key in defaultSettings) {
      settingsSheet.appendRow([key, defaultSettings[key]]);
    }
  } else {
    // If settings sheet exists, check and add new keys if they are missing
    const settingsSheet = ss.getSheetByName(SHEET_SETTINGS);
    const settingsData = settingsSheet.getDataRange().getValues();
    const existingKeys = new Set(settingsData.slice(1).map(row => row[0])); // Get existing keys, skip header

    const defaultSettings = {
      'OrganizationName': 'ชื่อหน่วยงาน (กรุณาตั้งค่า)', // Ensure these are also checked
      'NextQueueNumber': '1',
      'MediaURL': '',
      'DisplayType': 'slideshow',
      'SoundURL': '',
      'TicketTitle': 'บัตรคิว',
      'AutoPrintEnabled': 'disabled',
      'TicketWidth': '80',
      'TicketHeight': '150',
      'SlideshowInterval': '7',
      'SlideshowTransition': 'fade'
    };

    for (const key in defaultSettings) {
      if (!existingKeys.has(key)) {
        settingsSheet.appendRow([key, defaultSettings[key]]);
        Logger.log(`Appended missing setting to ${SHEET_SETTINGS}: ${key} = ${defaultSettings[key]}`);
      }
    }
    // Ensure NextQueueNumber is valid if it exists
    let nextQueueNumberValue = '1';
    let nextQueueNumberRowIndex = -1;
    for (let i = 1; i < settingsData.length; i++) { // Skip header
        if (settingsData[i][0] === 'NextQueueNumber') {
            nextQueueNumberValue = settingsData[i][1];
            nextQueueNumberRowIndex = i + 1; // 1-based index for getRange
            break;
        }
    }
    if (isNaN(parseInt(nextQueueNumberValue)) || parseInt(nextQueueNumberValue) < 1) {
        if (nextQueueNumberRowIndex !== -1) {
            settingsSheet.getRange(nextQueueNumberRowIndex, 2).setValue('1');
            Logger.log('Corrected NextQueueNumber to 1 in Settings.');
        }
        // If NextQueueNumber was missing, it's added by the loop above with default '1'
    }
  }

  if (!ss.getSheetByName(SHEET_ANNOUNCEMENT_CONFIG)) {
    const announcementConfigSheet = ss.insertSheet(SHEET_ANNOUNCEMENT_CONFIG);
    announcementConfigSheet.appendRow(['PatternID', 'PatternName', 'AnnouncementPattern', 'CounterAnnouncementType', 'IsDefault']);
       announcementConfigSheet.appendRow([1, 'รูปแบบมาตรฐาน (ค่าเริ่มต้น)', 'SOUND_TYPE_START_CALL,{QUEUE_NUMBER},SOUND_TYPE_COUNTER_PREFIX,{COUNTER_NUMBER}', 'number', true])
    
  } else {
    const announcementConfigSheet = ss.getSheetByName(SHEET_ANNOUNCEMENT_CONFIG);
    if (announcementConfigSheet.getLastRow() < 2) { // Only header or empty
        announcementConfigSheet.appendRow([1, 'รูปแบบมาตรฐาน (ค่าเริ่มต้น)', 'SOUND_TYPE_START_CALL,{QUEUE_NUMBER},SOUND_TYPE_COUNTER_PREFIX,{COUNTER_NUMBER}', 'number', true]);
    }
  }

  if (!ss.getSheetByName(SHEET_SOUND)) {
    const soundSheet = ss.insertSheet(SHEET_SOUND);
    // Corrected: use soundSheet instead of userSheet for appending sound data
    soundSheet.appendRow(['id', 'nameSound', 'linkSound', 'description', 'soundType']);
    soundSheet.appendRow(['1', 'เสียงเลข 0', 'https://weerasak3s.github.io/media/0-0.mp3', 'เสียงสำหรับเลขศูนย์', 'digit_0']);
    soundSheet.appendRow(['2', 'เสียงเลข 1', 'https://weerasak3s.github.io/media/1-1.mp3', 'เสียงสำหรับเลขหนึ่ง', 'digit_1']);
    soundSheet.appendRow(['3', 'เสียงเลข 2', 'https://weerasak3s.github.io/media/2-2.mp3', 'เสียงสำหรับเลขสอง', 'digit_2']);
    soundSheet.appendRow(['4', 'เสียงเลข 3', 'https://weerasak3s.github.io/media/3-3.mp3', 'เสียงสำหรับเลขสาม', 'digit_3']);
    soundSheet.appendRow(['5', 'เสียงเลข 4', 'https://weerasak3s.github.io/media/4-4.mp3', 'เสียงสำหรับเลขสี่', 'digit_4']);
    soundSheet.appendRow(['6', 'เสียงเลข 5', 'https://weerasak3s.github.io/media/5-5.mp3', 'เสียงสำหรับเลขห้า', 'digit_5']);
    soundSheet.appendRow(['7', 'เสียงเลข 6', 'https://weerasak3s.github.io/media/6-6.mp3', 'เสียงสำหรับเลขหก', 'digit_6']);
    soundSheet.appendRow(['8', 'เสียงเลข 7', 'https://weerasak3s.github.io/media/7-7.mp3', 'เสียงสำหรับเลขเจ็ด', 'digit_7']);
    soundSheet.appendRow(['9', 'เสียงเลข 8', 'https://weerasak3s.github.io/media/8-8.mp3', 'เสียงสำหรับเลขแปด', 'digit_8']);
    soundSheet.appendRow(['10', 'เสียงเลข 9', 'https://weerasak3s.github.io/media/9-09.mp3', 'เสียงสำหรับเลขเก้า', 'digit_9']);
    soundSheet.appendRow(['11', 'เสียงเชิญหมายเลข (เริ่มต้น)', 'https://weerasak3s.github.io/media/10-start.mp3', 'เสียงนำเมื่อเริ่มเรียกคิว', 'start_call']);
    soundSheet.appendRow(['12', 'เสียงเชิญช่องบริการ (สิ้นสุด)', 'https://weerasak3s.github.io/media/11-end.mp3', 'เสียงปิดท้ายเมื่อระบุช่องบริการ (กรณีช่องเดียว หรือไม่มีเสียงชื่อช่อง)', 'end_call']);
    soundSheet.appendRow(['13', 'เสียง "ที่ช่องบริการ"', 'https://example.com/placeholder_counter_prefix.mp3', 'เสียงพูดว่า "ที่ช่องบริการ" ก่อนบอกหมายเลขช่อง', 'counter_prefix']);
    // Example for a counter name sound
    soundSheet.appendRow(['100', 'เสียงห้องตรวจโรค', 'https://example.com/placeholder_examination_room.mp3', 'เสียงสำหรับ "ห้องตรวจโรค"', 'general_purpose']);
  
  }
  
  if (!ss.getSheetByName(SHEET_SLIDESHOW_IMAGES)) {
    const slideshowSheet = ss.insertSheet(SHEET_SLIDESHOW_IMAGES);
    slideshowSheet.appendRow(['ID', 'ImageURL', 'Title', 'DisplayOrder', 'IsActive']);
    // Add some default/example images
    slideshowSheet.appendRow([1, 'https://banhanhealth.github.io/Queue-calll/media/images/test/image1.jpg', 'ตัวอย่างภาพที่ 1', 1, true]);
    slideshowSheet.appendRow([2, 'https://banhanhealth.github.io/Queue-calll/media/images/test/image2.jpg', 'ตัวอย่างภาพที่ 2', 2, true]);
    slideshowSheet.appendRow([3, 'https://banhanhealth.github.io/Queue-calll/media/images/test/image3.jpg', 'ตัวอย่างภาพที่ 3', 3, true]);
  }

  return "ระบบถูกเริ่มต้นเรียบร้อยแล้ว";
}

// ฟังก์ชันสำหรับตรวจสอบการเข้าสู่ระบบ
function login(username, password) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_USERS);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username && data[i][1] === password) {
      const userProperties = PropertiesService.getUserProperties();
      userProperties.setProperty('username', username);
      userProperties.setProperty('role', data[i][2]);
      
      // สร้าง session ID และเก็บใน cache
      const sessionId = Utilities.getUuid();
      const cache = CacheService.getUserCache();
      cache.put('sessionId', sessionId, 21600); // 6 hours
      
      return {success: true, role: data[i][2]};
    }
  }
  
  return {success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'};
}

// ฟังก์ชันสำหรับตรวจสอบสถานะการเข้าสู่ระบบ
function checkLoginStatus() {
  const userProperties = PropertiesService.getUserProperties();
  const username = userProperties.getProperty('username');
  const role = userProperties.getProperty('role');
  
  // ตรวจสอบ session จาก cache
  const cache = CacheService.getUserCache();
  const sessionId = cache.get('sessionId');
  
  if (username && sessionId) {
    Logger.log({isLoggedIn: true, username: username, role: role});
    return {isLoggedIn: true, username: username, role: role};
  }
  Logger.log({isLoggedIn: false});
  return {isLoggedIn: false};
}

// ฟังก์ชันสำหรับออกจากระบบ
function logout() {
  const userProperties = PropertiesService.getUserProperties();
  userProperties.deleteProperty('username');
  userProperties.deleteProperty('role');
  
  // ลบ session จาก cache
  const cache = CacheService.getUserCache();
  cache.remove('sessionId');
  
  return true;
}

// ฟังก์ชันสำหรับจองคิว
function createQueue() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const queueSheet = ss.getSheetByName(SHEET_QUEUE);
  const settingsSheet = ss.getSheetByName(SHEET_SETTINGS);

  let newQueueNumber;
  const queueData = queueSheet.getDataRange().getValues();
  let hasActualQueues = false;
  // Check if there are any actual queue entries beyond the header
  if (queueData.length > 1) {
    for (let i = 1; i < queueData.length; i++) {
      if (queueData[i] && queueData[i][Q_COL_ID_IDX] !== undefined && queueData[i][Q_COL_ID_IDX] !== '') {
        hasActualQueues = true;
        break;
      }
    }
  }

  if (hasActualQueues) {
    let maxQueueNumber = 0;
    for (let i = 1; i < queueData.length; i++) { // Skip header
      if (queueData[i] && queueData[i][Q_COL_ID_IDX] !== undefined && queueData[i][Q_COL_ID_IDX] !== '') {
        const currentId = parseInt(queueData[i][Q_COL_ID_IDX]);
        if (!isNaN(currentId) && currentId > maxQueueNumber) {
          maxQueueNumber = currentId;
        }
      }
    }
    newQueueNumber = maxQueueNumber + 1;
  } else {
    // Queue sheet is empty (or only header), get number from Settings
    const settingsData = settingsSheet.getDataRange().getValues();
    for (let i = 1; i < settingsData.length; i++) { // Skip header
      if (settingsData[i][0] === 'NextQueueNumber') {
        newQueueNumber = parseInt(settingsData[i][1]);
        break;
      }
    }
    if (newQueueNumber === undefined || isNaN(newQueueNumber) || newQueueNumber < 1) {
      newQueueNumber = 1; // Fallback if setting not found or invalid
      Logger.log("NextQueueNumber setting not found or invalid, defaulting to 1.");
    }
  }

  // บันทึกคิวใหม่
  const now = new Date();
  queueSheet.appendRow([
    newQueueNumber,
    'waiting', // สถานะ: waiting, calling, completed, skipped
    now,
    '',    // CalledAt is initially empty
    null,  // CounterID is initially null
    null   // ReasonForSkip is initially null
  ]);

  // Update NextQueueNumber in Settings to newQueueNumber + 1
  // This ensures the setting always reflects the *next* number to be used if the queue sheet becomes empty.
  const settingsData = settingsSheet.getDataRange().getValues();
  let foundNextQueueSetting = false;
  for (let i = 1; i < settingsData.length; i++) { // Skip header
    if (settingsData[i][0] === 'NextQueueNumber') {
      settingsSheet.getRange(i + 1, 2).setValue(newQueueNumber + 1);
      foundNextQueueSetting = true;
      break;
    }
  }
  if (!foundNextQueueSetting) { // Should not happen if initializeSystem ran correctly
    settingsSheet.appendRow(['NextQueueNumber', newQueueNumber + 1]);
    Logger.log("Appended NextQueueNumber setting as it was not found during createQueue.");
  }

  Logger.log("New queue created: " + newQueueNumber + ". NextQueueNumber setting in sheet updated to: " + (newQueueNumber + 1));
  return {success: true, queueNumber: newQueueNumber};
}

// ฟังก์ชันสำหรับดึงข้อมูลคิวทั้งหมด
function getAllQueues() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_QUEUE);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  
  const queues = [];
  for (let i = 1; i < data.length; i++) { // Skip header
    queues.push({
      id: data[i][0],     
      status: data[i][1],
      createdAt: data[i][2], // Will be Date object if cell is formatted as Date
      calledAt: data[i][3]  // Will be Date object if cell is formatted as Date
    });
  }
  Logger.log(queues);
  return queues;
}

/**
 * Fetches data for the admin dashboard.
 * Assumes SHEET_QUEUE has columns: ID, Status, CreatedAt, CalledAt.
 * For full serviceName and skip reason, SHEET_QUEUE should ideally have
 * CounterID (col 5) and ReasonForSkip (col 6).
 */
function getAdminDashboardData() {
  Logger.log("Enter getAdminDashboardData");
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    if (!ss) {
        Logger.log("SpreadsheetApp.openById returned null/falsy for ID: " + SPREADSHEET_ID);
        return { calling: null, nextWaiting: null, completed: [], skipped: [], error: 'Failed to open spreadsheet. Check SPREADSHEET_ID and permissions.' };
    }

    const queueSheet = ss.getSheetByName(SHEET_QUEUE);
    const settingsSheet = ss.getSheetByName(SHEET_SETTINGS); // For display settings
    const counterSheet = ss.getSheetByName(SHEET_COUNTERS);
    const announcementConfigSheet = ss.getSheetByName(SHEET_ANNOUNCEMENT_CONFIG);
    // ... (error handling for sheet not found) ...
    if (!queueSheet) {
      Logger.log('Error: Queue sheet not found for Admin Dashboard.');
      return { calling: null, nextWaiting: null, completed: [], skipped: [], error: 'Queue sheet not found. Please run initializeSystem or check sheet name.' };
    }
    if (!counterSheet) {
      Logger.log('Error: Counters sheet not found for Admin Dashboard.');
      return { calling: null, nextWaiting: null, completed: [], skipped: [], error: 'Counters sheet not found. Please run initializeSystem or check sheet name.' };
    }
    if (!settingsSheet) {
      Logger.log('Error: Settings sheet not found for Admin Dashboard.');
      return { calling: null, nextWaiting: null, completed: [], skipped: [], error: 'Settings sheet not found. Please run initializeSystem or check sheet name.' };
    }
    if (!announcementConfigSheet) {
      Logger.log('Error: AnnouncementConfig sheet not found for Admin Dashboard.');
      return { calling: null, nextWaiting: null, completed: [], skipped: [], error: 'AnnouncementConfig sheet not found. Please run initializeSystem or check sheet name.' };
    }

    const queueRange = queueSheet.getDataRange();
    if (!queueRange) {
      Logger.log('Error: Queue sheet data range is null.');
      return { calling: null, nextWaiting: null, completed: [], skipped: [], error: 'Could not get data range from Queue sheet.' };
    }
    const queueData = queueRange.getValues();

    const counterRange = counterSheet.getDataRange();
    if (!counterRange) {
      Logger.log('Error: Counters sheet data range is null.');
      return { calling: null, nextWaiting: null, completed: [], skipped: [], error: 'Could not get data range from Counters sheet.' };
    }
    const counterData = counterRange.getValues();

    // Fetch display-specific settings
    const settingsData = settingsSheet.getDataRange().getValues();
    const displayPageSettings = {};
    for (let i = 1; i < settingsData.length; i++) { // Skip header
        const key = settingsData[i][0];
        const value = settingsData[i][1];
        if (key) {
            displayPageSettings[key] = value;
            if (key === 'OrganizationName') {
              Logger.log(`getAdminDashboardData: Read OrganizationName from sheet: '${value}' (Type: ${typeof value})`);
            }
        }
        }
    // Fetch announcement config
    const announcementConfigData = announcementConfigSheet.getDataRange().getValues();
     let activeAnnouncementPattern = 'SOUND_TYPE_START_CALL,{QUEUE_NUMBER},SOUND_TYPE_COUNTER_PREFIX,{COUNTER_NUMBER}'; // Fallback
    let activeCounterAnnouncementType = 'number'; // Fallback

    for (let i = 1; i < announcementConfigData.length; i++) { // Skip header
       // Assuming columns are: PatternID (0), PatternName (1), AnnouncementPattern (2), CounterAnnouncementType (3), IsDefault (4)
      if (announcementConfigData[i][4] === true || String(announcementConfigData[i][4]).toUpperCase() === 'TRUE') {
        activeAnnouncementPattern = announcementConfigData[i][2];
        activeCounterAnnouncementType = announcementConfigData[i][3];
        break; 
      }
    }
    // If no default found after loop, and there's at least one pattern, use the first one.
    if (activeAnnouncementPattern === 'SOUND_TYPE_START_CALL,{QUEUE_NUMBER},SOUND_TYPE_COUNTER_PREFIX,{COUNTER_NUMBER}' && announcementConfigData.length > 1) {
        if (announcementConfigData[1] && announcementConfigData[1][2]) { // Check if first data row and pattern cell exist
            activeAnnouncementPattern = announcementConfigData[1][2];
            activeCounterAnnouncementType = announcementConfigData[1][3] || 'number';
        }
    }


    const countersMap = new Map();
    for (let i = 1; i < counterData.length; i++) {
      const counterRow = counterData[i];
    if (counterRow && counterRow[0] !== undefined && counterRow[1] !== undefined) { // ID and Name must exist
        countersMap.set(counterRow[0].toString(), { name: counterRow[1], nameSoundId: counterRow[CTR_COL_NAMESOUNDID_IDX] });
    
      }
    }

    const allQueues = [];
    for (let i = 1; i < queueData.length; i++) {
      const row = queueData[i];
      if (!row || row.length === 0 || row[Q_COL_ID_IDX] == null) continue; // Skip empty or invalid rows

      const queueItem = {
        number: row[Q_COL_ID_IDX],
        status: row[Q_COL_STATUS_IDX],
        createdAtDateObj: row[Q_COL_CREATED_AT_IDX] instanceof Date ? row[Q_COL_CREATED_AT_IDX] : (row[Q_COL_CREATED_AT_IDX] ? new Date(row[Q_COL_CREATED_AT_IDX]) : null), // Store as Date object
        calledAtDateObj: row[Q_COL_CALLED_AT_IDX] instanceof Date ? row[Q_COL_CALLED_AT_IDX] : (row[Q_COL_CALLED_AT_IDX] ? new Date(row[Q_COL_CALLED_AT_IDX]) : null), // Store as Date object
        counterId: row.length > Q_COL_COUNTER_ID_IDX && row[Q_COL_COUNTER_ID_IDX] ? row[Q_COL_COUNTER_ID_IDX].toString() : null,
        reason: row.length > Q_COL_REASON_FOR_SKIP_IDX && row[Q_COL_REASON_FOR_SKIP_IDX] ? row[Q_COL_REASON_FOR_SKIP_IDX].toString() : null,
         serviceName: null,
        counterNameSoundId: null // Will be populated if counterId is set
     
      };

      if (queueItem.counterId && countersMap.has(queueItem.counterId)) {
         queueItem.serviceName = countersMap.get(queueItem.counterId).name;
        queueItem.counterNameSoundId = countersMap.get(queueItem.counterId).nameSoundId;
      }

      allQueues.push(queueItem);
    }

    let callingQueue = null;
    const callingQueuesList = allQueues.filter(q => q.status === 'calling');
    if (callingQueuesList.length > 0) {
      callingQueuesList.sort((a, b) => {
          if (isValidDate(a.calledAtDateObj) && isValidDate(b.calledAtDateObj)) return b.calledAtDateObj.getTime() - a.calledAtDateObj.getTime();
          if (isValidDate(a.calledAtDateObj)) return -1;
          // Ensure createdAt is also a valid date before comparing or converting
          if (isValidDate(a.createdAtDateObj) && isValidDate(b.createdAtDateObj)) {
            // Fallback to createdAt if calledAt is not available for both
            // Or if you prefer sorting by number if calledAt is missing
            // return b.createdAtDateObj.getTime() - a.createdAtDateObj.getTime(); 
          }
          // Fallback to number if dates are not reliable for sorting 'calling'
          // This sort order might need adjustment based on business logic for multiple 'calling' queues
          // (ideally there should only be one 'calling' queue)
          if (isValidDate(b.calledAt)) return 1;
          return (b.number || 0) - (a.number || 0);
      });
      callingQueue = callingQueuesList[0];
    }

    let nextWaitingQueue = null;
    const waitingQueuesList = allQueues.filter(q => q.status === 'waiting');
    if (waitingQueuesList.length > 0) {
      // Sort by createdAt first, then by number as a tie-breaker
      waitingQueuesList.sort((a, b) => {
        if (isValidDate(a.createdAtDateObj) && isValidDate(b.createdAtDateObj)) return a.createdAtDateObj.getTime() - b.createdAtDateObj.getTime();
        return (a.number || 0) - (b.number || 0);
      });
      nextWaitingQueue = waitingQueuesList[0];
    }

    // Get the next 3 waiting queues for the display page
    const nextWaitingQueuesRaw = waitingQueuesList.slice(0, 3); // Take the first 3 after sorting
    const nextWaitingQueues = nextWaitingQueuesRaw.map(q => ({
        number: q.number,
        serviceId: q.counterId, // Counter ID might be null for waiting
        serviceName: q.serviceName, // Service Name might be null for waiting
        // Use createdAt timestamp for waiting queues
        timestamp: isValidDate(q.createdAtDateObj) ? q.createdAtDateObj.toISOString() : null
    }));


    const completedQueuesRaw = allQueues.filter(q => q.status === 'completed');
    completedQueuesRaw.sort((a, b) => {
      if (isValidDate(a.calledAtDateObj) && isValidDate(b.calledAtDateObj)) return b.calledAtDateObj.getTime() - a.calledAtDateObj.getTime();
      if (isValidDate(a.calledAtDateObj)) return -1;
      if (isValidDate(b.calledAtDateObj)) return 1;
      if (isValidDate(a.createdAtDateObj) && isValidDate(b.createdAtDateObj)) return b.createdAtDateObj.getTime() - a.createdAtDateObj.getTime();
      if (isValidDate(a.createdAtDateObj)) return -1;
      if (isValidDate(b.createdAtDateObj)) return 1;
      return (b.number || 0) - (a.number || 0);
    });
    const completedQueues = completedQueuesRaw.slice(0, 3).map(q => ({
      number: q.number,
      serviceId: q.counterId,
      serviceName: q.serviceName,
      timestamp: isValidDate(q.calledAtDateObj) ? q.calledAtDateObj.toISOString() : (isValidDate(q.createdAtDateObj) ? q.createdAtDateObj.toISOString() : null)
    }));

    const skippedQueuesRaw = allQueues.filter(q => q.status === 'skipped');
    skippedQueuesRaw.sort((a, b) => {
      if (isValidDate(a.calledAtDateObj) && isValidDate(b.calledAtDateObj)) return b.calledAtDateObj.getTime() - a.calledAtDateObj.getTime();
      if (isValidDate(a.calledAtDateObj)) return -1;
      if (isValidDate(b.calledAtDateObj)) return 1;
      if (isValidDate(a.createdAtDateObj) && isValidDate(b.createdAtDateObj)) return b.createdAtDateObj.getTime() - a.createdAtDateObj.getTime();
      if (isValidDate(a.createdAtDateObj)) return -1;
      if (isValidDate(b.createdAtDateObj)) return 1;
      return (b.number || 0) - (a.number || 0);
    });
    const skippedQueues = skippedQueuesRaw.slice(0, 3).map(q => ({
      number: q.number,
      serviceId: q.counterId,
      serviceName: q.serviceName,
      timestamp: isValidDate(q.calledAtDateObj) ? q.calledAtDateObj.toISOString() : (isValidDate(q.createdAtDateObj) ? q.createdAtDateObj.toISOString() : null),
      reason: q.reason
    }));
    
    Logger.log("Exiting getAdminDashboardData successfully with data: " + JSON.stringify({calling: callingQueue, nextWaiting: nextWaitingQueue, completedCount: completedQueues.length, skippedCount: skippedQueues.length}));
    
    // Prepare allQueuesForTable with ISO strings by converting DateObj properties
    const allQueuesForTableOutput = allQueues.map(q => {
        const { createdAtDateObj, calledAtDateObj, ...rest } = q; // Destructure to get DateObjs and rest of props
        return {
            ...rest, // Spread the rest of the properties
            createdAt: isValidDate(createdAtDateObj) ? createdAtDateObj.toISOString() : null,
            calledAt: isValidDate(calledAtDateObj) ? calledAtDateObj.toISOString() : null
        };
    });

    // Convert dates in callingQueue and nextWaitingQueue to ISO strings for the final output
    let finalCallingQueue = null;
    if (callingQueue) { // callingQueue is an item from allQueues, contains DateObj properties
        const { createdAtDateObj, calledAtDateObj, ...rest } = callingQueue;
        finalCallingQueue = {
            ...rest,
            createdAt: isValidDate(createdAtDateObj) ? createdAtDateObj.toISOString() : null,
            calledAt: isValidDate(calledAtDateObj) ? calledAtDateObj.toISOString() : null,
        };
        Logger.log("getAdminDashboardData: Final callingQueue before return: " + JSON.stringify(finalCallingQueue ? { number: finalCallingQueue.number, status: finalCallingQueue.status, counterId: finalCallingQueue.counterId, counterNameSoundId: finalCallingQueue.counterNameSoundId } : null));
    }

    let finalNextWaitingQueue = null;
    if (nextWaitingQueue) { // nextWaitingQueue is an item from allQueues, contains DateObj properties
        const { createdAtDateObj, calledAtDateObj, ...rest } = nextWaitingQueue;
        finalNextWaitingQueue = {
            ...rest,
            createdAt: isValidDate(createdAtDateObj) ? createdAtDateObj.toISOString() : null,
            calledAt: isValidDate(calledAtDateObj) ? calledAtDateObj.toISOString() : null,
        };
    }
    
    let recallSignal = null;
    const recallProp = PropertiesService.getScriptProperties().getProperty('last_recalled_queue');
    if (recallProp) {
      try {
        recallSignal = JSON.parse(recallProp);
      } catch (parseError) {
        Logger.log("Error parsing recall_signal property: " + parseError + ". Value: " + recallProp);
        recallSignal = null; // Reset if parsing fails
      }
    }

    // Get slideshow images from the dedicated SlideshowImages sheet
    const slideshowImagesResult = getSlideshowImagesForDisplay();

    return {
      calling: finalCallingQueue,
      nextWaiting: finalNextWaitingQueue,
      nextWaitingQueues: nextWaitingQueues, // Add the list of next waiting queues
      completed: completedQueues,
      allQueuesForTable: allQueuesForTableOutput, 
      skipped: skippedQueues,
      recallSignal: recallSignal, // Add this to the returned object
      // Add display settings
      mediaUrl: displayPageSettings.MediaURL || null,
      // Explicitly log what's being chosen for organizationName
      organizationName: (displayPageSettings.OrganizationName && displayPageSettings.OrganizationName.trim() !== "" ? displayPageSettings.OrganizationName : "Queue System"),
      slideshowImages: slideshowImagesResult.data || [], // Use .data from the getSlideshowImagesForDisplay function
      announcementPattern: activeAnnouncementPattern,
      counterAnnouncementType: activeCounterAnnouncementType,
      // Include display settings
      DisplayType: displayPageSettings.DisplayType || (slideshowImagesResult.data && slideshowImagesResult.data.length > 0 ? 'slideshow' : 'video'),
      SlideshowInterval: displayPageSettings.SlideshowInterval || 7,
      SlideshowTransition: displayPageSettings.SlideshowTransition || 'fade'
    };
  } catch (e) {
    Logger.log("CRITICAL ERROR in getAdminDashboardData: " + e.toString() + " Stack: " + e.stack);
    return { 
        calling: null, 
        nextWaiting: null, 
        nextWaitingQueues: [], // Send empty array on critical error
        completed: [], 
        skipped: [], 
        error: "Server-side exception in getAdminDashboardData: " + e.message,
        recallSignal: null,
        allQueuesForTable: [], // Send empty array on critical error
        mediaUrl: null,
        organizationName: "Error Loading Settings", // This indicates a broader settings load failure
        slideshowImages: [],
        announcementPattern: 'SOUND_TYPE_START_CALL,{QUEUE_NUMBER},SOUND_TYPE_COUNTER_PREFIX,{COUNTER_NUMBER}', // Fallback
        counterAnnouncementType: 'number', // Fallback
        DisplayType: 'video', // Default to video on error
        SlideshowInterval: 7, // Default to 7 seconds
        SlideshowTransition: 'fade' // Default to fade transition
    };
  } finally {
    // This log helps identify which execution of getAdminDashboardData we are looking at
    const user = Session.getActiveUser().getEmail() || "unknown_user_for_display";
    Logger.log("getAdminDashboardData: Execution finished for user/context: " + user);
  }
}

// ฟังก์ชันสำหรับดึงข้อมูลช่องบริการทั้งหมด
function getCounters() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_COUNTERS);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  
  const counters = [];
  for (let i = 1; i < data.length; i++) { // Skip header
    if(data[i][2] === 'active'){ // Assuming status is in the 3rd column (C)
      counters.push({
        id: data[i][0],     // Assuming ID is in the 1st column (A)
        name: data[i][1],   // Assuming Name is in the 2nd column (B)
        status: data[i][2]
      });
    }
  }
  Logger.log(counters);
  return counters;
}

// ฟังก์ชันสำหรับเพิ่มช่องบริการ
function addCounter(name, nameSoundId = null) { // Added nameSoundId parameter
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_COUNTERS);
  if (!sheet) return {success: false, message: "Counters sheet not found."};
  const data = sheet.getDataRange().getValues();
  
  // หา ID ล่าสุด
  let lastId = 0;
  for (let i = 1; i < data.length; i++) { // Skip header
    if (data[i][0] > lastId) {
      lastId = parseInt(data[i][0]);
    }
  }
  
  // เพิ่มช่องบริการใหม่
  sheet.appendRow([lastId + 1, name, 'active', nameSoundId]);
  return {success: true, id: lastId + 1, name: name, status: 'active', nameSoundId: nameSoundId};
}

// ฟังก์ชันสำหรับอัพเดทการตั้งค่า
function updateSettings(key, value) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheet) return {success: false, message: "Settings sheet not found."};
  // Also check SHEET_ANNOUNCEMENT_CONFIG
  const announcementConfigSheet = ss.getSheetByName(SHEET_ANNOUNCEMENT_CONFIG);
  if (!announcementConfigSheet) return {success: false, message: "AnnouncementConfig sheet not found."};

  let targetSheet = sheet;
  // Determine which sheet the key belongs to (simple check for now)
  if (key === 'default_announcement_pattern' || key === 'counter_announcement_type') {
    targetSheet = announcementConfigSheet;
  }

  const data = targetSheet.getDataRange().getValues();
  let keyFound = false;
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === key) {
      targetSheet.getRange(i + 1, 2).setValue(value);
      keyFound = true;
      break;
    }
  }
  if (!keyFound) {
    targetSheet.appendRow([key, value]);
  }
  return {success: true};
}

// ฟังก์ชันสำหรับดึงการตั้งค่า
function getSettings() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_SETTINGS);
 
   const settings = {}; // Initialize settings object
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) { // Skip header
     if (data[i][0]) { // Ensure key exists
        settings[data[i][0]] = data[i][1];
      }
    }
  }

  const announcementConfigSheet = ss.getSheetByName(SHEET_ANNOUNCEMENT_CONFIG);
  if (announcementConfigSheet) {
    const announcementData = announcementConfigSheet.getDataRange().getValues();
     // Find the default pattern and add its values to the settings object
    // with the keys expected by the settings page form.
    
    for (let i = 1; i < announcementData.length; i++) { // Skip header
      // PatternID (0), PatternName (1), AnnouncementPattern (2), CounterAnnouncementType (3), IsDefault (4)
      if (announcementData[i][4] === true || String(announcementData[i][4]).toUpperCase() === 'TRUE') {
        settings['default_announcement_pattern'] = announcementData[i][2];
        settings['counter_announcement_type'] = announcementData[i][3];
        break; // Found the default
      }
    }
    // If no default is found, the settings page might show empty for these fields, or use hardcoded defaults in JS.
  }

  Logger.log("Fetched settings: " + JSON.stringify(settings));
  
  return settings;
}

// Function to get the notification sound URL from settings
function getNotificationSoundUrl() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) { // Start from 1 to skip header
    if (data[i][0] === 'SoundURL') {
      return data[i][1]; 
    }
  }
  return null; 
}

// ฟังก์ชันสำหรับเรียกคิวถัดไปสำหรับช่องบริการที่กำหนด
function callNextQueueForService(counterId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const queueSheet = ss.getSheetByName(SHEET_QUEUE);
  if (!queueSheet) {
    return { success: false, message: "Queue sheet not found." };
  }

  const data = queueSheet.getDataRange().getValues();
  
  // Check if any queue is already 'calling'
  for (let i = 1; i < data.length; i++) { // Skip header
    if (data[i][Q_COL_STATUS_IDX] === 'calling') {
      return { success: false, message: 'A queue is already being called. Please complete or skip it first.' };
    }
  }

  let waitingQueues = [];
  for (let i = 1; i < data.length; i++) { // Skip header
    if (data[i][Q_COL_STATUS_IDX] === 'waiting') {
      waitingQueues.push({
        rowIndex: i + 1, // 1-based index for sheet range
        id: data[i][Q_COL_ID_IDX],
        number: parseInt(data[i][Q_COL_ID_IDX]), // Assuming ID is the queue number
        createdAt: new Date(data[i][Q_COL_CREATED_AT_IDX])
      });
    }
  }

  if (waitingQueues.length === 0) {
    return { success: false, message: 'No queues waiting to be called.' };
  }

  // Sort by queue number (ID) ascending
  waitingQueues.sort((a, b) => a.number - b.number);
  const nextQueue = waitingQueues[0];

  // Update the selected queue
  queueSheet.getRange(nextQueue.rowIndex, Q_COL_STATUS_IDX + 1).setValue('calling');
  
  // Set the CalledAt timestamp with the current date and time
  const now = new Date();
  queueSheet.getRange(nextQueue.rowIndex, Q_COL_CALLED_AT_IDX + 1).setValue(now);
  
  queueSheet.getRange(nextQueue.rowIndex, Q_COL_COUNTER_ID_IDX + 1).setValue(counterId);
  
  SpreadsheetApp.flush(); // Ensure changes are written to the spreadsheet immediately
  Logger.log(`Queue ${nextQueue.number} called for counter ${counterId}`);
  return { 
    success: true, 
    calledQueue: { number: nextQueue.number, counterId: counterId },
    message: `Queue ${nextQueue.number} is now being called at counter ${counterId}.`
  };
}

// ฟังก์ชันสำหรับทำเครื่องหมายคิวว่าเสร็จสิ้น
function markQueueAsCompleted() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const queueSheet = ss.getSheetByName(SHEET_QUEUE);
  if (!queueSheet) {
    return { success: false, message: "Queue sheet not found." };
  }

  const data = queueSheet.getDataRange().getValues();
  let queueFound = false;
  let completedQueueNumber = null;

  for (let i = 1; i < data.length; i++) { // Skip header
    if (data[i][Q_COL_STATUS_IDX] === 'calling') {
      queueSheet.getRange(i + 1, Q_COL_STATUS_IDX + 1).setValue('completed');
      // Optionally, set a 'CompletedAt' timestamp if you add such a column
      queueFound = true;
      completedQueueNumber = data[i][Q_COL_ID_IDX];
      Logger.log(`Queue ${completedQueueNumber} marked as completed.`);
      break; 
    }
  }

  if (queueFound) {
    return { success: true, message: `Queue ${completedQueueNumber} marked as completed.` };
  } else {
    return { success: false, message: 'No queue is currently being called.' };
  }
}

// ฟังก์ชันสำหรับทำเครื่องหมายคิวว่าถูกข้าม
function markQueueAsSkipped(reason) {
  if (!reason || reason.trim() === "") {
    // You might want to enforce a reason or allow skipping without one
    // For now, let's default it if empty, or you can return an error.
    reason = "No reason provided"; 
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const queueSheet = ss.getSheetByName(SHEET_QUEUE);
  if (!queueSheet) {
    return { success: false, message: "Queue sheet not found." };
  }

  const data = queueSheet.getDataRange().getValues();
  let queueFound = false;
  let skippedQueueNumber = null;

  for (let i = 1; i < data.length; i++) { // Skip header
    if (data[i][Q_COL_STATUS_IDX] === 'calling') {
      queueSheet.getRange(i + 1, Q_COL_STATUS_IDX + 1).setValue('skipped');
      queueSheet.getRange(i + 1, Q_COL_REASON_FOR_SKIP_IDX + 1).setValue(reason);
      // Optionally, set a 'SkippedAt' timestamp if you add such a column
      queueFound = true;
      skippedQueueNumber = data[i][Q_COL_ID_IDX];
      Logger.log(`Queue ${skippedQueueNumber} marked as skipped. Reason: ${reason}`);
      break; 
    }
  }

  if (queueFound) {
    return { success: true, message: `Queue ${skippedQueueNumber} marked as skipped.` };
  } else {
    return { success: false, message: 'No queue is currently being called.' };
  }
}

function getServedUrl(pageName) {
  if (!pageName) {
    Logger.log("getServedUrl: pageName was not provided. Returning base URL of the web app.");
    return ScriptApp.getService().getUrl(); // Returns the base URL of the deployed web app.
  }
  // Construct the URL with the page parameter.
  const url = ScriptApp.getService().getUrl() + "?page=" + pageName.toLowerCase();
  Logger.log("getServedUrl: Generated URL for page '" + pageName + "': " + url);
  return url;
}

// Function to get all sound URLs from the Sound sheet
function getSoundUrls() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const soundSheet = ss.getSheetByName(SHEET_SOUND);
    if (!soundSheet) {
      Logger.log("Sound sheet not found.");
      return { error: "Sound sheet not found.", digits: {}, types: {}, rawById: {} };
    }
    const data = soundSheet.getDataRange().getValues();
    const soundMap = {
      digits: {},      // For 'digit_0', 'digit_1', ...
      types: {},       // For 'start_call', 'end_call', 'counter_prefix', ...
      rawById: {}      // For direct lookup by sound ID, e.g. for counter name sounds
    };

    for (let i = 1; i < data.length; i++) {
      const soundId = data[i][SND_COL_ID_IDX] ? data[i][SND_COL_ID_IDX].toString().trim() : null;
      const linkSound = data[i][SND_COL_LINK_IDX] ? data[i][SND_COL_LINK_IDX].toString().trim() : "";
      const soundType = data[i][SND_COL_TYPE_IDX] ? data[i][SND_COL_TYPE_IDX].toString().trim().toLowerCase() : "";

      if (soundId && linkSound && soundType) {
        soundMap.rawById[soundId] = linkSound; // Always map by ID

        if (soundType.startsWith("digit_")) {
          const digit = soundType.replace("digit_", "");
          soundMap.digits[digit] = linkSound;
        } else if (soundType === "start_call" || 
                   soundType === "end_call" || 
                   soundType === "counter_prefix" /* add other specific types here */) {
          soundMap.types[soundType] = linkSound;
        }
        // 'general_purpose' sounds are available via rawById
      } else {
        if (i > 0 && (data[i][SND_COL_ID_IDX] || data[i][SND_COL_NAME_IDX])) { // Log if it looks like a data row but is incomplete
            Logger.log(`Skipping sound row ${i+1} due to missing ID, link, or type. ID: ${soundId}, Link: ${linkSound}, Type: ${soundType}`);
        }
      }
    }
    // Fallback for old keys if new types are not yet fully adopted or for backward compatibility during transition
    // This part can be removed once soundType is consistently used.
    if (!soundMap.types.start_call && soundMap.rawById['11']) soundMap.types.start_call = soundMap.rawById['11']; // Assuming ID 11 was 'start'
    if (!soundMap.types.end_call && soundMap.rawById['12']) soundMap.types.end_call = soundMap.rawById['12'];     // Assuming ID 12 was 'end'
    if (!soundMap.types.counter_prefix && soundMap.rawById['13']) soundMap.types.counter_prefix = soundMap.rawById['13']; // Assuming ID 13 was 'counter_prefix'

    Logger.log("Sound map created: " + JSON.stringify(soundMap));
    return soundMap;
  } catch (e) {
    Logger.log("Error in getSoundUrls: " + e.toString() + " Stack: " + e.stack);
    return { error: "Server error fetching sound URLs: " + e.message };
  }
}

// Function to signal the display page to recall a queue's sound
function recallQueueForDisplay(queueNumber, counterId) {
  try {
    // Validate inputs (basic validation)
    if (queueNumber == null || counterId == null) {
      Logger.log("recallQueueForDisplay: Invalid queueNumber or counterId.");
      return { success: false, message: "Invalid queue number or counter ID provided for recall." };
    }

    // We don't necessarily need to check the sheet here if the admin page ensures
    // currentCallingQueue is valid. The main purpose is to set the property.
    // However, logging the attempt is good.
    Logger.log(`Attempting to set recall signal for Queue ${queueNumber} at Counter ${counterId}.`);

    PropertiesService.getScriptProperties().setProperty('last_recalled_queue', JSON.stringify({
      number: queueNumber,
      counterId: counterId,
      timestamp: new Date().getTime() // Unique timestamp for each recall
    }));

    Logger.log(`Recall signal set for Queue ${queueNumber} at Counter ${counterId}.`);
    return { success: true, message: `Recall signal sent for queue ${queueNumber}.` };

  } catch (e) {
    Logger.log(`Error in recallQueueForDisplay: ${e.toString()} Stack: ${e.stack}`);
    return { 
      success: false, 
      message: `Server error during recall operation: ${e.message}` 
    };
  }
}

/**
 * Clears the last recalled queue signal from script properties.
 * This is typically called by the client after it has processed a recall signal.
 */
function clearRecallSignal() {
  try {
    PropertiesService.getScriptProperties().deleteProperty('last_recalled_queue');
    Logger.log("Recall signal cleared from script properties.");
    return { success: true, message: "Recall signal cleared." };
  } catch (e) {
    Logger.log("Error clearing recall signal: " + e.toString());
    return { success: false, message: "Error clearing recall signal: " + e.message };
  }
}


// ฟังก์ชันสำหรับรีเซ็ตเลขคิว
function resetQueueSystem(startNumber) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const queueSheet = ss.getSheetByName(SHEET_QUEUE);
  const settingsSheet = ss.getSheetByName(SHEET_SETTINGS);

  // Validate startNumber
  const numStartNumber = parseInt(startNumber);
  if (isNaN(numStartNumber) || numStartNumber < 1) {
    Logger.log("Invalid startNumber for reset: " + startNumber + ". Defaulting to 1.");
    startNumber = 1;
  } else {
    startNumber = numStartNumber;
  }

  // Update NextQueueNumber in Settings
  const settingsData = settingsSheet.getDataRange().getValues();
  let foundSetting = false;
  for (let i = 1; i < settingsData.length; i++) { // Skip header
    if (settingsData[i][0] === 'NextQueueNumber') {
      settingsSheet.getRange(i + 1, 2).setValue(startNumber);
      foundSetting = true;
      break;
    }
  }
  if (!foundSetting) { // Should not happen if initializeSystem ran
    settingsSheet.appendRow(['NextQueueNumber', startNumber]);
    Logger.log("Appended NextQueueNumber setting as it was not found during resetQueueSystem.");
  }

  // ล้างข้อมูลใน Queue sheet (ยกเว้น header)
  if (queueSheet.getLastRow() > 1) {
    queueSheet.getRange(2, 1, queueSheet.getLastRow() - 1, queueSheet.getLastColumn()).clearContent();
  }
  Logger.log("Queue system reset. Next queue will start from: " + startNumber);
  return `รีเซ็ตระบบคิวเรียบร้อยแล้ว เลขคิวถัดไปจะเริ่มจาก ${startNumber}`;
}

// --- Slideshow Image Management Functions ---

/**
 * Fetches active slideshow images for the display page.
 * This function retrieves images from the SlideshowImages sheet,
 * filtering by the IsActive flag and sorting by DisplayOrder.
 */
function getSlideshowImagesForDisplay() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_SLIDESHOW_IMAGES);
    if (!sheet) {
      Logger.log("SlideshowImages sheet not found in getSlideshowImagesForDisplay.");
      return { success: false, message: "ไม่พบชีท SlideshowImages", data: [] };
    }
    const range = sheet.getDataRange();
    const values = range.getValues();
    const images = [];

    // Start from row 1 to skip header
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const isActive = row[SLI_COL_IS_ACTIVE_IDX];
      // Only include active images
      if (isActive === true || (typeof isActive === 'string' && isActive.toLowerCase() === 'true')) {
        if (row[SLI_COL_IMAGE_URL_IDX]) { // Ensure URL exists
            images.push({
                id: row[SLI_COL_ID_IDX] ? row[SLI_COL_ID_IDX].toString() : null,
                url: row[SLI_COL_IMAGE_URL_IDX].toString(),
                title: row[SLI_COL_TITLE_IDX] ? row[SLI_COL_TITLE_IDX].toString() : "",
                order: row[SLI_COL_DISPLAY_ORDER_IDX] ? parseInt(row[SLI_COL_DISPLAY_ORDER_IDX]) : 0
            });
        }
      }
    }

    // Sort by display order
    images.sort((a, b) => a.order - b.order);
    Logger.log(`Fetched ${images.length} active slideshow images for display.`);
    return { success: true, data: images.map(img => ({ url: img.url, title: img.title })) }; // Return only url and title for display
  } catch (e) {
    Logger.log("Error in getSlideshowImagesForDisplay: " + e.toString() + " Stack: " + e.stack);
    return { success: false, message: "Server error fetching slideshow images: " + e.message, data: [] };
  }
}

/**
 * Fetches all slideshow images for the admin panel.
 */
function getAllSlideshowImagesAdmin() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_SLIDESHOW_IMAGES);
    if (!sheet) {
      Logger.log("SlideshowImages sheet not found in getAllSlideshowImagesAdmin.");
      return { success: false, message: "ไม่พบชีท SlideshowImages", data: [] };
    }
    const values = sheet.getDataRange().getValues();
    const images = [];
    for (let i = 1; i < values.length; i++) { // Skip header
      if (values[i][SLI_COL_ID_IDX] && values[i][SLI_COL_IMAGE_URL_IDX]) { // ID and URL are essential
        images.push({
          id: values[i][SLI_COL_ID_IDX].toString(),
          imageUrl: values[i][SLI_COL_IMAGE_URL_IDX].toString(),
          title: values[i][SLI_COL_TITLE_IDX] ? values[i][SLI_COL_TITLE_IDX].toString() : "",
          displayOrder: values[i][SLI_COL_DISPLAY_ORDER_IDX] ? parseInt(values[i][SLI_COL_DISPLAY_ORDER_IDX]) : 0,
          isActive: values[i][SLI_COL_IS_ACTIVE_IDX] === true || (typeof values[i][SLI_COL_IS_ACTIVE_IDX] === 'string' && values[i][SLI_COL_IS_ACTIVE_IDX].toLowerCase() === 'true')
        });
      }
    }
    Logger.log(`Fetched ${images.length} slideshow images for admin.`);
    return { success: true, data: images };
  } catch (e) {
    Logger.log("Error in getAllSlideshowImagesAdmin: " + e.toString() + " Stack: " + e.stack);
    return { success: false, message: "Server error fetching slideshow images for admin: " + e.message, data: [] };
  }
}

/**
 * Adds a new slideshow image.
 */
function addSlideshowImage(imageData) { // imageData = { imageUrl, title, displayOrder, isActive }
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_SLIDESHOW_IMAGES);
    if (!sheet) return { success: false, message: "ไม่พบชีท SlideshowImages" };

    const lastRow = sheet.getLastRow();
    let nextId = 1;
    let maxOrder = 0;
    if (lastRow > 0) { // Check if there's at least a header
        const idColumnValues = sheet.getRange(2, SLI_COL_ID_IDX + 1, Math.max(1, lastRow -1), 1).getValues().flat();
        const numericIds = idColumnValues.map(id => parseInt(id)).filter(id => !isNaN(id));
        if (numericIds.length > 0) {
            nextId = Math.max(...numericIds) + 1;
        } else if (lastRow > 0 && idColumnValues.length === 0) { // Header exists, but no numeric IDs yet
            nextId = 1;
        } else if (lastRow > 0) {
            nextId = lastRow; // Fallback, might need adjustment if IDs aren't purely sequential/numeric
        }

        const orderColumnValues = sheet.getRange(2, SLI_COL_DISPLAY_ORDER_IDX + 1, Math.max(1, lastRow -1), 1).getValues().flat();
        const numericOrders = orderColumnValues.map(o => parseInt(o)).filter(o => !isNaN(o));
        if (numericOrders.length > 0) {
            maxOrder = Math.max(...numericOrders);
        }
    }
    const displayOrder = imageData.displayOrder !== undefined ? imageData.displayOrder : maxOrder + 1;

    sheet.appendRow([
      nextId.toString(),
      imageData.imageUrl,
      imageData.title || "",
      displayOrder,
      imageData.isActive === undefined ? true : imageData.isActive
    ]);
    Logger.log(`Added slideshow image: ID=${nextId}, URL=${imageData.imageUrl}`);
    return { success: true, message: "เพิ่มรูปภาพสไลด์โชว์สำเร็จ", newImage: { id: nextId.toString(), ...imageData, displayOrder: displayOrder } };
  } catch (e) {
    Logger.log("Error in addSlideshowImage: " + e.toString() + " Stack: " + e.stack);
    return { success: false, message: "เกิดข้อผิดพลาดในการเพิ่มรูปภาพ: " + e.message };
  }
}

/**
 * Updates an existing slideshow image.
 */
function updateSlideshowImage(id, imageData) { // imageData = { imageUrl, title, displayOrder, isActive }
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_SLIDESHOW_IMAGES);
    if (!sheet) return { success: false, message: "ไม่พบชีท SlideshowImages" };

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) { // Skip header
      if (data[i][SLI_COL_ID_IDX] && data[i][SLI_COL_ID_IDX].toString().trim() === id.toString().trim()) {
        if (imageData.imageUrl !== undefined) sheet.getRange(i + 1, SLI_COL_IMAGE_URL_IDX + 1).setValue(imageData.imageUrl);
        if (imageData.title !== undefined) sheet.getRange(i + 1, SLI_COL_TITLE_IDX + 1).setValue(imageData.title);
        if (imageData.displayOrder !== undefined) sheet.getRange(i + 1, SLI_COL_DISPLAY_ORDER_IDX + 1).setValue(imageData.displayOrder);
        if (imageData.isActive !== undefined) sheet.getRange(i + 1, SLI_COL_IS_ACTIVE_IDX + 1).setValue(imageData.isActive);
        
        Logger.log(`Updated slideshow image: ID=${id}`);
        return { success: true, message: "อัปเดตข้อมูลรูปภาพสไลด์โชว์สำเร็จ", updatedData: {id: id, ...imageData} };
      }
    }
    Logger.log(`Slideshow image ID not found for update: ${id}`);
    return { success: false, message: "ไม่พบ ID รูปภาพที่ต้องการอัปเดต" };
  } catch (e) {
    Logger.log("Error in updateSlideshowImage: " + e.toString() + " Stack: " + e.stack);
    return { success: false, message: "เกิดข้อผิดพลาดในการอัปเดตข้อมูลรูปภาพ: " + e.message };
  }
}

/**
 * Deletes a slideshow image by ID.
 */
function deleteSlideshowImage(id) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_SLIDESHOW_IMAGES);
    if (!sheet) return { success: false, message: "ไม่พบชีท SlideshowImages" };

    const data = sheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) { // Iterate backwards for safe deletion, skip header
      if (data[i][SLI_COL_ID_IDX] && data[i][SLI_COL_ID_IDX].toString().trim() === id.toString().trim()) {
        sheet.deleteRow(i + 1); // i is 0-based for data array, sheet rows are 1-based
        Logger.log(`Deleted slideshow image: ID=${id}`);
        return { success: true, message: "ลบรูปภาพสไลด์โชว์สำเร็จ" };
      }
    }
    Logger.log(`Slideshow image ID not found for deletion: ${id}`);
    return { success: false, message: "ไม่พบ ID รูปภาพที่ต้องการลบ" };
  } catch (e) {
    Logger.log("Error in deleteSlideshowImage: " + e.toString() + " Stack: " + e.stack);
    return { success: false, message: "เกิดข้อผิดพลาดในการลบรูปภาพ: " + e.message };
  }
}

// d:\Github\Queue-augment\Code.js

// ... (existing code) ...

function updateMultipleSettings(settingsToUpdate) {
  // settingsToUpdate is an object like { "OrganizationName": "New Name", "MediaURL": "new_url" }
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheet) return {success: false, message: "Settings sheet not found."};
  
  const data = sheet.getDataRange().getValues();
  let updatedCount = 0;
  let errors = [];
  let announcementConfigSheet = null; // Lazy load

  for (const keyToUpdate in settingsToUpdate) {
    if (settingsToUpdate.hasOwnProperty(keyToUpdate)) {
      const valueToUpdate = settingsToUpdate[keyToUpdate];
      let keyFound = false;
      let currentSheet = sheet;
      let currentSheetData = data;

      if (keyToUpdate === 'default_announcement_pattern' || keyToUpdate === 'counter_announcement_type') {
        if (!announcementConfigSheet) announcementConfigSheet = ss.getSheetByName(SHEET_ANNOUNCEMENT_CONFIG);
       if (announcementConfigSheet) {
          const announcementData = announcementConfigSheet.getDataRange().getValues();
          let defaultPatternRowIndex = -1;
          for (let i = 1; i < announcementData.length; i++) { // Skip header
            if (announcementData[i][4] === true || String(announcementData[i][4]).toUpperCase() === 'TRUE') {
              defaultPatternRowIndex = i + 1; // 1-based index
              break;
            }
          }

          if (defaultPatternRowIndex !== -1) {
            const colToUpdate = (keyToUpdate === 'default_announcement_pattern') ? 3 : 4; // AnnouncementPattern is col 3 (index 2), CounterAnnouncementType is col 4 (index 3)
            announcementConfigSheet.getRange(defaultPatternRowIndex, colToUpdate).setValue(valueToUpdate);
            updatedCount++;
            keyFound = true; // Mark as handled
          } else {
            errors.push(`Could not find a default pattern to update for ${keyToUpdate}.`);
          }
        } else {
          errors.push(`AnnouncementConfig sheet not found for key ${keyToUpdate}.`);
        }
      } else { // Handle other settings in SHEET_SETTINGS
        for (let i = 0; i < currentSheetData.length; i++) { // Iterate through SHEET_SETTINGS data
          if (currentSheetData[i][0] === keyToUpdate) {
            try {
              currentSheet.getRange(i + 1, 2).setValue(valueToUpdate);
              keyFound = true;
              updatedCount++;
              break; 
            } catch (e) {
              errors.push(`Error updating ${keyToUpdate}: ${e.message}`);
              Logger.log(`Error updating setting ${keyToUpdate}: ${e.message}`);
            }
          }
        }
        if (!keyFound) { // If key not found in SHEET_SETTINGS, append it
          try {
            currentSheet.appendRow([keyToUpdate, valueToUpdate]);
            updatedCount++;
          } catch (e) {
            errors.push(`Error appending ${keyToUpdate}: ${e.message}`);
            Logger.log(`Error appending setting ${keyToUpdate}: ${e.message}`);
          }        
        }
      }
    }
  }

  if (errors.length > 0) {
    return {success: false, message: `อัปเดต ${updatedCount} รายการ, แต่เกิดข้อผิดพลาด: ${errors.join("; ")}`, updatedCount: updatedCount};
  }
  if (updatedCount > 0) {
    return {success: true, message: `อัปเดตการตั้งค่า ${updatedCount} รายการสำเร็จ`};
  }
  return {success: true, message: "ไม่มีการเปลี่ยนแปลงข้อมูลการตั้งค่า"};
}

function getAllSoundData() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const soundSheet = ss.getSheetByName(SHEET_SOUND);
    if (!soundSheet) {
      Logger.log("Sound sheet not found in getAllSoundData.");
      return { success: false, message: "ไม่พบชีท Sound", data: [] };
    }
    const data = soundSheet.getDataRange().getValues();
    const sounds = [];
   
    for (let i = 1; i < data.length; i++) {
       if (data[i][SND_COL_ID_IDX] && data[i][SND_COL_NAME_IDX]) { // ID and Name are mandatory
        sounds.push({
         id: data[i][SND_COL_ID_IDX].toString().trim(),
          nameSound: data[i][SND_COL_NAME_IDX].toString().trim(),
          linkSound: data[i][SND_COL_LINK_IDX] ? data[i][SND_COL_LINK_IDX].toString().trim() : "",
          description: data[i][SND_COL_DESC_IDX] ? data[i][SND_COL_DESC_IDX].toString().trim() : "",
          soundType: data[i][SND_COL_TYPE_IDX] ? data[i][SND_COL_TYPE_IDX].toString().trim() : "general_purpose"
      
        });
      }
    }
    return { success: true, data: sounds };
  } catch (e) {
    Logger.log("Error in getAllSoundData: " + e.toString() + " Stack: " + e.stack);
    return { success: false, message: "Server error fetching sound data: " + e.message, data: [] };
  }
}

function addSoundData(nameSound, linkSound, description, soundType) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const soundSheet = ss.getSheetByName(SHEET_SOUND);
    if (!soundSheet) return { success: false, message: "ไม่พบชีท Sound" };

    const lastRow = soundSheet.getLastRow();
    let nextId = 1;
    if (lastRow >= 1) { // Check if there's at least a header or data
        // Get all IDs to find the max, more robust than just last row's ID
        const idColumnValues = soundSheet.getRange(2, 1, Math.max(1, lastRow -1), 1).getValues().flat();
        const numericIds = idColumnValues.map(id => parseInt(id)).filter(id => !isNaN(id));
        if (numericIds.length > 0) {
            nextId = Math.max(...numericIds) + 1;
        } else if (lastRow > 0) { // If no numeric IDs but rows exist (e.g. header only or non-numeric IDs)
             nextId = lastRow; // This might need adjustment if IDs are not sequential or numeric
        }
    }
    // If sheet is completely empty (no header), nextId remains 1.
    // If only header, lastRow is 1, nextId becomes 1.
    // If header + 1 data row with ID 1, nextId becomes 2.

    soundSheet.appendRow([nextId.toString(), nameSound, linkSound, description, soundType]);
    Logger.log(`Added sound: ID=${nextId}, Name=${nameSound}, Description=${description}, Type=${soundType}`);
    return { success: true, message: "เพิ่มข้อมูลเสียงสำเร็จ", newSound: {id: nextId.toString(), nameSound: nameSound, linkSound: linkSound, description: description, soundType: soundType } };
  } catch (e) {
    Logger.log("Error in addSoundData: " + e.toString() + " Stack: " + e.stack);
    return { success: false, message: "เกิดข้อผิดพลาดในการเพิ่มข้อมูลเสียง: " + e.message };
  }
}

function updateSoundData(id, nameSound, linkSound, description, soundType) {
  
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const soundSheet = ss.getSheetByName(SHEET_SOUND);
    if (!soundSheet) return { success: false, message: "ไม่พบชีท Sound" };

    const data = soundSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) { 
       if (data[i][SND_COL_ID_IDX].toString().trim() === id.toString().trim()) {
        soundSheet.getRange(i + 1, SND_COL_NAME_IDX + 1).setValue(nameSound);
        soundSheet.getRange(i + 1, SND_COL_LINK_IDX + 1).setValue(linkSound);
        soundSheet.getRange(i + 1, SND_COL_DESC_IDX + 1).setValue(description);
        soundSheet.getRange(i + 1, SND_COL_TYPE_IDX + 1).setValue(soundType);
        Logger.log(`Updated sound: ID=${id}, Name=${nameSound}, Desc=${description}, Type=${soundType}`);
        return { success: true, message: "อัปเดตข้อมูลเสียงสำเร็จ", updatedSound: {id: id, nameSound: nameSound, linkSound: linkSound, description: description, soundType: soundType } };
     }
    }
    Logger.log(`Sound ID not found for update: ${id}`);
    return { success: false, message: "ไม่พบ ID เสียงที่ต้องการอัปเดต" };
  } catch (e) {
    Logger.log("Error in updateSoundData: " + e.toString() + " Stack: " + e.stack);
    return { success: false, message: "เกิดข้อผิดพลาดในการอัปเดตข้อมูลเสียง: " + e.message };
  }
}

function deleteSoundData(id) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const soundSheet = ss.getSheetByName(SHEET_SOUND);
    if (!soundSheet) return { success: false, message: "ไม่พบชีท Sound" };

    const data = soundSheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) { // Iterate backwards for safe deletion
      if (data[i][SND_COL_ID_IDX].toString().trim() === id.toString().trim()) {
        soundSheet.deleteRow(i + 1);
        Logger.log(`Deleted sound: ID=${id}`);
        return { success: true, message: "ลบข้อมูลเสียงสำเร็จ" };
      }
    }
    Logger.log(`Sound ID not found for deletion: ${id}`);
    return { success: false, message: "ไม่พบ ID เสียงที่ต้องการลบ" };
  } catch (e) {
    Logger.log("Error in deleteSoundData: " + e.toString() + " Stack: " + e.stack);
    return { success: false, message: "เกิดข้อผิดพลาดในการลบข้อมูลเสียง: " + e.message };
  }
}

// ... (rest of existing Code.js) ...
// ฟังก์ชันสำหรับดึงข้อมูลช่องบริการทั้งหมดสำหรับหน้า Admin
function getAllCountersAdmin() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_COUNTERS);
  if (!sheet) {
    Logger.log("Counters sheet not found in getAllCountersAdmin.");
    return { success: false, message: "ไม่พบชีท Counters", data: [] };
  }
  const data = sheet.getDataRange().getValues();
  const counters = [];
  // Skip header row (i=0)
  for (let i = 1; i < data.length; i++) {
    // Ensure ID (data[i][0]), Name (data[i][1]), and Status (data[i][2]) exist
    if (data[i][0]) { // Ensure ID exists
      // Column indices: ID=0, Name=1, Status=2, NameSoundID=3 (CTR_COL_NAMESOUNDID_IDX)
      counters.push({
        id: data[i][0].toString().trim(),
        name: data[i][1] ? data[i][1].toString().trim() : "Unnamed Counter", // Added name
       status: data[i][2] ? data[i][2].toString().trim() : "inactive", // Default to inactive if status is missing
        nameSoundId: data[i][CTR_COL_NAMESOUNDID_IDX] ? data[i][CTR_COL_NAMESOUNDID_IDX].toString().trim() : null
      });

    }
  }
  return { success: true, data: counters };
}

// ฟังก์ชันสำหรับอัปเดตช่องบริการ (ชื่อ และ/หรือ สถานะ)
function updateCounter(id, name, status, nameSoundId) { // Added nameSoundId
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_COUNTERS);
    if (!sheet) return { success: false, message: "ไม่พบชีท Counters" };

    const data = sheet.getDataRange().getValues();
    let found = false;
    for (let i = 1; i < data.length; i++) { // Skip header
      if (data[i][0].toString().trim() === id.toString().trim()) {
        if (name !== undefined && name !== null) {
           sheet.getRange(i + 1, 2).setValue(name); // Column B for Name
        }
        if (status !== undefined && status !== null) {
           sheet.getRange(i + 1, 3).setValue(status); // Column C for Status
        }
        if (nameSoundId !== undefined) { // Allow setting to null
           sheet.getRange(i + 1, CTR_COL_NAMESOUNDID_IDX + 1).setValue(nameSoundId); // Column D for NameSoundID
        }
        found = true;
       Logger.log(`Counter updated: ID=${id}, Name=${name}, Status=${status}, NameSoundID=${nameSoundId}`);
       break; // Exit loop once found and updated
      
      }
    }
    if (found) {
      return { success: true, message: "อัปเดตช่องบริการสำเร็จ" };
    } else {
      return { success: false, message: "ไม่พบ ID ช่องบริการที่ต้องการอัปเดต" };
    }
  } catch (e) {
    Logger.log("Error in updateCounter: " + e.toString() + " Stack: " + e.stack);
    return { success: false, message: "เกิดข้อผิดพลาดในการอัปเดตช่องบริการ: " + e.message };
  }
}

// ฟังก์ชันสำหรับลบช่องบริการ
function deleteCounter(id) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_COUNTERS);
    if (!sheet) return { success: false, message: "ไม่พบชีท Counters" };

    const data = sheet.getDataRange().getValues();
    let found = false;
    // Iterate backwards for safe deletion by row index
    for (let i = data.length - 1; i >= 1; i--) { 
      if (data[i][0].toString().trim() === id.toString().trim()) {
        sheet.deleteRow(i + 1); // i is 0-based for data array, sheet rows are 1-based
        found = true;
        Logger.log(`Deleted counter: ID=${id}`);
        break;
      }
    }
    if (found) {
      return { success: true, message: "ลบช่องบริการสำเร็จ" };
    } else {
      return { success: false, message: "ไม่พบ ID ช่องบริการที่ต้องการลบ" };
    }
  } catch (e) {
    Logger.log("Error in deleteCounter: " + e.toString() + " Stack: " + e.stack);
    return { success: false, message: "เกิดข้อผิดพลาดในการลบช่องบริการ: " + e.message };
  }
}
