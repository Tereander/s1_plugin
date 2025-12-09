// activity_fetcher.js - ИСПОЛЬЗУЕМ ПОДХОД С КОПИРОВАНИЕМ СТИЛЕЙ
console.log("[ActivityFetcher] Запущен на странице:", window.location.href);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractActivity") {
    console.log("[ActivityFetcher] Получен запрос на извлечение активности");

    setTimeout(() => {
      extractActivityWithStyles(request.requestId, sendResponse);
    }, 3000);

    return true;
  }
  return false;
});

function extractActivityWithStyles(requestId, sendResponse) {
  try {
    const activityElement = document.querySelector('#activity-feed');

    if (!activityElement) {
      sendBack("<div style='padding:20px;color:#666;'>#activity-feed не найден</div>", requestId, sendResponse);
      return;
    }

    // Создаем временный div для копирования
    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = 'position: absolute; left: -9999px; top: -9999px;';

    // Клонируем элемент и всех его детей
    const clone = activityElement.cloneNode(true);

    // 1. Удаляем скрипты
    const scripts = clone.querySelectorAll('script, iframe, link[rel="stylesheet"], style');
    scripts.forEach(el => el.remove());

    // 2. Добавляем элемент в DOM чтобы стили применились
    tempDiv.appendChild(clone);
    document.body.appendChild(tempDiv);

    // 3. Force reflow для применения стилей
    clone.offsetHeight;

    // 4. Собираем все примененные стили
    collectAndApplyStyles(clone);

    // 5. Удаляем из DOM
    document.body.removeChild(tempDiv);

    // 6. Ограничиваем размеры картинок
    const images = clone.querySelectorAll('img');
    images.forEach(img => {
      const style = window.getComputedStyle(img);
      const width = parseInt(style.width) || img.naturalWidth || img.width;
      const height = parseInt(style.height) || img.naturalHeight || img.height;

      if (width > 300 || height > 200) {
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.maxHeight = '200px';
      }
    });

    // 7. Создаем финальный HTML
    const wrapper = document.createElement('div');
    wrapper.className = 'activity-copy-wrapper';
    wrapper.style.cssText = 'max-width: 100%; overflow: auto;';
    wrapper.appendChild(clone);

    const html = wrapper.outerHTML;
    console.log("[ActivityFetcher] Отправляю HTML со стилями, длина:", html.length);

    sendBack(html, requestId, sendResponse);

  } catch (error) {
    console.error("[ActivityFetcher] Ошибка:", error);
    sendBack(
      `<div style="padding:20px;background:#ffebee;color:#c62828;border-radius:4px;">
        <strong>Ошибка:</strong> ${error.message}
      </div>`,
      requestId,
      sendResponse
    );
  }
}

// Собираем и применяем стили
function collectAndApplyStyles(element) {
  const allStyles = new Set();

  // Собираем стили из style элементов
  document.querySelectorAll('style').forEach(styleEl => {
    if (styleEl.textContent) {
      allStyles.add(styleEl.textContent);
    }
  });

  // Собираем inline стили элемента и его родителей
  function collectElementStyles(el) {
    if (el.style && el.style.cssText) {
      const selector = getElementSelector(el);
      if (selector) {
        allStyles.add(`${selector} { ${el.style.cssText} }`);
      }
    }

    if (el.parentElement && el.parentElement !== document.body) {
      collectElementStyles(el.parentElement);
    }
  }

  collectElementStyles(element);

  // Создаем style элемент с собранными стилями
  if (allStyles.size > 0) {
    const styleEl = document.createElement('style');
    styleEl.textContent = Array.from(allStyles).join('\n');
    element.insertBefore(styleEl, element.firstChild);
  }
}

// Получаем селектор для элемента
function getElementSelector(element) {
  if (element.id) {
    return '#' + element.id;
  }

  if (element.className && typeof element.className === 'string') {
    const classes = element.className.trim().split(/\s+/).filter(c => c);
    if (classes.length > 0) {
      return '.' + classes.join('.');
    }
  }

  return null;
}

// Отправляем ответ
function sendBack(html, requestId, sendResponse) {
  chrome.runtime.sendMessage({
    action: "extractedActivity",
    html: html,
    requestId: requestId
  }, () => {
    if (sendResponse) sendResponse({ success: true });
  });
}
