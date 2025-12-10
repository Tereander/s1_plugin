// activity_fetcher.js - КОПИРУЕМ С ОРИГИНАЛЬНЫМИ СТИЛЯМИ
console.log("[ActivityFetcher] Запущен на странице:", window.location.href);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractActivity") {
    console.log("[ActivityFetcher] Получен запрос на извлечение активности, requestId:", request.requestId);

    extractActivityWithOriginalStyles(request.requestId, sendResponse);

    return true; // Сохраняем канал открытым
  }
  return false;
});

function extractActivityWithOriginalStyles(requestId, sendResponse) {
  console.log("[ActivityFetcher] Начинаю извлечение с оригинальными стилями...");

  try {
    const activityElement = document.querySelector('#activity-feed');

    if (!activityElement) {
      console.log("[ActivityFetcher] #activity-feed не найден, пробую найти другой контейнер");

      // Пробуем другие возможные селекторы
      const altSelectors = [
        '.activity-feed',
        '.timeline',
        '[class*="activity"]',
        '[class*="timeline"]',
        '.history-container',
        '.task-history',
        '[data-testid*="activity"]',
        '[id*="activity"]'
      ];

      let foundElement = null;
      for (const selector of altSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          console.log(`[ActivityFetcher] Найден альтернативный элемент: ${selector}`);
          foundElement = el;
          break;
        }
      }

      if (!foundElement) {
        console.log("[ActivityFetcher] Активность не найдена на странице");
        sendBack("<div style='padding:20px;color:#666;'>Активность не найдена на странице</div>", requestId, sendResponse);
        return;
      }

      // Используем найденный элемент
      processElementWithStyles(foundElement, requestId, sendResponse);
      return;
    }

    // Обрабатываем найденный элемент
    processElementWithStyles(activityElement, requestId, sendResponse);

  } catch (error) {
    console.error("[ActivityFetcher] Ошибка:", error);
    sendBack(
      `<div style="padding:20px;background:#ffebee;color:#c62828;border-radius:4px;">
        <strong>Ошибка извлечения:</strong> ${error.message}
      </div>`,
      requestId,
      sendResponse
    );
  }
}

function processElementWithStyles(activityElement, requestId, sendResponse) {
  console.log("[ActivityFetcher] Обрабатываю элемент с сохранением стилей");

  // Клонируем элемент
  const clone = activityElement.cloneNode(true);

  // Удаляем ненужные элементы
  clone.querySelectorAll('script, iframe, noscript').forEach(el => el.remove());

  // Собираем все CSS-правила со страницы
  const allStyles = [];

  // Проходим по всем стилям на странице
  for (const sheet of document.styleSheets) {
    try {
      if (sheet.cssRules) {
        for (const rule of sheet.cssRules) {
          // Фильтруем только те стили, которые могут повлиять на наш элемент
          if (rule.selectorText && (
            rule.selectorText.includes('activity') ||
            rule.selectorText.includes('timeline') ||
            rule.selectorText.includes('history') ||
            rule.selectorText.includes('feed') ||
            rule.selectorText.includes('comment') ||
            rule.selectorText.includes('entry') ||
            rule.selectorText === '*' ||
            rule.selectorText.includes(clone.tagName.toLowerCase()) ||
            clone.classList.contains(rule.selectorText.replace('.', '').split(' ')[0])
          )) {
            allStyles.push(rule.cssText);
          }
        }
      }
    } catch (e) {
      // Игнорируем ошибки доступа к стилям (cross-origin)
      console.log('[ActivityFetcher] Ошибка доступа к стилям:', e.message);
    }
  }

  // Также добавляем inline-стили элементов
  const inlineStyles = collectInlineStyles(clone);

  // Создаем стилевой элемент
  const styleElement = document.createElement('style');
  styleElement.textContent = allStyles.join('\n') + '\n' + inlineStyles;

  // Создаем контейнер с оригинальными стилями
  const wrapper = document.createElement('div');
  wrapper.className = 'activity-original-styles';
  wrapper.style.cssText = `
    font-family: inherit;
    line-height: 1.5;
    max-width: 100%;
    overflow: auto;
  `;

  // Вставляем стили первыми
  wrapper.appendChild(styleElement);
  wrapper.appendChild(clone);

  // Применяем важные стили для адаптивности
  const responsiveStyle = document.createElement('style');
  responsiveStyle.textContent = `
    .activity-original-styles * {
      max-width: 100% !important;
      box-sizing: border-box !important;
    }
    .activity-original-styles img {
      max-width: 100% !important;
      height: auto !important;
    }
    .activity-original-styles table {
      width: 100% !important;
      border-collapse: collapse !important;
    }
  `;
  wrapper.insertBefore(responsiveStyle, wrapper.firstChild);

  const html = wrapper.outerHTML;
  console.log("[ActivityFetcher] Отправляю HTML с оригинальными стилями, длина:", html.length);

  sendBack(html, requestId, sendResponse);
}

function collectInlineStyles(element) {
  let styles = '';

  // Рекурсивно проходим по всем элементам
  function processElement(el) {
    if (el.nodeType === 1) { // Element node
      const computedStyle = window.getComputedStyle(el);
      const className = el.className;

      if (className) {
        // Создаем CSS-правило для класса
        const rules = [];
        if (el.style.length > 0) {
          for (let i = 0; i < el.style.length; i++) {
            const prop = el.style[i];
            const value = el.style.getPropertyValue(prop);
            rules.push(`${prop}: ${value} !important;`);
          }

          if (rules.length > 0) {
            styles += `.${className.split(' ')[0]} { ${rules.join(' ')} }\n`;
          }
        }
      }
    }

    // Проходим по дочерним элементам
    for (const child of el.children) {
      processElement(child);
    }
  }

  processElement(element);
  return styles;
}

function sendBack(html, requestId, sendResponse) {
  console.log("[ActivityFetcher] Отправляю данные в background...");

  chrome.runtime.sendMessage({
    action: "activityDataReceived",
    html: html,
    requestId: requestId
  }).then(() => {
    console.log("[ActivityFetcher] Данные отправлены успешно");
    if (sendResponse) sendResponse({ success: true });
  }).catch(error => {
    console.error("[ActivityFetcher] Ошибка отправки:", error);
    if (sendResponse) sendResponse({ success: false, error: error.message });
  });
}