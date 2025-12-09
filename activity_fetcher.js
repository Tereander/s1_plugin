// activity_fetcher.js
console.log("[ActivityFetcher] Запущен на странице:", window.location.href);

// Обработчик сообщений для извлечения активности
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractActivity") {
    console.log("[ActivityFetcher] Получен запрос на извлечение активности, ID:", request.requestId);

    // Ждем дополнительное время для динамического контента
    const waitTime = document.readyState === 'complete' ? 2000 : 4000;

    setTimeout(() => {
      extractAndSendActivity(sendResponse, request.requestId);
    }, waitTime);

    return true;
  }
  return false;
});

// Функция для извлечения и отправки блока активности
function extractAndSendActivity(sendResponse, requestId) {
    console.log("[ActivityFetcher] Поиск блока активности...");

    // Пробуем разные стратегии поиска
    let activityHTML = findActivityContent();

    if (!activityHTML) {
        console.log("[ActivityFetcher] Блок активности не найден, пробую альтернативные методы...");
        activityHTML = findAlternativeContent();
    }

    if (activityHTML) {
        console.log("[ActivityFetcher] Отправляю HTML активности, длина:", activityHTML.length);
        sendResponse({ html: activityHTML, requestId: requestId });
    } else {
        console.log("[ActivityFetcher] Не удалось найти активность");
        sendResponse({ html: "<div>Активность не найдена на странице</div>", requestId: requestId });
    }
}

// Основной поиск активности
function findActivityContent() {
    const selectors = [
        '#activity-box',
        '.activity-history',
        '.history-container',
        '.timeline',
        '.comments-section',
        '.activity-panel',
        '.activity-stream',
        '.activity-list',
        '[data-testid*="activity"]',
        '[class*="activity" i]', // case insensitive
        '[id*="history" i]',
        '[class*="history" i]',
        '[id*="comment" i]',
        '[class*="comment" i]',
        '[id*="timeline" i]',
        '[class*="timeline" i]'
    ];

    for (const selector of selectors) {
        try {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                console.log(`[ActivityFetcher] Найден элемент по селектору "${selector}":`, elements.length);

                // Ищем элемент с наибольшим количеством контента
                let bestElement = elements[0];
                let maxLength = bestElement.textContent.length;

                for (let i = 1; i < elements.length; i++) {
                    const length = elements[i].textContent.length;
                    if (length > maxLength) {
                        bestElement = elements[i];
                        maxLength = length;
                    }
                }

                if (maxLength > 200) { // Достаточно контента
                    const clonedElement = bestElement.cloneNode(true);
                    cleanElement(clonedElement);
                    return clonedElement.outerHTML;
                }
            }
        } catch (e) {
            console.warn(`[ActivityFetcher] Ошибка при поиске по селектору ${selector}:`, e);
        }
    }

    return null;
}

// Альтернативный поиск
function findAlternativeContent() {
    // Ищем любой контейнер с большим количеством текста
    const allContainers = document.querySelectorAll('div, section, article, main');
    let bestContainer = null;
    let maxTextLength = 0;

    allContainers.forEach(container => {
        const textLength = container.textContent.length;
        if (textLength > 500 && textLength > maxTextLength) {
            // Проверяем что это не основной контент страницы
            const rect = container.getBoundingClientRect();
            if (rect.width > 300 && rect.height > 200) {
                bestContainer = container;
                maxTextLength = textLength;
            }
        }
    });

    if (bestContainer) {
        console.log("[ActivityFetcher] Найден альтернативный контейнер с текстом длиной:", maxTextLength);
        const clonedElement = bestContainer.cloneNode(true);
        cleanElement(clonedElement);
        return clonedElement.outerHTML;
    }

    return null;
}

// Очистка элемента от лишнего
function cleanElement(element) {
    // Удаляем скрипты, стили и интерактивные элементы
    const unwanted = element.querySelectorAll(
        'script, style, link, meta, input, button, form, textarea, select, ' +
        'iframe, object, embed, audio, video, canvas, svg, ' +
        '[onclick], [onload], [onmouseover], [on*]'
    );
    unwanted.forEach(el => el.remove());

    // Удаляем пустые элементы
    const emptyElements = element.querySelectorAll('div, span, p, td, th, li');
    emptyElements.forEach(el => {
        if (el.textContent.trim() === '' && el.children.length === 0) {
            el.remove();
        }
    });

    return element;
}

// Если страница загружена, выводим информацию
if (document.readyState === 'complete') {
    console.log("[ActivityFetcher] Страница полностью загружена, готов к извлечению");
} else {
    window.addEventListener('load', () => {
        console.log("[ActivityFetcher] Страница загружена (load event)");
    });
}