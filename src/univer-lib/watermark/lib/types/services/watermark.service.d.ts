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
import type { IWatermarkConfigWithType } from '@univerjs/engine-render';
import { Disposable, ILocalStorageService } from '@univerjs/core';
export declare class WatermarkService extends Disposable {
    private _localStorageService;
    private readonly _updateConfig$;
    readonly updateConfig$: import("rxjs").Observable<Nullable<IWatermarkConfigWithType>>;
    private readonly _refresh$;
    readonly refresh$: import("rxjs").Observable<number>;
    constructor(_localStorageService: ILocalStorageService);
    getWatermarkConfig(): Promise<IWatermarkConfigWithType | null>;
    updateWatermarkConfig(config: IWatermarkConfigWithType): void;
    deleteWatermarkConfig(): void;
    refresh(): void;
    dispose(): void;
}
