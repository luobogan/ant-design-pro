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
import type { Engine } from '@univerjs/engine-render';
import { IConfigService, Injector, IUniverInstanceService, Plugin, UniverInstanceType } from '@univerjs/core';
export interface IUniverSlidesConfig {
}
export declare class UniverSlidesPlugin extends Plugin {
    private readonly _config;
    readonly _injector: Injector;
    private readonly _configService;
    private readonly _univerInstanceService;
    static pluginName: string;
    static packageName: string;
    static version: string;
    static type: UniverInstanceType;
    private _canvasEngine;
    constructor(_config: Partial<IUniverSlidesConfig> | undefined, _injector: Injector, _configService: IConfigService, _univerInstanceService: IUniverInstanceService);
    onStarting(): void;
    initialize(): void;
    onReady(): void;
    getConfig(): Partial<IUniverSlidesConfig>;
    initCanvasEngine(): void;
    onRendered(): void;
    getCanvasEngine(): Engine | null;
    private _initializeDependencies;
}
