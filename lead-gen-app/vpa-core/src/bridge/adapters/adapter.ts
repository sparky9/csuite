import { BridgeEvent } from '../types.js';
import { BridgeSession } from '../types.js';
import { RuntimeMode } from '../../config/runtime.js';

export interface AdapterMessage {
  content: string;
  voiceHint?: string;
}

export interface AdapterResult {
  events: BridgeEvent[];
}

export interface AdapterStatus {
  id: RuntimeMode;
  available: boolean;
  detail?: string;
}

export interface Adapter {
  readonly id: RuntimeMode;
  getStatus(): AdapterStatus;
  processMessage(
    session: BridgeSession,
    message: AdapterMessage,
    emit?: (event: BridgeEvent) => void
  ): Promise<AdapterResult>;
}
