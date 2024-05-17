import { Tracer, ResponseDetails } from "./types";

/**
 * Represents a console tracer that logs information about requests and responses.
 */
export class ConsoleTracer implements Tracer {
    /**
     * Called when the first byte of the response is received.
     * @param req - The request object.
     * @param res - The response object.
     * @param details - Additional response details.
     */
    onFirstByteReceived(req: any, res: any, details?: ResponseDetails): void {
        if (details) {
            details.timings = details.timings || {};
            details.timings.firstByteTime = performance.now();
        }
        console.log(`First byte received for request: ${req.url}`);
    }

    /**
     * Called when the response ends.
     * @param req - The request object.
     * @param res - The response object.
     * @param details - Additional response details.
     */
    onEnd(req: any, res: any, details?: ResponseDetails): void {
        if (details) {
            details.timings = details.timings || {};
            details.timings.endTime = performance.now();
        }
        console.log(`Response ended for request: ${req.url}`);
        if (details) {
            console.log(
                `Response status: ${details.statusCode} ${details.statusMessage}`
            );
            if (details.timings) {
                const duration = (details.timings.endTime! - details.timings.startTime!).toFixed(2);
                console.log(`[END] Request duration: ${duration} ms`);
            }
        }
    }

    /**
     * Called when the connection is closed.
     * @param req - The request object.
     * @param res - The response object.
     * @param details - Additional response details.
     */
    onClose(req: any, res: any, details?: ResponseDetails): void {
        if (details) {
            details.timings = details.timings || {};
            details.timings.closeTime = performance.now();
        }
        console.log(`Connection closed for request: ${req.url}`);
        if (details) {
            console.log(
                `Response status: ${details.statusCode} ${details.statusMessage}`
            );
            if (details.timings) {
                const duration =
                    (details.timings.closeTime! - details.timings.startTime!).toFixed(2);
                console.log(`[CLOSE]  Request duration: ${duration} ms`);
            }
        }
    }
}
