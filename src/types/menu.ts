import React, { LazyExoticComponent, ComponentType } from 'react';

export interface MenuDTO {
  id: number;
  name: string;
  path: string;
  component?: string;
  icon?: string;
  parentId?: number;
  orderNum?: number;
  isOpen?: number;
  permissions?: string[];
  children?: MenuDTO[];
}

export interface MenuRouteItem {
  path: string;
  name?: string;
  icon?: string;
  id?: number | string;
  parentId?: number | string;
  element?: React.ReactNode;
  children?: MenuRouteItem[];
  component?: string;
  isOpen?: number;
  permissions?: string[];
}

export type ComponentSource = 'bundled' | 'remote';

export interface ComponentInfo {
  component: LazyExoticComponent<ComponentType<any>> | ComponentType<any>;
  source: ComponentSource;
  url?: string;
  loadedAt: number;
}

export interface BundledComponentMap {
  [path: string]: string;
}

export interface RemoteComponentMap {
  [name: string]: string;
}

export interface ComponentMapResponse {
  bundled: BundledComponentMap;
  remote: RemoteComponentMap;
  version: string;
}

export interface RemoteComponentConfig {
  name: string;
  url: string;
  md5?: string;
  scope?: string;
}

export interface CacheConfig {
  memoryTTL: number;
  localTTL: number;
  versionCheck: boolean;
}

export interface MenuCacheData {
  data: MenuDTO[];
  version: string;
  timestamp: number;
}

export interface MenuPermission {
  path: string;
  permissions: string[];
}

export interface APIResponse<T = any> {
  code: number;
  msg: string;
  data: T;
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  memoryTTL: 5 * 60 * 1000,
  localTTL: 30 * 60 * 1000,
  versionCheck: true,
};

export const CACHE_KEYS = {
  MENU_CACHE: 'blade-menu-cache',
  COMPONENT_MAP: 'blade-component-map',
  MENU_VERSION: 'blade-menu-version',
} as const;
