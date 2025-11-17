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
let originalBodyStyle = null; // Для сохранения оригинальных стилей body

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
            height: 50vh; /* 50% высоты */
            background: white;
            border-top: 2px solid #ccc;
            z-index: 10000;
            display: none; /* Сначала скрыта */
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

        /* Стили для данных таски в формате "Поле: значение" */
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
            max-width: calc(100% - 130px); /* Оставляем место для label */
        }

        /* Стили для активности - копируем из оригинального HTML */
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
    // Обновляем ссылки на элементы
    const taskDataContent = document.getElementById('task-data-content');
    const taskDataLoading = document.getElementById('task-data-loading');
    historyContent = document.getElementById('activity-content');  // Правая часть
    loadingIndicator = document.getElementById('activity-loading'); // Правая часть

    document.getElementById('close-history-panel').addEventListener('click', () => {
        historyPanel.style.display = 'none';
        // Восстанавливаем оригинальные стили body
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
    // Находим строку таблицы, в которой находится кнопка
    let currentRow = clickedButton.closest('tr[data-test="table-row"]');
    if (!currentRow) {
        console.warn('[TaskData] Не найдена строка таблицы для кнопки');
        return null;
    }

    // Находим ячейку с ссылкой (обычно это ячейка с номером)
    const linkCell = currentRow.querySelector('td a, th a');
    if (!linkCell) {
        console.warn('[TaskData] Не найдена ячейка со ссылкой');
        return null;
    }

    // Извлекаем все ячейки в строке
    const allCells = currentRow.querySelectorAll('td, th');
    if (allCells.length === 0) {
        console.warn('[TaskData] Нет ячеек в строке');
        return null;
    }

    // Получаем заголовки из thead (если есть)
    const table = currentRow.closest('table');
    let headers = [];
    if (table) {
        const headerRow = table.querySelector('thead tr');
        if (headerRow) {
            const headerCells = headerRow.querySelectorAll('th, td');
            headers = Array.from(headerCells).map(h => h.textContent.trim());
        }
    }

    // Формируем HTML с данными в формате "Поле: значение"
    let html = '';

    // Обрабатываем каждую ячейку с соответствующим заголовком
    allCells.forEach((cell, index) => {
        const headerText = headers[index] || `Поле ${index + 1}`;

        // Пропускаем ячейки с кнопкой "Активность" и пустые заголовки
        if (headerText === 'Активность' || headerText === 'Поле 1' || headerText === 'Поле 2') {
            return; // Пропускаем эти заголовки
        }

        // Берем текстовое содержимое, но сохраняем важные HTML-теги
        const cellContent = cell.innerHTML.trim();

        if (cellContent && cellContent !== '' && headerText !== 'Активность') {  // Только непустые значения и не кнопка активности
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

// --- Функция для извлечения активности из URL (новая версия через новую вкладку) ---
async function fetchActivityFromUrlNew(url) {
    return new Promise((resolve, reject) => {
        console.log('[Activity] Отправка запроса на извлечение активности в background:', url);

        // Отправляем сообщение в background
        chrome.runtime.sendMessage({
            action: "fetchActivity",
            url: url
        }, (response) => {
            // Проверяем, была ли ошибка
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

    // Сохраняем оригинальные стили body перед изменением
    if (!originalBodyStyle) {
        originalBodyStyle = {
            height: document.body.style.height,
            overflow: document.body.style.overflow,
            maxHeight: document.body.style.maxHeight
        };
    }

    // Устанавливаем высоту body до 50vh, чтобы освободить место для панели
    document.body.style.height = '50vh';
    document.body.style.overflow = 'auto';
    document.body.style.maxHeight = '50vh';

    historyPanel.style.display = 'flex';

    // Показываем загрузку в обеих частях
    document.getElementById('task-data-loading').style.display = 'block';
    document.getElementById('task-data-content').style.display = 'none';
    document.getElementById('activity-loading').style.display = 'block';
    document.getElementById('activity-content').style.display = 'none';

    try {
        // Извлекаем данные таски из текущей строки таблицы (синхронно)
        const taskDataHTML = getTaskDataFromCurrentRow(clickedButton);

        // Загружаем активность из удаленной страницы (асинхронно)
        const activityHTML = await fetchActivityFromUrlNew(url);

        // Отображаем данные таски в левой части
        document.getElementById('task-data-content').innerHTML = taskDataHTML;
        document.getElementById('task-data-loading').style.display = 'none';
        document.getElementById('task-data-content').style.display = 'block';

        // Обрабатываем HTML активности - убираем лишние элементы в начале
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = activityHTML;

        // Удаляем блок parentformsectionmodel и другие ненужные элементы в начале
        // Более точный селектор для удаления
        const unwantedElements = tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6, input[type="checkbox"], .activity-controls, .activity-input, .activity-button, [class*="controls"], [class*="input"], [class*="button"], [id*="parentformsectionmodel"], [class*="parentformsectionmodel"], [data-testid*="parentformsectionmodel"], .parentformsectionmodel, [id^="parentformsectionmodel"], [class^="parentformsectionmodel"]');

        unwantedElements.forEach(el => {
            // Удаляем только элементы в начале, если они первые или ближе к началу
            if (el === tempDiv.firstChild ||
                el === tempDiv.children[0] ||
                el === tempDiv.children[1] ||
                el === tempDiv.children[2] ||
                el === tempDiv.children[3] ||
                el === tempDiv.children[4]) { // Удаляем первые 5 элементов, если они ненужные
                el.remove();
            }
        });

        // Отображаем очищенную активность в правой части
        document.getElementById('activity-content').innerHTML = tempDiv.innerHTML;
        document.getElementById('activity-loading').style.display = 'none';
        document.getElementById('activity-content').style.display = 'block';

        console.log('[Activity] Данные таски и активность успешно загружены и отображены.');
    } catch (error) {
        console.error('[Activity] Ошибка при загрузке данных:', error);

        // Отображаем ошибку в обеих частях
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
    // Проверяем, уже ли добавлен столбец
    if (table.querySelector('.history-column-header')) return;

    const headerRow = table.querySelector('thead tr');
    if (!headerRow) return;

    // Найдем индекс столбца "Номер" (по тексту заголовка)
    let numberColumnIndex = -1;
    const headers = headerRow.querySelectorAll('th, td');
    headers.forEach((header, index) => {
        if (header.textContent.trim() === 'Номер') {
            numberColumnIndex = index;
        }
    });

    if (numberColumnIndex === -1) return; // Не нашли столбец "Номер"

    // Создаем заголовок для столбца активности
    const historyHeader = document.createElement('th');
    historyHeader.className = 'history-column-header';
    historyHeader.textContent = 'Активность';
    historyHeader.style.width = '80px';
    historyHeader.style.textAlign = 'center';

    // Вставляем перед столбцом "Номер"
    const targetHeader = headers[numberColumnIndex];
    targetHeader.parentNode.insertBefore(historyHeader, targetHeader);

    // Добавляем ячейки активности в каждую строку
    const rows = table.querySelectorAll('tbody tr[data-test="table-row"]');
    rows.forEach(row => {
        const cells = row.querySelectorAll('td, th');
        if (cells.length <= numberColumnIndex) return; // Защита от ошибок

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
                    showActivity(fullUrl, activityBtn); // Передаем кнопку для извлечения данных
                } else {
                    console.warn('[Activity] Ссылка не найдена в ячейке:', targetCell);
                }
            });

            historyCell.appendChild(activityBtn);
        } else {
            // Если в ячейке нет ссылки, просто добавим текст
            historyCell.textContent = '-';
            historyCell.style.color = '#999';
            historyCell.style.fontSize = '12px';
        }

        targetCell.parentNode.insertBefore(historyCell, targetCell);
    });

    // Убираем ограничение высоты у таблицы, т.к. теперь body будет ограничен
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
            } else if (diffMinutes < 60*24) {
                row.style.backgroundColor = '#fff8e1';
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

    if (getComputedStyle(table).position === 'static') {
        table.style.position = 'relative';
    }

    table.setAttribute(DATA_ENHANCED_RESIZE, 'true');
    table.querySelectorAll('.table-resizer').forEach(el => el.remove());

    headers.forEach((header, index) => {
        if (index === headers.length - 1) return;

        const resizer = document.createElement('div');
        resizer.className = 'table-resizer';

        const updateResizerPosition = () => {
            const headerRect = header.getBoundingClientRect();
            const tableRect = table.getBoundingClientRect();
            resizer.style.left = (headerRect.right - tableRect.left) + 'px';
        };

        updateResizerPosition();
        table.appendChild(resizer);

        let startX, startWidth;

        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startX = e.clientX;

            const allRows = Array.from(table.querySelectorAll('tr'));
            const cellsToResize = allRows
                .map(row => {
                    const cells = row.querySelectorAll('th, td');
                    return cells[index] || null;
                })
                .filter(Boolean);

            if (cellsToResize.length === 0) {
                console.log("[Resizer] Ячейки для изменения ширины не найдены для столбца", index);
                return;
            }
            startWidth = cellsToResize[0].offsetWidth;

            const onMouseMove = (moveEvent) => {
                const dx = moveEvent.clientX - startX;
                let newWidth = startWidth + dx;
                if (newWidth < 20) newWidth = 20;

                cellsToResize.forEach(cell => {
                    cell.style.width = newWidth + 'px';
                    cell.style.minWidth = newWidth + 'px';
                    cell.style.maxWidth = newWidth + 'px';
                });

                const allTargetRows = Array.from(table.querySelectorAll('tr'));
                const contentContainers = allTargetRows.flatMap(row => {
                    const cells = row.querySelectorAll('th, td');
                    const targetCell = cells[index];
                    if (targetCell) {
                        const contentDiv = targetCell.querySelector('.src-components-groupedTable-cellDescription-___styles-module__content___wrzOw');
                        if (contentDiv) {
                            const containerDiv = contentDiv.querySelector('.src-components-groupedTable-cellDescription-___styles-module__container___u5dbD');
                            if (containerDiv) {
                                return [containerDiv];
                            }
                        }
                    }
                    return [];
                });

                contentContainers.forEach(container => {
                    container.style.textOverflow = 'clip';
                    container.style.overflow = 'visible';
                    container.style.whiteSpace = 'normal';
                });

                updateResizerPosition();
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
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
        addHistoryColumn(table); // Добавляем столбец активности первым
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
        window.addEventListener('load', enhanceAllTables, { once: true });
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
    document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
    console.log("[Main] Документ готов, запуск инициализации...");
    init();
}