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
import type { Injector } from '@univerjs/core';
import type { IPageElement } from '../../../types/interfaces/i-slide-data';
import { LocaleService } from '@univerjs/core';
import { Scene, SceneViewer } from '@univerjs/engine-render';
import { PageElementType } from '../../../types/interfaces/i-slide-data';
import { ObjectAdaptor } from '../adaptor';
export declare enum DOCS_VIEW_KEY {
    MAIN = "__DocsRender__",
    SCENE_VIEWER = "__DocsViewer__",
    SCENE = "__DocsScene__",
    VIEWPORT = "__DocsViewPort_"
}
export declare class DocsAdaptor extends ObjectAdaptor {
    private readonly _localeService;
    zIndex: number;
    viewKey: PageElementType;
    private _liquid;
    constructor(_localeService: LocaleService);
    check(type: PageElementType): this | undefined;
    convert(pageElement: IPageElement, mainScene: Scene): SceneViewer | undefined;
    private _recalculateSizeBySkeleton;
    private _calculatePagePosition;
}
export declare class DocsAdaptorFactory {
    readonly zIndex = 5;
    create(injector: Injector): DocsAdaptor;
}
