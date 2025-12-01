
// content.js

// --- Константы ---
const DATA_ENHANCED_COLOR = 'data-enhanced-color';
const DATA_ENHANCED_RESIZE = 'data-enhanced-resize';

// --- Состояния ---
let refreshIntervalId = null;
let currentSettings = {
    enabled: false,
    intervalSeconds: 10
};
let historyPanel = null;
let historyContent = null;
let loadingIndicator = null;
let originalBodyStyle = null;

// --- Функция для загрузки настроек из chrome.storage ---
function loadSettings() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['autoRefreshEnabled', 'autoRefreshInterval'], (result) => {
            currentSettings.enabled = result.autoRefreshEnabled ?? currentSettings.enabled;
            currentSettings.intervalSeconds = result.autoRefreshInterval ?? currentSettings.intervalSeconds;
            console.log('[Settings] Загружены настройки:', currentSettings);
            resolve(currentSettings);
        });
    });
}

// --- Функция для сохранения настроек в chrome.storage ---
function saveSettings(settings) {
    return new Promise((resolve) => {
        chrome.storage.sync.set({
            autoRefreshEnabled: settings.enabled,
            autoRefreshInterval: settings.intervalSeconds
        }, () => {
            console.log('[Settings] Сохранены настройки:', settings);
            resolve();
        });
    });
}

// --- Функция для управления автообновлением ---
async function toggleAutoRefresh() {
    await loadSettings();
    if (currentSettings.enabled) {
        if (refreshIntervalId) {
            clearInterval(refreshIntervalId);
        }
        console.log(`[AutoRefresh] Включение автообновления каждые ${currentSettings.intervalSeconds} секунд.`);
        refreshIntervalId = setInterval(() => {
            console.log("[AutoRefresh] Обновление страницы по таймеру.");
            location.reload();
        }, currentSettings.intervalSeconds * 1000);
    } else {
        console.log('[AutoRefresh] Отключение автообновления.');
        if (refreshIntervalId) {
            clearInterval(refreshIntervalId);
            refreshIntervalId = null;
        }
    }
}

