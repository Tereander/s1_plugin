// content.js - ОБЪЕДИНЕННЫЙ ФАЙЛ ДЛЯ ВСЕХ ФУНКЦИЙ

// === КОНСТАНТЫ ===
const DATA_ENHANCED_COLOR = 'data-enhanced-color';
const DATA_ENHANCED_RESIZE = 'data-enhanced-resize';

// Конфигурация для стилизации статусов
const STATUS_CONFIG = {
    statuses: [
    'Отложено', 'Закрыта', 'В работе', 'Выполнено', 'На подтверждении', 'Зарегистрировано',
    'Назначено', 'Принято', 'Возврат диспетчеру', 'Подготовка отчета', 'Закрыто', 'Авторизация',
    'Ожидает согласования', 'Подготовка отчета'
    ],
    styleFlag: 'data-status-styled',
    // statusSelector: 'span.src-components-customselect-___styles-module__inputText___J9u6h'
    statusSelector: 'button.src-components-customselect-___styles-module__input___M2cpK'
};

// === СОСТОЯНИЯ ===
let refreshIntervalId = null;
let currentSettings = {
    enabled: false,
    intervalSeconds: 10
};
let historyPanel = null;
let originalBodyStyle = null;
let isEnhancingTables = false;
let observerDebounceTimer = null;
let activityRequests = new Map();

// Для стилизации статусов
let statusCheckCount = 0;
let statusObserver = null;
let statusIntervalId = null;
let lastUrl = window.location.href;

// === ФУНКЦИИ СТИЛИЗАЦИИ СТАТУСОВ ===

function applyStatusStyles() {
    try {
        console.log("[StatusStyler] Поиск элементов статусов...");

        const elements = document.querySelectorAll(STATUS_CONFIG.statusSelector);

        if (elements.length === 0) {
            console.log("[StatusStyler] Элементы не найдены");
            return false;
        }

        let styledCount = 0;

        elements.forEach(element => {
            const text = element.textContent.trim();

            // Проверяем массив статусов
            for (const status of STATUS_CONFIG.statuses) {
                if (text === status) {
                    // Проверяем, не стилизован ли уже
                    if (element.hasAttribute(STATUS_CONFIG.styleFlag)) {
                        continue;
                    }

                    // Применяем стили
                    element.style.backgroundColor = '#33cbb4';
                    element.style.border = '1px solid black';
                    element.style.color = 'white';
                    element.style.fontWeight = '600';

                    // Сохраняем оригинальные padding если они есть
                    const computedStyle = window.getComputedStyle(element);
                    if (!computedStyle.padding || computedStyle.padding === '0px') {
                        element.style.padding = '2px 8px';
                    }

                    if (!computedStyle.borderRadius || computedStyle.borderRadius === '0px') {
                        element.style.borderRadius = '3px';
                    }

                    element.setAttribute(STATUS_CONFIG.styleFlag, 'true');
                    styledCount++;

                    console.log(`[StatusStyler] Стилизован: "${text}"`);
                    break;
                }
            }
        });

        if (styledCount > 0) {
            console.log(`[StatusStyler] Стилизовано элементов: ${styledCount}`);
            return true;
        }

        return false;

    } catch (error) {
        console.error("[StatusStyler] Ошибка:", error);
        return false;
    }
}

function startStatusStyling() {
    console.log("[StatusStyler] Запуск стилизации статусов...");
    statusCheckCount = 0;

    // Первая попытка
    const success = applyStatusStyles();

    if (success) {
        console.log("[StatusStyler] Стилизация успешно применена");
        return;
    }

    // Если не нашли элементы, пробуем несколько раз с интервалом
    statusIntervalId = setInterval(() => {
        statusCheckCount++;

        if (statusCheckCount >= 10) {
            console.log("[StatusStyler] Достигнут лимит проверок, остановка");
            clearInterval(statusIntervalId);
            return;
        }

        console.log(`[StatusStyler] Повторная проверка #${statusCheckCount}`);

        if (applyStatusStyles()) {
            clearInterval(statusIntervalId);
            console.log("[StatusStyler] Элементы найдены и стилизованы");
        }

    }, 2000);
}

