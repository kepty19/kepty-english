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


function getDashboardTargetConfig(ss, userId) {
  const candidateSheets = [
    "dashboard_targets",
    "DashboardTargets",
    "Dashboard Target",
    "Dashboard",
    "Target"
  ];

  let targetSheet = null;
  for (let i = 0; i < candidateSheets.length; i++) {
    const sh = ss.getSheetByName(candidateSheets[i]);
    if (sh) {
      targetSheet = sh;
      break;
    }
  }
  if (!targetSheet) {
    return {
      dailyTargetMinutes: [0, 0, 0, 0, 0, 0, 0],
      weeklyTargetMinutes: 0,
      source: "fallback"
    };
  }

  const rows = targetSheet.getDataRange().getValues();
  if (!rows || rows.length < 2) {
    return {
      dailyTargetMinutes: [0, 0, 0, 0, 0, 0, 0],
      weeklyTargetMinutes: 0,
      source: targetSheet.getName()
    };
  }

  const headers = rows[0].map(h => String(h || "").trim().toLowerCase());
  const headerMap = {};
  headers.forEach((h, idx) => { headerMap[h] = idx; });

  const userIdIdx = ["userid", "user_id", "id", "user"].reduce((acc, key) => {
    return acc !== -1 ? acc : (headerMap[key] !== undefined ? headerMap[key] : -1);
  }, -1);

  let targetRow = null;
  if (userIdIdx >= 0) {
    for (let i = 1; i < rows.length; i++) {
      const rowUserId = String(rows[i][userIdIdx] || "").trim();
      if (rowUserId === userId) {
        targetRow = rows[i];
        break;
      }
    }
  }
  if (!targetRow) {
    targetRow = rows[1];
  }

  const dayAliases = [
    ["mon", "monday", "月", "月曜", "月曜日"],
    ["tue", "tuesday", "火", "火曜", "火曜日"],
    ["wed", "wednesday", "水", "水曜", "水曜日"],
    ["thu", "thursday", "木", "木曜", "木曜日"],
    ["fri", "friday", "金", "金曜", "金曜日"],
    ["sat", "saturday", "土", "土曜", "土曜日"],
    ["sun", "sunday", "日", "日曜", "日曜日"]
  ];

  const dailyTargetMinutes = dayAliases.map((aliases, dayIndex) => {
    let colIdx = -1;
    for (let i = 0; i < aliases.length; i++) {
      if (headerMap[aliases[i]] !== undefined) {
        colIdx = headerMap[aliases[i]];
        break;
      }
    }
    if (colIdx === -1 && dayIndex + 1 < targetRow.length) {
      colIdx = dayIndex + 1;
    }
    if (colIdx === -1 || colIdx >= targetRow.length) {
      return 0;
    }
    const raw = targetRow[colIdx];
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  });

  const weeklyTargetIdx = ["weekly", "weeklytarget", "weekly_target", "week_total", "週目標"].reduce((acc, key) => {
    return acc !== -1 ? acc : (headerMap[key] !== undefined ? headerMap[key] : -1);
  }, -1);

  const weeklyTargetMinutes = weeklyTargetIdx >= 0
    ? Math.max(0, Math.floor(Number(targetRow[weeklyTargetIdx]) || 0))
    : dailyTargetMinutes.reduce((sum, m) => sum + m, 0);

  return {
    dailyTargetMinutes: dailyTargetMinutes,
    weeklyTargetMinutes: weeklyTargetMinutes,
    source: targetSheet.getName()
  };
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
  const grammarSheets = grammarSs.getSheets();
  const normSheetName = v => String(v || "").trim().toLowerCase();
  const findGrammarSheet = (candidateNames) => {
    for (let i = 0; i < candidateNames.length; i++) {
      const exact = grammarSs.getSheetByName(candidateNames[i]);
      if (exact) return exact;
    }
    const names = candidateNames.map(normSheetName);
    for (let i = 0; i < grammarSheets.length; i++) {
      if (names.indexOf(normSheetName(grammarSheets[i].getName())) !== -1) {
        return grammarSheets[i];
      }
    }
    return null;
  };
  const getSheetHeaders = (sheet) => {
    if (!sheet || sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) return [];
    return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normSheetName);
  };
  const looksLikeExamSheet = (sheet) => {
    const h = getSheetHeaders(sheet);
    return (h.indexOf("question") !== -1 && h.indexOf("answer") !== -1)
      || (h.indexOf("answer") !== -1 && (h.indexOf("option2") !== -1 || h.indexOf("option3") !== -1));
  };
  const looksLikeExplainSheet = (sheet) => {
    const h = getSheetHeaders(sheet);
    const hasText = h.indexOf("explain") !== -1 || h.indexOf("explanation") !== -1 || h.indexOf("manual") !== -1 || h.indexOf("text") !== -1;
    const hasKey = h.indexOf("category") !== -1 || h.indexOf("lesson") !== -1 || h.indexOf("key") !== -1;
    return hasText && hasKey;
  };

  let grammarExamSheet = findGrammarSheet(["exam", "Exam", "grammar_exam"]);
  let grammarExplainSheet = findGrammarSheet(["explain", "Explain", "manual", "manuals"]);

  if (!grammarExamSheet) {
    grammarExamSheet = grammarSheets.find(looksLikeExamSheet) || null;
  }
  if (!grammarExplainSheet) {
    grammarExplainSheet = grammarSheets.find(sh => sh !== grammarExamSheet && looksLikeExplainSheet(sh)) || null;
  }
  if (!grammarExamSheet) {
    grammarExamSheet = grammarSheets.find(sh => sh !== grammarExplainSheet) || grammarSheets[0] || null;
  }
  if (!grammarExplainSheet) {
    grammarExplainSheet = grammarSheets.find(sh => sh !== grammarExamSheet) || null;
  }

  let grammarData = [];
  if (grammarExamSheet) {
    const gRows = grammarExamSheet.getDataRange().getValues().slice(1);
    grammarData = gRows.map(row => ({
      category: String(row[0] || ""), question: String(row[1] || ""), answer: String(row[2] || ""),
      option2: String(row[3] || ""), option3: String(row[4] || ""), option4: String(row[5] || ""), explanation: String(row[6] || "")
    })).filter(item => item.question !== "" && item.answer !== "");
  }
  const manualDataMap = {};
  if (grammarExplainSheet) {
    grammarExplainSheet.getDataRange().getValues().slice(1).forEach(r => {
      const k = String(r[0] || "").trim();
      if (k) {
        manualDataMap[k] = String(r[1] || "");
      }
    });
  }

  // 3. Reading
  const readingSs = SpreadsheetApp.openById("1z-2SiGESlHhAX35o1YgGwpbkgd6u3qNWvgbv3PsAo3M");
  const readingSheet = readingSs.getSheetByName("exam") || readingSs.getSheets()[0];
  let readingData = [];
  if (readingSheet) {
    const rRows = readingSheet.getDataRange().getValues().slice(1);
    readingData = rRows.map(row => {
      let keywords = [];
      for (let i = 0; i < 6; i++) {
        let sIdx = 2 + (i * 6);
        if (row[sIdx]) keywords.push({ word: String(row[sIdx]), meaning: String(row[sIdx+1]), phonetic: String(row[sIdx+2]), pos: String(row[sIdx+3]), example: String(row[sIdx+4]), example_ja: String(row[sIdx+5]) });
      }
      return {
        category: String(row[0]),
        theme: String(row[1]),
        keywords: keywords,
        article: String(row[38] || ""),      // AM: Reading
        slashArticle: String(row[39] || ""), // AN: Slash Reading
        training_topic: String(row[40] || ""),
        japaneseArticle: String(row[42] || "") // AQ: Japanese
      };
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
      const textCandidate = String(row[8] || "").trim();
      const japaneseCandidate = String(row[9] || row[10] || "").trim();
      // Store direct audio link instead of just ID
      if (!grouped[key]) {
        const audioId = String(row[7]);
        const audioUrl = audioId ? `https://docs.google.com/uc?export=download&id=${audioId}` : "";
        grouped[key] = {
          lesson: mat,
          theme: no,
          audioUrl: audioUrl,
          text: textCandidate,
          japanese: japaneseCandidate,
          highlights: []
        };
      }
      if (!grouped[key].text && textCandidate) grouped[key].text = textCandidate;
      if (!grouped[key].japanese && japaneseCandidate) grouped[key].japanese = japaneseCandidate;
      if (row[2] && row[3]) grouped[key].highlights.push({ type: String(row[2]), target: String(row[3]), symbol: String(row[4]), katakana: String(row[5]), explanation: String(row[6]) });
    });
    shadowingData = Object.values(grouped);
  }

  // 5. Pronunciation
  const phSs = SpreadsheetApp.openById("1lBdocIdicG7p3QGqVhwsxzwfpAwnWjtSsqm0t2VPwjY");
  const phSheet = phSs.getSheets()[0];
  let pronunciationData = [];
  let pronunciationExplainIndex = { byCategory: {}, byPoint: {}, bySubcategory: {} };
  if (phSheet) {
    const pRows = phSheet.getDataRange().getValues().slice(1);
    pronunciationData = pRows.map((row, rowIdx) => {
      // Current schema:
      // A category, B subcategory, C point, D word, E symbol, F katakana, G translation, H-M videos, N explain
      const looksLikeWord = v => /[a-z]/i.test(String(v || "")) && !/[\u0250-\u02af]/.test(String(v || "")) && !/[\u02c8\u02cc/]/.test(String(v || ""));
      const looksLikeIpa = v => /[\u0250-\u02af\u02c8\u02cc/]/.test(String(v || ""));
      const looksLikePointLabel = v => /[「」]/.test(String(v || "")) || (/[ぁ-んァ-ヶ一-龯]/.test(String(v || "")) && !/[a-z]/i.test(String(v || "")));
      const hasHiraganaOrKanji = v => /[ぁ-ゖ一-龯々〆ヵヶ]/.test(String(v || ""));
      const isKatakanaOnly = v => /^[\s\u30A0-\u30FF\uFF66-\uFF9Fー・]+$/.test(String(v || "").trim()) && String(v || "").trim() !== "";

      // Some rows are shifted one column to the right from D onward:
      // D: point label, E: word, F: symbol, G: katakana, H: translation, I-N: videos, O: explain.
      const isShifted =
        (looksLikePointLabel(row[3]) && looksLikeWord(row[4]) && looksLikeIpa(row[5])) ||
        (!looksLikeWord(row[3]) && looksLikeWord(row[4]) && looksLikeIpa(row[5]));
      const wordIdx = isShifted ? 4 : 3;
      const symbolIdx = isShifted ? 5 : 4;
      const katakanaIdx = isShifted ? 6 : 5;
      const translationIdx = isShifted ? 7 : 6;
      const videoStartIdx = isShifted ? 8 : 7;
      const explainIdx = isShifted ? 14 : 13;

      const katakanaValue = String(row[katakanaIdx] || "").trim();
      let translationValue = String(row[translationIdx] || "").trim();
      const translationNextValue = String(row[translationIdx + 1] || "").trim();

      // Recover translation when column alignment is off by one and G mirrors katakana.
      if (
        (!translationValue || translationValue === katakanaValue || isKatakanaOnly(translationValue)) &&
        hasHiraganaOrKanji(translationNextValue)
      ) {
        translationValue = translationNextValue;
      }

      const videos = [
        row[videoStartIdx],
        row[videoStartIdx + 1],
        row[videoStartIdx + 2],
        row[videoStartIdx + 3],
        row[videoStartIdx + 4],
        row[videoStartIdx + 5]
      ]
        .map(v => String(v || "").trim())
        .filter(v => v.includes('<iframe'));

      const explain = String(row[explainIdx] || row[13] || row[14] || "");
      return {
        category: String(row[0] || ""),
        subcategory: String(row[1] || ""),
        point: String(row[2] || ""),
        word: String(row[wordIdx] || ""),
        symbol: String(row[symbolIdx] || ""),
        katakana: katakanaValue,
        translation: translationValue,
        explain: explain,
        videos: videos,
        sourceRowIndex: rowIdx
      };
    }).filter(i => i.word.trim() !== "").map(i => ({
      category: i.category,
      subcategory: i.subcategory,
      point: i.point,
      word: i.word,
      symbol: i.symbol,
      katakana: i.katakana,
      translation: i.translation,
      explain: i.explain,
      videos: i.videos
    }));

    const norm = v => String(v || "").trim().toLowerCase();
    // Build explain index from raw rows (not filtered pronunciationData),
    // so explain rows without a word are still available to the frontend.
    pRows.forEach(row => {
      const explain = String(row[13] || row[14] || "").trim();
      if (!explain) return;
      const categoryKey = norm(row[0]);
      const subcategoryKey = norm(row[1]);
      const pointKey = norm(row[2]);

      if (categoryKey && !pronunciationExplainIndex.byCategory[categoryKey]) {
        pronunciationExplainIndex.byCategory[categoryKey] = explain;
      }
      if (categoryKey && pointKey) {
        const k = `${categoryKey}::${pointKey}`;
        if (!pronunciationExplainIndex.byPoint[k]) pronunciationExplainIndex.byPoint[k] = explain;
      }
      if (categoryKey && subcategoryKey) {
        const k = `${categoryKey}::${subcategoryKey}`;
        if (!pronunciationExplainIndex.bySubcategory[k]) pronunciationExplainIndex.bySubcategory[k] = explain;
      }
    });
  }
  let phManuals = {};
  // const phManualSheet = phSs.getSheetByName("Manuals");
  // if (phManualSheet) {
  //   phManualSheet.getDataRange().getValues().forEach(r => { if (r[0]) phManuals[String(r[0]).toLowerCase().trim()] = r[1]; });
  // }

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

  const dashboardTargets = getDashboardTargetConfig(ss, userId);

  const pronunciationDebug = {
    rowCount: pronunciationData.length,
    explainNonEmptyCount: pronunciationData.filter(i => String(i.explain || "").trim()).length,
    indexCounts: {
      byCategory: Object.keys(pronunciationExplainIndex.byCategory || {}).length,
      byPoint: Object.keys(pronunciationExplainIndex.byPoint || {}).length,
      bySubcategory: Object.keys(pronunciationExplainIndex.bySubcategory || {}).length
    },
    sampleKeys: {
      byCategory: Object.keys(pronunciationExplainIndex.byCategory || {}).slice(0, 5),
      byPoint: Object.keys(pronunciationExplainIndex.byPoint || {}).slice(0, 5),
      bySubcategory: Object.keys(pronunciationExplainIndex.bySubcategory || {}).slice(0, 5)
    },
    sampleExplainLengths: pronunciationData
      .filter(i => String(i.explain || "").trim())
      .slice(0, 5)
      .map(i => ({
        category: String(i.category || ""),
        subcategory: String(i.subcategory || ""),
        point: String(i.point || ""),
        explainLength: String(i.explain || "").trim().length
      }))
  };

  return { 
    chunk: chunkData, grammar: grammarData, grammarManual: manualDataMap, 
    reading: readingData, shadowing: shadowingData, 
    pronunciation: pronunciationData, pronunciationManual: phManuals, pronunciationExplainIndex: pronunciationExplainIndex,
    pronunciationDebug: pronunciationDebug,
    speaking: speakingData, vocabulary: vocabularyData, 
    topicTalk: topicTalkData,
    dashboardTargets: dashboardTargets,
    welcomeMessage: personalMsg,
    success: true 
  };
}
