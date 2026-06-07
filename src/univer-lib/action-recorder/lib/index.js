import { CommandType, Disposable, ICommandService, IConfigService, ILogService, IUniverInstanceService, Inject, Injector, Plugin, awaitTime, merge } from "@univerjs/core";
import { RecordIcon } from "@univerjs/icons";
import { AddWorksheetMergeAllCommand, AddWorksheetMergeCommand, AddWorksheetMergeHorizontalCommand, AddWorksheetMergeVerticalCommand, AutoFillCommand, CancelFrozenCommand, CopySheetCommand, DeleteRangeMoveLeftCommand, DeleteRangeMoveUpCommand, DeltaColumnWidthCommand, DeltaRowHeightCommand, InsertColAfterCommand, InsertColBeforeCommand, InsertRowAfterCommand, InsertRowBeforeCommand, InsertSheetCommand, RefillCommand, RemoveSheetCommand, SetFrozenCommand, SetHorizontalTextAlignCommand, SetOverlineCommand, SetRangeValuesCommand, SetSelectionsOperation, SetStrikeThroughCommand, SetStyleCommand, SetTextColorCommand, SetTextRotationCommand, SetTextWrapCommand, SetVerticalTextAlignCommand, SetWorksheetActivateCommand, SetWorksheetActiveOperation } from "@univerjs/sheets";
import { RemoveSheetFilterCommand, SetSheetFilterRangeCommand, SetSheetsFilterCriteriaCommand } from "@univerjs/sheets-filter";
import { SetRangeBoldCommand, SetRangeFontFamilyCommand, SetRangeFontSizeCommand, SetRangeItalicCommand, SetRangeStrickThroughCommand, SetRangeSubscriptCommand, SetRangeSuperscriptCommand, SetRangeTextColorCommand, SetRangeUnderlineCommand, SheetCopyCommand, SheetCutCommand, SheetPasteBesidesBorderCommand, SheetPasteColWidthCommand, SheetPasteCommand, SheetPasteFormatCommand, SheetPasteShortKeyCommand, SheetPasteValueCommand } from "@univerjs/sheets-ui";
import { BuiltInUIPart, ComponentManager, ILocalFileService, IMenuManagerService, IMessageService, IUIPartsService, MenuItemType, RibbonOthersGroup, connectInjector, useDependency, useObservable } from "@univerjs/ui";
import { BehaviorSubject } from "rxjs";
import { Button, MessageType } from "@univerjs/design";
import { useCallback } from "react";
import { jsx, jsxs } from "react/jsx-runtime";

//#region package.json
var name = "@univerjs/action-recorder";
var version = "0.25.0";

//#endregion
//#region src/config/config.ts
const ACTION_RECORDER_PLUGIN_CONFIG_KEY = "action-recorder.config";
const configSymbol = Symbol(ACTION_RECORDER_PLUGIN_CONFIG_KEY);
const defaultPluginConfig = {};

//#endregion
//#region \0@oxc-project+runtime@0.133.0/helpers/esm/typeof.js
function _typeof(o) {
	"@babel/helpers - typeof";
	return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o) {
		return typeof o;
	} : function(o) {
		return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o;
	}, _typeof(o);
}

//#endregion
//#region \0@oxc-project+runtime@0.133.0/helpers/esm/toPrimitive.js
function toPrimitive(t, r) {
	if ("object" != _typeof(t) || !t) return t;
	var e = t[Symbol.toPrimitive];
	if (void 0 !== e) {
		var i = e.call(t, r || "default");
		if ("object" != _typeof(i)) return i;
		throw new TypeError("@@toPrimitive must return a primitive value.");
	}
	return ("string" === r ? String : Number)(t);
}

//#endregion
//#region \0@oxc-project+runtime@0.133.0/helpers/esm/toPropertyKey.js
function toPropertyKey(t) {
	var i = toPrimitive(t, "string");
	return "symbol" == _typeof(i) ? i : i + "";
}