function stopStatusStyling() {
    if (statusIntervalId) {
        clearInterval(statusIntervalId);
        statusIntervalId = null;
    }

    if (statusObserver) {
        statusObserver.disconnect();
        statusObserver = null;
    }

    console.log("[StatusStyler] Стилизация статусов остановлена");
}

function setupStatusObserver() {
    statusObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Проверяем есть ли в новых элементах наши статусы
                let hasRelevantChanges = false;

                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) { // Element node
                        if (node.querySelector && node.querySelector(STATUS_CONFIG.statusSelector)) {
                            hasRelevantChanges = true;
                            break;
                        }
                    }
                }

                if (hasRelevantChanges) {
                    console.log("[StatusStyler] Обнаружены новые элементы DOM");
                    setTimeout(applyStatusStyles, 300);
                }
            }
        }
    });

    statusObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// === ФУНКЦИИ ДЛЯ СПИСКА ЗАЯВОК ===

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

function toggleAutoRefresh() {
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
                    <div class="task-data-content" id="task-data-content"></div>
                </div>
                <div class="activity-section">
                    <div class="activity-content" id="activity-content"></div>
                </div>
            </div>
        </div>
    `;

    // Стили
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
        /* Стили для ресайзеров */
        .table-resizer:hover {
            background-color: rgba(33, 150, 243, 0.3) !important;
        }
        .table-resizer.resizing {
            background-color: rgba(33, 150, 243, 0.5) !important;
        }
    `;

    document.head.appendChild(style);
    document.body.appendChild(panel);

    historyPanel = panel;

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

function extractTaskDataFromRow(clickedButton) {
    let currentRow = clickedButton.closest('tr[data-test="table-row"]');
    if (!currentRow) {
        console.warn('[TaskData] Не найдена строка таблицы для кнопки');
        return '<div>Не найдена строка таблицы</div>';
    }

    const allCells = currentRow.querySelectorAll('td, th');
    if (allCells.length === 0) {
        return '<div>Нет данных в строке</div>';
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

        // Пропускаем столбец активности
        if (headerText === 'Активность' || cell.classList.contains('history-column-cell')) {
            return;
        }

        const cellContent = cell.textContent.trim();
        if (cellContent && cellContent !== '') {
            html += `
                <div class="task-data-item">
                    <span class="task-data-label">${headerText}:</span>
                    <span class="task-data-value">${cellContent}</span>
                </div>
            `;
        }
    });

    return html || '<div>Нет данных для отображения</div>';
}

async function fetchActivityFromUrlNew(url) {
    return new Promise((resolve, reject) => {
        console.log('[Activity] Отправка запроса на извлечение активности:', url);

        const requestId = Date.now() + Math.random();

        const messageListener = (message) => {
            if (message.action === "activityDataReceived" && message.requestId === requestId) {
                console.log('[Activity] Получены данные активности!');
                chrome.runtime.onMessage.removeListener(messageListener);
                activityRequests.delete(requestId);

                if (message.html) {
                    resolve(message.html);
                } else {
                    reject(new Error('Нет данных активности'));
                }
            }
        };

        chrome.runtime.onMessage.addListener(messageListener);
        activityRequests.set(requestId, { resolve, reject });

        chrome.runtime.sendMessage({
            action: "fetchActivity",
            url: url,
            requestId: requestId
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('[Activity] Ошибка отправки:', chrome.runtime.lastError);
                chrome.runtime.onMessage.removeListener(messageListener);
                activityRequests.delete(requestId);
                reject(chrome.runtime.lastError);
                return;
            }

            if (response && response.success) {
                console.log('[Activity] Запрос принят, ожидание данных...');
            } else if (response && response.error) {
                chrome.runtime.onMessage.removeListener(messageListener);
                activityRequests.delete(requestId);
                reject(new Error(response.error));
            }
        });

        // Таймаут 20 секунд
        setTimeout(() => {
            if (activityRequests.has(requestId)) {
                console.log('[Activity] Таймаут ожидания активности (20с)');
                chrome.runtime.onMessage.removeListener(messageListener);
                activityRequests.delete(requestId);
                reject(new Error('Таймаут загрузки активности'));
            }
        }, 20000);
    });
}

