import React, { type ComponentType, type LazyExoticComponent } from 'react';
import { menuCacheManager } from './CacheManager';
import {
  componentRegistry,
  registerBundledComponents,
} from './ComponentRegistry';
import { remoteComponentLoader } from './RemoteLoader';

export interface DynamicComponentResult {
  component:
    | ComponentType<any>
    | LazyExoticComponent<ComponentType<any>>
    | null;
  source: 'bundled' | 'remote' | 'bundled-legacy' | null;
  error?: string;
}

class DynamicLoader {
  private initialized = false;

  private remoteComponentUrls: Map<string, string> = new Map();

  initialize(): void {
    if (this.initialized) {
      return;
    }
    console.log('[DynamicLoader] Initializing...');
    registerBundledComponents();
    this.initialized = true;
    console.log('[DynamicLoader] Initialized successfully');
  }

  setRemoteComponentUrls(urls: Record<string, string>): void {
    Object.entries(urls).forEach(([name, url]) => {
      this.remoteComponentUrls.set(name, url);
    });
    console.log(
      '[DynamicLoader] Remote component URLs set:',
      this.remoteComponentUrls.size,
    );
  }

  async getComponent(componentPath: string): Promise<DynamicComponentResult> {
    if (!componentPath) {
      return {
        component: null,
        source: null,
        error: 'No component path provided',
      };
    }

    const bundled = componentRegistry.getBundledComponent(componentPath);
    if (bundled) {
      return { component: bundled, source: 'bundled' };
    }

    const direct = componentRegistry.get(componentPath);
    if (direct) {
      return { component: direct, source: 'bundled-legacy' };
    }

    const remoteName = this.findRemoteComponentName(componentPath);
    if (remoteName && this.remoteComponentUrls.has(remoteName)) {
      try {
        const remoteUrl = this.remoteComponentUrls.get(remoteName)!;
        const component = await remoteComponentLoader.load({
          name: remoteName,
          url: remoteUrl,
        });
        return { component, source: 'remote' };
      } catch (error) {
        console.error(
          `[DynamicLoader] Failed to load remote component: ${remoteName}`,
          error,
        );
        return {
          component: null,
          source: 'remote',
          error: `Failed to load remote component: ${remoteName}`,
        };
      }
    }

    return {
      component: null,
      source: null,
      error: `Component not found: ${componentPath}`,
    };
  }

  private findRemoteComponentName(componentPath: string): string | null {
    for (const [name, _url] of this.remoteComponentUrls) {
      if (componentPath.includes(name)) {
        return name;
      }
    }
    return null;
  }

  hasComponent(componentPath: string): boolean {
    return (
      componentRegistry.has(componentPath) ||
      this.findRemoteComponentName(componentPath) !== null
    );
  }

  getSource(componentPath: string): 'bundled' | 'remote' | null {
    if (componentRegistry.has(componentPath)) {
      const info = componentRegistry.getSource(componentPath);
      return info as 'bundled' | 'remote' | null;
    }
    return this.findRemoteComponentName(componentPath) ? 'remote' : null;
  }

  async preloadComponents(paths: string[]): Promise<void> {
    await componentRegistry.preload(paths);
  }

  clearCache(): void {
    menuCacheManager.invalidateCache();
    remoteComponentLoader.clearCache();
    console.log('[DynamicLoader] All caches cleared');
  }

  getCacheStatus() {
    return menuCacheManager.getCacheStatus();
  }
}

export const dynamicLoader = new DynamicLoader();

export {
  componentRegistry,
  menuCacheManager,
  registerBundledComponents,
  remoteComponentLoader,
};

export default DynamicLoader;
