// activity_fetcher.js
console.log("[ActivityFetcher] Запущен на странице:", window.location.href);

// Функция для извлечения и отправки блока активности
function extractAndSendActivity() {
    const activityBox = document.getElementById('activity-box');
    if (activityBox && activityBox.children.length > 0) { // Проверяем, что внутри есть контент
        console.log("[ActivityFetcher] Найден #activity-box с контентом, длина HTML:", activityBox.outerHTML.length);
        const activityHTML = activityBox.outerHTML;

        chrome.runtime.sendMessage({
            action: "activityData",
            html: activityHTML
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("[ActivityFetcher] Ошибка отправки данных:", chrome.runtime.lastError);
            } else {
                console.log("[ActivityFetcher] Данные отправлены, ответ:", response);
                window.close();
            }
        });
    } else {
        console.log("[ActivityFetcher] #activity-box не найден или пуст, жду...");
    }
}

// Ждем полной загрузки DOM
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => {
        console.log("[ActivityFetcher] DOMContentLoaded сработал");
        setTimeout(() => {
            extractAndSendActivity();
        }, 2000); // Ждем 2 секунды после DOM загрузки, чтобы JS мог выполниться
    });
} else {
    // Если DOM уже загружен, ждем немного и проверяем
    setTimeout(() => {
        extractAndSendActivity();
    }, 2000);
}

// И устанавливаем MutationObserver на случай, если элемент появится позже
const observer = new MutationObserver((mutationsList) => {
    for (let mutation of mutationsList) {
        if (mutation.type === 'childList' || mutation.type === 'subtree') {
            const activityBox = document.getElementById('activity-box');
            if (activityBox && activityBox.children.length > 0) {
                console.log("[ActivityFetcher] #activity-box найден через MutationObserver с контентом");
                observer.disconnect();
                extractAndSendActivity();
                return;
            }
        }
    }
});

// Начинаем наблюдение за изменениями в body
observer.observe(document.body, { childList: true, subtree: true });

// Устанавливаем таймаут на 30 секунд, чтобы не висеть вечно
setTimeout(() => {
    console.log("[ActivityFetcher] Таймаут 30 секунд, закрываю вкладку");
    window.close();
}, 30000);