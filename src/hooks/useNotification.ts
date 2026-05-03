import { useCallback, useEffect, useRef } from 'react';

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  onClick?: () => void;
}

export function useNotification() {
  const permissionRef = useRef<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      permissionRef.current = Notification.permission;
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) return false;

    if (Notification.permission === 'granted') {
      permissionRef.current = 'granted';
      return true;
    }

    if (Notification.permission === 'denied') {
      return false;
    }

    const result = await Notification.requestPermission();
    permissionRef.current = result;
    return result === 'granted';
  }, []);

  const notify = useCallback((options: NotificationOptions) => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon,
      tag: options.tag || 'ralph-discovery',
      requireInteraction: false,
    });

    if (options.onClick) {
      notification.onclick = () => {
        window.focus();
        options.onClick?.();
        notification.close();
      };
    }

    setTimeout(() => notification.close(), 8000);
  }, []);

  const notifyDiscovery = useCallback(
    (projectName: string, score: number, grade: string, count: number) => {
      notify({
        title: `🔍 Ralph 发现新宝藏`,
        body: `${projectName} — 评分 ${score.toFixed(1)} (${grade})\n已累计发现 ${count} 个项目`,
        tag: `discovery-${projectName}`,
      });
    },
    [notify],
  );

  const notifyBatchComplete = useCallback(
    (count: number, query: string) => {
      notify({
        title: '✅ 批量评估完成',
        body: `"${query}" 的 ${count} 个项目评估完毕`,
        tag: 'batch-complete',
      });
    },
    [notify],
  );

  return {
    permission: permissionRef.current,
    requestPermission,
    notify,
    notifyDiscovery,
    notifyBatchComplete,
  };
}
