// Универсальный background.js для Manifest V2 и V3

// Проверяем, какая версия manifest используется
const isManifestV3 = chrome.runtime.getManifest().manifest_version === 3;

// Обработчик сообщений
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchActivity") {
    console.log("[Background] Получен запрос на извлечение активности:", request.url);

    fetch(request.url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
      })
      .then(html => {
        sendResponse({ html: html });
      })
      .catch(error => {
        console.error("[Background] Ошибка при извлечении активности:", error);
        sendResponse({ error: error.message });
      });

    return true; // Указываем, что ответ будет асинхронным
  }

  // Добавьте другие обработчики по необходимости
});

// Инициализация при установке
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("[Background] Расширение установлено");

    // Устанавливаем значения по умолчанию
    chrome.storage.sync.set({
      autoRefreshEnabled: false,
      autoRefreshInterval: 10
    }, () => {
      console.log("[Background] Настройки по умолчанию установлены");
    });
  }
});

// Для Manifest V3 нужно объявить как сервисный воркер
if (isManifestV3) {
  // Экспортируем функции для доступа из других частей расширения
  self.onfetch = null; // Отключаем стандартный fetch handler
}