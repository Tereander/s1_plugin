// background.js для Manifest V3
console.log("[Background] Service worker запущен");

// Хранилище для временных данных активности
let activityDataCache = new Map();

// Обработчик сообщений
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[Background] Получено сообщение:", request.action, "от таба:", sender.tab?.id);

  if (request.action === "fetchActivity") {
    console.log("[Background] Получен запрос на извлечение активности:", request.url);

    // Создаем уникальный ID для этого запроса
    const requestId = request.requestId || Date.now() + Math.random();
    activityDataCache.set(requestId, {
      url: request.url,
      sourceTabId: sender.tab.id,
      timestamp: Date.now(),
      sendResponse: sendResponse
    });

    // Открываем новую вкладку для загрузки активности
    chrome.tabs.create({
      url: request.url,
      active: false
    }).then((newTab) => {
      console.log("[Background] Создана вкладка для получения активности, ID:", newTab.id);

      // Обновляем кэш с ID новой вкладки
      const cachedData = activityDataCache.get(requestId);
      if (cachedData) {
        cachedData.fetchTabId = newTab.id;
        activityDataCache.set(requestId, cachedData);
      }

      // Слушатель для обновлений вкладки
      const onTabUpdate = (tabId, changeInfo, tab) => {
        if (tabId === newTab.id) {
          console.log("[Background] Обновление вкладки:", changeInfo.status);

          if (changeInfo.status === 'complete') {
            console.log("[Background] Вкладка полностью загружена, жду 5 секунд для JS...");

            // Даем время на выполнение JavaScript и загрузку динамического контента
            setTimeout(() => {
              // Проверяем что вкладка еще существует
              chrome.tabs.get(tabId).then(() => {
                console.log("[Background] Отправляю сообщение для извлечения активности...");

                chrome.tabs.sendMessage(tabId, {
                  action: "extractActivity",
                  requestId: requestId
                }).then(response => {
                  console.log("[Background] Получены данные активности, длина:", response?.html?.length || 0);

                  // Закрываем временную вкладку
                  chrome.tabs.remove(tabId).then(() => {
                    console.log("[Background] Вкладка активности закрыта");
                  }).catch(err => {
                    console.warn("[Background] Не удалось закрыть вкладку:", err);
                  });

                  // Отправляем данные обратно в исходную вкладку
                  const cachedRequest = activityDataCache.get(requestId);
                  if (cachedRequest) {
                    chrome.tabs.sendMessage(cachedRequest.sourceTabId, {
                      action: "activityDataReceived",
                      html: response.html || "<div>Нет данных активности</div>",
                      requestId: requestId
                    }).then(() => {
                      console.log("[Background] Данные отправлены обратно в таб:", cachedRequest.sourceTabId);
                    }).catch(error => {
                      console.error("[Background] Ошибка отправки данных обратно:", error);
                    });

                    // Отправляем ответ на начальный запрос
                    if (cachedRequest.sendResponse) {
                      cachedRequest.sendResponse({ success: true, requestId: requestId });
                    }

                    // Очищаем кэш
                    activityDataCache.delete(requestId);
                  }

                }).catch(error => {
                  console.error("[Background] Ошибка получения данных от вкладки:", error);

                  // Закрываем вкладку в случае ошибки
                  chrome.tabs.remove(tabId).catch(() => {});

                  const cachedRequest = activityDataCache.get(requestId);
                  if (cachedRequest) {
                    chrome.tabs.sendMessage(cachedRequest.sourceTabId, {
                      action: "activityDataReceived",
                      html: `<div>Ошибка извлечения активности: ${error.message}</div>`,
                      requestId: requestId
                    }).catch(() => {});

                    if (cachedRequest.sendResponse) {
                      cachedRequest.sendResponse({
                        error: `Ошибка извлечения: ${error.message}`
                      });
                    }

                    activityDataCache.delete(requestId);
                  }
                });

              }).catch(error => {
                console.error("[Background] Вкладка недоступна:", error);
                cleanupRequest(requestId);
              });

            }, 5000); // Ждем 5 секунд для полной загрузки динамического контента

            // Удаляем слушатель
            chrome.tabs.onUpdated.removeListener(onTabUpdate);
          }
        }
      };

      chrome.tabs.onUpdated.addListener(onTabUpdate);

      // Таймаут на случай если вкладка не загрузится
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(onTabUpdate);
        cleanupRequest(requestId, newTab.id);
      }, 45000); // 45 секунд таймаут

      // Не отправляем ответ сразу, ждем завершения
      return true;

    }).catch((error) => {
      console.error("[Background] Ошибка при создании вкладки:", error);
      sendResponse({ error: error.message });
      cleanupRequest(requestId);
    });

    return true; // Сообщаем что ответ будет асинхронным
  }

  if (request.action === "extractedActivity") {
    console.log("[Background] Получены извлеченные данные активности");
    sendResponse({ success: true, html: request.html });
    return true;
  }

  // Функция очистки запроса
  function cleanupRequest(requestId, tabId = null) {
    const cachedRequest = activityDataCache.get(requestId);
    if (cachedRequest) {
      if (tabId) {
        chrome.tabs.remove(tabId).catch(() => {});
      }

      chrome.tabs.sendMessage(cachedRequest.sourceTabId, {
        action: "activityDataReceived",
        html: "<div>Таймаут загрузки активности (45 секунд)</div>",
        requestId: requestId
      }).catch(() => {});

      if (cachedRequest.sendResponse) {
        cachedRequest.sendResponse({ error: "Таймаут загрузки активности" });
      }

      activityDataCache.delete(requestId);
    }
  }

  // Обработчик закрытия вкладок
  chrome.tabs.onRemoved.addListener((tabId) => {
    for (const [requestId, data] of activityDataCache.entries()) {
      if (data.fetchTabId === tabId) {
        console.log("[Background] Вкладка активности закрыта, очищаю запрос:", requestId);
        cleanupRequest(requestId);
        break;
      }
    }
  });

  console.log("[Background] Неизвестное действие:", request.action);
  sendResponse({ error: "Unknown action" });
  return false;
});

// Инициализация при установке
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("[Background] Расширение установлено");

    chrome.storage.sync.set({
      autoRefreshEnabled: false,
      autoRefreshInterval: 10
    }).then(() => {
      console.log("[Background] Настройки по умолчанию установлены");
    }).catch((error) => {
      console.error("[Background] Ошибка установки настроек:", error);
    });
  }
});