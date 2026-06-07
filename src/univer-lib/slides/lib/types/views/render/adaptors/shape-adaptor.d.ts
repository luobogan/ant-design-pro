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
import { Circle, Rect } from '@univerjs/engine-render';
import { PageElementType } from '../../../types/interfaces/i-slide-data';
import { ObjectAdaptor } from '../adaptor';
export declare class ShapeAdaptor extends ObjectAdaptor {
    zIndex: number;
    viewKey: PageElementType;
    check(type: PageElementType): this | undefined;
    convert(pageElement: IPageElement): Circle | Rect<{
        fill: string;
        top: number;
        left: number;
        width: number | undefined;
        height: number | undefined;
        zIndex: number;
        angle: number | undefined;
        scaleX: number | undefined;
        scaleY: number | undefined;
        skewX: number | undefined;
        skewY: number | undefined;
        flipX: boolean | undefined;
        flipY: boolean | undefined;
        forceRender: true;
    }> | undefined;
}
export declare class ShapeAdaptorFactory {
    readonly zIndex = 2;
    create(injector: Injector): ShapeAdaptor;
}
