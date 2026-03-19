import React, { LazyExoticComponent, ComponentType } from 'react';
import type { ComponentInfo, ComponentSource } from '@/types/menu';

class ComponentRegistry {
  private registry: Map<string, ComponentInfo> = new Map();

  private bundledComponents: Map<string, LazyExoticComponent<ComponentType<any>>> = new Map();

  registerBundled(path: string, component: LazyExoticComponent<ComponentType<any>>): void {
    this.bundledComponents.set(path, component);
    this.registry.set(path, {
      component,
      source: 'bundled',
      loadedAt: Date.now(),
    });
  }

  registerRemote(path: string, component: ComponentType<any>, url: string): void {
    this.registry.set(path, {
      component,
      source: 'remote',
      url,
      loadedAt: Date.now(),
    });
  }

  get(path: string): ComponentType<any> | null {
    const info = this.registry.get(path);
    if (info) {
      return info.component as ComponentType<any>;
    }
    return null;
  }

  has(path: string): boolean {
    return this.registry.has(path);
  }

  getSource(path: string): ComponentSource | null {
    const info = this.registry.get(path);
    return info ? info.source : null;
  }

  getBundledComponent(path: string): LazyExoticComponent<ComponentType<any>> | null {
    return this.bundledComponents.get(path) || null;
  }

  getAllRegisteredPaths(): string[] {
    return Array.from(this.registry.keys());
  }

  clear(): void {
    this.registry.clear();
  }

  preload(paths: string[]): Promise<void> {
    const promises = paths.map((path) => {
      const bundled = this.bundledComponents.get(path);
      if (bundled) {
        return bundled();
      }
      return Promise.resolve();
    });
    return Promise.all(promises).then(() => undefined);
  }
}

export const componentRegistry = new ComponentRegistry();

export function registerBundledComponents(): void {
  const mappedPaths: Record<string, () => any> = {
  };

  Object.entries(mappedPaths).forEach(([path, importFn]) => {
    const lazyComponent = React.lazy(importFn as any);
    componentRegistry.registerBundled(path, lazyComponent);
  });
}

export default componentRegistry;
