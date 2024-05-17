import httpProxy from "http-proxy";
import { Request } from "@hapi/hapi";
import { Tracer, ResponseDetails } from "../tracer/types";
import { Readable } from "stream";
import streamify from "../streaming/streamify";
import * as http from "http";
import * as net from "net";

/**
 * Represents a proxy server that forwards HTTP requests to a target server.
 */
export class ProxyServer {
  private proxy: httpProxy;
  private request: Request;
  private target: string;
  private headers: any;
  private method: string;
  private path: string;
  private body?: Readable | Buffer | string | object;

  /**
   * Creates a new instance of the ProxyServer class.
   * @param request - The incoming HTTP request to be proxied.
   * @param tracer - The tracer or an array of tracers to be used for capturing request/response details.
   * @param target - The target server URL to forward the requests to.
   */
  constructor(request: Request, tracer: Tracer | Tracer[], target: string) {
    this.proxy = httpProxy.createProxyServer({});
    this.request = request;
    this.target = target;
    this.headers = request.headers;
    this.method = request.method.toUpperCase();
    this.path = request.url.pathname || "";
    this.body = "";

    // Only capture the body for POST and PUT requests
    if (this.method === "POST" || this.method === "PUT") {
      switch (typeof this.request.payload) {
        case "string":
          this.body = this.request.payload;
          break;
        case "object":
          if (this.request.payload instanceof Readable) {
            this.body = this.request.payload;
          } else if (this.request.payload instanceof Buffer) {
            this.body = this.request.payload.toString();
          } else {
            this.body = JSON.stringify(this.request.payload);
          }
          break;
        case "undefined":
          break;
        default:
          throw new Error("Unsupported payload type");
      }
    }

    this.setupProxyEvents(tracer);
  }

  /**
   * Sets up event listeners for the proxy server.
   * @param tracer - The tracer or an array of tracers to be used for capturing request/response details.
   */
  private setupProxyEvents(tracer: Tracer | Tracer[]): void {
    this.proxy.on("proxyReq", (proxyReq, req, res) => {
      const responseDetails: ResponseDetails = {
        statusCode: undefined,
        statusMessage: undefined,
        timings: {
          startTime: performance.now(),
        },
      };

      proxyReq.on("response", (proxyRes) => {
        responseDetails.statusCode = proxyRes.statusCode;
        responseDetails.statusMessage = proxyRes.statusMessage;

        if (Array.isArray(tracer)) {
          tracer.forEach((t) => t.onFirstByteReceived(req, proxyRes, responseDetails));
        } else {
          tracer.onFirstByteReceived(req, proxyRes, responseDetails);
        }

        // Add custom header
        res.setHeader("X-Proxy-Server", "true");

        // Error handling for the response
        if ((proxyRes?.statusCode ?? 700) >= 400) {
          res.setHeader('Content-Type', 'text/plain');
          res.end(`Error Occurred: proxyRes.statusCode: ${proxyRes.statusCode}`);
        } else {
          proxyRes.pipe(res);
        }

        // Capture response code, message, and timings
        proxyRes.on("end", () => {
          if (Array.isArray(tracer)) {
            tracer.forEach((t) => t.onEnd(req, proxyRes, responseDetails));
          } else {
            tracer.onEnd(req, proxyRes, responseDetails);
          }
        });

        proxyRes.on("close", () => {
          if (Array.isArray(tracer)) {
            tracer.forEach((t) => t.onClose(req, proxyRes, responseDetails));
          } else {
            tracer.onClose(req, proxyRes, responseDetails);
          }
        });
      });
    });

    // Handle proxy errors
    this.proxy.on('error', (err, req, res) => {
      if (res instanceof http.ServerResponse) {
        res.writeHead(500, {
          'Content-Type': 'text/plain'
        });
        res.end('Something went wrong. And we are reporting a custom error message.');
      } else if (res instanceof net.Socket) {
        res.end();
      }
    });
  }

  /**
   * Dispatches the HTTP request to the target server.
   * @param options - Additional options to be passed to the http-proxy server.
   */
  public dispatch(options: httpProxy.ServerOptions = {}): void {
    const req = this.request.raw.req;
    const res = this.request.raw.res;

    const defaultOptions = {
      target: this.target,
      headers: this.headers,
      method: this.method,
      path: this.path,
    };

    const proxyOptions = { ...defaultOptions, ...options };

    if (this.body && (this.method === "POST" || this.method === "PUT")) {
      let bodyStream;

      if (this.body instanceof Readable) {
        bodyStream = this.body;
      } else {
        bodyStream = streamify({ readable: true, writable: false });
        bodyStream.push(
          typeof this.body === "string" ? this.body : JSON.stringify(this.body)
        );
        bodyStream.push(null); // Signifies end of stream
      }

      proxyOptions.buffer = bodyStream;
    }

    this.proxy.web(req, res, proxyOptions);
  }
}
