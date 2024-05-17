import { Tracer as ITracer, ResponseDetails } from "./types";
import { Tracer as ZipkinTracer, ExplicitContext, TraceId, BatchRecorder, option, Annotation, jsonEncoder } from 'zipkin';
import { HttpLogger } from 'zipkin-transport-http';

/**
 * The base URL of the Zipkin server.
 * Replace this with the URL of your Zipkin server.
 */
const zipkinBaseUrl = 'http://localhost:9411';

const ctxImpl = new ExplicitContext();
const httpLogger = new HttpLogger({ endpoint: `${zipkinBaseUrl}/api/v2/spans`, jsonEncoder: jsonEncoder.JSON_V2 });
const recorder = new BatchRecorder({ logger: httpLogger });

const zipkinTracer = new ZipkinTracer({ ctxImpl, recorder, localServiceName: 'service-wrs' });

/**
 * Implementation of the ZipkinTracer interface.
 * This class is responsible for tracing requests and sending data to Zipkin.
 */
export class ZipkinTracerImpl implements ITracer {
  private traceId: TraceId | null = null;

  constructor() {
    zipkinTracer.recordServiceName('proxy-server');
  }

  /**
   * Creates a new trace or continues an existing trace based on the request headers.
   * @param req - The request object.
   */
  private createOrContinueTrace(req: any): void {
    const headers = req.headers;

    const traceIdHeader = headers['x-b3-traceid'];
    const spanIdHeader = headers['x-b3-spanid'];
    const parentIdHeader = headers['x-b3-parentspanid'];
    const sampledHeader = headers['x-b3-sampled'];
    const flagsHeader = headers['x-b3-flags'];

    if (traceIdHeader && spanIdHeader) {
      this.traceId = new TraceId({
        traceId: traceIdHeader,
        spanId: spanIdHeader,
        parentId: parentIdHeader ? new option.Some(parentIdHeader) : option.None,
        sampled: sampledHeader ? new option.Some(sampledHeader === '1') : option.None,
        debug: flagsHeader ? parseInt(flagsHeader, 10) === 1 : false,
      });
      zipkinTracer.setId(this.traceId);
    } else {
      this.traceId = zipkinTracer.createRootId();
      zipkinTracer.setId(this.traceId);
    }

    // Log traceId for debugging
    console.log('Trace ID:', this.traceId);
  }

  /**
   * Logs the Zipkin data for debugging purposes.
   * @param traceId - The trace ID.
   */
  private logZipkinData(traceId: TraceId): void {
    console.log('Sending data to Zipkin:', {
      traceId: traceId.traceId,
      spanId: traceId.spanId,
      parentId: traceId.parentSpanId,
      sampled: traceId.sampled,
    });
  }

  /**
   * Called when the first byte of the response is received.
   * @param req - The request object.
   * @param res - The response object.
   * @param details - Additional response details.
   */
  onFirstByteReceived(req: any, res: any, details?: ResponseDetails): void {
    this.createOrContinueTrace(req);

    if (details) {
      details.timings = details.timings || {};
      details.timings.firstByteTime = performance.now();
    }

    zipkinTracer.recordRpc('first-byte-received');
    zipkinTracer.recordBinary('http.url', req.url);
    zipkinTracer.recordAnnotation(new Annotation.ClientSend());
    zipkinTracer.recordAnnotation(new Annotation.Message('First byte received'));

    console.log(`First byte received for request: ${req.url}`);
    if (this.traceId) {
      this.logZipkinData(this.traceId);
    }
  }

  /**
   * Called when the request/response cycle ends.
   * @param req - The request object.
   * @param res - The response object.
   * @param details - Additional response details.
   */
  onEnd(req: any, res: any, details?: ResponseDetails): void {
    if (!this.traceId) return;
    zipkinTracer.setId(this.traceId);

    if (details) {
      details.timings = details.timings || {};
      details.timings.endTime = performance.now();
    }

    zipkinTracer.recordRpc('end');
    zipkinTracer.recordBinary('http.url', req.url);
    zipkinTracer.recordBinary('http.status_code', res.statusCode.toString());
    zipkinTracer.recordAnnotation(new Annotation.ClientRecv());
    zipkinTracer.recordAnnotation(new Annotation.Message('Response ended'));

    console.log(`Response ended for request: ${req.url}`);
    if (details) {
      console.log(`Response status: ${details.statusCode} ${details.statusMessage}`);
      if (details.timings) {
        const duration = (details.timings.endTime! - details.timings.startTime!).toFixed(2);
        console.log(`[END] Request duration: ${duration} ms`);
      }
    }
    this.logZipkinData(this.traceId);
  }

  /**
   * Called when the connection is closed.
   * @param req - The request object.
   * @param res - The response object.
   * @param details - Additional response details.
   */
  onClose(req: any, res: any, details?: ResponseDetails): void {
    if (!this.traceId) return;
    zipkinTracer.setId(this.traceId);

    if (details) {
      details.timings = details.timings || {};
      details.timings.closeTime = performance.now();
    }

    zipkinTracer.recordRpc('close');
    zipkinTracer.recordBinary('http.url', req.url);
    zipkinTracer.recordBinary('http.status_code', res.statusCode.toString());
    zipkinTracer.recordAnnotation(new Annotation.ClientRecv());
    zipkinTracer.recordAnnotation(new Annotation.Message('Connection closed'));

    console.log(`Connection closed for request: ${req.url}`);
    if (details) {
      console.log(`Response status: ${details.statusCode} ${details.statusMessage}`);
      if (details.timings) {
        const duration = (details.timings.closeTime! - details.timings.startTime!).toFixed(2);
        console.log(`[CLOSE] Request duration: ${duration} ms`);
      }
    }
    this.logZipkinData(this.traceId);
  }
}
