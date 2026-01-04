// Notification Service for payment reminders
// Uses Push API and local notifications

const NOTIFICATION_PERMISSION_KEY = 'inovabank_notifications_enabled';

export interface PaymentReminder {
  type: 'salary' | 'advance';
  amount: number;
  day: number;
  daysUntil: number;
}

/**
 * Check if notifications are supported
 */
export function isNotificationSupported(): boolean {
  return 'Notification' in window;
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) {
    console.warn('Notifications not supported');
    return false;
  }

  const permission = await Notification.requestPermission();
  const granted = permission === 'granted';
  
  if (granted) {
    localStorage.setItem(NOTIFICATION_PERMISSION_KEY, 'true');
  }
  
  return granted;
}

/**
 * Check if notification permission is granted
 */
export function hasNotificationPermission(): boolean {
  if (!isNotificationSupported()) return false;
  return Notification.permission === 'granted';
}

/**
 * Send a local notification
 */
export function sendNotification(
  title: string, 
  body?: string,
  tag?: string
): Notification | null {
  if (!hasNotificationPermission()) {
    console.warn('Notification permission not granted');
    return null;
  }

  try {
    const notification = new Notification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/favicon.png',
      tag,
      requireInteraction: true,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return notification;
  } catch (err) {
    console.error('Error sending notification:', err);
    return null;
  }
}

/**
 * Send payment reminder notification
 */
export function sendPaymentReminder(reminder: PaymentReminder): Notification | null {
  const typeLabel = reminder.type === 'salary' ? 'Salário' : 'Adiantamento';
  const formattedAmount = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(reminder.amount);

  return sendNotification(
    `💰 ${typeLabel} em ${reminder.daysUntil} dia${reminder.daysUntil > 1 ? 's' : ''}!`,
    `Seu ${typeLabel.toLowerCase()} de ${formattedAmount} será creditado no dia ${reminder.day}.`,
    `payment-reminder-${reminder.type}`
  );
}

/**
 * Check and send reminders for tomorrow's payments
 */
export function checkAndSendPaymentReminders(
  salaryDay: number | null,
  salaryAmount: number,
  advanceDay: number | null,
  advanceAmount: number
): void {
  const today = new Date();
  const currentDay = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  // Calculate tomorrow's day (handling month rollover)
  const tomorrowDay = currentDay >= daysInMonth ? 1 : currentDay + 1;

  // Check if salary is tomorrow
  if (salaryDay && salaryAmount > 0 && salaryDay === tomorrowDay) {
    sendPaymentReminder({
      type: 'salary',
      amount: salaryAmount,
      day: salaryDay,
      daysUntil: 1
    });
  }

  // Check if advance is tomorrow
  if (advanceDay && advanceAmount > 0 && advanceDay === tomorrowDay) {
    sendPaymentReminder({
      type: 'advance',
      amount: advanceAmount,
      day: advanceDay,
      daysUntil: 1
    });
  }
}

/**
 * Store last check timestamp to avoid duplicate notifications
 */
const LAST_CHECK_KEY = 'inovabank_last_notification_check';

export function shouldCheckReminders(): boolean {
  const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
  if (!lastCheck) return true;

  const lastCheckDate = new Date(lastCheck);
  const today = new Date();

  // Check once per day
  return lastCheckDate.toDateString() !== today.toDateString();
}

export function markReminderChecked(): void {
  localStorage.setItem(LAST_CHECK_KEY, new Date().toISOString());
}
