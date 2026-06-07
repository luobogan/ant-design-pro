/**
 * Copyright 2023-present DreamNum Co., Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import type { defineComponent } from 'vue';
import { Injector, Plugin } from '@univerjs/core';
import { ComponentManager } from '@univerjs/ui';
/**
 * The plugin that allows Univer to use Vue 3 components as UI components.
 */
export declare class UniverVue3AdapterPlugin extends Plugin {
    private readonly _config;
    protected readonly _injector: Injector;
    protected readonly _componentManager: ComponentManager;
    static pluginName: string;
    static packageName: string;
    static version: string;
    constructor(_config: {} | undefined, _injector: Injector, _componentManager: ComponentManager);
    onStarting(): void;
}
export declare function VueComponentWrapper(options: {
    component: ReturnType<typeof defineComponent>;
    props: Record<string, unknown>;
    reactUtils: typeof ComponentManager.prototype.reactUtils;
}): import("react").DetailedReactHTMLElement<import("react").HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
