import { notificationPermission } from '../reminders/scheduler';
import { defaultDeviceName, useSync } from '../sync/engine';

export const REPO_URL = 'https://github.com/amirsaeed671/Greenbit';

/**
 * A pre-filled GitHub issue. Only technical details are included (never tasks, notes
 * or habits), and nothing is sent until the person submits it on GitHub.
 */
export function bugReportUrl(): string {
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches;
  const env = [
    `- Greenbit version: ${__APP_VERSION__}`,
    `- Browser / OS: ${defaultDeviceName()}`,
    `- Installed as app: ${standalone ? 'yes' : 'no'}`,
    `- Screen: ${window.innerWidth}×${window.innerHeight}`,
    `- Sync: ${useSync.getState().enabled ? 'on' : 'off'}`,
    `- Notifications: ${notificationPermission()}`,
    `- Page: ${location.pathname}`,
  ].join('\n');
  const body = `**What happened?**\n\n\n**Steps to reproduce**\n1. \n2. \n\n**What did you expect?**\n\n\n**Environment** (filled in automatically; no personal data)\n${env}\n`;
  const q = new URLSearchParams({ title: 'Bug: ', labels: 'bug', body });
  return `${REPO_URL}/issues/new?${q}`;
}

export function ReportBugLink({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <a
      className={className}
      href={REPO_URL + '/issues/new'}
      target="_blank"
      rel="noopener noreferrer"
      // Build the URL at click time so it reflects the current page and settings.
      onClick={(e) => {
        e.currentTarget.href = bugReportUrl();
      }}
    >
      {children ?? 'Report a bug'}
    </a>
  );
}