// --- Функция для добавления панели истории ---
function addHistoryPanel() {
    if (document.getElementById('history-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'history-panel';
    panel.innerHTML = `
        <div class="history-panel-header">
            <h3>Данные заявки</h3>
            <button id="close-history-panel" class="close-btn">×</button>
        </div>
        <div class="history-panel-content">
            <div class="panel-grid">
                <div class="task-data-section">
                    <div class="task-data-loading" id="task-data-loading">Загрузка данных заявки...</div>
                    <div class="task-data-content" id="task-data-content"></div>
                </div>
                <div class="activity-section">
                    <div class="activity-loading" id="activity-loading">Загрузка активности...</div>
                    <div class="activity-content" id="activity-content"></div>
                </div>
            </div>
        </div>
    `;

    // Добавляем стили
    const style = document.createElement('style');
    style.textContent = `
        #history-panel {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 50vh;
            background: white;
            border-top: 2px solid #ccc;
            z-index: 10000;
            display: none;
            flex-direction: column;
            box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
        }

        .history-panel-header {
            padding: 10px;
            background: #f5f5f5;
            border-bottom: 1px solid #ddd;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .history-panel-header h3 {
            margin: 0;
            font-size: 14px;
        }

        .close-btn {
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            padding: 0 5px;
        }

        .history-panel-content {
            flex: 1;
            overflow: hidden;
        }

        .panel-grid {
            display: flex;
            height: 100%;
        }

        .task-data-section, .activity-section {
            flex: 1;
            padding: 10px;
            overflow-y: auto;
            border-left: 1px solid #eee;
        }

        .task-data-section:first-child {
            border-left: none;
        }

        .task-data-loading, .activity-loading {
            text-align: center;
            padding: 20px;
            display: block;
        }

        .task-data-content, .activity-content {
            display: none;
        }

        .task-data-item {
            margin-bottom: 8px;
            padding: 5px 0;
            border-bottom: 1px solid #eee;
        }

        .task-data-label {
            font-weight: bold;
            color: #555;
            display: inline-block;
            min-width: 120px;
        }

        .task-data-value {
            display: inline-block;
            word-break: break-word;
            max-width: calc(100% - 130px);
        }

        .activity-item {
            margin-bottom: 15px;
            padding: 10px;
            border: 1px solid #eee;
            border-radius: 4px;
            background: #fafafa;
        }

        .activity-item-head {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }

        .activity-item-user {
            display: flex;
            align-items: center;
        }

        .activity-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            margin-right: 8px;
        }

        .activity-content-block {
            flex: 1;
        }

        .user-title {
            font-weight: bold;
            font-size: 13px;
        }

        .activity-date {
            font-size: 12px;
            color: #666;
        }

        .activity-history {
            margin-bottom: 10px;
        }

        .history-item-new, .history-item-old {
            display: flex;
            margin-bottom: 5px;
        }

        .item-new-title, .item-old-title {
            font-weight: bold;
            min-width: 100px;
            flex-shrink: 0;
            color: #555;
        }

        .item-new-text, .item-old-text {
            flex: 1;
        }

        .activity-info {
            margin-top: 10px;
        }

        .comment-message {
            line-height: 1.4;
        }
    `;

    document.head.appendChild(style);
    document.body.appendChild(panel);

    historyPanel = panel;
    historyContent = document.getElementById('activity-content');
    loadingIndicator = document.getElementById('activity-loading');

    document.getElementById('close-history-panel').addEventListener('click', () => {
        historyPanel.style.display = 'none';
        if (originalBodyStyle) {
            document.body.style.height = originalBodyStyle.height;
            document.body.style.overflow = originalBodyStyle.overflow;
            document.body.style.maxHeight = originalBodyStyle.maxHeight;
            originalBodyStyle = null;
        }
    });
}

// --- Функция для извлечения данных таски из текущей строки таблицы ---
function extractTaskDataFromRow(clickedButton) {
    let currentRow = clickedButton.closest('tr[data-test="table-row"]');
    if (!currentRow) {
        console.warn('[TaskData] Не найдена строка таблицы для кнопки');
        return null;
    }

    const linkCell = currentRow.querySelector('td a, th a');
    if (!linkCell) {
        console.warn('[TaskData] Не найдена ячейка со ссылкой');
        return null;
    }

    const allCells = currentRow.querySelectorAll('td, th');
    if (allCells.length === 0) {
        console.warn('[TaskData] Нет ячеек в строке');
        return null;
    }

    const table = currentRow.closest('table');
    let headers = [];
    if (table) {
        const headerRow = table.querySelector('thead tr');
        if (headerRow) {
            const headerCells = headerRow.querySelectorAll('th, td');
            headers = Array.from(headerCells).map(h => h.textContent.trim());
        }
    }

    let html = '';

    allCells.forEach((cell, index) => {
        const headerText = headers[index] || `Поле ${index + 1}`;

        if (headerText === 'Активность' || headerText === 'Поле 1' || headerText === 'Поле 2') {
            return;
        }

        const cellContent = cell.innerHTML.trim();

        if (cellContent && cellContent !== '' && headerText !== 'Активность') {
            html += `
                <div class="task-data-item">
                    <span class="task-data-label">${headerText}:</span>
                    <span class="task-data-value">${cellContent}</span>
                </div>
            `;
        }
    });

    if (html === '') {
        html = '<div>Нет данных для отображения</div>';
    }

    return html;
}

// --- Функция для извлечения данных таски ---
function getTaskDataFromCurrentRow(clickedButton) {
    try {
        const taskDataHTML = extractTaskDataFromRow(clickedButton);
        if (taskDataHTML) {
            return taskDataHTML;
        } else {
            return '<div>Не удалось извлечь данные заявки из таблицы</div>';
        }
    } catch (error) {
        console.error('[TaskData] Ошибка при извлечении данных:', error);
        return `<div>Ошибка при извлечении данных: ${error.message}</div>`;
    }
}

// --- Функция для извлечения активности из URL ---
async function fetchActivityFromUrlNew(url) {
    return new Promise((resolve, reject) => {
        console.log('[Activity] Отправка запроса на извлечение активности в background:', url);

        chrome.runtime.sendMessage({
            action: "fetchActivity",
            url: url
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('[Activity] Ошибка при отправке сообщения в background:', chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
                return;
            }

            if (response && response.error) {
                console.error('[Activity] Ошибка от background:', response.error);
                reject(new Error(response.error));
            } else if (response && response.html) {
                console.log('[Activity] Получены данные активности из background');
                resolve(response.html);
            } else {
                console.error('[Activity] Неожиданный ответ от background:', response);
                reject(new Error('Unexpected response from background'));
            }
        });
    });
}

// --- Функция для отображения активности и данных таски ---
async function showActivity(url, clickedButton) {
    if (!historyPanel) addHistoryPanel();

    if (!originalBodyStyle) {
        originalBodyStyle = {
            height: document.body.style.height,
            overflow: document.body.style.overflow,
            maxHeight: document.body.style.maxHeight
        };
    }

    document.body.style.height = '50vh';
    document.body.style.overflow = 'auto';
    document.body.style.maxHeight = '50vh';

    historyPanel.style.display = 'flex';

    document.getElementById('task-data-loading').style.display = 'block';
    document.getElementById('task-data-content').style.display = 'none';
    document.getElementById('activity-loading').style.display = 'block';
    document.getElementById('activity-content').style.display = 'none';

    try {
        const taskDataHTML = getTaskDataFromCurrentRow(clickedButton);
        const activityHTML = await fetchActivityFromUrlNew(url);

        document.getElementById('task-data-content').innerHTML = taskDataHTML;
        document.getElementById('task-data-loading').style.display = 'none';
        document.getElementById('task-data-content').style.display = 'block';

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = activityHTML;

        const unwantedElements = tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6, input[type="checkbox"], .activity-controls, .activity-input, .activity-button, [class*="controls"], [class*="input"], [class*="button"], [id*="parentformsectionmodel"], [class*="parentformsectionmodel"], [data-testid*="parentformsectionmodel"], .parentformsectionmodel, [id^="parentformsectionmodel"], [class^="parentformsectionmodel"]');

        unwantedElements.forEach(el => {
            if (el === tempDiv.firstChild ||
                el === tempDiv.children[0] ||
                el === tempDiv.children[1] ||
                el === tempDiv.children[2] ||
                el === tempDiv.children[3] ||
                el === tempDiv.children[4]) {
                el.remove();
            }
        });

        document.getElementById('activity-content').innerHTML = tempDiv.innerHTML;
        document.getElementById('activity-loading').style.display = 'none';
        document.getElementById('activity-content').style.display = 'block';

        console.log('[Activity] Данные таски и активность успешно загружены и отображены.');
    } catch (error) {
        console.error('[Activity] Ошибка при загрузке данных:', error);

        const errorHTML = `<div>Ошибка загрузки: ${error.message || error}</div>`;

        document.getElementById('task-data-content').innerHTML = errorHTML;
        document.getElementById('task-data-loading').style.display = 'none';
        document.getElementById('task-data-content').style.display = 'block';

        document.getElementById('activity-content').innerHTML = errorHTML;
        document.getElementById('activity-loading').style.display = 'none';
        document.getElementById('activity-content').style.display = 'block';
    }
}

// --- Функция для добавления столбца истории ---
function addHistoryColumn(table) {
    if (table.querySelector('.history-column-header')) return;

    const headerRow = table.querySelector('thead tr');
    if (!headerRow) return;

    let numberColumnIndex = -1;
    const headers = headerRow.querySelectorAll('th, td');
    headers.forEach((header, index) => {
        if (header.textContent.trim() === 'Номер') {
            numberColumnIndex = index;
        }
    });

    if (numberColumnIndex === -1) return;

    const historyHeader = document.createElement('th');
    historyHeader.className = 'history-column-header';
    historyHeader.textContent = 'Активность';
    historyHeader.style.width = '80px';
    historyHeader.style.textAlign = 'center';

    const targetHeader = headers[numberColumnIndex];
    targetHeader.parentNode.insertBefore(historyHeader, targetHeader);

    const rows = table.querySelectorAll('tbody tr[data-test="table-row"]');
    rows.forEach(row => {
        const cells = row.querySelectorAll('td, th');
        if (cells.length <= numberColumnIndex) return;

        const targetCell = cells[numberColumnIndex];
        if (!targetCell) return;

        const historyCell = document.createElement('td');
        historyCell.className = 'history-column-cell';
        historyCell.style.textAlign = 'center';
        historyCell.style.padding = '5px';

        const linkElement = targetCell.querySelector('a');
        if (linkElement) {
            const activityBtn = document.createElement('button');
            activityBtn.textContent = 'Активность';
            activityBtn.style.padding = '2px 8px';
            activityBtn.style.fontSize = '12px';
            activityBtn.style.cursor = 'pointer';
            activityBtn.style.backgroundColor = '#e3f2fd';
            activityBtn.style.border = '1px solid #2196f3';
            activityBtn.style.borderRadius = '3px';
            activityBtn.style.color = '#1976d2';

            activityBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const href = linkElement.getAttribute('href');
                if (href) {
                    const fullUrl = new URL(href, window.location.origin).href;
                    console.log('[Activity] Клик по кнопке, открываем активность для URL:', fullUrl);
                    showActivity(fullUrl, activityBtn);
                } else {
                    console.warn('[Activity] Ссылка не найдена в ячейке:', targetCell);
                }
            });

            historyCell.appendChild(activityBtn);
        } else {
            historyCell.textContent = '-';
            historyCell.style.color = '#999';
            historyCell.style.fontSize = '12px';
        }

        targetCell.parentNode.insertBefore(historyCell, targetCell);
    });

    table.style.maxHeight = 'none';
    table.style.overflowY = 'auto';
}

