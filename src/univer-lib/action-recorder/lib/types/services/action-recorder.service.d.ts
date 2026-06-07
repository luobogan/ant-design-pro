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
import type { ICommand, ICommandInfo } from '@univerjs/core';
import { Disposable, ICommandService, ILogService, IUniverInstanceService } from '@univerjs/core';
import { ILocalFileService } from '@univerjs/ui';
/**
 * This service is for recording commands. What commands should be recorded can be configured by other
 * plugins.
 */
export declare class ActionRecorderService extends Disposable {
    private readonly _commandSrv;
    private readonly _logService;
    private readonly _localFileService;
    private readonly _instanceService;
    private readonly _shouldRecordCommands;
    private readonly _panelOpened$;
    readonly panelOpened$: import("rxjs").Observable<boolean>;
    private _recorder;
    private readonly _recording$;
    readonly recording$: import("rxjs").Observable<boolean>;
    get recording(): boolean;
    private _recorded$;
    private get _recorded();
    private _recordedCommands$;
    readonly recordedCommands$: import("rxjs").Observable<ICommandInfo<object>[]>;
    private get _recordedCommands();
    constructor(_commandSrv: ICommandService, _logService: ILogService, _localFileService: ILocalFileService, _instanceService: IUniverInstanceService);
    registerRecordedCommand(command: ICommand): void;
    togglePanel(visible: boolean): void;
    startRecording(replaceId?: boolean): void;
    stopRecording(): void;
    completeRecording(): void;
}
