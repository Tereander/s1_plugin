console.log("[Background] Service worker запущен");

let activityDataCache = new Map();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[Background] Получено сообщение:", request.action);

  if (request.action === "fetchActivity") {
    console.log("[Background] Получен запрос на извлечение активности");

    const requestId = request.requestId || Date.now();
    activityDataCache.set(requestId, {
      sourceTabId: sender.tab.id,
      timestamp: Date.now(),
      status: "fetching"
    });

    chrome.tabs.create({
      url: request.url,
      active: false
    }).then((newTab) => {
      console.log("[Background] Создана вкладка:", newTab.id);

      const cachedData = activityDataCache.get(requestId);
      if (cachedData) {
        cachedData.fetchTabId = newTab.id;
        cachedData.status = "tab_created";
        activityDataCache.set(requestId, cachedData);
      }

      sendResponse({ success: true, requestId: requestId });

      // Ждем загрузки страницы
      const onTabReady = (tabId, changeInfo) => {
        if (tabId === newTab.id && changeInfo.status === 'complete') {
          console.log("[Background] Вкладка загружена, ждем 3 секунды для динамического контента");
          chrome.tabs.onUpdated.removeListener(onTabReady);

          // Даем время на загрузку динамического контента
          setTimeout(() => {
            console.log("[Background] Отправляю запрос на извлечение активности");
            sendExtractRequest(requestId, newTab.id);
          }, 3000); // 3 секунды для AJAX
        }
      };

      chrome.tabs.onUpdated.addListener(onTabReady);

      // Если вкладка уже загружена
      if (newTab.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(onTabReady);
        setTimeout(() => {
          sendExtractRequest(requestId, newTab.id);
        }, 3000);
      }

      // Таймаут 45 секунд
      setTimeout(() => {
        if (activityDataCache.has(requestId)) {
          const data = activityDataCache.get(requestId);
          if (data.status !== "completed") {
            console.log("[Background] Таймаут 45 секунд, закрываю вкладку");
            cleanupRequest(requestId, newTab.id, "Таймаут загрузки");
          }
        }
      }, 45000);

    }).catch((error) => {
      console.error("[Background] Ошибка при создании вкладки:", error);
      sendResponse({ error: error.message });
      cleanupRequest(requestId);
    });

    return true;
  }

  // ПРИНИМАЕМ ТОЛЬКО activityDataReceived (как в content.js ожидается)
  if (request.action === "activityDataReceived") {
    console.log("[Background] Получены данные активности, длина:", request.html?.length);

    let foundRequestId = null;
    for (const [requestId, data] of activityDataCache.entries()) {
      if (data.fetchTabId === sender.tab.id) {
        foundRequestId = requestId;
        break;
      }
    }

    if (foundRequestId) {
      const requestData = activityDataCache.get(foundRequestId);
      requestData.status = "completed";

      console.log("[Background] Данные получены, отправляю обратно в исходную вкладку");

      // СНАЧАЛА отправляем данные обратно, ПОТОМ закрываем вкладку
      if (requestData.sourceTabId) {
        chrome.tabs.sendMessage(requestData.sourceTabId, {
          action: "activityDataReceived",  // Это то, что ждет content.js
          html: request.html,
          requestId: foundRequestId
        }).then(() => {
          console.log("[Background] Данные отправлены, закрываю вкладку источника");
          // Закрываем вкладку источника ТОЛЬКО ПОСЛЕ успешной отправки
          chrome.tabs.remove(sender.tab.id).catch(() => {
            console.log("[Background] Вкладка уже закрыта");
          });
        }).catch(error => {
          console.error("[Background] Ошибка отправки данных:", error);
          // Все равно закрываем вкладку
          chrome.tabs.remove(sender.tab.id).catch(() => {});
        });
      } else {
        // Если нет sourceTabId, просто закрываем
        chrome.tabs.remove(sender.tab.id).catch(() => {});
      }

      // Удаляем из кэша
      setTimeout(() => {
        activityDataCache.delete(foundRequestId);
      }, 1000);
    }

    sendResponse({ success: true });
    return true;
  }

  return false;
});

function sendExtractRequest(requestId, tabId) {
  console.log(`[Background] Отправляю запрос на извлечение вкладке ${tabId}`);

  const cachedData = activityDataCache.get(requestId);
  if (cachedData) {
    cachedData.status = "extracting";
    activityDataCache.set(requestId, cachedData);
  }

  chrome.tabs.sendMessage(tabId, {
    action: "extractActivity",
    requestId: requestId
  }).then(() => {
    console.log(`[Background] Запрос отправлен вкладке ${tabId}`);
  }).catch(error => {
    console.error(`[Background] Ошибка отправки вкладке ${tabId}:`, error);

    // Повторная попытка через 2 секунды
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, {
        action: "extractActivity",
        requestId: requestId
      }).catch(retryError => {
        console.error(`[Background] Повторная ошибка:`, retryError);
        cleanupRequest(requestId, tabId, "Не удалось отправить запрос");
      });
    }, 2000);
  });
}

function cleanupRequest(requestId, tabId = null, reason = "Ошибка") {
  const cachedRequest = activityDataCache.get(requestId);
  if (cachedRequest) {
    console.log(`[Background] Очистка запроса ${requestId}: ${reason}`);

    // Закрываем вкладку если она еще открыта
    if (tabId) {
      chrome.tabs.remove(tabId).catch(() => {
        console.log(`[Background] Вкладка ${tabId} уже закрыта`);
      });
    }

    // Отправляем сообщение об ошибке в исходную вкладку
    if (cachedRequest.sourceTabId) {
      chrome.tabs.sendMessage(cachedRequest.sourceTabId, {
        action: "activityDataReceived",
        html: `<div style="padding:20px;color:#666;background:#fff3e0;">
                <strong>Информация:</strong> ${reason}
              </div>`,
        requestId: requestId
      }).catch(() => {
        console.log(`[Background] Не удалось отправить сообщение об ошибке`);
      });
    }

    activityDataCache.delete(requestId);
  }
}

// Очистка старых записей
setInterval(() => {
  const now = Date.now();
  for (const [requestId, data] of activityDataCache.entries()) {
    if (now - data.timestamp > 120000) { // 2 минуты
      cleanupRequest(requestId, data.fetchTabId, "Очень долгий таймаут");
    }
  }
}, 30000);