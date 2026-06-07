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
import type { IPageElement } from '../../../types/interfaces/i-slide-data';
import { IConfigService, IContextService, Injector, LocaleService } from '@univerjs/core';
import { Scene, SceneViewer } from '@univerjs/engine-render';
import { PageElementType } from '../../../types/interfaces/i-slide-data';
import { ObjectAdaptor } from '../adaptor';
export declare class SpreadsheetAdaptor extends ObjectAdaptor {
    private readonly _localeService;
    private readonly _contextService;
    private readonly _configService;
    private readonly _injector;
    zIndex: number;
    viewKey: PageElementType;
    constructor(_localeService: LocaleService, _contextService: IContextService, _configService: IConfigService, _injector: Injector);
    check(type: PageElementType): this | undefined;
    convert(pageElement: IPageElement, mainScene: Scene): SceneViewer | undefined;
    private _updateViewport;
}
export declare class SpreadsheetAdaptorFactory {
    readonly zIndex = 4;
    create(injector: Injector): SpreadsheetAdaptor;
}