// --- Функция для раскраски строк SLA ---
function colorDueDateRows() {
    const tables = document.querySelectorAll('table');
    const now = new Date();
    console.log("[SLA Color] Запуск обновления цветов SLA. Текущее время:", now);

    tables.forEach(table => {
        if (table.hasAttribute(DATA_ENHANCED_COLOR)) {
            console.log("[SLA Color] Таблица уже обработана для раскраски, пропускаем:", table);
            return;
        }

        let targetIndexPrimary = -1;
        let targetIndexFallback = -1;

        const headerCells = table.querySelectorAll('thead th, thead td');
        headerCells.forEach((th, index) => {
            const text = th.textContent.trim();
            if (text === 'Плановая дата/время окончания') {
                targetIndexPrimary = index;
            }
            if (text === 'Плановая дата/время окончания в BMC') {
                targetIndexFallback = index;
            }
        });

        let targetIndex = targetIndexPrimary !== -1 ? targetIndexPrimary : targetIndexFallback;

        if (targetIndex === -1) {
            console.log("[SLA Color] Ни один из столбцов SLA не найден в таблице, пропускаем.");
            return;
        }

        const rows = table.querySelectorAll('tbody tr[data-test="table-row"]');
        console.log("[SLA Color] Найдено строк для обработки в таблице:", rows.length);

        rows.forEach(row => {
            const cells = row.querySelectorAll('td, th');
            const cell = cells[targetIndex];
            if (!cell) {
                row.style.backgroundColor = '';
                return;
            }

            let textElement = cell.querySelector('span:not(.src-components-groupedTable-___styles-module__NotSet___qnmCN)');
            if (!textElement) {
                textElement = cell.querySelector('div, span');
            }
            if (!textElement) {
                row.style.backgroundColor = '';
                return;
            }

            let text = textElement.textContent.trim();

            if ((!text || text === '(не задано)' || text.toLowerCase() === 'none') && targetIndexFallback !== -1 && targetIndexFallback !== targetIndexPrimary) {
                const fallbackCell = cells[targetIndexFallback];
                if (fallbackCell) {
                    let fallbackTextElement = fallbackCell.querySelector('span:not(.src-components-groupedTable-___styles-module__NotSet___qnmCN)');
                    if (!fallbackTextElement) {
                        fallbackTextElement = fallbackCell.querySelector('div, span');
                    }
                    if (fallbackTextElement) {
                        text = fallbackTextElement.textContent.trim();
                    } else {
                        row.style.backgroundColor = '';
                        return;
                    }
                } else {
                    row.style.backgroundColor = '';
                    return;
                }
            }

            if (!text || text === '(не задано)' || text.toLowerCase() === 'none') {
                row.style.backgroundColor = '';
                return;
            }

            let date = null;
            date = new Date(text);
            if (isNaN(date.getTime())) {
                const dateMatch = text.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/);
                if (dateMatch) {
                    const [, day, month, year, hour, minute] = dateMatch;
                    date = new Date(year, month - 1, day, hour, minute, 0, 0);
                }
            }
            if (isNaN(date.getTime())) {
                const dateMatch = text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
                if (dateMatch) {
                    const [, day, month, year] = dateMatch;
                    date = new Date(year, month - 1, day, 23, 59, 59, 999);
                }
            }

            if (isNaN(date.getTime())) {
                row.style.backgroundColor = '';
                return;
            }

            const diffMs = date.getTime() - now.getTime();
            const diffMinutes = diffMs / (1000 * 60);

            if (diffMs < 0) {
                row.style.backgroundColor = '#ffebee';
                console.log("[SLA Color] Строка окрашена в красный (просрочено):", text);
            } else if (diffMinutes < 60*24) {
                row.style.backgroundColor = '#fff8e1';
                console.log("[SLA Color] Строка окрашена в желтый (менее 24 часов):", text);
            } else {
                row.style.backgroundColor = '';
            }
        });

        table.setAttribute(DATA_ENHANCED_COLOR, 'true');
    });
}

