import React, { ComponentType } from 'react';
import type { RemoteComponentConfig } from '@/types/menu';

declare global {
  interface Window {
    __REMOTE_COMPONENTS__?: Record<string, any>;
  }
}

class RemoteComponentLoader {
  private loadedScripts: Map<string, Promise<any>> = new Map();

  private scriptCache: Map<string, any> = new Map();

  async load(config: RemoteComponentConfig): Promise<ComponentType<any>> {
    const cacheKey = `${config.name}-${config.url}`;

    const cached = this.scriptCache.get(cacheKey);
    if (cached) {
      console.log(`[RemoteLoader] Using cached component: ${config.name}`);
      return cached as ComponentType<any>;
    }

    const existingPromise = this.loadedScripts.get(cacheKey);
    if (existingPromise) {
      console.log(`[RemoteLoader] Waiting for existing load: ${config.name}`);
      return existingPromise as Promise<ComponentType<any>>;
    }

    const loadPromise = this.doLoad(config, cacheKey);
    this.loadedScripts.set(cacheKey, loadPromise);

    try {
      const component = await loadPromise;
      this.scriptCache.set(cacheKey, component);
      return component as ComponentType<any>;
    } finally {
      this.loadedScripts.delete(cacheKey);
    }
  }

  private async doLoad(config: RemoteComponentConfig, cacheKey: string): Promise<ComponentType<any>> {
    console.log(`[RemoteLoader] Loading component: ${config.name} from ${config.url}`);

    try {
      const response = await fetch(config.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      let scriptContent = await response.text();

      if (config.md5) {
        const isValid = await this.verifyMD5(scriptContent, config.md5);
        if (!isValid) {
          throw new Error(`MD5 verification failed for component: ${config.name}`);
        }
        console.log(`[RemoteLoader] MD5 verified for: ${config.name}`);
      }

      const scope = config.scope || config.name;
      const component = await this.executeScript(scriptContent, scope);
      console.log(`[RemoteLoader] Successfully loaded: ${config.name}`);
      return component;
    } catch (error) {
      console.error(`[RemoteLoader] Failed to load ${config.name}:`, error);
      throw error;
    }
  }

  private async verifyMD5(content: string, expectedMD5: string): Promise<boolean> {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const hashBuffer = await crypto.subtle.digest('MD5', data.buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        return hashHex === expectedMD5;
      } catch {
        console.warn('[RemoteLoader] MD5 verification not supported, skipping');
        return true;
      }
    }
    console.warn('[RemoteLoader] Web Crypto API not available, skipping MD5 verification');
    return true;
  }

  private executeScript(scriptContent: string, scope: string): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        if (!window.__REMOTE_COMPONENTS__) {
          window.__REMOTE_COMPONENTS__ = {};
        }

        const moduleExec = new Function('scope', 'window', `
          "use strict";
          try {
            const module = { exports: {} };
            const exports = module.exports;
            ${scriptContent}
            if (module.exports && module.exports.__esModule) {
              const exportKeys = Object.keys(module.exports);
              if (exportKeys.length === 1 && exportKeys[0] === 'default') {
                window.__REMOTE_COMPONENTS__[scope] = module.exports.default;
              } else {
                window.__REMOTE_COMPONENTS__[scope] = module.exports;
              }
            } else {
              window.__REMOTE_COMPONENTS__[scope] = module.exports || module;
            }
            return true;
          } catch (e) {
            console.error('Script execution error:', e);
            throw e;
          }
        `);

        const success = moduleExec(scope, window);

        if (success && window.__REMOTE_COMPONENTS__[scope]) {
          resolve(window.__REMOTE_COMPONENTS__[scope]);
        } else {
          reject(new Error(`Component ${scope} not found after execution`));
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  preload(configs: RemoteComponentConfig[]): Promise<void> {
    const promises = configs.map((config) =>
      this.load(config).catch((error) => {
        console.warn(`[RemoteLoader] Preload failed for ${config.name}:`, error);
        return null;
      })
    );
    return Promise.all(promises).then(() => undefined);
  }

  clearCache(): void {
    this.scriptCache.clear();
    this.loadedScripts.clear();
    console.log('[RemoteLoader] Cache cleared');
  }

  isLoaded(name: string): boolean {
    return this.scriptCache.has(name);
  }

  getLoadedComponents(): string[] {
    return Array.from(this.scriptCache.keys());
  }
}

export const remoteComponentLoader = new RemoteComponentLoader();

export default RemoteComponentLoader;
