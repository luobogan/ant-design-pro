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
import { Injector } from '@univerjs/core';
import { Scene, Slide } from '@univerjs/engine-render';
import { PageElementType } from '../../../types/interfaces/i-slide-data';
import { ObjectAdaptor } from '../adaptor';
export declare enum SLIDE_VIEW_KEY {
    MAIN = "__SLIDERender__",
    SCENE_VIEWER = "__SLIDEViewer__",
    SCENE = "__SLIDEScene__",
    VIEWPORT = "__SLIDEViewPort_"
}
export declare class SlideAdaptor extends ObjectAdaptor {
    private _injector;
    zIndex: number;
    viewKey: PageElementType;
    private _ObjectProvider;
    constructor(_injector: Injector);
    check(type: PageElementType): this | undefined;
    convert(pageElement: IPageElement, mainScene: Scene): Slide | undefined;
    private _createScene;
    private _addBackgroundRect;
}
export declare class SlideAdaptorFactory {
    readonly zIndex = 6;
    create(injector: Injector): SlideAdaptor;
}
