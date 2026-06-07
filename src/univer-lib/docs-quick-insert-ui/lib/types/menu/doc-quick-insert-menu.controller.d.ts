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
import type { DocumentDataModel, INeedCheckDisposable, Nullable } from '@univerjs/core';
import type { IRenderContext, IRenderModule } from '@univerjs/engine-render';
import { Disposable } from '@univerjs/core';
import { DocCanvasPopManagerService, DocEventManagerService } from '@univerjs/docs-ui';
import { DocQuickInsertPopupService } from '../services/doc-quick-insert-popup.service';
export declare class DocQuickInsertMenuController extends Disposable implements IRenderModule {
    private _context;
    private _docEventManagerService;
    private _docQuickInsertPopupService;
    private _docCanvasPopManagerService;
    private _popup$;
    readonly popup$: import("rxjs").Observable<Nullable<{
        startIndex: number;
        disposable: INeedCheckDisposable;
    }>>;
    get popup(): Nullable<{
        startIndex: number;
        disposable: INeedCheckDisposable;
    }>;
    constructor(_context: IRenderContext<DocumentDataModel>, _docEventManagerService: DocEventManagerService, _docQuickInsertPopupService: DocQuickInsertPopupService, _docCanvasPopManagerService: DocCanvasPopManagerService);
    private _init;
    private _hideMenu;
}
