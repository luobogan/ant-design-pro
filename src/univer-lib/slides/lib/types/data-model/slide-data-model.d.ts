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
import type { Nullable } from '@univerjs/core';
import type { Observable } from 'rxjs';
import type { ISlideData, ISlidePage } from '../types/interfaces/i-slide-data';
import { UnitModel, UniverInstanceType } from '@univerjs/core';
import { PageType } from '../types/interfaces/i-slide-data';
export declare class SlideDataModel extends UnitModel<ISlideData, UniverInstanceType.UNIVER_SLIDE> {
    type: UniverInstanceType.UNIVER_SLIDE;
    private readonly _activePage$;
    private get _activePage();
    readonly activePage$: Observable<Nullable<ISlidePage>>;
    private readonly _name$;
    name$: Observable<string>;
    private _snapshot;
    private _unitId;
    constructor(snapshot: Partial<ISlideData>);
    setName(name: string): void;
    getRev(): number;
    incrementRev(): void;
    setRev(_rev: number): void;
    getSnapshot(): ISlideData;
    getUnitId(): string;
    getPages(): {
        [id: string]: ISlidePage;
    } | undefined;
    getPageOrder(): string[] | undefined;
    getPage(pageId: string): ISlidePage | undefined;
    getElementsByPage(pageId: string): {
        [elementId: string]: import("..").IPageElement;
    } | undefined;
    getElement(pageId: string, elementId: string): import("..").IPageElement | undefined;
    getPageSize(): import("@univerjs/core").ISize;
    getBlankPage(): {
        id: string;
        pageType: PageType;
        zIndex: number;
        title: string;
        description: string;
        pageBackgroundFill: {
            rgb: string;
        };
        pageElements: {};
    };
    setActivePage(page: Nullable<ISlidePage>): void;
    getActivePage(): Nullable<ISlidePage>;
    updatePage(pageId: string, page: ISlidePage): void;
    appendPage(page: ISlidePage): void;
}
