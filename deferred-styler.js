// deferred-styler.js - РАБОЧАЯ ВЕРСИЯ БЕЗ СПАМА
(function() {
    'use strict';

    console.log("[StatusStyler] Запущен для URL:", window.location.href);

    // Конфигурация
    const CONFIG = {
        statuses: ['Отложено', 'Закрыта', 'В работе'],
        styleFlag: 'data-status-styled',
        checkInterval: 2000, // проверка каждые 2 секунды
        maxChecks: 10 // максимум 10 проверок
    };

    let checkCount = 0;
    let observer = null;
    let intervalId = null;

    // Основная функция стилизации (вызывается один раз при изменении URL)
    function applyStatusStyles() {
        try {
            console.log("[StatusStyler] Поиск элементов статусов...");

            const elements = document.querySelectorAll('span.src-components-customselect-___styles-module__inputText___J9u6h');

            if (elements.length === 0) {
                console.log("[StatusStyler] Элементы не найдены");
                return false;
            }

            let styledCount = 0;

            elements.forEach(element => {
                const text = element.textContent.trim();

                // Проверяем массив статусов
                for (const status of CONFIG.statuses) {
                    if (text === status) {
                        // Проверяем, не стилизован ли уже
                        if (element.hasAttribute(CONFIG.styleFlag)) {
                            continue;
                        }

                        // Применяем стили
                        element.style.backgroundColor = '#4caf50';
                        element.style.color = '#ffffff';
                        element.style.fontWeight = '600';

                        // Сохраняем оригинальные padding если они есть
                        const computedStyle = window.getComputedStyle(element);
                        if (!computedStyle.padding || computedStyle.padding === '0px') {
                            element.style.padding = '2px 8px';
                        }

                        if (!computedStyle.borderRadius || computedStyle.borderRadius === '0px') {
                            element.style.borderRadius = '3px';
                        }

                        element.setAttribute(CONFIG.styleFlag, 'true');
                        styledCount++;

                        console.log(`[StatusStyler] Стилизован: "${text}"`);
                        break;
                    }
                }
            });

            if (styledCount > 0) {
                console.log(`[StatusStyler] Стилизовано элементов: ${styledCount}`);
                return true;
            }

            return false;

        } catch (error) {
            console.error("[StatusStyler] Ошибка:", error);
            return false;
        }
    }

    // Запуск стилизации с проверками
    function startStyling() {
        console.log("[StatusStyler] Запуск стилизации...");
        checkCount = 0;

        // Первая попытка
        const success = applyStatusStyles();

        if (success) {
            console.log("[StatusStyler] Стилизация успешно применена");
            return;
        }

        // Если не нашли элементы, пробуем несколько раз с интервалом
        intervalId = setInterval(() => {
            checkCount++;

            if (checkCount >= CONFIG.maxChecks) {
                console.log("[StatusStyler] Достигнут лимит проверок, остановка");
                clearInterval(intervalId);
                return;
            }

            console.log(`[StatusStyler] Повторная проверка #${checkCount}`);

            if (applyStatusStyles()) {
                clearInterval(intervalId);
                console.log("[StatusStyler] Элементы найдены и стилизованы");
            }

        }, CONFIG.checkInterval);
    }

    // Остановка стилизации
    function stopStyling() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }

        if (observer) {
            observer.disconnect();
            observer = null;
        }

        console.log("[StatusStyler] Стилизация остановлена");
    }

    // Отслеживание изменений DOM (только для динамически добавленных элементов)
    function startDOMObserver() {
        observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Проверяем есть ли в новых элементах наши статусы
                    let hasRelevantChanges = false;

                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1) { // Element node
                            if (node.querySelector && node.querySelector('span.src-components-customselect-___styles-module__inputText___J9u6h')) {
                                hasRelevantChanges = true;
                                break;
                            }
                        }
                    }

                    if (hasRelevantChanges) {
                        console.log("[StatusStyler] Обнаружены новые элементы DOM");
                        setTimeout(applyStatusStyles, 300);
                    }
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // ОСНОВНОЙ МЕХАНИЗМ: отслеживание изменений URL для SPA
    function setupSPATracking() {
        let lastUrl = window.location.href;

        // Функция проверки URL
        function checkUrlChange() {
            const currentUrl = window.location.href;

            if (currentUrl !== lastUrl) {
                console.log(`[StatusStyler] URL изменился: ${lastUrl} -> ${currentUrl}`);
                lastUrl = currentUrl;

                // Перезапускаем стилизацию для новой страницы
                stopStyling();

                // Ждем немного и запускаем снова
                setTimeout(() => {
                    if (currentUrl.includes('sd.jet.su')) {
                        startStyling();
                        startDOMObserver();
                    }
                }, 500);
            }
        }

        // 1. Периодическая проверка URL (самый надежный способ)
        const urlCheckInterval = setInterval(checkUrlChange, 1000);

        // 2. События истории браузера
        window.addEventListener('popstate', checkUrlChange);

        // 3. Перехват pushState/replaceState (SPA навигация)
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function(...args) {
            const result = originalPushState.apply(this, args);
            setTimeout(checkUrlChange, 100);
            return result;
        };

        history.replaceState = function(...args) {
            const result = originalReplaceState.apply(this, args);
            setTimeout(checkUrlChange, 100);
            return result;
        };

        // 4. Отслеживание кликов по ссылкам
        document.addEventListener('click', (e) => {
            let target = e.target;

            // Ищем ближайшую ссылку
            while (target && target.tagName !== 'A' && target !== document.body) {
                target = target.parentElement;
            }

            if (target && target.tagName === 'A' && target.href) {
                setTimeout(checkUrlChange, 300);
            }
        }, true);

        // Очистка при уходе со страницы
        window.addEventListener('beforeunload', () => {
            clearInterval(urlCheckInterval);
            stopStyling();
        });

        console.log("[StatusStyler] SPA-трекинг запущен");
    }

    // Инициализация
    function initialize() {
        console.log("[StatusStyler] Инициализация для текущей страницы");

        // Запускаем отслеживание SPA
        setupSPATracking();

        // Запускаем стилизацию для текущей страницы
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => {
                    startStyling();
                    startDOMObserver();
                }, 1000);
            });
        } else {
            setTimeout(() => {
                startStyling();
                startDOMObserver();
            }, 1000);
        }
    }

    // Запускаем инициализацию
    setTimeout(initialize, 100);

    // Экспортируем для отладки
    window.statusStyler = {
        apply: applyStatusStyles,
        start: startStyling,
        stop: stopStyling,
        config: CONFIG
    };

})();