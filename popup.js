document.addEventListener('DOMContentLoaded', async () => {
  const toggle = document.getElementById('autoRefreshToggle');
  const input = document.getElementById('refreshIntervalInput');
  const saveBtn = document.getElementById('saveSettingsBtn');

  // Загрузка текущих настроек
  const result = await chrome.storage.sync.get(['autoRefreshEnabled', 'autoRefreshInterval']);
  toggle.checked = result.autoRefreshEnabled ?? false;
  input.value = result.autoRefreshInterval ?? 10;

  // Кнопка сохранения
  saveBtn.addEventListener('click', async () => {
    const enabled = toggle.checked;
    let interval = parseInt(input.value, 10);

    if (isNaN(interval) || interval < 1) {
      alert('Интервал обновления должен быть не менее 1 секунды.');
      return;
    }

    await chrome.storage.sync.set({
      autoRefreshEnabled: enabled,
      autoRefreshInterval: interval
    });

    // Закрытие popup после сохранения
    window.close();
  });
});