async function showActivity(url, clickedButton) {
    console.log('[Activity] === НАЧАЛО ЗАГРУЗКИ АКТИВНОСТИ ===');
    console.log('[Activity] URL:', url);
    console.log('[Activity] Кнопка:', clickedButton);

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

    // Сразу показываем данные из таблицы
    document.getElementById('task-data-content').innerHTML = extractTaskDataFromRow(clickedButton);

    // Показываем индикатор загрузки
    document.getElementById('activity-content').innerHTML = '<div style="padding:10px;text-align:center;">Загрузка...</div>';

    try {
        console.log('[Activity] Запуск fetchActivityFromUrlNew...');
        const startTime = Date.now();
        const activityHTML = await fetchActivityFromUrlNew(url);
        const endTime = Date.now();

        console.log('[Activity] Данные получены за', endTime - startTime, 'мс');
        console.log('[Activity] Длина HTML:', activityHTML.length);
        console.log('[Activity] Первые 500 символов:', activityHTML.substring(0, 500));

        document.getElementById('activity-content').innerHTML = activityHTML;
        console.log('[Activity] Активность загружена и отображена');

        // Быстрое добавление стилей
        addFastStyles();

        console.log('[Activity] Активность загружена');

    } catch (error) {
        console.error('[Activity] ПОЛНАЯ ОШИБКА:', error);
        console.error('[Activity] Stack:', error.stack);

        document.getElementById('activity-content').innerHTML =
            `<div style="padding:15px;background:#ffebee;color:#c62828;">
                <strong>Ошибка:</strong> ${error.message}<br>
                <small>${error.stack}</small>
            </div>`;
    }

    console.log('[Activity] === КОНЕЦ ЗАГРУЗКИ АКТИВНОСТИ ===');
}

function addFastStyles() {
    const styleId = 'activity-fast-styles';
    let style = document.getElementById(styleId);

    if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #activity-content { max-width: 100%; }
            #activity-content img { max-width: 100% !important; height: auto !important; }
        `;
        document.head.appendChild(style);
    }
}

function addActivityStyles() {
    const styleId = 'activity-panel-styles';

    // Удаляем старые стили если есть
    const oldStyle = document.getElementById(styleId);
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        #activity-content {
            font-family: inherit;
            line-height: 1.5;
            max-width: 100%;
        }

        #activity-content img {
            max-width: 100% !important;
            height: auto !important;
            max-height: 200px !important;
        }

        #activity-content video,
        #activity-content iframe,
        #activity-content audio {
            max-width: 100% !important;
            max-height: 300px !important;
        }

        #activity-content table {
            width: 100% !important;
            border-collapse: collapse;
            margin: 8px 0;
        }

        #activity-content th,
        #activity-content td {
            border: 1px solid #e0e0e0;
            padding: 6px 8px;
            font-size: 13px;
        }

        #activity-content th {
            background: #f5f5f5;
            font-weight: 600;
        }

        /* Делаем прокрутку внутри панели */
        .activity-section {
            overflow-y: auto;
            padding-right: 5px;
        }

        .activity-section::-webkit-scrollbar {
            width: 6px;
        }

        .activity-section::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 3px;
        }

        .activity-section::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 3px;
        }

        .activity-section::-webkit-scrollbar-thumb:hover {
            background: #a8a8a8;
        }
    `;

    document.head.appendChild(style);
}

