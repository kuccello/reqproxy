# Hapi Proxy Server with Tracing


## License
This project is licensed under the MIT License.

## Author
kuccello@gmail.com


## Description

This project implements a proxy server using Hapi.js that forwards HTTP requests to a target server. It includes support for tracing HTTP requests and responses using both ConsoleTracer and ZipkinTracer.

## Features

- Proxy HTTP requests to a target server
- Support for HTTP streaming responses
- Hapi request passthrough to the target endpoint while preserving the original request path
- Composition via dependency injection of multiple tracers
- Tracers can hook into the events of the `http-proxy` library for detailed tracing
- Idempotent per request and prevents potential cross-wire issues
- Custom error handling for proxy failures

## Project Structure

```
/project-root
│
├── /src
│ ├── /proxy
│ │ └── ProxyServer.ts
│ ├── /streaming
│ │ └── streamify.ts
│ ├── /tracer
│ │ ├── ConsoleTracer.ts
│ │ ├── ZipkinTracer.ts
│ │ └── types.ts
│ └── main.ts
├── package.json
└── README.md
```


## Installation

1. Clone the repository:

    ```bash
    git clone https://github.com/your-repo/hapi-proxy-server.git
    cd hapi-proxy-server
    ```

2. Install the dependencies:

    ```bash
    npm install
    ```

## Usage

1. Start the servers:

    ```bash
    npm start
    ```

2. The proxy server runs on port `3300`, and the target server runs on port `4400`.

## Code Overview

### `main.ts`

This is the entry point of the application. It sets up two Hapi servers:

- **Server 1**: Listens on port `3300` and acts as the proxy server.
- **Server 2**: Listens on port `4400` and acts as the target server.

Example routes are configured to demonstrate the proxy functionality.

### `ProxyServer.ts`

This class handles the proxying of requests and integrates tracers to capture request and response details.

**Constructor Parameters:**
- `request`: The incoming HTTP request to be proxied.
- `tracer`: An instance or array of tracer instances for capturing request/response details.
- `target`: The target server URL to forward the requests to.

**Methods:**
- `setupProxyEvents(tracer)`: Sets up event listeners for the proxy server to capture request and response details.
- `dispatch(options)`: Dispatches the HTTP request to the target server with additional options.

### `streamify.ts`

This utility helps convert request payloads into readable streams for proxying.

### `ConsoleTracer.ts`

A simple tracer implementation that logs request and response details to the console.

### `ZipkinTracer.ts`

An advanced tracer implementation that sends tracing data to a Zipkin server for distributed tracing.

### `types.ts`

Defines the `Tracer` interface and `ResponseDetails` type used by the tracer implementations.

## Environment Variables

Ensure the following environment variables are set:

- `ZIPKIN_SERVER_URL`: The URL of the Zipkin server.

## Example Request

Send a request to the proxy server:

```bash
curl http://localhost:3300/your-endpoint
```

The request will be proxied to:

```
http://127.0.0.1:4400/your-endpoint
```

