import { roomKey } from './session';

// Ryan (QoL): put the club on your home screen, so it opens full screen like an app. Android
// browsers can ask for it directly (beforeinstallprompt); iPhones can't, so we show the steps.
// The manifest comes from the Worker with the private link's key in its start address, because
// a home-screen app on an iPhone has its own storage and wouldn't otherwise know the key.

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const standalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true);

class Install {
  /** Already opened from the home screen (or just installed): nothing to offer. */
  installed = $state(standalone());
  /** The browser's own install prompt, when it offers one. */
  private deferred: InstallPrompt | null = null;
  canPrompt = $state(false);

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferred = e as InstallPrompt;
      this.canPrompt = true;
    });
    window.addEventListener('appinstalled', () => (this.installed = true));
    const key = roomKey();
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = `/manifest.webmanifest${key ? `?k=${encodeURIComponent(key)}` : ''}`;
    document.head.appendChild(link);
  }

  /** Ask the browser to install; false when it can't, and the steps should be shown instead. */
  async prompt(): Promise<boolean> {
    const d = this.deferred;
    if (!d) return false;
    this.deferred = null;
    this.canPrompt = false;
    await d.prompt();
    const { outcome } = await d.userChoice;
    if (outcome === 'accepted') this.installed = true;
    return true;
  }

  /** Which steps to show when the browser can't ask itself. */
  get platform(): 'ios' | 'other' {
    return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'ios' : 'other';
  }
}

export const install = new Install();
