/* Greenbit: notification actions for task reminders. Loaded into the Workbox service worker. */
self.addEventListener('notificationclick', (event) => {
  const n = event.notification;
  const taskId = n.data && n.data.taskId;
  const action = event.action || 'open';
  n.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client = windows[0];
      if (client) {
        if (taskId && action !== 'open') client.postMessage({ type: 'reminder-action', action, taskId });
        await client.focus();
        return;
      }
      const url = taskId && action !== 'open' ? `/?reminderAction=${action}&task=${encodeURIComponent(taskId)}` : '/';
      await self.clients.openWindow(url);
    })(),
  );
});
