import * as Hapi from '@hapi/hapi';
import { ConsoleTracer } from './tracer/ConsoleTracer';
import { ProxyServer } from './proxy/ProxyServer';
import { ZipkinTracerImpl } from './tracer/ZipkinTracer';

async function startServers() {
  const s1 = new Hapi.Server({
    port: 3300,
    host: '0.0.0.0'
  });

  const s2 = new Hapi.Server({
    port: 4400,
    host: '0.0.0.0'
  });

  s1.route({
    method: 'GET',
    path: '/',
    handler: (req, h) => {
      return 'S1 Hello World!';
    }
  });

  s1.route({
    method: '*',
    path: '/{path*}',
    handler: (req, h) => {
        const consoleTracer = new ConsoleTracer();
        const zipkinTracer = new ZipkinTracerImpl();
        const target = `http://127.0.0.1:4400/${req.url.pathname}`;
        const proxyServer = new ProxyServer(req, [zipkinTracer, consoleTracer], target);
        proxyServer.dispatch({
          headers: req.headers,
          selfHandleResponse: true,
          cookieDomainRewrite: false,
          cookiePathRewrite: false,
          proxyTimeout: 6000,
          timeout: 2000,
          followRedirects: true,
        })
        // this.proxy.web(req.raw.req, req.raw.res, { target });
        return h.abandon;
    }
  });

  s2.route({
    method: 'GET',
    path: '/{path*}',
    handler: (req, h) => {
      return `S2 Hello World! PATH: ${req.params.path}`;
    }
  });

  await s1.start();
  console.log('Server 1 running on %s', s1.info.uri);

  await s2.start();
  console.log('Server 2 running on %s', s2.info.uri);

}

startServers();
