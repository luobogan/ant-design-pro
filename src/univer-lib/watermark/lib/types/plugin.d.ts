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
import type { IUniverWatermarkConfig } from './config/config';
import { IConfigService, ILocalStorageService, Injector, Plugin } from '@univerjs/core';
import { IRenderManagerService } from '@univerjs/engine-render';
export declare class UniverWatermarkPlugin extends Plugin {
    private readonly _config;
    protected _injector: Injector;
    private readonly _configService;
    private readonly _renderManagerSrv;
    private readonly _localStorageService;
    static pluginName: string;
    static packageName: string;
    static version: string;
    constructor(_config: Partial<IUniverWatermarkConfig> | undefined, _injector: Injector, _configService: IConfigService, _renderManagerSrv: IRenderManagerService, _localStorageService: ILocalStorageService);
    private _initWatermarkStorage;
    private _initDependencies;
    onRendered(): void;
    private _initRenderDependencies;
}
