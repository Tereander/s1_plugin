// Помечаем таблицу как обработанную (для раскраски)
const DATA_ENHANCED_COLOR = 'data-enhanced-color';
// Помечаем таблицу как обработанную (для ресайзера)
const DATA_ENHANCED_RESIZE = 'data-enhanced-resize';

// --- Управление автообновлением ---
let refreshIntervalId = null;
let currentSettings = {
    enabled: false,
    intervalSeconds: 10
};

// --- Функция для загрузки настроек из chrome.storage ---
function loadSettings() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['autoRefreshEnabled', 'autoRefreshInterval'], (result) => {
            // Обновляем настройки из хранилища, используя значения по умолчанию, если их нет
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

// --- Функция для раскраски строк SLA (обновлённый подход) ---
function colorDueDateRows() {
  // Используем оригинальный селектор таблиц
  const tables = document.querySelectorAll('table');
  const now = new Date();
  console.log("[SLA Color] Запуск обновления цветов SLA. Текущее время:", now);

  tables.forEach(table => {
    // Проверяем, обработана ли таблица
    if (table.hasAttribute(DATA_ENHANCED_COLOR)) {
        console.log("[SLA Color] Таблица уже обработана для раскраски, пропускаем:", table);
        return;
    }

    // 1. Найдём индексы столбцов "Плановая дата/время окончания" и "Плановая дата/время окончания в BMC"
    let targetIndexPrimary = -1; // 'planned_end_datetime'
    let targetIndexFallback = -1; // 'c_bmc_planned_end_datetime'

    const headerCells = table.querySelectorAll('thead th, thead td');
    headerCells.forEach((th, index) => {
      const text = th.textContent.trim();
      if (text === 'Плановая дата/время окончания') {
        targetIndexPrimary = index;
        console.log("[SLA Color] Найден индекс основного столбца SLA:", targetIndexPrimary);
      }
      if (text === 'Плановая дата/время окончания в BMC') {
        targetIndexFallback = index;
        console.log("[SLA Color] Найден индекс резервного столбца SLA:", targetIndexFallback);
      }
    });

    // Приоритет у основного столбца, если его нет - используем резервный
    let targetIndex = targetIndexPrimary !== -1 ? targetIndexPrimary : targetIndexFallback;

    if (targetIndex === -1) {
        console.log("[SLA Color] Ни один из столбцов SLA не найден в таблице, пропускаем.");
        return;
    }

    // 2. Обрабатываем каждую строку tbody
    const rows = table.querySelectorAll('tbody tr[data-test="table-row"]');
    console.log("[SLA Color] Найдено строк для обработки в таблице:", rows.length);

    rows.forEach(row => {
      const cells = row.querySelectorAll('td, th');
      const cell = cells[targetIndex];
      if (!cell) {
          console.log("[SLA Color] Ячейка SLA не найдена в строке, сбрасываем стиль.");
          row.style.backgroundColor = '';
          return;
      }

      // 3. Извлекаем текст из span внутри ячейки (как в оригинале)
      let textElement = cell.querySelector('span:not(.src-components-groupedTable-___styles-module__NotSet___qnmCN)');
      if (!textElement) {
          textElement = cell.querySelector('div, span');
      }
      if (!textElement) {
          console.log("[SLA Color] Элемент с датой не найден в ячейке, сбрасываем стиль строки.");
          row.style.backgroundColor = '';
          return;
      }

      let text = textElement.textContent.trim();
      console.log("[SLA Color] Текст даты из ячейки (основной столбец):", text);

      // Если основной столбец пуст или 'none', проверяем резервный столбец, если он есть и отличается от основного
      if ((!text || text === '(не задано)' || text.toLowerCase() === 'none') && targetIndexFallback !== -1 && targetIndexFallback !== targetIndexPrimary) {
          console.log("[SLA Color] Основной столбец пуст, проверяем резервный столбец BMC.");
          const fallbackCell = cells[targetIndexFallback];
          if (fallbackCell) {
              let fallbackTextElement = fallbackCell.querySelector('span:not(.src-components-groupedTable-___styles-module__NotSet___qnmCN)');
              if (!fallbackTextElement) {
                  fallbackTextElement = fallbackCell.querySelector('div, span');
              }
              if (fallbackTextElement) {
                  text = fallbackTextElement.textContent.trim();
                  console.log("[SLA Color] Текст даты из резервной ячейки BMC:", text);
              } else {
                  console.log("[SLA Color] Элемент с датой не найден в резервной ячейке BMC, сбрасываем стиль строки.");
                  row.style.backgroundColor = '';
                  return;
              }
          } else {
              console.log("[SLA Color] Резервная ячейка BMC не найдена, сбрасываем стиль строки.");
              row.style.backgroundColor = '';
              return;
          }
      }

      if (!text || text === '(не задано)' || text.toLowerCase() === 'none') {
        console.log("[SLA Color] Дата не задана ни в одном из столбцов, сбрасываем стиль строки.");
        row.style.backgroundColor = '';
        return;
      }

      // 4. Парсим дату
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
              date = new Date(year, month - 1, day, 23, 59, 59, 999); // Конец дня
          }
      }

      if (isNaN(date.getTime())) {
        console.log("[SLA Color] Невозможно распознать формат даты:", text);
        row.style.backgroundColor = '';
        return;
      }

      console.log("[SLA Color] Распознанная дата:", date);

      const diffMs = date.getTime() - now.getTime();
      const diffMinutes = diffMs / (1000 * 60);

      console.log("[SLA Color] Разница в минутах:", diffMinutes);

      if (diffMs < 0) {
        // 🔴 Прошло SLA
        console.log("[SLA Color] SLA просрочен, устанавливаем красный.");
        row.style.backgroundColor = '#ffebee';
      } else if (diffMinutes < 60*24) {
        console.log("[SLA Color] Менее 1 суток до SLA, устанавливаем жёлтый.");
        row.style.backgroundColor = '#fff8e1';
      } else {
        console.log("[SLA Color] SLA не подходит под условия, сбрасываем стиль.");
        row.style.backgroundColor = '';
      }
    });

    // Помечаем таблицу как обработанную для раскраски
    table.setAttribute(DATA_ENHANCED_COLOR, 'true');
  });
}

