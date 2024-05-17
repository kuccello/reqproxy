import { IncomingMessage } from 'http';

/**
 * Represents the details of a response.
 */
export interface ResponseDetails {
  statusCode?: number;
  statusMessage?: string;
  timings?: {
    startTime?: number;
    firstByteTime?: number;
    endTime?: number;
    closeTime?: number;
  };
}

/**
 * Represents a tracer object that can be used to track the progress of a request/response.
 */
export interface Tracer {
  /**
   * Called when the first byte of the response is received.
   * @param req - The incoming request object.
   * @param res - The incoming response object.
   * @param details - The details of the response.
   */
  onFirstByteReceived(req: IncomingMessage, res: IncomingMessage, details?: ResponseDetails): void;

  /**
   * Called when the response is fully received.
   * @param req - The incoming request object.
   * @param res - The incoming response object.
   * @param details - The details of the response.
   */
  onEnd(req: IncomingMessage, res: IncomingMessage, details?: ResponseDetails): void;

  /**
   * Called when the connection is closed.
   * @param req - The incoming request object.
   * @param res - The incoming response object.
   * @param details - The details of the response.
   */
  onClose(req: IncomingMessage, res: IncomingMessage, details?: ResponseDetails): void;
}