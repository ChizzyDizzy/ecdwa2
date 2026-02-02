/**
 * Mock server setup for testing HTTP requests
 */

import http from 'http';
import { AddressInfo } from 'net';

export class MockServer {
  private server: http.Server | null = null;
  private handlers: Map<string, (req: http.IncomingMessage, res: http.ServerResponse) => void> = new Map();
  private port: number = 0;

  /**
   * Register a mock endpoint
   */
  on(path: string, handler: (req: http.IncomingMessage, res: http.ServerResponse) => void) {
    this.handlers.set(path, handler);
  }

  /**
   * Mock a GET request
   */
  get(path: string, responseData: any, statusCode: number = 200) {
    this.on(path, (req, res) => {
      if (req.method === 'GET') {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(responseData));
      }
    });
  }

  /**
   * Mock a POST request
   */
  post(path: string, responseData: any, statusCode: number = 200) {
    this.on(path, (req, res) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk.toString();
        });
        req.on('end', () => {
          res.writeHead(statusCode, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(responseData));
        });
      }
    });
  }

  /**
   * Mock a PUT request
   */
  put(path: string, responseData: any, statusCode: number = 200) {
    this.on(path, (req, res) => {
      if (req.method === 'PUT') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk.toString();
        });
        req.on('end', () => {
          res.writeHead(statusCode, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(responseData));
        });
      }
    });
  }

  /**
   * Mock a DELETE request
   */
  delete(path: string, responseData: any, statusCode: number = 200) {
    this.on(path, (req, res) => {
      if (req.method === 'DELETE') {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(responseData));
      }
    });
  }

  /**
   * Start the mock server
   */
  async start(port?: number): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const url = req.url || '/';
        const handler = this.handlers.get(url);

        if (handler) {
          handler(req, res);
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not Found' }));
        }
      });

      this.server.listen(port || 0, () => {
        const address = this.server!.address() as AddressInfo;
        this.port = address.port;
        resolve(this.port);
      });

      this.server.on('error', reject);
    });
  }

  /**
   * Stop the mock server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err) => {
          if (err) {
            reject(err);
          } else {
            this.server = null;
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get the server port
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Get the server URL
   */
  getUrl(): string {
    return `http://localhost:${this.port}`;
  }

  /**
   * Clear all handlers
   */
  clearHandlers() {
    this.handlers.clear();
  }

  /**
   * Reset the server (clear handlers and restart)
   */
  async reset() {
    this.clearHandlers();
  }
}

/**
 * Create a new mock server instance
 */
export const createMockServer = () => new MockServer();

/**
 * Mock fetch globally
 */
export const mockFetch = (responses: Map<string, any>) => {
  global.fetch = jest.fn((url: string, options?: any) => {
    const response = responses.get(url);
    if (response) {
      return Promise.resolve({
        ok: response.ok !== false,
        status: response.status || 200,
        json: () => Promise.resolve(response.data),
        text: () => Promise.resolve(JSON.stringify(response.data)),
      } as Response);
    }
    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not Found' }),
      text: () => Promise.resolve('Not Found'),
    } as Response);
  }) as jest.Mock;
};

/**
 * Restore fetch
 */
export const restoreFetch = () => {
  if (global.fetch && (global.fetch as any).mockRestore) {
    (global.fetch as any).mockRestore();
  }
};
