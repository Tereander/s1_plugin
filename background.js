// background.js - БЫСТРАЯ ВЕРСИЯ
console.log("[Background] Service worker запущен");

let activityDataCache = new Map();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[Background] Получено сообщение:", request.action);

  if (request.action === "fetchActivity") {
    console.log("[Background] Получен запрос на извлечение активности");

    const requestId = request.requestId || Date.now();
    activityDataCache.set(requestId, {
      sourceTabId: sender.tab.id,
      timestamp: Date.now()
    });

    // Сразу создаем вкладку без задержек
    chrome.tabs.create({
      url: request.url,
      active: false
    }).then((newTab) => {
      console.log("[Background] Создана вкладка:", newTab.id);

      const cachedData = activityDataCache.get(requestId);
      if (cachedData) {
        cachedData.fetchTabId = newTab.id;
        activityDataCache.set(requestId, cachedData);
      }

      // Сразу отвечаем что вкладка создана
      sendResponse({ success: true, requestId: requestId });

      // НЕ ЖДЕМ 5 секунд! Отправляем запрос сразу
      // Слушаем когда вкладка будет готова
      const onTabReady = (tabId, changeInfo) => {
        if (tabId === newTab.id && changeInfo.status === 'complete') {
          console.log("[Background] Вкладка загружена, отправляю запрос на извлечение");
          chrome.tabs.onUpdated.removeListener(onTabReady);

          // Ждем всего 500мс для динамического контента (вместо 5000мс!)
          setTimeout(() => {
            sendExtractRequest(requestId, newTab.id);
          }, 500);
        }
      };

      chrome.tabs.onUpdated.addListener(onTabReady);

      // Если вкладка уже загружена
      if (newTab.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(onTabReady);
        setTimeout(() => {
          sendExtractRequest(requestId, newTab.id);
        }, 500);
      }

      // Таймаут на случай проблем - сокращаем до 15 секунд
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(onTabReady);
        if (activityDataCache.has(requestId)) {
          console.log("[Background] Таймаут 15 секунд");
          cleanupRequest(requestId, newTab.id);
        }
      }, 15000);

    }).catch((error) => {
      console.error("[Background] Ошибка при создании вкладки:", error);
      sendResponse({ error: error.message });
      cleanupRequest(requestId);
    });

    return true;
  }

  if (request.action === "extractedActivity") {
    console.log("[Background] Получены данные активности, длина:", request.html?.length);

    // Находим запрос
    let foundRequestId = null;
    for (const [requestId, data] of activityDataCache.entries()) {
      if (data.fetchTabId === sender.tab.id) {
        foundRequestId = requestId;
        break;
      }
    }

    if (foundRequestId) {
      const requestData = activityDataCache.get(foundRequestId);

      // Сразу закрываем вкладку
      chrome.tabs.remove(sender.tab.id).catch(() => {});

      // Сразу отправляем данные обратно
      if (requestData && requestData.sourceTabId) {
        console.log("[Background] Отправляю данные обратно в таб:", requestData.sourceTabId);

        chrome.tabs.sendMessage(requestData.sourceTabId, {
          action: "activityDataReceived",
          html: request.html,
          requestId: foundRequestId
        }).catch(error => {
          console.error("[Background] Ошибка отправки данных:", error);
        });
      }

      activityDataCache.delete(foundRequestId);
    }

    sendResponse({ success: true });
    return true;
  }

  return false;
});

function sendExtractRequest(requestId, tabId) {
  console.log(`[Background] Отправляю запрос на извлечение вкладке ${tabId}`);

  chrome.tabs.sendMessage(tabId, {
    action: "extractActivity",
    requestId: requestId
  }).then(() => {
    console.log(`[Background] Запрос отправлен вкладке ${tabId}`);
  }).catch(error => {
    console.error(`[Background] Ошибка отправки вкладке ${tabId}:`, error);

    // Быстрая повторная попытка через 200мс
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, {
        action: "extractActivity",
        requestId: requestId
      }).catch(retryError => {
        console.error(`[Background] Повторная ошибка:`, retryError);
        cleanupRequest(requestId, tabId);
      });
    }, 200);
  });
}

function cleanupRequest(requestId, tabId = null) {
  const cachedRequest = activityDataCache.get(requestId);
  if (cachedRequest) {
    if (tabId) {
      chrome.tabs.remove(tabId).catch(() => {});
    }

    if (cachedRequest.sourceTabId) {
      chrome.tabs.sendMessage(cachedRequest.sourceTabId, {
        action: "activityDataReceived",
        html: "<div>Таймаут загрузки активности</div>",
        requestId: requestId
      }).catch(() => {});
    }

    activityDataCache.delete(requestId);
  }
}

// Очистка старых записей
setInterval(() => {
  const now = Date.now();
  for (const [requestId, data] of activityDataCache.entries()) {
    if (now - data.timestamp > 30000) { // 30 секунд
      cleanupRequest(requestId, data.fetchTabId);
    }
  }
}, 10000);