// --- Функция для изменения ширины столбцов (ресайзера) под таблицу ---
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

    // Убедимся, что таблица имеет позиционирование, чтобы ресайзеры правильно позиционировались
    if (getComputedStyle(table).position === 'static') {
        table.style.position = 'relative';
    }

    // Помечаем таблицу как обработанную для ресайзера
    table.setAttribute(DATA_ENHANCED_RESIZE, 'true');

    table.querySelectorAll('.table-resizer').forEach(el => el.remove());

    headers.forEach((header, index) => {
        if (index === headers.length - 1) return;

        const resizer = document.createElement('div');
        resizer.className = 'table-resizer';

        // Функция для обновления позиции ресайзера
        const updateResizerPosition = () => {
            const headerRect = header.getBoundingClientRect();
            const tableRect = table.getBoundingClientRect();
            resizer.style.left = (headerRect.right - tableRect.left) + 'px';
        };

        // Инициализируем позицию
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
            startWidth = cellsToResize[0].offsetWidth; // Берём ширину первой ячейки как эталон

            const onMouseMove = (moveEvent) => {
                const dx = moveEvent.clientX - startX;
                let newWidth = startWidth + dx;
                if (newWidth < 20) newWidth = 20; // Минимальная ширина

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

                // Применяем стили к найденным контейнерам
                contentContainers.forEach(container => {
                    container.style.textOverflow = 'clip';
                    container.style.overflow = 'visible';
                    container.style.whiteSpace = 'normal';
                });

                // Обновляем позицию ресайзера
                updateResizerPosition();
            };

            const onMouseUp = () => {
                console.log("[Resizer] Изменение ширины столбца", index, "завершено.");

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

  // Находим таблицы и применяем к ним обе функции
  document.querySelectorAll('table').forEach(table => {
      colorDueDateRows();
      makeTableResizable(table);
  });
}

// --- Основной запуск ---
async function init() {
  console.log("[Main] Инициализация плагина...");

  // Загружаем настройки
  await loadSettings();

  // Применяем настройки (включаем/выключаем автообновление)
  toggleAutoRefresh();

  // Сначала попробуем сразу
  enhanceAllTables();

  // Затем после полной загрузки страницы
  if (document.readyState === 'complete') {
    console.log("[Main] Страница уже загружена, повторный запуск обработки...");
    enhanceAllTables();
  } else {
    console.log("[Main] Ожидание загрузки страницы...");
    window.addEventListener('load', enhanceAllTables, { once: true });
  }

  // И отслеживаем динамические изменения
  const observer = new MutationObserver((mutationsList) => {
    let shouldUpdate = false;
    for (let mutation of mutationsList) {
      if (mutation.type === 'childList') {
        for (let node of mutation.addedNodes) {
          if (node.nodeType === 1) { // Это элемент
            if (node.tagName === 'TABLE' || node.querySelector && (node.querySelector('tr[data-test="table-row"]') || node.querySelector('th, td'))) {
              shouldUpdate = true;
              break;
            }
          }
        }
        // Проверяем удалённые узлы - возможно, удалили старую таблицу
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
      // Небольшая задержка, чтобы дать DOM сформироваться
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