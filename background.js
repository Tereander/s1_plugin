// background.js
console.log('[Background] Service Worker загружен');

// Храним состояние вкладок
const tabStates = new Map();

// Обработчик сообщений
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Background] Получено сообщение:', request);

    if (request.action === "fetchActivity") {
        const url = request.url;
        console.log('[Background] Получен запрос fetchActivity для URL:', url);

        // Открываем новую вкладку
        chrome.tabs.create({ url: url, active: false }, (newTab) => {
            if (chrome.runtime.lastError) {
                console.error('[Background] Ошибка открытия вкладки:', chrome.runtime.lastError);
                sendResponse({ error: chrome.runtime.lastError.message });
                return;
            }

            console.log('[Background] Открыта вкладка с ID:', newTab.id, 'URL:', newTab.url);

            // Сохраняем callback для этой вкладки
            tabStates.set(newTab.id, {
                sendResponse: sendResponse,
                startTime: Date.now(),
                timeoutId: null
            });

            // Устанавливаем таймаут
            const timeoutId = setTimeout(() => {
                console.log('[Background] Таймаут для вкладки:', newTab.id);
                cleanupTabState(newTab.id, 'Timeout: Не удалось загрузить активность за 30 секунд');
            }, 30000);

            // Обновляем timeoutId в состоянии
            const state = tabStates.get(newTab.id);
            if (state) {
                state.timeoutId = timeoutId;
            }
        });

        // Оставляем порт открытым
        return true;
    }
});

// Слушаем обновления вкладок
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    console.log('[Background] Статус вкладки изменен:', tabId, changeInfo.status);

    // Проверяем, что вкладка из нашего списка и статус "complete"
    if (tabStates.has(tabId) && changeInfo.status === 'complete') {
        console.log('[Background] Вкладка полностью загружена, выполняю скрипт:', tabId);

        // Через небольшую задержку, чтобы JS на странице точно выполнился
        setTimeout(() => {
            console.log('[Background] Выполняю scripting.executeScript для вкладки:', tabId);

            // Используем chrome.scripting.executeScript вместо chrome.tabs.executeScript
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: () => {
                    console.log('[ContentScript] Ищу #activity-box');
                    const activityBox = document.getElementById('activity-box');
                    if (activityBox) {
                        console.log('[ContentScript] Найден #activity-box, длина HTML:', activityBox.outerHTML.length);
                        return activityBox.outerHTML;
                    } else {
                        console.log('[ContentScript] #activity-box не найден');
                        // Попробуем найти другие возможные селекторы для активности
                        const possibleSelectors = [
                            '[data-testid="activity"]',
                            '.activity-container',
                            '.activity-section',
                            '.timeline',
                            '.history-container'
                        ];

                        for (const selector of possibleSelectors) {
                            const element = document.querySelector(selector);
                            if (element) {
                                console.log('[ContentScript] Найден элемент по селектору:', selector);
                                return element.outerHTML;
                            }
                        }

                        return null;
                    }
                }
            }).then((results) => {
                console.log('[Background] Результат scripting.executeScript для вкладки:', tabId, results);

                const state = tabStates.get(tabId);
                if (!state) {
                    console.log('[Background] Состояние вкладки уже очищено:', tabId);
                    return;
                }

                if (results && results[0] && results[0].result) {
                    console.log('[Background] HTML активности получен, закрываю вкладку:', tabId);
                    cleanupTabState(tabId, null, results[0].result);
                } else {
                    console.log('[Background] #activity-box не найден, продолжаю ожидать:', tabId);

                    // Попробуем еще раз через 2 секунды
                    setTimeout(() => {
                        if (tabStates.has(tabId)) {
                            console.log('[Background] Повторная проверка для вкладки:', tabId);

                            chrome.scripting.executeScript({
                                target: { tabId: tabId },
                                func: () => {
                                    const activityBox = document.getElementById('activity-box');
                                    if (activityBox) {
                                        console.log('[ContentScript] Найден #activity-box при повторной проверке');
                                        return activityBox.outerHTML;
                                    }
                                    return null;
                                }
                            }).then((retryResults) => {
                                const retryState = tabStates.get(tabId);
                                if (!retryState) return;

                                if (retryResults && retryResults[0] && retryResults[0].result) {
                                    console.log('[Background] HTML активности получен при повторной проверке');
                                    cleanupTabState(tabId, null, retryResults[0].result);
                                } else {
                                    console.log('[Background] #activity-box не найден даже при повторной проверке');
                                    // Не закрываем вкладку, продолжаем ожидать
                                }
                            }).catch((error) => {
                                console.error('[Background] Ошибка при повторной проверке:', error);
                                cleanupTabState(tabId, error.message);
                            });
                        }
                    }, 2000);
                }
            }).catch((error) => {
                console.error('[Background] Ошибка выполнения скрипта:', error);
                cleanupTabState(tabId, error.message);
            });
        }, 3000);
    }
});

// Функция для очистки состояния вкладки
function cleanupTabState(tabId, errorMessage, htmlResult) {
    console.log('[Background] Очистка состояния для вкладки:', tabId, 'error:', errorMessage, 'htmlResult:', !!htmlResult);

    const state = tabStates.get(tabId);
    if (!state) return;

    // Очищаем таймаут
    if (state.timeoutId) {
        clearTimeout(state.timeoutId);
    }

    // Закрываем вкладку
    chrome.tabs.remove(tabId, () => {
        if (chrome.runtime.lastError) {
            console.warn('[Background] Ошибка при закрытии вкладки:', chrome.runtime.lastError.message);
        } else {
            console.log('[Background] Вкладка закрыта:', tabId);
        }
    });

    // Отправляем результат
    if (errorMessage) {
        state.sendResponse({ error: errorMessage });
        state.sendResponse({ error: errorMessage });
    } else if (htmlResult) {
        state.sendResponse({ html: htmlResult });
    }

    // Удаляем из состояния
    tabStates.delete(tabId);
}