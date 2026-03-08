function doGet(e) {
  // GitHubからのリクエストに対してデータをJSONで返す
  const userId = e.parameter.id || "tomohiro.19";
  const data = getPortalData(userId);
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  // 録音データを受け取って指定のGoogleドライブフォルダに保存する
  const params = JSON.parse(e.postData.contents);
  const audioData = Utilities.base64Decode(params.audioBase64);
  const fileName = `${params.userId}_${params.app}_${params.theme}_${new Date().getTime()}.webm`;
  
  // 指定されたフォルダID: 1Jk4094X_3Mhr2tz2rpDFipnovdCYKc5s
  const FOLDER_ID = "1Jk4094X_3Mhr2tz2rpDFipnovdCYKc5s"; 
  const folder = DriveApp.getFolderById(FOLDER_ID);
  
  const file = folder.createFile(Utilities.newBlob(audioData, "audio/webm", fileName));
  // Set sharing so anyone with the link can view
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  // Construct direct audio link
  const audioLink = `https://docs.google.com/uc?export=download&id=${file.getId()}`;
  return ContentService.createTextOutput(JSON.stringify({ success: true, audioUrl: audioLink }))
    .setMimeType(ContentService.MimeType.JSON);
}

// 既存のデータ取得ロジック（最新の状態を維持）
function getPortalData(userId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Sentence Building (旧Chunk)
  const chunkSheet = ss.getSheetByName("Sheet1"); 
  let chunkData = [];
  if (chunkSheet) {
    const rows = chunkSheet.getDataRange().getValues().slice(1);
    chunkData = rows.map(row => ({
      lesson: String(row[0]).trim(), theme: String(row[1]).trim(), point: String(row[2]).trim(),
      sentence: String(row[3]), answer: String(row[4]),
      exam_1: row.slice(5, 35).map(v => String(v)), exam_2: row.slice(35, 65).map(v => String(v)), exam_3: row.slice(65, 95).map(v => String(v))
    })).filter(item => item.lesson !== "");
  }

  // 2. Grammar
  const grammarSs = SpreadsheetApp.openById("1LEw95D2dEKOAwU2Rb516vq7uHSC97z6-DA3BH_3tDVs");
  const grammarSheet = grammarSs.getSheetByName("梶山") || grammarSs.getSheets()[0];
  let grammarData = [];
  if (grammarSheet) {
    const gRows = grammarSheet.getDataRange().getValues().slice(1);
    grammarData = gRows.map(row => ({
      category: String(row[0] || ""), question: String(row[1] || ""), answer: String(row[2] || ""),
      option2: String(row[3] || ""), option3: String(row[4] || ""), option4: String(row[5] || ""), explanation: String(row[6] || "")
    })).filter(item => item.question !== "");
  }
  const manualDataMap = {};
  const gManualSheet = grammarSs.getSheetByName("マニュアル");
  if (gManualSheet) {
    gManualSheet.getDataRange().getValues().forEach(r => manualDataMap[String(r[0]).trim()] = String(r[1] || ""));
  }

  // 3. Reading
  const readingSs = SpreadsheetApp.openById("1z-2SiGESlHhAX35o1YgGwpbkgd6u3qNWvgbv3PsAo3M");
  const readingSheet = readingSs.getSheetByName("梶山") || readingSs.getSheets()[0];
  let readingData = [];
  if (readingSheet) {
    const rRows = readingSheet.getDataRange().getValues().slice(1);
    readingData = rRows.map(row => {
      let keywords = [];
      for (let i = 0; i < 6; i++) {
        let sIdx = 2 + (i * 6);
        if (row[sIdx]) keywords.push({ word: String(row[sIdx]), meaning: String(row[sIdx+1]), phonetic: String(row[sIdx+2]), pos: String(row[sIdx+3]), example: String(row[sIdx+4]), example_ja: String(row[sIdx+5]) });
      }
      return { category: String(row[0]), theme: String(row[1]), keywords: keywords, article: String(row[38]), training_topic: String(row[39]) };
    }).filter(item => item.theme && item.theme !== "");
  }

  // 4. Shadowing
  const shadowingSs = SpreadsheetApp.openById("1rWWmACIVy7kzZE2RReE_DnGFY3sPMWJzq87Z4i1DDUo");
  const shadowingSheet = shadowingSs.getSheetByName("Sheet1");
  let shadowingData = [];
  if (shadowingSheet) {
    const sRows = shadowingSheet.getDataRange().getValues().slice(1);
    const grouped = {};
    sRows.forEach(row => {
      const mat = String(row[0]||"").trim(), no = String(row[1]||"").trim();
      if (!mat || !no) return;
      const key = mat + "_" + no; 
      // Store direct audio link instead of just ID
      if (!grouped[key]) {
        const audioId = String(row[7]);
        const audioUrl = audioId ? `https://docs.google.com/uc?export=download&id=${audioId}` : "";
        grouped[key] = { lesson: mat, theme: no, audioUrl: audioUrl, text: String(row[8]), highlights: [] };
      }
      if (row[2] && row[3]) grouped[key].highlights.push({ type: String(row[2]), target: String(row[3]), symbol: String(row[4]), katakana: String(row[5]), explanation: String(row[6]) });
    });
    shadowingData = Object.values(grouped);
  }

  // 5. Pronunciation
  const phSs = SpreadsheetApp.openById("1lBdocIdicG7p3QGqVhwsxzwfpAwnWjtSsqm0t2VPwjY");
  const phSheet = phSs.getSheets()[0];
  let pronunciationData = [];
  if (phSheet) {
    const pRows = phSheet.getDataRange().getValues().slice(1);
    pronunciationData = pRows.map(row => {
      const videos = [row[6], row[7], row[8], row[9], row[10], row[11]].map(v => String(v||"").trim()).filter(v => v.includes('<iframe'));
      return { category: String(row[0]||""), point: String(row[1]||""), word: String(row[2]||""), symbol: String(row[3]||""), katakana: String(row[4]||""), translation: String(row[5]||""), videos: videos };
    }).filter(i => i.word.trim() !== "");
  }
  let phManuals = {};
  const phManualSheet = phSs.getSheetByName("Manuals");
  if (phManualSheet) {
    phManualSheet.getDataRange().getValues().forEach(r => { if (r[0]) phManuals[String(r[0]).toLowerCase().trim()] = r[1]; });
  }

  // 6. Speaking Form
  const spSs = SpreadsheetApp.openById("1ZXEfA--ghGMNUoPNU3pBpIgy-ySNp4O51x-lxK1kUIU");
  const spSheet = spSs.getSheets()[0];
  let speakingData = [];
  if (spSheet) {
    const spRows = spSheet.getDataRange().getValues().slice(1);
    speakingData = spRows.map(row => ({
      category: String(row[0]||"").trim(), theme: String(row[1]||"").trim(), point: String(row[2]||"").trim(),
      background: String(row[3]||"").trim(), example: String(row[4]||"").trim(), assignment: String(row[5]||"").trim(), rules: String(row[6]||"").trim()
    })).filter(item => item.theme !== "");
  }

  // 7. Vocabulary
  const vocSs = SpreadsheetApp.openById("1hPHopHRYNSqZi0aY4mRHaTkh3IVAuff1z-nj6d3f9G8");
  const vocAdmin = vocSs.getSheetByName("管理用");
  let personalSheetName = "梶山"; 
  if (vocAdmin) {
    const vAdminData = vocAdmin.getDataRange().getValues();
    for(let i=1; i<vAdminData.length; i++) { if(String(vAdminData[i][0]).trim() === userId) { personalSheetName = String(vAdminData[i][1]).trim(); break; } }
  }
  const vocSheet = vocSs.getSheetByName(personalSheetName);
  let vocabularyData = [];
  let personalMsg = "Kepty English";
  if (vocSheet) {
    vocabularyData = vocSheet.getDataRange().getValues().slice(1).map(row => ({
      category: String(row[0]||""), word: String(row[1]||""), pronunciation: String(row[2]||""), meaning: String(row[3]||""), pos: String(row[4]||""), example: String(row[5]||"")
    })).filter(i => i.word.trim() !== "");
    personalMsg = String(vocSheet.getRange("K2").getValue() || personalMsg);
  }

  // 8. Topic Talk
  const ttSs = SpreadsheetApp.openById("1wtqW01d6eVXvV_YdQtvq8T0iTe_ZBa_77mnOTUpnjgY");
  const ttSheet = ttSs.getSheetByName(personalSheetName) || ttSs.getSheets()[0];
  let topicTalkData = [];
  if (ttSheet) {
    topicTalkData = ttSheet.getDataRange().getValues().slice(1).map(row => ({
      category: String(row[0]||"").trim(), theme: String(row[1]||"").trim(), training_topic: String(row[2]||"").trim()
    })).filter(item => item.theme !== "" && item.theme !== "undefined");
  }

  return { 
    chunk: chunkData, grammar: grammarData, grammarManual: manualDataMap, 
    reading: readingData, shadowing: shadowingData, 
    pronunciation: pronunciationData, pronunciationManual: phManuals,
    speaking: speakingData, vocabulary: vocabularyData, 
    topicTalk: topicTalkData,
    welcomeMessage: personalMsg,
    success: true 
  };
}