function addHistoryColumn(table) {
    if (table.querySelector('.history-column-header')) return;

    const headerRow = table.querySelector('thead tr');
    if (!headerRow) return;

    let numberColumnIndex = -1;
    const headers = headerRow.querySelectorAll('th, td');
    headers.forEach((header, index) => {
        if (header.textContent.trim() === 'Номер' || header.textContent.trim() === '#') {
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
        if (linkElement && linkElement.href) {
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
                e.preventDefault();
                const href = linkElement.href;
                if (href) {
                    console.log('[Activity] Клик по кнопке:', href);
                    showActivity(href, activityBtn);
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
}

function colorDueDateRows() {
    const tables = document.querySelectorAll('table');
    const now = new Date();

    tables.forEach(table => {
        if (table.hasAttribute(DATA_ENHANCED_COLOR)) return;

        let targetIndex = -1;
        const headerCells = table.querySelectorAll('thead th, thead td');
        headerCells.forEach((th, index) => {
            const text = th.textContent.trim();
            if (text === 'Плановая дата/время окончания' ||
                text === 'Плановая дата/время окончания в BMC' ||
                text === 'Плановая дата/время окончания для ПБ') {
                targetIndex = index;
            }
        });

        if (targetIndex === -1) return;

        const rows = table.querySelectorAll('tbody tr[data-test="table-row"]');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td, th');
            const cell = cells[targetIndex];
            if (!cell) return;

            let text = cell.textContent.trim();
            if (!text || text === '(не задано)' || text.toLowerCase() === 'none') {
                row.style.backgroundColor = '';
                return;
            }

            let date = new Date(text);
            if (isNaN(date.getTime())) {
                const dateMatch = text.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/);
                if (dateMatch) {
                    const [, day, month, year, hour, minute] = dateMatch;
                    date = new Date(year, month - 1, day, hour, minute);
                }
            }

            if (isNaN(date.getTime())) return;

            const diffMs = date.getTime() - now.getTime();
            const diffMinutes = diffMs / (1000 * 60);

            if (diffMs < 0) {
                row.style.backgroundColor = '#ffebee';
            } else if (diffMinutes < 60*24) {
                row.style.backgroundColor = '#fff8e1';
            }
        });

        table.setAttribute(DATA_ENHANCED_COLOR, 'true');
    });
}

function makeTableResizable(table) {
    if (table.hasAttribute(DATA_ENHANCED_RESIZE)) {
        return;
    }

    const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
    if (!headerRow) {
        return;
    }

    const headers = Array.from(headerRow.querySelectorAll('th, td'));
    if (headers.length <= 1) {
        return;
    }

    try {
        table.setAttribute(DATA_ENHANCED_RESIZE, 'true');

        if (table.querySelector('.resizer-container')) {
            return;
        }

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

        // Сначала настраиваем стили для ячеек
        optimizeTableCells(table);

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

            const updateResizerPosition = () => {
                const headerRect = header.getBoundingClientRect();
                const tableRect = table.getBoundingClientRect();
                const leftPosition = (headerRect.right - tableRect.left) - 5;
                resizer.style.left = leftPosition + 'px';
            };

            setTimeout(updateResizerPosition, 0);
            setupResizerHandlers(resizer, header, headers, index, table);
            resizerContainer.appendChild(resizer);
        });

    } catch (error) {
        console.error("[Resizer] Ошибка при создании ресайзеров:", error);
    }
}