//#endregion
//#region \0@oxc-project+runtime@0.133.0/helpers/esm/defineProperty.js
function _defineProperty(e, r, t) {
	return (r = toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
		value: t,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[r] = t, e;
}

//#endregion
//#region \0@oxc-project+runtime@0.133.0/helpers/esm/decorateParam.js
function __decorateParam(paramIndex, decorator) {
	return function(target, key) {
		decorator(target, key, paramIndex);
	};
}

//#endregion
//#region \0@oxc-project+runtime@0.133.0/helpers/esm/decorate.js
function __decorate(decorators, target, key, desc) {
	var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
	if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
	else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
	return c > 3 && r && Object.defineProperty(target, key, r), r;
}

//#endregion
//#region src/services/action-recorder.service.ts
let ActionRecorderService = class ActionRecorderService extends Disposable {
	get recording() {
		return this._recording$.getValue();
	}
	get _recorded() {
		return this._recorded$.getValue();
	}
	get _recordedCommands() {
		return this._recordedCommands$.getValue();
	}
	constructor(_commandSrv, _logService, _localFileService, _instanceService) {
		super();
		this._commandSrv = _commandSrv;
		this._logService = _logService;
		this._localFileService = _localFileService;
		this._instanceService = _instanceService;
		_defineProperty(this, "_shouldRecordCommands", /* @__PURE__ */ new Set());
		_defineProperty(this, "_panelOpened$", new BehaviorSubject(false));
		_defineProperty(this, "panelOpened$", this._panelOpened$.asObservable());
		_defineProperty(this, "_recorder", null);
		_defineProperty(this, "_recording$", new BehaviorSubject(false));
		_defineProperty(this, "recording$", this._recording$.asObservable());
		_defineProperty(this, "_recorded$", new BehaviorSubject([]));
		_defineProperty(this, "_recordedCommands$", new BehaviorSubject([]));
		_defineProperty(this, "recordedCommands$", this._recordedCommands$.asObservable());
	}
	registerRecordedCommand(command) {
		if (command.type === CommandType.MUTATION) throw new Error("[CommandRecorderService] Cannot record mutation commands.");
		this._shouldRecordCommands.add(command.id);
	}
	togglePanel(visible) {
		this._panelOpened$.next(visible);
		if (visible === false) this.stopRecording();
	}
	startRecording(replaceId = false) {
		this._recorder = this._commandSrv.onCommandExecuted((rawCommandInfo) => {
			if (this._shouldRecordCommands.has(rawCommandInfo.id)) {
				var _this$_instanceServic;
				const recorded = this._recorded;
				const commands = this._recordedCommands;
				let commandInfo = { ...rawCommandInfo };
				const focusUnitId = (_this$_instanceServic = this._instanceService.getFocusedUnit()) === null || _this$_instanceServic === void 0 ? void 0 : _this$_instanceServic.getUnitId();
				const { unitId = focusUnitId, subUnitId } = commandInfo === null || commandInfo === void 0 ? void 0 : commandInfo.params;
				if (replaceId && unitId && subUnitId) {
					var _getSheetBySheetId;
					const subUnitName = (_getSheetBySheetId = this._instanceService.getUnit(unitId).getSheetBySheetId(subUnitId)) === null || _getSheetBySheetId === void 0 ? void 0 : _getSheetBySheetId.getName();
					commandInfo = {
						...commandInfo,
						params: {
							...commandInfo.params,
							subUnitId: subUnitName
						}
					};
				}
				if (commandInfo.id === SetSelectionsOperation.id && recorded.length > 0 && recorded[recorded.length - 1].id === SetSelectionsOperation.id) recorded[recorded.length - 1] = commandInfo;
				else {
					recorded.push(commandInfo);
					this._recorded$.next(recorded);
					if (commandInfo.type === CommandType.COMMAND) {
						commands.push(commandInfo);
						this._recordedCommands$.next(commands);
					}
				}
			}
		});
		this._recording$.next(true);
	}
	stopRecording() {
		var _this$_recorder;
		(_this$_recorder = this._recorder) === null || _this$_recorder === void 0 || _this$_recorder.dispose();
		this._recorder = null;
		this._recorded$.next([]);
		this._recordedCommands$.next([]);
		this._recording$.next(false);
	}
	completeRecording() {
		const commands = this._recorded.slice();
		this._localFileService.downloadFile(new Blob([JSON.stringify(commands, null, 2)]), "recorded-commands.json");
		this._logService.error("Recorded commands:", commands);
		this.stopRecording();
	}
};
ActionRecorderService = __decorate([
	__decorateParam(0, ICommandService),
	__decorateParam(1, ILogService),
	__decorateParam(2, ILocalFileService),
	__decorateParam(3, IUniverInstanceService)
], ActionRecorderService);

//#endregion
//#region src/commands/commands/record.command.ts
const StartRecordingActionCommand = {
	id: "action-recorder.command.start-recording",
	type: CommandType.COMMAND,
	handler: (accessor, params) => {
		accessor.get(ActionRecorderService).startRecording(!!(params === null || params === void 0 ? void 0 : params.replaceId));
		return true;
	}
};
const CompleteRecordingActionCommand = {
	id: "action-recorder.command.complete-recording",
	type: CommandType.COMMAND,
	handler: (accessor) => {
		accessor.get(ActionRecorderService).completeRecording();
		return true;
	}
};
const StopRecordingActionCommand = {
	id: "action-recorder.command.stop-recording",
	type: CommandType.COMMAND,
	handler: (accessor) => {
		accessor.get(ActionRecorderService).completeRecording();
		return true;
	}
};

//#endregion
//#region src/services/replay.service.ts
let ActionReplayService = class ActionReplayService extends Disposable {
	constructor(_messageService, _instanceService, _localFileService, _logService, _commandService) {
		super();
		this._messageService = _messageService;
		this._instanceService = _instanceService;
		this._localFileService = _localFileService;
		this._logService = _logService;
		this._commandService = _commandService;
	}
	/**
	* Read a local file and try to replay commands in this JSON.
	*/
	async replayLocalJSON(mode = "default") {
		const files = await this._localFileService.openFile({
			multiple: false,
			accept: ".json"
		});
		if (files.length !== 1) return false;
		const file = files[0];
		try {
			return this.replayCommands(JSON.parse(await file.text()), { mode });
		} catch {
			this._messageService.show({
				type: MessageType.Error,
				content: `Failed to replay commands from local file ${file.name}.`
			});
			return false;
		}
	}
	/**
	* Replay a list of commands. Note that `unitId` of these commands would be changed to the focused unit.
	* @param commands - The commands to replay.
	* @returns If the replay is successful.
	*/
	async replayCommands(commands, options) {
		var _this$_instanceServic;
		const focusedUnitId = (_this$_instanceServic = this._instanceService.getFocusedUnit()) === null || _this$_instanceServic === void 0 ? void 0 : _this$_instanceServic.getUnitId();
		if (!focusedUnitId) this._logService.error("[ReplayService]", "no focused unit to replay commands");
		const { mode } = options || {};
		for (const command of commands) {
			const { id, params } = command;
			const commandParams = params;
			if (commandParams) {
				if (typeof commandParams.unitId !== "undefined") commandParams.unitId = focusedUnitId;
				if (mode === "name" && commandParams.subUnitId !== "undefined") {
					var _getSheetBySheetName;
					const realSubUnitId = (_getSheetBySheetName = this._instanceService.getFocusedUnit().getSheetBySheetName(commandParams.subUnitId)) === null || _getSheetBySheetName === void 0 ? void 0 : _getSheetBySheetName.getSheetId();
					if (realSubUnitId) commandParams.subUnitId = realSubUnitId;
					else this._logService.error("[ReplayService]", `failed to find subunit by subUnitName = ${commandParams.subUnitId}`);
				}
				if (mode === "active" && commandParams.subUnitId !== "undefined") {
					var _getActiveSheet;
					const realSubUnitId = (_getActiveSheet = this._instanceService.getFocusedUnit().getActiveSheet()) === null || _getActiveSheet === void 0 ? void 0 : _getActiveSheet.getSheetId();
					if (realSubUnitId) commandParams.subUnitId = realSubUnitId;
					else this._logService.error("[ReplayService]", "failed to find active subunit");
				}
				if (!await this._commandService.executeCommand(id, params)) return false;
			} else if (!await this._commandService.executeCommand(id)) return false;
		}
		return true;
	}
	/**
	* Replay a list of commands with a random delay between each command.
	* @param commands - The commands to replay.
	*/
	async replayCommandsWithDelay(commands) {
		var _this$_instanceServic2;
		const focusedUnitId = (_this$_instanceServic2 = this._instanceService.getFocusedUnit()) === null || _this$_instanceServic2 === void 0 ? void 0 : _this$_instanceServic2.getUnitId();
		if (!focusedUnitId) this._logService.error("[ReplayService]", "no focused unit to replay commands");
		for (const command of commands) {
			await awaitTime(randomBetween200And1k());
			const { id, params } = command;
			if (params) {
				if (typeof params.unitId !== "undefined") params.unitId = focusedUnitId;
				if (!await this._commandService.executeCommand(id, params)) return false;
			} else if (!await this._commandService.executeCommand(id)) return false;
		}
		return true;
	}
};
ActionReplayService = __decorate([
	__decorateParam(0, IMessageService),
	__decorateParam(1, IUniverInstanceService),
	__decorateParam(2, ILocalFileService),
	__decorateParam(3, ILogService),
	__decorateParam(4, ICommandService)
], ActionReplayService);
function randomBetween200And1k() {
	return Math.floor(Math.random() * 800) + 200;
}

//#endregion
//#region src/commands/commands/replay.command.ts
const ReplayLocalRecordCommand = {
	id: "action-recorder.command.replay-local-records",
	type: CommandType.COMMAND,
	handler: async (accessor) => {
		const result = await accessor.get(ActionReplayService).replayLocalJSON();
		if (result) accessor.get(IMessageService).show({
			type: MessageType.Success,
			content: "Successfully replayed local records"
		});
		return result;
	}
};
const ReplayLocalRecordOnNamesakeCommand = {
	id: "action-recorder.command.replay-local-records-name",
	type: CommandType.COMMAND,
	handler: async (accessor) => {
		const result = await accessor.get(ActionReplayService).replayLocalJSON("name");
		if (result) accessor.get(IMessageService).show({
			type: MessageType.Success,
			content: "Successfully replayed local records"
		});
		return result;
	}
};
const ReplayLocalRecordOnActiveCommand = {
	id: "action-recorder.command.replay-local-records-active",
	type: CommandType.COMMAND,
	handler: async (accessor) => {
		const result = await accessor.get(ActionReplayService).replayLocalJSON("active");
		if (result) accessor.get(IMessageService).show({
			type: MessageType.Success,
			content: "Successfully replayed local records"
		});
		return result;
	}
};

//#endregion
//#region src/commands/operations/operation.ts
const OpenRecordPanelOperation = {
	id: "action-recorder.operation.open-panel",
	type: CommandType.OPERATION,
	handler(accessor) {
		accessor.get(ActionRecorderService).togglePanel(true);
		return true;
	}
};
const CloseRecordPanelOperation = {
	id: "action-recorder.operation.close-panel",
	type: CommandType.OPERATION,
	handler(accessor) {
		accessor.get(ActionRecorderService).togglePanel(false);
		return true;
	}
};

//#endregion
//#region src/menu/action-recorder.menu.ts
const RECORD_MENU_ITEM_ID = "RECORD_MENU_ITEM";
function RecordMenuItemFactory() {
	return {
		id: RECORD_MENU_ITEM_ID,
		type: MenuItemType.SUBITEMS,
		icon: "RecordIcon",
		tooltip: "action-recorder.menu.title"
	};
}
function OpenRecorderMenuItemFactory(accessor) {
	const actionRecorderService = accessor.get(ActionRecorderService);
	return {
		id: OpenRecordPanelOperation.id,
		title: "action-recorder.menu.record",
		type: MenuItemType.BUTTON,
		disabled$: actionRecorderService.panelOpened$
	};
}
function ReplayLocalRecordMenuItemFactory() {
	return {
		id: ReplayLocalRecordCommand.id,
		title: "action-recorder.menu.replay-local",
		type: MenuItemType.BUTTON
	};
}
function ReplayLocalRecordOnNamesakeMenuItemFactory() {
	return {
		id: ReplayLocalRecordOnNamesakeCommand.id,
		title: "action-recorder.menu.replay-local-name",
		type: MenuItemType.BUTTON
	};
}
function ReplayLocalRecordOnActiveMenuItemFactory() {
	return {
		id: ReplayLocalRecordOnActiveCommand.id,
		title: "action-recorder.menu.replay-local-active",
		type: MenuItemType.BUTTON
	};
}
const menuSchema = { [RibbonOthersGroup.OTHERS]: { [RECORD_MENU_ITEM_ID]: {
	order: 1,
	menuItemFactory: RecordMenuItemFactory,
	[OpenRecordPanelOperation.id]: {
		order: 1,
		menuItemFactory: OpenRecorderMenuItemFactory
	},
	[ReplayLocalRecordCommand.id]: {
		order: 2,
		menuItemFactory: ReplayLocalRecordMenuItemFactory
	},
	[ReplayLocalRecordOnNamesakeCommand.id]: {
		order: 3,
		menuItemFactory: ReplayLocalRecordOnNamesakeMenuItemFactory
	},
	[ReplayLocalRecordOnActiveCommand.id]: {
		order: 4,
		menuItemFactory: ReplayLocalRecordOnActiveMenuItemFactory
	}
} } };

//#endregion
//#region src/views/components/RecorderPanel.tsx
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
function RecorderPanel() {
	if (!useObservable(useDependency(ActionRecorderService).panelOpened$)) return null;
	return /* @__PURE__ */ jsx(RecordPanelImpl, {});
}
function RecordPanelImpl() {
	var _recordedCommands$len;
	const commandService = useDependency(ICommandService);
	const actionRecorderService = useDependency(ActionRecorderService);
	const recording = useObservable(actionRecorderService.recording$);
	const recordedCommands = useObservable(actionRecorderService.recordedCommands$);
	const len = (_recordedCommands$len = recordedCommands === null || recordedCommands === void 0 ? void 0 : recordedCommands.length) !== null && _recordedCommands$len !== void 0 ? _recordedCommands$len : 0;
	const closePanel = useCallback(() => {
		if (!recording) commandService.executeCommand(CloseRecordPanelOperation.id);
	}, [commandService, recording]);
	const startRecording = useCallback((replaceId) => {
		if (!recording) commandService.executeCommand(StartRecordingActionCommand.id, { replaceId });
	}, [commandService, recording]);
	const completeRecording = useCallback(() => {
		if (recording) commandService.executeCommand(CompleteRecordingActionCommand.id);
	}, [commandService, recording]);
	const stopRecording = useCallback(() => {
		if (recording) commandService.executeCommand(StopRecordingActionCommand.id);
	}, [commandService, recording]);
	const titleText = recording ? len === 0 ? "Recording..." : `${len}: ${recordedCommands[len - 1].id}` : "Start Recording";
	return /* @__PURE__ */ jsxs("div", {
		className: "univer-fixed univer-bottom-20 univer-left-1/2 univer-z-[1000] univer-flex univer-h-16 univer-w-[512px] -univer-translate-x-1/2 univer-items-center univer-rounded-lg univer-bg-white univer-px-5 univer-shadow-lg",
		children: [
			/* @__PURE__ */ jsx("div", {
				className: "univer-mr-2 univer-size-5 univer-shrink-0 univer-grow-0 univer-text-xl",
				children: /* @__PURE__ */ jsx(RecordIcon, {})
			}),
			/* @__PURE__ */ jsx("div", {
				className: "univer-flex-1 univer-text-sm",
				children: titleText
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "univer-flex univer-w-64 univer-shrink-0 univer-grow-0 univer-justify-between",
				children: [
					/* @__PURE__ */ jsx(Button, {
						className: "univer-w-20",
						onClick: recording ? stopRecording : closePanel,
						children: recording ? "Cancel" : "Close"
					}),
					/* @__PURE__ */ jsx(Button, {
						className: "univer-w-20",
						variant: "primary",
						onClick: recording ? completeRecording : () => startRecording(),
						children: recording ? "Save" : "Start"
					}),
					!recording && /* @__PURE__ */ jsx(Button, {
						variant: "primary",
						onClick: () => startRecording(true),
						children: "Start(N)"
					})
				]
			})
		]
	});
}

//#endregion
//#region src/controllers/action-recorder.controller.ts
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
let ActionRecorderController = class ActionRecorderController extends Disposable {
	constructor(_commandSrv, _uiPartsSrv, _menuManagerService, _componentManager, _actionRecorderService, _injector) {
		super();
		this._commandSrv = _commandSrv;
		this._uiPartsSrv = _uiPartsSrv;
		this._menuManagerService = _menuManagerService;
		this._componentManager = _componentManager;
		this._actionRecorderService = _actionRecorderService;
		this._injector = _injector;
		this._initCommands();
		this._initUI();
		this._initSheetsCommands();
		this._initDocsCommands();
	}
	_initCommands() {
		[
			StartRecordingActionCommand,
			StopRecordingActionCommand,
			CompleteRecordingActionCommand,
			OpenRecordPanelOperation,
			CloseRecordPanelOperation,
			ReplayLocalRecordCommand,
			ReplayLocalRecordOnNamesakeCommand,
			ReplayLocalRecordOnActiveCommand
		].forEach((command) => this._commandSrv.registerCommand(command));
	}
	_initUI() {
		this._uiPartsSrv.registerComponent(BuiltInUIPart.GLOBAL, () => connectInjector(RecorderPanel, this._injector));
		this.disposeWithMe(this._componentManager.register("RecordIcon", RecordIcon));
		this._menuManagerService.mergeMenu(menuSchema);
	}
	_initSheetsCommands() {
		[
			CopySheetCommand,
			DeleteRangeMoveLeftCommand,
			DeleteRangeMoveUpCommand,
			DeltaColumnWidthCommand,
			DeltaRowHeightCommand,
			InsertSheetCommand,
			InsertColAfterCommand,
			InsertColBeforeCommand,
			InsertRowAfterCommand,
			InsertRowBeforeCommand,
			RemoveSheetCommand,
			SetStyleCommand,
			AddWorksheetMergeCommand,
			AddWorksheetMergeAllCommand,
			AddWorksheetMergeVerticalCommand,
			AddWorksheetMergeHorizontalCommand,
			SetFrozenCommand,
			CancelFrozenCommand,
			SetHorizontalTextAlignCommand,
			SetOverlineCommand,
			SetRangeBoldCommand,
			SetRangeFontFamilyCommand,
			SetRangeFontSizeCommand,
			SetRangeItalicCommand,
			SetRangeStrickThroughCommand,
			SetRangeSubscriptCommand,
			SetRangeSuperscriptCommand,
			SetRangeTextColorCommand,
			SetRangeUnderlineCommand,
			SetRangeValuesCommand,
			SetStrikeThroughCommand,
			SetTextColorCommand,
			SetTextRotationCommand,
			SetTextWrapCommand,
			SetVerticalTextAlignCommand,
			SheetCopyCommand,
			SheetCutCommand,
			SheetPasteBesidesBorderCommand,
			SheetPasteColWidthCommand,
			SheetPasteCommand,
			SheetPasteFormatCommand,
			SheetPasteShortKeyCommand,
			SheetPasteValueCommand,
			AutoFillCommand,
			RefillCommand,
			SetWorksheetActivateCommand,
			SetWorksheetActiveOperation,
			SetSelectionsOperation,
			SetSheetFilterRangeCommand,
			SetSheetsFilterCriteriaCommand,
			RemoveSheetFilterCommand
		].forEach((command) => this._actionRecorderService.registerRecordedCommand(command));
	}
	_initDocsCommands() {}
};
ActionRecorderController = __decorate([
	__decorateParam(0, ICommandService),
	__decorateParam(1, IUIPartsService),
	__decorateParam(2, IMenuManagerService),
	__decorateParam(3, Inject(ComponentManager)),
	__decorateParam(4, Inject(ActionRecorderService)),
	__decorateParam(5, Inject(Injector))
], ActionRecorderController);

//#endregion
//#region src/plugin.ts
let UniverActionRecorderPlugin = class UniverActionRecorderPlugin extends Plugin {
	constructor(_config = defaultPluginConfig, _injector, _configService) {
		super();
		this._config = _config;
		this._injector = _injector;
		this._configService = _configService;
		const { menu, ...rest } = merge({}, defaultPluginConfig, this._config);
		if (menu) this._configService.setConfig("menu", menu, { merge: true });
		this._configService.setConfig(ACTION_RECORDER_PLUGIN_CONFIG_KEY, rest);
	}
	onStarting() {
		(this._config.replayOnly ? [[ActionReplayService]] : [
			[ActionRecorderService],
			[ActionReplayService],
			[ActionRecorderController]
		]).forEach((d) => this._injector.add(d));
	}
	onSteady() {
		if (this._config.replayOnly) return;
		this._injector.get(ActionRecorderController);
	}
};
_defineProperty(UniverActionRecorderPlugin, "pluginName", "UNIVER_ACTION_RECORDER_PLUGIN");
_defineProperty(UniverActionRecorderPlugin, "packageName", name);
_defineProperty(UniverActionRecorderPlugin, "version", version);
UniverActionRecorderPlugin = __decorate([__decorateParam(1, Inject(Injector)), __decorateParam(2, IConfigService)], UniverActionRecorderPlugin);

//#endregion
export { ActionRecorderService, ActionReplayService, UniverActionRecorderPlugin };