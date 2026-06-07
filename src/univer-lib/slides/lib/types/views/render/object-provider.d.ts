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
import type { BaseObject, Scene } from '@univerjs/engine-render';
import type { IPageElement } from '../../types/interfaces/i-slide-data';
import { Injector } from '@univerjs/core';
import './adaptors';
export declare class ObjectProvider {
    private readonly _injector;
    private _adaptors;
    constructor(_injector: Injector);
    convertToRenderObjects(pageElements: {
        [elementId: string]: IPageElement;
    }, mainScene: Scene): BaseObject[];
    convertToRenderObject(pageElement: IPageElement, mainScene: Scene): BaseObject | undefined;
    private _executor;
    private _adaptorLoader;
}