function optimizeTableCells(table) {
    const allCells = table.querySelectorAll('th, td');
    allCells.forEach(cell => {
        // Устанавливаем правильные стили для предотвращения переноса
        cell.style.whiteSpace = 'nowrap';
        cell.style.overflow = 'hidden';
        cell.style.textOverflow = 'ellipsis';
        cell.style.maxWidth = '500px'; // Максимальная ширина по умолчанию

        // Очищаем возможные мешающие стили
        cell.style.wordBreak = 'normal';
        cell.style.wordWrap = 'normal';
        cell.style.hyphens = 'none';

        // Обрабатываем вложенные элементы
        const innerElements = cell.querySelectorAll('div, span, p');
        innerElements.forEach(el => {
            el.style.whiteSpace = 'nowrap';
            el.style.overflow = 'hidden';
            el.style.textOverflow = 'ellipsis';
            el.style.maxWidth = '100%';
            el.style.display = 'block';
        });
    });
}

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
            let newWidthCurrent = Math.max(30, startWidthCurrent + dx); // Минимум 30px
            let newWidthNext = Math.max(30, startWidthNext - dx);

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

            // Обновляем отображение текста
            updateCellTextVisibility([...currentColumnCells, ...nextColumnCells]);
        };

        const onMouseUp = () => {
            isResizing = false;
            resizer.classList.remove('resizing');

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

function updateCellTextVisibility(cells) {
    cells.forEach(cell => {
        // Для узких колонок - обрезаем текст
        if (cell.offsetWidth < 100) {
            cell.style.textOverflow = 'ellipsis';
            cell.style.overflow = 'hidden';
            cell.style.whiteSpace = 'nowrap';
        } else {
            // Для широких колонок - можно показывать больше
            cell.style.textOverflow = 'ellipsis';
            cell.style.overflow = 'hidden';
            cell.style.whiteSpace = 'nowrap';
        }

        // Обрабатываем вложенные элементы
        const innerElements = cell.querySelectorAll('div, span, p');
        innerElements.forEach(el => {
            el.style.textOverflow = 'ellipsis';
            el.style.overflow = 'hidden';
            el.style.whiteSpace = 'nowrap';
            el.style.maxWidth = '100%';
        });
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

function resetEnhancedFlags() {
    document.querySelectorAll(`[${DATA_ENHANCED_COLOR}]`).forEach(el => el.removeAttribute(DATA_ENHANCED_COLOR));
    document.querySelectorAll(`[${DATA_ENHANCED_RESIZE}]`).forEach(el => el.removeAttribute(DATA_ENHANCED_RESIZE));
}

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

function enhanceAllTables() {
    if (isEnhancingTables) {
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
        setTimeout(() => {
            isEnhancingTables = false;
        }, 50);
    }
}

const debouncedEnhanceAllTables = debounce(enhanceAllTables, 500);

// === SPA-ОТСЛЕЖИВАНИЕ ПЕРЕХОДОВ ===

function checkUrlChange() {
    const currentUrl = window.location.href;

    if (currentUrl !== lastUrl) {
        console.log(`[URL Tracker] URL изменился: ${lastUrl} -> ${currentUrl}`);
        lastUrl = currentUrl;

        // Определяем тип страницы и запускаем нужные функции
        handlePageChange(currentUrl);
    }
}

function setupSPATracking() {
    // 1. Периодическая проверка URL
    const urlCheckInterval = setInterval(checkUrlChange, 1000);

    // 2. События истории браузера
    window.addEventListener('popstate', checkUrlChange);

    // 3. Перехват pushState/replaceState
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
        const result = originalPushState.apply(this, args);
        setTimeout(checkUrlChange, 100);
        return result;
    };

    history.replaceState = function(...args) {
        const result = originalReplaceState.apply(this, args);
        setTimeout(checkUrlChange, 100);
        return result;
    };

    // 4. Отслеживание кликов по ссылкам
    document.addEventListener('click', (e) => {
        let target = e.target;

        // Ищем ближайшую ссылку
        while (target && target.tagName !== 'A' && target !== document.body) {
            target = target.parentElement;
        }

        if (target && target.tagName === 'A' && target.href) {
            setTimeout(checkUrlChange, 300);
        }
    }, true);

    // Очистка при уходе со страницы
    window.addEventListener('beforeunload', () => {
        clearInterval(urlCheckInterval);
        stopStatusStyling();
    });

    console.log("[SPA Tracker] Отслеживание запущено");
}

// === ОСНОВНАЯ ЛОГИКА ОБРАБОТКИ СТРАНИЦ ===

function handlePageChange(url) {
    // Останавливаем все предыдущие процессы
    stopStatusStyling();

    // Сбрасываем флаги таблиц
    resetEnhancedFlags();

    // Определяем тип страницы и запускаем нужные функции
    if (url.includes('/record/')) {
        // Страница заявки - только стилизация статусов
        console.log('[Page] Страница заявки - запускаем стилизацию статусов');
        setTimeout(() => {
            startStatusStyling();
            setupStatusObserver();
        }, 500);
    } else if (url.includes('/list/')) {
        // Страница списка - все функции кроме стилизации статусов
        console.log('[Page] Страница списка - запускаем основные функции');
        setTimeout(() => {
            initListFunctions();
        }, 500);
    } else {
        console.log('[Page] Неизвестный тип страницы, базовая инициализация');
        setTimeout(initBaseFunctions, 500);
    }
}

async function initListFunctions() {
    console.log("[List] Инициализация функций для списка...");

    await loadSettings();
    toggleAutoRefresh();
    enhanceAllTables();
}

function initBaseFunctions() {
    console.log("[Base] Базовая инициализация...");

    // Инициализация SPA отслеживания
    setupSPATracking();

    // Проверяем текущую страницу при загрузке
    setTimeout(() => {
        handlePageChange(window.location.href);
    }, 100);
}

// В конец content.js добавь:
// Функция для ручного тестирования
function testActivityExtraction(url) {
  console.log('[TEST] Начинаю тест извлечения активности:', url);

  const testButton = document.createElement('button');
  testButton.textContent = 'ТЕСТ';
  testButton.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;padding:10px;background:red;color:white;';

  testButton.addEventListener('click', async () => {
    console.log('[TEST] Клик по тестовой кнопке');
    await showActivity(url, testButton);
  });

  document.body.appendChild(testButton);
  console.log('[TEST] Тестовая кнопка добавлена');
}

// Для отладки в консоли
window.testActivity = testActivityExtraction;
console.log('[TEST] Для тестирования используй: testActivity("URL_заявки")');

// === ИНИЦИАЛИЗАЦИЯ MUTATION OBSERVER ===

const observer = new MutationObserver((mutationsList) => {
    if (isEnhancingTables) return;

    let shouldUpdate = false;

    for (let mutation of mutationsList) {
        if (mutation.target.classList?.contains('table-resizer') ||
            mutation.target.classList?.contains('resizer-container') ||
            mutation.target.id === 'history-panel') {
            continue;
        }

        if (mutation.type === 'childList') {
            for (let node of mutation.addedNodes) {
                if (node.nodeType === 1) {
                    if (node.tagName === 'TABLE' ||
                        (node.querySelector && node.querySelector('table'))) {
                        shouldUpdate = true;
                        break;
                    }
                }
            }

            for (let node of mutation.removedNodes) {
                if (node.nodeType === 1) {
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
        if (observerDebounceTimer) {
            clearTimeout(observerDebounceTimer);
        }

        observerDebounceTimer = setTimeout(() => {
            console.log("[Main] Обнаружены изменения в DOM, запуск обработки...");
            debouncedEnhanceAllTables();
        }, 300);
    }
});

// === ГЛАВНАЯ ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ ===

async function init() {
    console.log("[Main] Инициализация плагина...");

    // Настройка observer
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
    });

    // Обработчики событий
    window.addEventListener('resize', () => {
        setTimeout(updateResizerPositions, 100);
    });

    // Запускаем SPA отслеживание
    setupSPATracking();

    // Инициализируем функции для текущей страницы
    setTimeout(() => {
        handlePageChange(window.location.href);
    }, 100);
}

// Запуск
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Экспортируем для отладки
window.simpleOnePlugin = {
    applyStatusStyles: applyStatusStyles,
    startStatusStyling: startStatusStyling,
    stopStatusStyling: stopStatusStyling,
    enhanceAllTables: enhanceAllTables,
    config: STATUS_CONFIG
};

// ТУТ ЕСЛИ ЧТО СТОП!!!