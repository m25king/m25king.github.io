(() => {
  'use strict';

  const DB_NAME = 'study-reader-practice';
  const DB_VERSION = 1;
  const WORKBOOK_STORE = 'workbooks';
  const FILE_STORE = 'files';
  const STATE_PREFIX = 'study-reader:practice:v1:state:';
  const SETTINGS_KEY = 'study-reader:practice:v1:settings';
  const PROGRESS_FORMAT = 'study-reader-practice-progress';
  const MAX_PDF_BYTES = 500 * 1024 * 1024;
  const MAX_PROGRESS_BYTES = 8 * 1024 * 1024;
  const CHOICES = ['A', 'B', 'C', 'D', 'E'];
  const SUBJECTS = {
    ds: '数据结构',
    co: '计算机组成原理',
    os: '操作系统',
    cn: '计算机网络'
  };

  const elements = {
    app: document.getElementById('app'),
    sidebar: document.getElementById('sidebar'),
    closeSidebar: document.getElementById('closeSidebar'),
    menuButton: document.getElementById('menuButton'),
    backdrop: document.getElementById('backdrop'),
    edgeSwipeZone: document.getElementById('edgeSwipeZone'),
    main: document.getElementById('mainContent'),
    subjectFilter: document.getElementById('subjectFilter'),
    workbookList: document.getElementById('workbookList'),
    sidebarEmpty: document.getElementById('sidebarEmpty'),
    visibleWorkbookCount: document.getElementById('visibleWorkbookCount'),
    librarySummary: document.getElementById('librarySummary'),
    sidebarImportButton: document.getElementById('sidebarImportButton'),
    importPdfButton: document.getElementById('importPdfButton'),
    emptyImportButton: document.getElementById('emptyImportButton'),
    dataButton: document.getElementById('dataButton'),
    currentContext: document.getElementById('currentContext'),
    currentTitle: document.getElementById('currentTitle'),
    homeView: document.getElementById('homeView'),
    practiceView: document.getElementById('practiceView'),
    bookCountStat: document.getElementById('bookCountStat'),
    answeredCountStat: document.getElementById('answeredCountStat'),
    favoriteCountStat: document.getElementById('favoriteCountStat'),
    storageStat: document.getElementById('storageStat'),
    storageLimitStat: document.getElementById('storageLimitStat'),
    dsCount: document.getElementById('dsCount'),
    coCount: document.getElementById('coCount'),
    osCount: document.getElementById('osCount'),
    cnCount: document.getElementById('cnCount'),
    pdfSubjectLabel: document.getElementById('pdfSubjectLabel'),
    pdfPanelTitle: document.getElementById('pdfPanelTitle'),
    pdfFrame: document.getElementById('pdfFrame'),
    pdfLoading: document.getElementById('pdfLoading'),
    openPdfLink: document.getElementById('openPdfLink'),
    deleteWorkbookButton: document.getElementById('deleteWorkbookButton'),
    questionProgressText: document.getElementById('questionProgressText'),
    questionTitle: document.getElementById('questionTitle'),
    answerProgress: document.getElementById('answerProgress'),
    answerOptions: document.getElementById('answerOptions'),
    answerFeedback: document.getElementById('answerFeedback'),
    favoriteButton: document.getElementById('favoriteButton'),
    questionNote: document.getElementById('questionNote'),
    completeQuestionButton: document.getElementById('completeQuestionButton'),
    clearAnswerButton: document.getElementById('clearAnswerButton'),
    showGridButton: document.getElementById('showGridButton'),
    questionNavigator: document.getElementById('questionNavigator'),
    gridFilter: document.getElementById('gridFilter'),
    wrongFilterOption: document.getElementById('wrongFilterOption'),
    questionGrid: document.getElementById('questionGrid'),
    gridEmpty: document.getElementById('gridEmpty'),
    previousQuestionButton: document.getElementById('previousQuestionButton'),
    nextQuestionButton: document.getElementById('nextQuestionButton'),
    pagerCounter: document.getElementById('pagerCounter'),
    finishButton: document.getElementById('finishButton'),
    pdfInput: document.getElementById('pdfInput'),
    progressInput: document.getElementById('progressInput'),
    importDialog: document.getElementById('importDialog'),
    importForm: document.getElementById('importForm'),
    cancelImportButton: document.getElementById('cancelImportButton'),
    chooseAnotherButton: document.getElementById('chooseAnotherButton'),
    confirmImportButton: document.getElementById('confirmImportButton'),
    selectedFileSummary: document.getElementById('selectedFileSummary'),
    workbookTitle: document.getElementById('workbookTitle'),
    workbookSubject: document.getElementById('workbookSubject'),
    questionCount: document.getElementById('questionCount'),
    answerKey: document.getElementById('answerKey'),
    rightsConfirm: document.getElementById('rightsConfirm'),
    importError: document.getElementById('importError'),
    dataDialog: document.getElementById('dataDialog'),
    closeDataButton: document.getElementById('closeDataButton'),
    exportProgressButton: document.getElementById('exportProgressButton'),
    importProgressButton: document.getElementById('importProgressButton'),
    dataMessage: document.getElementById('dataMessage'),
    resultDialog: document.getElementById('resultDialog'),
    closeResultButton: document.getElementById('closeResultButton'),
    continuePracticeButton: document.getElementById('continuePracticeButton'),
    reviewWrongButton: document.getElementById('reviewWrongButton'),
    resultScore: document.getElementById('resultScore'),
    resultAnswered: document.getElementById('resultAnswered'),
    resultCorrect: document.getElementById('resultCorrect'),
    resultWrong: document.getElementById('resultWrong'),
    resultUnanswered: document.getElementById('resultUnanswered'),
    resultNotice: document.getElementById('resultNotice'),
    toast: document.getElementById('toast')
  };

  let databasePromise = null;
  let workbooks = [];
  let activeWorkbook = null;
  let activeState = null;
  let currentQuestion = 1;
  let subjectFilter = 'all';
  let gridFilter = 'all';
  let pendingFile = null;
  let activePdfUrl = '';
  let pdfLoadToken = 0;
  let noteSaveTimer = 0;
  let toastTimer = 0;

  function readJSON(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '');
      return value ?? fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      showToast('本机存储空间不足，最新进度可能未保存。');
      return false;
    }
  }

  function getSettings() {
    const value = readJSON(SETTINGS_KEY, {});
    return value && typeof value === 'object' ? value : {};
  }

  function updateSettings(patch) {
    writeJSON(SETTINGS_KEY, { ...getSettings(), ...patch });
  }

  function stateKey(workbookId) {
    return `${STATE_PREFIX}${workbookId}`;
  }

  function cleanState(input, questionCount) {
    const source = input && typeof input === 'object' ? input : {};
    const answers = {};
    const notes = {};
    const favorites = [];
    const completed = [];

    if (source.answers && typeof source.answers === 'object') {
      Object.keys(source.answers).forEach(key => {
        const number = Number(key);
        const answer = String(source.answers[key] || '').toUpperCase();
        if (Number.isInteger(number) && number >= 1 && number <= questionCount && CHOICES.includes(answer)) {
          answers[number] = answer;
        }
      });
    }

    if (source.notes && typeof source.notes === 'object') {
      Object.keys(source.notes).forEach(key => {
        const number = Number(key);
        const note = typeof source.notes[key] === 'string' ? source.notes[key].slice(0, 5000) : '';
        if (Number.isInteger(number) && number >= 1 && number <= questionCount && note) notes[number] = note;
      });
    }

    if (Array.isArray(source.favorites)) {
      source.favorites.forEach(value => {
        const number = Number(value);
        if (Number.isInteger(number) && number >= 1 && number <= questionCount && !favorites.includes(number)) {
          favorites.push(number);
        }
      });
    }

    if (Array.isArray(source.completed)) {
      source.completed.forEach(value => {
        const number = Number(value);
        if (Number.isInteger(number) && number >= 1 && number <= questionCount && !completed.includes(number)) {
          completed.push(number);
        }
      });
    }

    const requestedCurrent = Number(source.current);
    const current = Number.isInteger(requestedCurrent)
      ? Math.min(questionCount, Math.max(1, requestedCurrent))
      : 1;

    return {
      schemaVersion: 1,
      current,
      answers,
      favorites,
      completed,
      notes,
      startedAt: typeof source.startedAt === 'string' ? source.startedAt : new Date().toISOString(),
      updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : new Date().toISOString()
    };
  }

  function loadState(workbook) {
    return cleanState(readJSON(stateKey(workbook.id), {}), workbook.questionCount);
  }

  function saveState() {
    if (!activeWorkbook || !activeState) return;
    activeState.current = currentQuestion;
    activeState.updatedAt = new Date().toISOString();
    writeJSON(stateKey(activeWorkbook.id), activeState);
  }

  function openDatabase() {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('当前浏览器不支持 IndexedDB。'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(WORKBOOK_STORE)) {
          database.createObjectStore(WORKBOOK_STORE, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(FILE_STORE)) {
          database.createObjectStore(FILE_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('无法打开本地题库。'));
      request.onblocked = () => reject(new Error('本地题库正在被另一个页面占用，请关闭其他标签页后重试。'));
    });
    return databasePromise;
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('本地数据库操作失败。'));
    });
  }

  async function getAllWorkbooks() {
    const database = await openDatabase();
    const transaction = database.transaction(WORKBOOK_STORE, 'readonly');
    const result = await requestResult(transaction.objectStore(WORKBOOK_STORE).getAll());
    return result.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  async function getWorkbookFile(id) {
    const database = await openDatabase();
    const transaction = database.transaction(FILE_STORE, 'readonly');
    return requestResult(transaction.objectStore(FILE_STORE).get(id));
  }

  async function putWorkbook(metadata, file) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([WORKBOOK_STORE, FILE_STORE], 'readwrite');
      transaction.objectStore(WORKBOOK_STORE).put(metadata);
      transaction.objectStore(FILE_STORE).put({ id: metadata.id, pdf: file });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('PDF 无法保存到本机。'));
      transaction.onabort = () => reject(transaction.error || new Error('PDF 保存已取消。'));
    });
  }

  async function removeWorkbook(id) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([WORKBOOK_STORE, FILE_STORE], 'readwrite');
      transaction.objectStore(WORKBOOK_STORE).delete(id);
      transaction.objectStore(FILE_STORE).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('无法删除本地题本。'));
      transaction.onabort = () => reject(transaction.error || new Error('删除操作已取消。'));
    });
  }

  function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10240 ? 1 : 0)} KB`;
    if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(value < 10 * 1024 * 1024 ? 1 : 0)} MB`;
    return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add('visible');
    toastTimer = window.setTimeout(() => elements.toast.classList.remove('visible'), 3000);
  }

  function showDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
  }

  function subjectName(subject) {
    return SUBJECTS[subject] || '408';
  }

  function openSidebar() {
    elements.app.classList.add('sidebar-open');
    elements.menuButton.setAttribute('aria-expanded', 'true');
    elements.menuButton.setAttribute('aria-label', '关闭题库目录');
    elements.sidebar.setAttribute('aria-hidden', 'false');
    elements.sidebar.inert = false;
    elements.main.inert = true;
    elements.backdrop.setAttribute('aria-hidden', 'false');
    elements.backdrop.tabIndex = 0;
    window.setTimeout(() => elements.closeSidebar.focus(), 20);
  }

  function closeSidebar(returnFocus = true) {
    const focusWasInSidebar = elements.sidebar.contains(document.activeElement);
    elements.app.classList.remove('sidebar-open');
    elements.menuButton.setAttribute('aria-expanded', 'false');
    elements.menuButton.setAttribute('aria-label', '打开题库目录');
    elements.sidebar.setAttribute('aria-hidden', 'true');
    elements.sidebar.inert = true;
    elements.main.inert = false;
    elements.backdrop.setAttribute('aria-hidden', 'true');
    elements.backdrop.tabIndex = -1;
    if (returnFocus || focusWasInSidebar) elements.menuButton.focus();
  }

  function setupSwipeDrawer() {
    let edgeStart = null;
    let sidebarStart = null;

    elements.edgeSwipeZone.addEventListener('pointerdown', event => {
      edgeStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });
    elements.edgeSwipeZone.addEventListener('pointerup', event => {
      if (!edgeStart || edgeStart.id !== event.pointerId) return;
      const dx = event.clientX - edgeStart.x;
      const dy = event.clientY - edgeStart.y;
      if (dx > 54 && Math.abs(dx) > Math.abs(dy) * 1.25) openSidebar();
      edgeStart = null;
    });
    elements.edgeSwipeZone.addEventListener('pointercancel', () => { edgeStart = null; });

    elements.sidebar.addEventListener('pointerdown', event => {
      sidebarStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });
    elements.sidebar.addEventListener('pointerup', event => {
      if (!sidebarStart || sidebarStart.id !== event.pointerId) return;
      const dx = event.clientX - sidebarStart.x;
      const dy = event.clientY - sidebarStart.y;
      if (dx < -54 && Math.abs(dx) > Math.abs(dy) * 1.25) closeSidebar(false);
      sidebarStart = null;
    });
    elements.sidebar.addEventListener('pointercancel', () => { sidebarStart = null; });
  }

  function simpleHash(bytes) {
    let first = 2166136261;
    let second = 2246822519;
    bytes.forEach(byte => {
      first = Math.imul(first ^ byte, 16777619);
      second = Math.imul(second ^ byte, 3266489917);
    });
    return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
  }

  async function fingerprintFile(file) {
    const chunkSize = 128 * 1024;
    const firstBuffer = await file.slice(0, Math.min(chunkSize, file.size)).arrayBuffer();
    const lastStart = Math.max(0, file.size - chunkSize);
    const lastBuffer = lastStart > 0 ? await file.slice(lastStart, file.size).arrayBuffer() : new ArrayBuffer(0);
    const sizeBytes = new TextEncoder().encode(`pdf-size:${file.size}:`);
    const sample = new Uint8Array(sizeBytes.length + firstBuffer.byteLength + lastBuffer.byteLength);
    sample.set(sizeBytes, 0);
    sample.set(new Uint8Array(firstBuffer), sizeBytes.length);
    sample.set(new Uint8Array(lastBuffer), sizeBytes.length + firstBuffer.byteLength);

    if (window.crypto && window.crypto.subtle) {
      const digest = await window.crypto.subtle.digest('SHA-256', sample);
      return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    }
    return simpleHash(sample);
  }

  async function isPdfFile(file) {
    if (!file || file.size < 5 || file.size > MAX_PDF_BYTES) return false;
    const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    return String.fromCharCode(...signature) === '%PDF-';
  }

  function parseAnswerKey(value, questionCount) {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw) return { answerKey: null };

    const tokens = raw.split(/[\s,，、;；|/]+/).filter(Boolean);
    const answers = [];
    for (const originalToken of tokens) {
      if (/^\d+$/.test(originalToken)) continue;
      const token = originalToken.replace(/^\d+\s*[.)、:：-]?\s*/, '');
      if (!token) continue;
      if (!/^[A-E-]+$/.test(token)) {
        return { error: `无法识别答案“${originalToken}”，请只填写 A–E 或 -。` };
      }
      Array.from(token).forEach(character => answers.push(character === '-' ? null : character));
    }

    if (answers.length !== questionCount) {
      return { error: `答案表识别到 ${answers.length} 题，但题目数量是 ${questionCount}。未知答案也请用 - 占位。` };
    }
    return { answerKey: answers };
  }

  async function updateStorageEstimate() {
    if (!navigator.storage || typeof navigator.storage.estimate !== 'function') {
      elements.storageStat.textContent = '本机';
      elements.storageLimitStat.textContent = '浏览器存储';
      return;
    }
    try {
      const estimate = await navigator.storage.estimate();
      elements.storageStat.textContent = formatBytes(estimate.usage || 0);
      elements.storageLimitStat.textContent = estimate.quota ? `可用上限 ${formatBytes(estimate.quota)}` : '仅本机';
    } catch (_) {
      elements.storageStat.textContent = '本机';
      elements.storageLimitStat.textContent = '浏览器存储';
    }
  }

  function calculateWorkbookStats(workbook, state = loadState(workbook)) {
    const answeredNumbers = new Set(Object.keys(state.answers).map(Number));
    state.completed.forEach(number => {
      const expected = Array.isArray(workbook.answerKey) ? workbook.answerKey[number - 1] : '';
      if (!CHOICES.includes(expected)) answeredNumbers.add(number);
    });
    const answers = answeredNumbers.size;
    const favorites = state.favorites.length;
    const knownAnswers = Array.isArray(workbook.answerKey)
      ? workbook.answerKey.filter(answer => CHOICES.includes(answer)).length
      : 0;
    let correct = 0;
    let wrong = 0;
    if (knownAnswers) {
      Object.keys(state.answers).forEach(key => {
        const number = Number(key);
        const expected = workbook.answerKey[number - 1];
        if (!CHOICES.includes(expected)) return;
        if (state.answers[number] === expected) correct += 1;
        else wrong += 1;
      });
    }
    return { answers, favorites, knownAnswers, correct, wrong };
  }

  function renderHomeStats() {
    let answeredTotal = 0;
    let favoriteTotal = 0;
    const subjectCounts = { ds: 0, co: 0, os: 0, cn: 0 };

    workbooks.forEach(workbook => {
      const stats = calculateWorkbookStats(workbook);
      answeredTotal += stats.answers;
      favoriteTotal += stats.favorites;
      if (subjectCounts[workbook.subject] !== undefined) subjectCounts[workbook.subject] += 1;
    });

    elements.bookCountStat.textContent = String(workbooks.length);
    elements.answeredCountStat.textContent = String(answeredTotal);
    elements.favoriteCountStat.textContent = String(favoriteTotal);
    Object.keys(subjectCounts).forEach(subject => {
      const target = elements[`${subject}Count`];
      if (target) target.textContent = `${subjectCounts[subject]} 本题本`;
    });
    updateStorageEstimate();
  }

  function renderSubjectFilter() {
    elements.subjectFilter.querySelectorAll('.subject-button').forEach(button => {
      const active = button.dataset.subject === subjectFilter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function renderWorkbookList() {
    const visible = workbooks.filter(workbook => subjectFilter === 'all' || workbook.subject === subjectFilter);
    const fragment = document.createDocumentFragment();

    visible.forEach(workbook => {
      const state = loadState(workbook);
      const row = document.createElement('div');
      row.className = 'workbook-row';

      const openButton = document.createElement('button');
      openButton.type = 'button';
      openButton.className = 'workbook-item';
      openButton.classList.toggle('active', Boolean(activeWorkbook && activeWorkbook.id === workbook.id));
      openButton.setAttribute('aria-label', `打开${workbook.title}`);
      const title = document.createElement('strong');
      title.textContent = workbook.title;
      const detail = document.createElement('span');
      detail.textContent = `${subjectName(workbook.subject)} · 已答 ${calculateWorkbookStats(workbook, state).answers}/${workbook.questionCount}`;
      openButton.append(title, detail);
      openButton.addEventListener('click', () => openWorkbook(workbook.id));

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'workbook-delete';
      deleteButton.textContent = '×';
      deleteButton.title = '删除本地题本';
      deleteButton.setAttribute('aria-label', `删除${workbook.title}`);
      deleteButton.addEventListener('click', () => deleteWorkbookById(workbook.id));
      row.append(openButton, deleteButton);
      fragment.append(row);
    });

    elements.workbookList.replaceChildren(fragment);
    elements.visibleWorkbookCount.textContent = `${visible.length} 本`;
    elements.sidebarEmpty.classList.toggle('visible', visible.length === 0);
    elements.sidebarEmpty.innerHTML = workbooks.length
      ? '这个科目还没有题本。<br>可切换科目或导入 PDF。'
      : '还没有本地题本。<br>点下方按钮导入 PDF。';

    const totalQuestions = workbooks.reduce((sum, workbook) => sum + Number(workbook.questionCount || 0), 0);
    elements.librarySummary.textContent = workbooks.length ? `${workbooks.length} 本 · ${totalQuestions} 题` : '仅保存在这台设备';
  }

  async function refreshWorkbooks() {
    workbooks = await getAllWorkbooks();
    renderSubjectFilter();
    renderWorkbookList();
    renderHomeStats();
  }

  function releasePdfUrl() {
    pdfLoadToken += 1;
    if (activePdfUrl) {
      URL.revokeObjectURL(activePdfUrl);
      activePdfUrl = '';
    }
    elements.openPdfLink.removeAttribute('href');
  }

  function showHome() {
    saveCurrentNote();
    activeWorkbook = null;
    activeState = null;
    releasePdfUrl();
    elements.pdfFrame.removeAttribute('src');
    elements.homeView.hidden = false;
    elements.practiceView.hidden = true;
    elements.currentContext.textContent = '408 个人题库';
    elements.currentTitle.textContent = '本地 PDF 答题';
    document.title = '408 个人题库';
    renderWorkbookList();
  }

  async function openWorkbook(id) {
    const workbook = workbooks.find(item => item.id === id);
    if (!workbook) return;

    saveCurrentNote();
    activeWorkbook = workbook;
    activeState = loadState(workbook);
    currentQuestion = activeState.current;
    gridFilter = 'all';
    elements.gridFilter.value = 'all';
    elements.homeView.hidden = true;
    elements.practiceView.hidden = false;
    elements.currentContext.textContent = `${subjectName(workbook.subject)} · ${workbook.questionCount} 题`;
    elements.currentTitle.textContent = workbook.title;
    elements.pdfSubjectLabel.textContent = subjectName(workbook.subject);
    elements.pdfPanelTitle.textContent = workbook.title;
    elements.pdfFrame.title = `${workbook.title} PDF`;
    document.title = `${workbook.title} · 408 题库`;
    elements.pdfLoading.textContent = '正在从本机打开 PDF…';
    elements.pdfLoading.classList.remove('done');
    releasePdfUrl();
    elements.pdfFrame.removeAttribute('src');
    updateSettings({ lastWorkbookId: workbook.id });
    renderQuestion();
    renderWorkbookList();
    closeSidebar(false);

    const openingId = workbook.id;
    try {
      const stored = await getWorkbookFile(openingId);
      if (!activeWorkbook || activeWorkbook.id !== openingId) return;
      if (!stored || !(stored.pdf instanceof Blob)) throw new Error('本地 PDF 文件缺失。');
      releasePdfUrl();
      activePdfUrl = URL.createObjectURL(stored.pdf);
      const token = pdfLoadToken;
      elements.openPdfLink.href = activePdfUrl;
      elements.pdfFrame.src = activePdfUrl;
      window.setTimeout(() => {
        if (token === pdfLoadToken) elements.pdfLoading.classList.add('done');
      }, 1800);
    } catch (error) {
      if (activeWorkbook && activeWorkbook.id === openingId) {
        elements.pdfLoading.textContent = error.message || '无法打开本地 PDF。';
        showToast(elements.pdfLoading.textContent);
      }
    }
  }

  function hasKnownAnswers() {
    return Boolean(activeWorkbook && Array.isArray(activeWorkbook.answerKey)
      && activeWorkbook.answerKey.some(answer => CHOICES.includes(answer)));
  }

  function answerFor(number) {
    return activeState && activeState.answers ? activeState.answers[number] || '' : '';
  }

  function isManuallyCompleted(number) {
    return Boolean(activeState && Array.isArray(activeState.completed) && activeState.completed.includes(number));
  }

  function isAnswered(number) {
    return Boolean(answerFor(number) || (!expectedFor(number) && isManuallyCompleted(number)));
  }

  function expectedFor(number) {
    if (!activeWorkbook || !Array.isArray(activeWorkbook.answerKey)) return '';
    const expected = activeWorkbook.answerKey[number - 1];
    return CHOICES.includes(expected) ? expected : '';
  }

  function isWrong(number) {
    const answer = answerFor(number);
    const expected = expectedFor(number);
    return Boolean(answer && expected && answer !== expected);
  }

  function isCorrect(number) {
    const answer = answerFor(number);
    const expected = expectedFor(number);
    return Boolean(answer && expected && answer === expected);
  }

  function filteredQuestionNumbers() {
    if (!activeWorkbook || !activeState) return [];
    const numbers = Array.from({ length: activeWorkbook.questionCount }, (_, index) => index + 1);
    if (gridFilter === 'unanswered') return numbers.filter(number => !isAnswered(number));
    if (gridFilter === 'wrong') return numbers.filter(number => isWrong(number));
    if (gridFilter === 'favorite') return numbers.filter(number => activeState.favorites.includes(number));
    return numbers;
  }

  function renderQuestionGrid() {
    const numbers = filteredQuestionNumbers();
    const existing = Array.from(elements.questionGrid.children);
    const canReuse = existing.length === numbers.length
      && existing.every((button, index) => Number(button.dataset.number) === numbers[index]);

    if (!canReuse) {
      const fragment = document.createDocumentFragment();
      numbers.forEach(number => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'question-number';
        button.dataset.number = String(number);
        button.textContent = String(number);
        fragment.append(button);
      });
      elements.questionGrid.replaceChildren(fragment);
    }

    const focusNumber = numbers.includes(currentQuestion) ? currentQuestion : numbers[0];
    Array.from(elements.questionGrid.children).forEach((button, index) => {
      const number = numbers[index];
      button.classList.toggle('answered', isAnswered(number));
      button.classList.toggle('correct', isCorrect(number));
      button.classList.toggle('wrong', isWrong(number));
      button.classList.toggle('favorite', activeState.favorites.includes(number));
      button.classList.toggle('current', number === currentQuestion);
      if (number === currentQuestion) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
      button.tabIndex = number === focusNumber ? 0 : -1;
      const states = [];
      if (isAnswered(number)) states.push(isManuallyCompleted(number) && !answerFor(number) ? '已完成' : '已答');
      if (isCorrect(number)) states.push('正确');
      if (isWrong(number)) states.push('错误');
      if (activeState.favorites.includes(number)) states.push('已收藏');
      button.setAttribute('aria-label', `第 ${number} 题${states.length ? `，${states.join('，')}` : ''}`);
    });
    elements.gridEmpty.hidden = numbers.length !== 0;
  }

  function renderPager() {
    const numbers = filteredQuestionNumbers();
    const index = numbers.indexOf(currentQuestion);
    elements.previousQuestionButton.disabled = !numbers.length || (index === 0);
    elements.nextQuestionButton.disabled = !numbers.length || (index === numbers.length - 1);
    if (index < 0) {
      elements.previousQuestionButton.disabled = !numbers.length;
      elements.nextQuestionButton.disabled = !numbers.length;
    }
    elements.pagerCounter.textContent = `${currentQuestion} / ${activeWorkbook.questionCount}`;
  }

  function renderQuestion() {
    if (!activeWorkbook || !activeState) return;
    currentQuestion = Math.min(activeWorkbook.questionCount, Math.max(1, currentQuestion));
    activeState.current = currentQuestion;

    const stats = calculateWorkbookStats(activeWorkbook, activeState);
    const selected = answerFor(currentQuestion);
    const expected = expectedFor(currentQuestion);
    elements.questionTitle.textContent = `第 ${currentQuestion} 题`;
    elements.questionProgressText.textContent = `已答 ${stats.answers} / ${activeWorkbook.questionCount}`;
    elements.answerProgress.max = activeWorkbook.questionCount;
    elements.answerProgress.value = stats.answers;
    elements.answerProgress.textContent = `${Math.round(stats.answers / activeWorkbook.questionCount * 100)}%`;

    elements.answerOptions.querySelectorAll('.answer-option').forEach(button => {
      const choice = button.dataset.choice;
      const pressed = choice === selected;
      button.setAttribute('aria-pressed', String(pressed));
      button.classList.remove('correct', 'wrong');
      if (selected && expected && choice === expected) button.classList.add('correct');
      if (selected && expected && choice === selected && selected !== expected) button.classList.add('wrong');
    });

    elements.answerFeedback.className = 'answer-feedback';
    if (!selected && !expected && isManuallyCompleted(currentQuestion)) {
      elements.answerFeedback.textContent = '已标记完成；可在本题笔记中记录综合题思路或页码。';
    } else if (!selected) {
      elements.answerFeedback.textContent = '尚未作答或标记完成';
    } else if (!expected) {
      elements.answerFeedback.textContent = '答案已记录；这道题没有本地答案，完成后可自行核对 PDF。';
    } else if (selected === expected) {
      elements.answerFeedback.textContent = `回答正确：${selected}`;
      elements.answerFeedback.classList.add('correct');
    } else {
      elements.answerFeedback.textContent = `回答错误：你选了 ${selected}，本地答案为 ${expected}。`;
      elements.answerFeedback.classList.add('wrong');
    }

    const favorite = activeState.favorites.includes(currentQuestion);
    elements.favoriteButton.setAttribute('aria-pressed', String(favorite));
    elements.favoriteButton.querySelector('span').textContent = favorite ? '已收藏' : '收藏';
    elements.questionNote.value = activeState.notes[currentQuestion] || '';
    const manuallyCompleted = !expected && isManuallyCompleted(currentQuestion);
    elements.completeQuestionButton.hidden = Boolean(expected);
    elements.completeQuestionButton.setAttribute('aria-pressed', String(manuallyCompleted));
    elements.completeQuestionButton.textContent = manuallyCompleted ? '已完成' : '标记完成';
    elements.clearAnswerButton.disabled = !selected;
    elements.wrongFilterOption.disabled = !hasKnownAnswers();
    if (!hasKnownAnswers() && gridFilter === 'wrong') {
      gridFilter = 'all';
      elements.gridFilter.value = 'all';
    }
    renderQuestionGrid();
    renderPager();
    saveState();
  }

  function saveCurrentNote() {
    window.clearTimeout(noteSaveTimer);
    if (!activeWorkbook || !activeState) return;
    const note = elements.questionNote.value.slice(0, 5000);
    if (note) activeState.notes[currentQuestion] = note;
    else delete activeState.notes[currentQuestion];
    saveState();
  }

  function goToQuestion(number, bringIntoView = false) {
    if (!activeWorkbook || !Number.isInteger(number) || number < 1 || number > activeWorkbook.questionCount) return;
    saveCurrentNote();
    currentQuestion = number;
    renderQuestion();
    if (bringIntoView && window.matchMedia('(max-width: 820px), (orientation: portrait) and (max-width: 1100px)').matches) {
      elements.questionTitle.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }

  function moveQuestion(delta) {
    const numbers = filteredQuestionNumbers();
    if (!numbers.length) return;
    const currentIndex = numbers.indexOf(currentQuestion);
    if (currentIndex < 0) {
      goToQuestion(delta > 0 ? numbers[0] : numbers[numbers.length - 1], true);
      return;
    }
    const target = numbers[currentIndex + delta];
    if (target) goToQuestion(target, true);
  }

  function chooseAnswer(choice) {
    if (!activeWorkbook || !activeState || !CHOICES.includes(choice)) return;
    activeState.answers[currentQuestion] = choice;
    saveState();
    renderQuestion();
    renderWorkbookList();
    renderHomeStats();
  }

  function toggleFavorite() {
    if (!activeState) return;
    const index = activeState.favorites.indexOf(currentQuestion);
    if (index >= 0) activeState.favorites.splice(index, 1);
    else activeState.favorites.push(currentQuestion);
    activeState.favorites.sort((a, b) => a - b);
    saveState();
    renderQuestion();
    renderWorkbookList();
    renderHomeStats();
  }

  function toggleCompleted() {
    if (!activeState || expectedFor(currentQuestion)) return;
    const index = activeState.completed.indexOf(currentQuestion);
    if (index >= 0) activeState.completed.splice(index, 1);
    else activeState.completed.push(currentQuestion);
    saveState();
    renderQuestion();
    renderWorkbookList();
    renderHomeStats();
  }

  function showResults() {
    if (!activeWorkbook || !activeState) return;
    saveCurrentNote();
    const stats = calculateWorkbookStats(activeWorkbook, activeState);
    const unanswered = activeWorkbook.questionCount - stats.answers;
    elements.resultAnswered.textContent = String(stats.answers);
    elements.resultUnanswered.textContent = String(unanswered);
    if (stats.knownAnswers) {
      const percentage = Math.round(stats.correct / stats.knownAnswers * 100);
      elements.resultScore.textContent = `${percentage} 分`;
      elements.resultCorrect.textContent = String(stats.correct);
      elements.resultWrong.textContent = String(stats.wrong);
      elements.resultNotice.textContent = stats.knownAnswers === activeWorkbook.questionCount
        ? '分数按全部题目的本地答案计算，未作答计 0 分。'
        : `答案表覆盖 ${stats.knownAnswers} 题，分数只按这些题计算，未提供答案的题目不计分。`;
      elements.reviewWrongButton.hidden = false;
      elements.reviewWrongButton.disabled = stats.wrong === 0;
    } else {
      const percentage = Math.round(stats.answers / activeWorkbook.questionCount * 100);
      elements.resultScore.textContent = `完成 ${percentage}%`;
      elements.resultCorrect.textContent = '—';
      elements.resultWrong.textContent = '—';
      elements.resultNotice.textContent = '该题本没有答案表，因此只统计完成进度，不判断对错。';
      elements.reviewWrongButton.hidden = true;
    }
    showDialog(elements.resultDialog);
  }

  function startPdfImport() {
    if (elements.app.classList.contains('sidebar-open')) closeSidebar();
    elements.pdfInput.value = '';
    elements.pdfInput.click();
  }

  function resetImportForm() {
    elements.importForm.reset();
    elements.importError.textContent = '';
    elements.importError.classList.remove('success');
    elements.selectedFileSummary.textContent = pendingFile
      ? `${pendingFile.name} · ${formatBytes(pendingFile.size)}`
      : '尚未选择文件';
    if (pendingFile) elements.workbookTitle.value = pendingFile.name.replace(/\.pdf$/i, '').slice(0, 100);
    if (subjectFilter !== 'all' && SUBJECTS[subjectFilter]) elements.workbookSubject.value = subjectFilter;
  }

  async function handlePdfSelected(file) {
    if (!file) return;
    try {
      if (file.size > MAX_PDF_BYTES) throw new Error(`PDF 超过 ${formatBytes(MAX_PDF_BYTES)}，不适合在浏览器中保存。`);
      if (!(await isPdfFile(file))) throw new Error('所选文件不是有效的 PDF。');
      pendingFile = file;
      resetImportForm();
      showDialog(elements.importDialog);
      window.setTimeout(() => elements.workbookTitle.focus(), 30);
    } catch (error) {
      pendingFile = null;
      showToast(error.message || '无法读取所选 PDF。');
    }
  }

  async function submitPdfImport(event) {
    event.preventDefault();
    elements.importError.textContent = '';
    if (!pendingFile) {
      elements.importError.textContent = '请先选择 PDF 文件。';
      return;
    }

    const title = elements.workbookTitle.value.trim();
    const subject = elements.workbookSubject.value;
    const questionCount = Number(elements.questionCount.value);
    if (!title || !SUBJECTS[subject] || !Number.isInteger(questionCount) || questionCount < 1 || questionCount > 5000) {
      elements.importError.textContent = '请填写题本名称、科目和 1–5000 之间的题目数量。';
      return;
    }

    const parsed = parseAnswerKey(elements.answerKey.value, questionCount);
    if (parsed.error) {
      elements.importError.textContent = parsed.error;
      elements.answerKey.focus();
      return;
    }

    elements.confirmImportButton.disabled = true;
    elements.confirmImportButton.textContent = '正在保存…';
    try {
      const fingerprint = await fingerprintFile(pendingFile);
      const id = `pdf-${fingerprint.slice(0, 24)}`;
      const existing = workbooks.find(workbook => workbook.id === id);
      if (existing && !window.confirm('这份 PDF 已在本机题库中。是否更新题本设置并保留原作答进度？')) return;

      const now = new Date().toISOString();
      const metadata = {
        id,
        fingerprint,
        title,
        subject,
        questionCount,
        answerKey: parsed.answerKey,
        fileName: pendingFile.name,
        fileSize: pendingFile.size,
        createdAt: existing && existing.createdAt ? existing.createdAt : now,
        updatedAt: now,
        visibility: 'local-only'
      };
      await putWorkbook(metadata, pendingFile);

      if (existing) {
        const existingState = cleanState(readJSON(stateKey(id), {}), questionCount);
        writeJSON(stateKey(id), existingState);
      }
      if (navigator.storage && typeof navigator.storage.persist === 'function') {
        navigator.storage.persist().catch(() => {});
      }
      closeDialog(elements.importDialog);
      pendingFile = null;
      await refreshWorkbooks();
      await openWorkbook(id);
      showToast('PDF 题本已保存在当前浏览器。');
    } catch (error) {
      elements.importError.textContent = error && error.name === 'QuotaExceededError'
        ? '浏览器存储空间不足，请删除其他本地题本后重试。'
        : (error.message || 'PDF 保存失败，请重试。');
    } finally {
      elements.confirmImportButton.disabled = false;
      elements.confirmImportButton.textContent = '保存到本机';
    }
  }

  async function deleteWorkbookById(id) {
    const workbook = workbooks.find(item => item.id === id);
    if (!workbook) return;
    const confirmed = window.confirm(`确定删除“${workbook.title}”吗？\n\n本机 PDF、答案、作答、收藏和笔记都会删除，且无法撤销。`);
    if (!confirmed) return;
    try {
      await removeWorkbook(id);
      try { localStorage.removeItem(stateKey(id)); } catch (_) { /* Ignore unavailable storage. */ }
      if (activeWorkbook && activeWorkbook.id === id) showHome();
      const settings = getSettings();
      if (settings.lastWorkbookId === id) updateSettings({ lastWorkbookId: '' });
      await refreshWorkbooks();
      showToast('本地题本及其进度已删除。');
    } catch (error) {
      showToast(error.message || '删除失败，请重试。');
    }
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportProgress() {
    const records = workbooks.map(workbook => ({
      fingerprint: workbook.fingerprint,
      title: workbook.title,
      subject: workbook.subject,
      questionCount: workbook.questionCount,
      state: loadState(workbook)
    }));
    const payload = {
      format: PROGRESS_FORMAT,
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      note: '此文件只含答题进度，不含 PDF 与答案表。',
      workbooks: records
    };
    const day = new Date().toISOString().slice(0, 10);
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `408答题进度-${day}.json`);
    elements.dataMessage.textContent = `已导出 ${records.length} 本题本的进度，不包含 PDF 与答案表。`;
    elements.dataMessage.classList.add('success');
  }

  async function importProgressFile(file) {
    elements.dataMessage.classList.remove('success');
    elements.dataMessage.textContent = '';
    if (!file || file.size > MAX_PROGRESS_BYTES) {
      elements.dataMessage.textContent = '进度文件无效或过大。';
      return;
    }

    try {
      const payload = JSON.parse(await file.text());
      if (!payload || payload.format !== PROGRESS_FORMAT || payload.schemaVersion !== 1 || !Array.isArray(payload.workbooks)) {
        throw new Error('不是本站导出的 408 答题进度文件。');
      }

      const metadataByFingerprint = new Map(workbooks.map(workbook => [workbook.fingerprint, workbook]));
      const matches = payload.workbooks.filter(record => record && metadataByFingerprint.has(record.fingerprint));
      if (!matches.length) {
        throw new Error('没有匹配的本地 PDF。请先导入原 PDF 题本，再导入进度。');
      }
      if (!window.confirm(`将恢复 ${matches.length} 本已匹配题本的进度，并覆盖这些题本当前的本机进度。是否继续？`)) return;

      matches.forEach(record => {
        const workbook = metadataByFingerprint.get(record.fingerprint);
        const state = cleanState(record.state, workbook.questionCount);
        state.updatedAt = new Date().toISOString();
        writeJSON(stateKey(workbook.id), state);
      });

      if (activeWorkbook && matches.some(record => record.fingerprint === activeWorkbook.fingerprint)) {
        activeState = loadState(activeWorkbook);
        currentQuestion = activeState.current;
        renderQuestion();
      }
      renderWorkbookList();
      renderHomeStats();
      const skipped = payload.workbooks.length - matches.length;
      elements.dataMessage.textContent = `已恢复 ${matches.length} 本题本${skipped > 0 ? `，另有 ${skipped} 本因未导入对应 PDF 而跳过` : ''}。`;
      elements.dataMessage.classList.add('success');
      showToast('答题进度已从本机文件恢复。');
    } catch (error) {
      elements.dataMessage.textContent = error.message || '进度文件读取失败。';
    }
  }

  function wireEvents() {
    elements.menuButton.addEventListener('click', () => {
      if (elements.app.classList.contains('sidebar-open')) closeSidebar();
      else openSidebar();
    });
    elements.closeSidebar.addEventListener('click', () => closeSidebar());
    elements.backdrop.addEventListener('click', () => closeSidebar());
    setupSwipeDrawer();

    elements.subjectFilter.addEventListener('click', event => {
      const button = event.target.closest('.subject-button');
      if (!button || !button.dataset.subject) return;
      subjectFilter = button.dataset.subject;
      updateSettings({ subjectFilter });
      renderSubjectFilter();
      renderWorkbookList();
    });

    [elements.sidebarImportButton, elements.importPdfButton, elements.emptyImportButton].forEach(button => {
      button.addEventListener('click', startPdfImport);
    });
    elements.pdfInput.addEventListener('change', event => {
      const file = event.target.files && event.target.files[0];
      event.target.value = '';
      handlePdfSelected(file);
    });
    elements.cancelImportButton.addEventListener('click', () => {
      closeDialog(elements.importDialog);
      pendingFile = null;
    });
    elements.chooseAnotherButton.addEventListener('click', () => {
      closeDialog(elements.importDialog);
      pendingFile = null;
      startPdfImport();
    });
    elements.importForm.addEventListener('submit', submitPdfImport);
    elements.importDialog.addEventListener('close', () => { pendingFile = null; });

    elements.answerOptions.addEventListener('click', event => {
      const button = event.target.closest('.answer-option');
      if (button) chooseAnswer(button.dataset.choice);
    });
    elements.favoriteButton.addEventListener('click', toggleFavorite);
    elements.completeQuestionButton.addEventListener('click', toggleCompleted);
    elements.clearAnswerButton.addEventListener('click', () => {
      if (!activeState) return;
      delete activeState.answers[currentQuestion];
      saveState();
      renderQuestion();
      renderWorkbookList();
      renderHomeStats();
    });
    elements.questionNote.addEventListener('input', () => {
      window.clearTimeout(noteSaveTimer);
      noteSaveTimer = window.setTimeout(saveCurrentNote, 400);
    });
    elements.questionNote.addEventListener('change', saveCurrentNote);
    elements.previousQuestionButton.addEventListener('click', () => moveQuestion(-1));
    elements.nextQuestionButton.addEventListener('click', () => moveQuestion(1));
    elements.showGridButton.addEventListener('click', () => {
      const willHide = !elements.questionNavigator.hidden;
      elements.questionNavigator.hidden = willHide;
      elements.showGridButton.setAttribute('aria-expanded', String(!willHide));
    });
    elements.gridFilter.addEventListener('change', () => {
      gridFilter = elements.gridFilter.value;
      const numbers = filteredQuestionNumbers();
      if (numbers.length && !numbers.includes(currentQuestion)) currentQuestion = numbers[0];
      renderQuestion();
    });
    elements.questionGrid.addEventListener('click', event => {
      const button = event.target.closest('.question-number');
      if (!button) return;
      goToQuestion(Number(button.dataset.number), true);
    });
    elements.questionGrid.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      const buttons = Array.from(elements.questionGrid.querySelectorAll('.question-number'));
      const currentButton = event.target.closest('.question-number');
      const currentIndex = buttons.indexOf(currentButton);
      if (currentIndex < 0 || !buttons.length) return;
      event.preventDefault();
      const columns = Math.max(1, Math.round(elements.questionGrid.clientWidth / Math.max(48, currentButton.offsetWidth)));
      let nextIndex = currentIndex;
      if (event.key === 'ArrowLeft') nextIndex -= 1;
      if (event.key === 'ArrowRight') nextIndex += 1;
      if (event.key === 'ArrowUp') nextIndex -= columns;
      if (event.key === 'ArrowDown') nextIndex += columns;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = buttons.length - 1;
      nextIndex = Math.max(0, Math.min(buttons.length - 1, nextIndex));
      const nextButton = buttons[nextIndex];
      goToQuestion(Number(nextButton.dataset.number));
      nextButton.focus();
    });
    elements.finishButton.addEventListener('click', showResults);
    elements.deleteWorkbookButton.addEventListener('click', () => {
      if (activeWorkbook) deleteWorkbookById(activeWorkbook.id);
    });
    elements.pdfFrame.addEventListener('load', () => elements.pdfLoading.classList.add('done'));

    elements.dataButton.addEventListener('click', () => {
      elements.dataMessage.textContent = '';
      elements.dataMessage.classList.remove('success');
      showDialog(elements.dataDialog);
    });
    elements.closeDataButton.addEventListener('click', () => closeDialog(elements.dataDialog));
    elements.exportProgressButton.addEventListener('click', exportProgress);
    elements.importProgressButton.addEventListener('click', () => {
      elements.progressInput.value = '';
      elements.progressInput.click();
    });
    elements.progressInput.addEventListener('change', event => {
      const file = event.target.files && event.target.files[0];
      event.target.value = '';
      importProgressFile(file);
    });

    elements.closeResultButton.addEventListener('click', () => closeDialog(elements.resultDialog));
    elements.continuePracticeButton.addEventListener('click', () => closeDialog(elements.resultDialog));
    elements.reviewWrongButton.addEventListener('click', () => {
      const wrong = filteredWrongQuestions();
      if (!wrong.length) return;
      gridFilter = 'wrong';
      elements.gridFilter.value = 'wrong';
      closeDialog(elements.resultDialog);
      goToQuestion(wrong[0], true);
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && document.querySelector('dialog[open]')) return;
      if (event.key === 'Escape' && elements.app.classList.contains('sidebar-open')) {
        event.preventDefault();
        closeSidebar();
        return;
      }
      if (!activeWorkbook || document.querySelector('dialog[open]')) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      const key = event.key.toUpperCase();
      if (CHOICES.includes(key)) {
        event.preventDefault();
        chooseAnswer(key);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveQuestion(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveQuestion(1);
      }
    });

    window.addEventListener('beforeunload', () => {
      saveCurrentNote();
      releasePdfUrl();
    });
  }

  function filteredWrongQuestions() {
    if (!activeWorkbook) return [];
    return Array.from({ length: activeWorkbook.questionCount }, (_, index) => index + 1).filter(number => isWrong(number));
  }

  async function initialize() {
    elements.sidebar.inert = true;
    wireEvents();
    const settings = getSettings();
    if (settings.subjectFilter === 'all' || SUBJECTS[settings.subjectFilter]) subjectFilter = settings.subjectFilter;

    try {
      await refreshWorkbooks();
      const lastWorkbook = workbooks.find(workbook => workbook.id === settings.lastWorkbookId);
      if (lastWorkbook) await openWorkbook(lastWorkbook.id);
      else showHome();
    } catch (error) {
      showHome();
      elements.librarySummary.textContent = '本地存储不可用';
      showToast(error.message || '当前浏览器无法使用本地题库。');
    }
  }

  initialize();
})();