// --- Функция для изменения ширины столбцов (ресайзера) ---
function makeTableResizable(table) {
    if (table.hasAttribute(DATA_ENHANCED_RESIZE)) {
        console.log("[Resizer] Таблица уже обработана для ресайзера, пропускаем:", table);
        return;
    }

    console.log("[Resizer] Обработка таблицы для ресайзера:", table);

    const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
    if (!headerRow) {
        console.log("[Resizer] Строка заголовков не найдена.");
        return;
    }

    const headers = Array.from(headerRow.querySelectorAll('th, td'));
    if (headers.length <= 1) {
        console.log("[Resizer] Недостаточно столбцов для ресайзера.");
        return;
    }

    // Временно отключаем observer
    observer.disconnect();

    try {
        table.setAttribute(DATA_ENHANCED_RESIZE, 'true');

        // Проверяем, не добавлены ли уже ресайзеры
        if (table.querySelector('.resizer-container')) {
            console.log("[Resizer] Ресайзеры уже добавлены, пропускаем");
            return;
        }

        // Создаем контейнер для ресайзеров
        const resizerContainer = document.createElement('div');
        resizerContainer.className = 'resizer-container';
        resizerContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 100;
        `;

        table.style.position = 'relative';
        table.appendChild(resizerContainer);

        headers.forEach((header, index) => {
            if (index === headers.length - 1) return;

            const resizer = document.createElement('div');
            resizer.className = 'table-resizer';
            resizer.setAttribute('data-resizer-index', index);
            resizer.style.cssText = `
                position: absolute;
                top: 0;
                bottom: 0;
                width: 10px;
                cursor: col-resize;
                z-index: 101;
                pointer-events: auto;
                background-color: transparent;
                transition: background-color 0.2s;
            `;

            // Начальная позиция
            const updateResizerPosition = () => {
                const headerRect = header.getBoundingClientRect();
                const tableRect = table.getBoundingClientRect();
                const leftPosition = (headerRect.right - tableRect.left) - 5;
                resizer.style.left = leftPosition + 'px';
            };

            // Устанавливаем начальную позицию с задержкой
            setTimeout(updateResizerPosition, 0);

            // Добавляем обработчик для ресайзинга
            setupResizerHandlers(resizer, header, headers, index, table);

            resizerContainer.appendChild(resizer);
        });

        // Добавляем стили один раз
        if (!document.head.querySelector('#resizer-styles')) {
            const style = document.createElement('style');
            style.id = 'resizer-styles';
            style.textContent = `
                .table-resizer:hover {
                    background-color: rgba(33, 150, 243, 0.3) !important;
                }

                .table-resizer.resizing {
                    background-color: rgba(33, 150, 243, 0.5) !important;
                }
            `;
            document.head.appendChild(style);
        }

    } finally {
        // Включаем observer обратно
        setTimeout(() => {
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: false,
                characterData: false
            });
        }, 100);
    }
}

// --- Функция для обновления позиций ресайзеров ---
function updateResizerPositions() {
    document.querySelectorAll('table[data-enhanced-resize="true"]').forEach(table => {
        const resizerContainer = table.querySelector('.resizer-container');
        if (!resizerContainer) return;

        const headers = Array.from(table.querySelectorAll('thead th, thead td'));
        const resizers = resizerContainer.querySelectorAll('.table-resizer');

        headers.forEach((header, index) => {
            if (index >= headers.length - 1) return;

            const resizer = resizers[index];
            if (!resizer) return;

            const headerRect = header.getBoundingClientRect();
            const tableRect = table.getBoundingClientRect();
            const leftPosition = (headerRect.right - tableRect.left) - 5;
            resizer.style.left = leftPosition + 'px';
        });
    });
}
// --- Функция для сброса флагов ---
function resetEnhancedFlags() {
    document.querySelectorAll(`[${DATA_ENHANCED_COLOR}]`).forEach(el => el.removeAttribute(DATA_ENHANCED_COLOR));
    document.querySelectorAll(`[${DATA_ENHANCED_RESIZE}]`).forEach(el => el.removeAttribute(DATA_ENHANCED_RESIZE));
}

// --- Обрабатываем все НЕОБРАБОТАННЫЕ таблицы на странице ---
function enhanceAllTables() {
    console.log("[Main] Запуск enhanceAllTables...");
    resetEnhancedFlags();

    document.querySelectorAll('table').forEach(table => {
        addHistoryColumn(table);
        colorDueDateRows();
        makeTableResizable(table);
    });
}

// --- Основной запуск ---
async function init() {
    console.log("[Main] Инициализация плагина...");

    await loadSettings();
    toggleAutoRefresh();
    enhanceAllTables();

    if (document.readyState === 'complete') {
        console.log("[Main] Страница уже загружена, повторный запуск обработки...");
        enhanceAllTables();
    } else {
        console.log("[Main] Ожидание загрузки страницы...");
        window.addEventListener('load', () => {
            enhanceAllTables();
        }, { once: true });
    }

    const observer = new MutationObserver((mutationsList) => {
        let shouldUpdate = false;
        for (let mutation of mutationsList) {
            if (mutation.type === 'childList') {
                for (let node of mutation.addedNodes) {
                    if (node.nodeType === 1) {
                        if (node.tagName === 'TABLE' || node.querySelector && (node.querySelector('tr[data-test="table-row"]') || node.querySelector('th, td'))) {
                            shouldUpdate = true;
                            break;
                        }
                    }
                }
                for (let node of mutation.removedNodes) {
                    if (node.nodeType === 1) {
                        if (node.tagName === 'TABLE' || node.querySelector && (node.querySelector('tr[data-test="table-row"]') || node.querySelector('th, td'))) {
                            shouldUpdate = true;
                            break;
                        }
                    }
                }
                if (shouldUpdate) break;
            }
        }
        if (shouldUpdate) {
            console.log("[Main] Обнаружены изменения в DOM (таблицы), запуск обработки...");
            setTimeout(enhanceAllTables, 200);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Запускаем инициализацию
if (document.readyState === 'loading') {
    console.log("[Main] Документ ещё загружается...");
    document.addEventListener('DOMContentLoaded', init);
} else {
    console.log("[Main] Документ готов, запуск инициализации...");
    init();
}

// --- Функция для сброса флагов ---
function resetEnhancedFlags() {
    document.querySelectorAll(`[${DATA_ENHANCED_COLOR}]`).forEach(el => el.removeAttribute(DATA_ENHANCED_COLOR));
    document.querySelectorAll(`[${DATA_ENHANCED_RESIZE}]`).forEach(el => el.removeAttribute(DATA_ENHANCED_RESIZE));
}

// --- Обрабатываем все НЕОБРАБОТАННЫЕ таблицы на странице ---
// Добавьте глобальный флаг
let isEnhancingTables = false;
let observerDebounceTimer = null;

// Обновите функцию enhanceAllTables с защитой от рекурсии
function enhanceAllTables() {
    if (isEnhancingTables) {
        console.log("[Main] Уже выполняется обработка таблиц, пропускаем...");
        return;
    }

    console.log("[Main] Запуск enhanceAllTables...");
    isEnhancingTables = true;

    try {
        resetEnhancedFlags();
        document.querySelectorAll('table').forEach(table => {
            addHistoryColumn(table);
            colorDueDateRows();
            makeTableResizable(table);
        });

        setTimeout(updateResizerPositions, 100);
    } finally {
        // Снимаем флаг после завершения с небольшой задержкой
        setTimeout(() => {
            isEnhancingTables = false;
            console.log("[Main] Обработка таблиц завершена");
        }, 50);
    }
}

// Обновленный MutationObserver
const observer = new MutationObserver((mutationsList) => {
    // Игнорируем изменения, если мы сами обрабатываем таблицы
    if (isEnhancingTables) return;

    // Проверяем, действительно ли изменения касаются таблиц
    let shouldUpdate = false;

    for (let mutation of mutationsList) {
        // Игнорируем изменения в наших собственных элементах
        if (mutation.target.classList?.contains('table-resizer') ||
            mutation.target.classList?.contains('resizer-container') ||
            mutation.target.id === 'history-panel') {
            continue;
        }

        // Игнорируем изменения стилей и классов (они часто триггерятся нашим кодом)
        if (mutation.type === 'attributes' &&
            (mutation.attributeName === 'style' ||
             mutation.attributeName === 'class')) {
            continue;
        }

        // Проверяем только добавление/удаление узлов
        if (mutation.type === 'childList') {
            for (let node of mutation.addedNodes) {
                if (node.nodeType === 1) { // Element node
                    // Проверяем только существенные изменения
                    if (node.tagName === 'TABLE' ||
                        (node.querySelector && node.querySelector('table')) ||
                        (node.classList && node.classList.contains('src-components-groupedTable'))) {
                        shouldUpdate = true;
                        break;
                    }
                }
            }

            for (let node of mutation.removedNodes) {
                if (node.nodeType === 1) { // Element node
                    if (node.tagName === 'TABLE' ||
                        (node.querySelector && node.querySelector('table'))) {
                        shouldUpdate = true;
                        break;
                    }
                }
            }
        }

        if (shouldUpdate) break;
    }

    if (shouldUpdate) {
        // Дебаунс - ждем, пока изменения устоятся
        if (observerDebounceTimer) {
            clearTimeout(observerDebounceTimer);
        }

        observerDebounceTimer = setTimeout(() => {
            console.log("[Main] Обнаружены существенные изменения в DOM, запуск обработки...");
            enhanceAllTables();
        }, 300); // Увеличил задержку
    }
});

// Настройка observer с более специфичными параметрами
observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false, // Отключаем отслеживание атрибутов
    attributeFilter: [], // Пустой фильтр = не отслеживаем атрибуты
    characterData: false // Не отслеживаем изменения текста
});

function setupResizerHandlers(resizer, header, headers, index, table) {
    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isResizing = true;
        resizer.classList.add('resizing');

        const tableRect = table.getBoundingClientRect();
        const startX = e.clientX;

        const allRows = Array.from(table.querySelectorAll('tr'));
        const currentColumnCells = allRows
            .map(row => {
                const cells = row.querySelectorAll('th, td');
                return cells[index] || null;
            })
            .filter(Boolean);

        const nextHeader = headers[index + 1];
        const nextColumnCells = allRows
            .map(row => {
                const cells = row.querySelectorAll('th, td');
                return cells[index + 1] || null;
            })
            .filter(Boolean);

        const startWidthCurrent = currentColumnCells[0]?.offsetWidth || 0;
        const startWidthNext = nextColumnCells[0]?.offsetWidth || 0;

        const onMouseMove = (moveEvent) => {
            if (!isResizing) return;

            const dx = moveEvent.clientX - startX;
            let newWidthCurrent = Math.max(20, startWidthCurrent + dx);
            let newWidthNext = Math.max(20, startWidthNext - dx);

            // Применяем новые ширины
            currentColumnCells.forEach(cell => {
                cell.style.width = newWidthCurrent + 'px';
                cell.style.minWidth = newWidthCurrent + 'px';
                cell.style.maxWidth = newWidthCurrent + 'px';
            });

            nextColumnCells.forEach(cell => {
                cell.style.width = newWidthNext + 'px';
                cell.style.minWidth = newWidthNext + 'px';
                cell.style.maxWidth = newWidthNext + 'px';
            });

            // Обновляем позицию текущего ресайзера
            resizer.style.left = (startWidthCurrent + dx - 5) + 'px';

            // Обновляем текст в ячейках
            updateCellContentVisibility([...currentColumnCells, ...nextColumnCells]);
        };

        const onMouseUp = () => {
            isResizing = false;
            resizer.classList.remove('resizing');

            // Обновляем все ресайзеры после завершения
            setTimeout(() => {
                updateAllResizerPositions(table);
            }, 10);

            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

function updateAllResizerPositions(table) {
    const resizerContainer = table.querySelector('.resizer-container');
    if (!resizerContainer) return;

    const headers = Array.from(table.querySelectorAll('thead th, thead td'));
    const resizers = resizerContainer.querySelectorAll('.table-resizer');

    headers.forEach((header, index) => {
        if (index >= headers.length - 1) return;

        const resizer = resizers[index];
        if (!resizer) return;

        const headerRect = header.getBoundingClientRect();
        const tableRect = table.getBoundingClientRect();
        const leftPosition = (headerRect.right - tableRect.left) - 5;
        resizer.style.left = leftPosition + 'px';
    });
}

function updateCellContentVisibility(cells) {
    cells.forEach(cell => {
        const contentDiv = cell.querySelector('.src-components-groupedTable-cellDescription-___styles-module__content___wrzOw');
        if (contentDiv) {
            const containerDiv = contentDiv.querySelector('.src-components-groupedTable-cellDescription-___styles-module__container___u5dbD');
            if (containerDiv) {
                containerDiv.style.cssText = `
                    overflow: visible !important;
                    white-space: normal !important;
                    text-overflow: clip !important;
                    word-break: break-word !important;
                    max-width: none !important;
                `;
            }
        }
    });
}

// Добавьте декоратор для предотвращения повторных вызовов
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Оберните enhanceAllTables в debounce
const debouncedEnhanceAllTables = debounce(enhanceAllTables, 500);

// В MutationObserver используйте debounced версию
observerDebounceTimer = setTimeout(() => {
    console.log("[Main] Обнаружены существенные изменения в DOM, запуск обработки...");
    debouncedEnhanceAllTables();
}, 300);

// --- Основной запуск ---
async function init() {
    console.log("[Main] Инициализация плагина...");

    await loadSettings();
    toggleAutoRefresh();
    enhanceAllTables();

    if (document.readyState === 'complete') {
        console.log("[Main] Страница уже загружена, повторный запуск обработки...");
        enhanceAllTables();
    } else {
        console.log("[Main] Ожидание загрузки страницы...");
        window.addEventListener('load', () => {
            enhanceAllTables();
        }, { once: true });
    }

    window.addEventListener('resize', () => {
        setTimeout(updateResizerPositions, 100);
    });

    const observer = new MutationObserver((mutationsList) => {
    let shouldUpdate = false;
    for (let mutation of mutationsList) {
        if (mutation.type === 'childList' || mutation.type === 'attributes') {
            shouldUpdate = true;
            break;
        }
    }
    if (shouldUpdate) {
        console.log("[Main] Обнаружены изменения в DOM, запуск обработки...");
        setTimeout(() => {
            enhanceAllTables();
            updateResizerPositions();
        }, 200);
    }
});

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Запускаем инициализацию
if (document.readyState === 'loading') {
    console.log("[Main] Документ ещё загружается...");
    document.addEventListener('DOMContentLoaded', init);
} else {
    console.log("[Main] Документ готов, запуск инициализации...");
    init();
}