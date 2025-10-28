// Помечаем таблицу как обработанную (для раскраски)
const DATA_ENHANCED_COLOR = 'data-enhanced-color';
// Помечаем таблицу как обработанную (для ресайзера)
const DATA_ENHANCED_RESIZE = 'data-enhanced-resize';

// --- Управление автообновлением ---
let refreshIntervalId = null;
let currentSettings = {
    enabled: false,
    intervalSeconds: 10 // по умолчанию 10 секунд
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
    await loadSettings(); // Убедимся, что у нас последние настройки
    if (currentSettings.enabled) {
        if (refreshIntervalId) {
            clearInterval(refreshIntervalId);
        }
        console.log(`[AutoRefresh] Включение автообновления каждые ${currentSettings.intervalSeconds} секунд.`);
        refreshIntervalId = setInterval(() => {
            console.log("[AutoRefresh] Обновление страницы по таймеру.");
            location.reload();
        }, currentSettings.intervalSeconds * 1000); // Переводим секунды в миллисекунды
    } else {
        console.log('[AutoRefresh] Отключение автообновления.');
        if (refreshIntervalId) {
            clearInterval(refreshIntervalId);
            refreshIntervalId = null;
        }
    }
}

// --- Функция для раскраски строк SLA (возвращение к оригинальному подходу) ---
function colorDueDateRows() {
  // Используем оригинальный селектор таблиц
  const tables = document.querySelectorAll('table');
  const now = new Date();
  console.log("[SLA Color] Запуск обновления цветов SLA. Текущее время:", now);

  tables.forEach(table => {
    // Проверяем, обработана ли таблица этим скриптом для раскраски
    if (table.hasAttribute(DATA_ENHANCED_COLOR)) {
        console.log("[SLA Color] Таблица уже обработана для раскраски, пропускаем:", table);
        return;
    }

    // 1. Найдём индекс столбца "Плановая дата/время окончания в BMC"
    let targetIndex = -1;
    const headerCells = table.querySelectorAll('thead th, thead td');
    headerCells.forEach((th, index) => {
      const text = th.textContent.trim();
      if (text === 'Плановая дата/время окончания в BMC') {
        targetIndex = index;
        console.log("[SLA Color] Найден индекс столбца SLA:", targetIndex);
      }
    });

    if (targetIndex === -1) {
        console.log("[SLA Color] Столбец 'Плановая дата/время окончания в BMC' не найден в таблице, пропускаем.");
        return; // Не ставим флаг, может появиться позже
    }

    // 2. Обрабатываем каждую строку tbody
    const rows = table.querySelectorAll('tbody tr[data-test="table-row"]'); // Используем ваш селектор строк
    console.log("[SLA Color] Найдено строк для обработки в таблице:", rows.length);

    rows.forEach(row => {
      const cells = row.querySelectorAll('td, th'); // Используем td, th как в оригинале
      const cell = cells[targetIndex];
      if (!cell) {
          console.log("[SLA Color] Ячейка SLA не найдена в строке, сбрасываем стиль.");
          row.style.backgroundColor = ''; // Сброс, если ячейка не найдена
          return;
      }

      // 3. Извлекаем текст из span внутри ячейки (как в оригинале)
      let textElement = cell.querySelector('span:not(.src-components-groupedTable-___styles-module__NotSet___qnmCN)');
      if (!textElement) {
          // Проверим, возможно, дата в div или другом элементе внутри ячейки
          textElement = cell.querySelector('div, span');
      }
      if (!textElement) {
          // Сброс стиля строки, если "(не задано)" или нет элемента с датой
          console.log("[SLA Color] Элемент с датой не найден в ячейке, сбрасываем стиль строки.");
          row.style.backgroundColor = '';
          return;
      }

      const text = textElement.textContent.trim();
      console.log("[SLA Color] Текст даты из ячейки:", text);

      if (!text || text === '(не задано)') {
        console.log("[SLA Color] Дата не задана, сбрасываем стиль строки.");
        row.style.backgroundColor = '';
        return;
      }

      // 4. Парсим дату (включая форматы Simple One)
      let date = null;
      date = new Date(text);
      if (isNaN(date.getTime())) {
          // Попробуем формат DD.MM.YYYY HH:mm
          const dateMatch = text.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/);
          if (dateMatch) {
              const [, day, month, year, hour, minute] = dateMatch;
              date = new Date(year, month - 1, day, hour, minute, 0, 0);
          }
      }
      if (isNaN(date.getTime())) {
          // Попробуем формат DD.MM.YYYY
          const dateMatch = text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
          if (dateMatch) {
              const [, day, month, year] = dateMatch;
              date = new Date(year, month - 1, day, 23, 59, 59, 999); // Конец дня
          }
      }

      if (isNaN(date.getTime())) {
        console.log("[SLA Color] Невозможно распознать формат даты:", text);
        row.style.backgroundColor = ''; // Сброс, если не распознано
        return;
      }

      console.log("[SLA Color] Распознанная дата:", date);

      const diffMs = date.getTime() - now.getTime();
      const diffMinutes = diffMs / (1000 * 60);

      console.log("[SLA Color] Разница в минутах:", diffMinutes);

      // 5. Применяем цвет к ВСЕЙ СТРОКЕ (ИСПРАВЛЕНО: теперь 1 час и просрочено)
      if (diffMs < 0) {
        // 🔴 Прошло SLA
        console.log("[SLA Color] SLA просрочен, устанавливаем красный.");
        row.style.backgroundColor = '#ffebee'; // светло-красный
      } else if (diffMinutes < 60*24) { // Менее 1 суток
        // 🟡 Менее 1 суток до окончания SLA
        console.log("[SLA Color] Менее 1 суток до SLA, устанавливаем жёлтый.");
        row.style.backgroundColor = '#fff8e1'; // светло-жёлтый
      } else {
        // Сброс
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
    // Проверяем, обработана ли таблица этим скриптом для ресайзера
    if (table.hasAttribute(DATA_ENHANCED_RESIZE)) {
        console.log("[Resizer] Таблица уже обработана для ресайзера, пропускаем:", table);
        return;
    }

    console.log("[Resizer] Обработка таблицы для ресайзера:", table);

    const headerRow = table.querySelector('thead tr') || table.querySelector('tr'); // Находим строку заголовков
    if (!headerRow) {
        console.log("[Resizer] Строка заголовков не найдена.");
        return;
    }

    const headers = Array.from(headerRow.querySelectorAll('th, td')); // Получаем ячейки заголовков
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

    // Удаляем старые ресайзеры (на всякий случай)
    table.querySelectorAll('.table-resizer').forEach(el => el.remove());

    headers.forEach((header, index) => {
        // Не добавляем ресайзер после последнего столбца
        if (index === headers.length - 1) return;

        const resizer = document.createElement('div');
        resizer.className = 'table-resizer'; // CSS-класс для стилей

        // Функция для обновления позиции ресайзера
        const updateResizerPosition = () => {
            const headerRect = header.getBoundingClientRect();
            const tableRect = table.getBoundingClientRect();
            // Позиционируем ресайзер справа от границы текущей ячейки
            resizer.style.left = (headerRect.right - tableRect.left) + 'px';
        };

        // Инициализируем позицию
        updateResizerPosition();
        // Добавляем ресайзер в ТАБЛИЦУ
        table.appendChild(resizer);

        let startX, startWidth;

        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Предотвращаем выделение текста и другие действия браузера
            startX = e.clientX;

            // Найдем ВСЕ строки в таблице
            const allRows = Array.from(table.querySelectorAll('tr')); // Все строки (thead и tbody)
            // Найдем ячейки во ВСЕХ строках, соответствующие текущему индексу
            const cellsToResize = allRows
                .map(row => {
                    const cells = row.querySelectorAll('th, td');
                    return cells[index] || null;
                })
                .filter(Boolean); // Фильтруем null, если ячейка не найдена

            if (cellsToResize.length === 0) {
                console.log("[Resizer] Ячейки для изменения ширины не найдены для столбца", index);
                return;
            }
            startWidth = cellsToResize[0].offsetWidth; // Берём ширину первой ячейки как эталон

            const onMouseMove = (moveEvent) => {
                const dx = moveEvent.clientX - startX;
                let newWidth = startWidth + dx;
                if (newWidth < 20) newWidth = 20; // Минимальная ширина

                // Применяем новую ширину ко ВСЕМ ячейкам этого столбца
                cellsToResize.forEach(cell => {
                    // Устанавливаем ширину, чтобы она не сбивалась браузером или CSS
                    cell.style.width = newWidth + 'px';
                    cell.style.minWidth = newWidth + 'px'; // Опционально, но часто помогает
                    cell.style.maxWidth = newWidth + 'px'; // Опционально
                });

                // --- НОВОЕ: Обновляем стили внутренних элементов для отмены обрезки ---
                // Найдем все внутренние элементы, отвечающие за отображение содержимого в ячейках этого столбца
                // Используем селектор, похожий на тот, что был в HTML (src-components-groupedTable-cellDescription-___styles-module__content___wrzOw)
                // и его контейнер (src-components-groupedTable-cellDescription-___styles-module__container___u5dbD)
                const allTargetRows = Array.from(table.querySelectorAll('tr')); // Все строки снова
                const contentContainers = allTargetRows.flatMap(row => {
                    const cells = row.querySelectorAll('th, td');
                    const targetCell = cells[index];
                    if (targetCell) {
                        // Найдем div.content___wrzOw, затем div.container___u5dbD внутри него
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
                    // Отменяем обрезку текста
                    container.style.textOverflow = 'clip'; // или 'clip' или '' (пустая строка), чтобы отменить 'ellipsis'
                    container.style.overflow = 'visible'; // или 'clip' или '' (пустая строка), чтобы отменить 'hidden'
                    container.style.whiteSpace = 'normal'; // или 'nowrap' в зависимости от желаемого поведения, но 'normal' обычно лучше для полного отображения
                    // container.style.maxWidth = newWidth + 'px'; // Опционально: можно ограничить ширину контейнера, но часто лучше оставить как есть
                    // container.style.width = 'auto'; // Позволяем ему растягиваться
                });

                // Обновляем позицию ресайзера
                updateResizerPosition();
            };

            const onMouseUp = () => {
                console.log("[Resizer] Изменение ширины столбца", index, "завершено.");
                // Здесь, при необходимости, можно вернуть исходные стили обрезки, но обычно этого не делают,
                // чтобы текст оставался видимым.
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
  // Сначала сбросим флаги у старых таблиц, если они были перерисованы
  resetEnhancedFlags();

  // Находим таблицы и применяем к ним обе функции
  document.querySelectorAll('table').forEach(table => {
      colorDueDateRows(); // Вызываем для одной таблицы (но функция обрабатывает все)
      makeTableResizable(table); // Вызываем для конкретной таблицы
  });
  // Альтернатива: Просто вызвать функции, они сами пройдут по всем таблицам
  // colorDueDateRows();
  // makeTableResizable();
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
            // Проверяем, если добавленный элемент - table или содержит строки/заголовки, похожие на table
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