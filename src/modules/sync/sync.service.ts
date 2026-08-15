import { env } from '../../config/env';

interface SyncRequestPayload {
  targetDate: string;
  triggeredBy: string;
  requestId: string;
}

export const triggerSync = async (payload: SyncRequestPayload) => {
  const { N8N_POSTFLOW_WEBHOOK_URL, N8N_POSTFLOW_WEBHOOK_KEY } = env;

  if (!N8N_POSTFLOW_WEBHOOK_URL || !N8N_POSTFLOW_WEBHOOK_KEY) {
    throw new Error('Sync configuration is missing on the server.');
  }

  const signal = AbortSignal.timeout(10000); // 10 seconds timeout

  try {
    const response = await fetch(N8N_POSTFLOW_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PostFlow-Webhook-Key': N8N_POSTFLOW_WEBHOOK_KEY,
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Upstream sync service responded with status ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    if (error.name === 'TimeoutError') {
      throw new Error('Sync request timed out.');
    }
    // Mask detailed network/internal errors from downstream
    throw new Error('Upstream sync service failed.');
  }
};
