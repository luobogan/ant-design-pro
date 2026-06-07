let _univerjs_core = require("@univerjs/core");
let _univerjs_core_facade = require("@univerjs/core/facade");
let _univerjs_docs = require("@univerjs/docs");
let _univerjs_sheets_ui = require("@univerjs/sheets-ui");
let _univerjs_sheets_zen_editor = require("@univerjs/sheets-zen-editor");
let _univerjs_sheets_facade = require("@univerjs/sheets/facade");

//#region src/facade/f-univer.ts
var FUniverSheetsZenEditorMixin = class extends _univerjs_core_facade.FUniver {
	_initSheetZenEditorEvent(injector) {
		const commandService = injector.get(_univerjs_core.ICommandService);
		this.disposeWithMe(this.registerEventHandler(this.Event.BeforeSheetEditStart, () => commandService.beforeCommandExecuted((commandInfo) => {
			if (commandInfo.id === _univerjs_sheets_zen_editor.OpenZenEditorCommand.id) {
				const target = this.getSheetCommandTarget();
				if (!target) return;
				const { workbook, worksheet } = target;
				const loc = injector.get(_univerjs_sheets_ui.IEditorBridgeService).getEditLocation();
				const eventParams = {
					workbook,
					worksheet,
					row: loc.row,
					column: loc.column,
					isZenEditor: true
				};
				this.fireEvent(this.Event.BeforeSheetEditStart, eventParams);
				if (eventParams.cancel) throw new _univerjs_core.CanceledError();
			}
		})));
		this.disposeWithMe(this.registerEventHandler(this.Event.BeforeSheetEditEnd, () => commandService.beforeCommandExecuted((commandInfo) => {
			if (commandInfo.id === _univerjs_sheets_zen_editor.CancelZenEditCommand.id || commandInfo.id === _univerjs_sheets_zen_editor.ConfirmZenEditCommand.id) {
				const target = this.getSheetCommandTarget();
				if (!target) return;
				const { workbook, worksheet } = target;
				const loc = injector.get(_univerjs_sheets_ui.IEditorBridgeService).getEditLocation();
				const value = _univerjs_core.RichTextValue.create(injector.get(_univerjs_core.IUniverInstanceService).getUnit(_univerjs_core.DOCS_ZEN_EDITOR_UNIT_ID_KEY).getSnapshot());
				const eventParams = {
					workbook,
					worksheet,
					row: loc.row,
					column: loc.column,
					isZenEditor: true,
					value,
					isConfirm: commandInfo.id === _univerjs_sheets_zen_editor.ConfirmZenEditCommand.id
				};
				this.fireEvent(this.Event.BeforeSheetEditEnd, eventParams);
				if (eventParams.cancel) throw new _univerjs_core.CanceledError();
			}
		})));
		this.disposeWithMe(this.registerEventHandler(this.Event.SheetEditStarted, () => commandService.onCommandExecuted((commandInfo) => {
			if (commandInfo.id === _univerjs_sheets_zen_editor.OpenZenEditorCommand.id) {
				const target = this.getSheetCommandTarget();
				if (!target) return;
				const { workbook, worksheet } = target;
				const loc = injector.get(_univerjs_sheets_ui.IEditorBridgeService).getEditLocation();
				const eventParams = {
					workbook,
					worksheet,
					row: loc.row,
					column: loc.column,
					isZenEditor: true
				};
				this.fireEvent(this.Event.SheetEditStarted, eventParams);
			}
		})));
		this.disposeWithMe(this.registerEventHandler(this.Event.SheetEditEnded, () => commandService.onCommandExecuted((commandInfo) => {
			if (commandInfo.id === _univerjs_sheets_zen_editor.CancelZenEditCommand.id || commandInfo.id === _univerjs_sheets_zen_editor.ConfirmZenEditCommand.id) {
				const target = this.getSheetCommandTarget();
				if (!target) return;
				const { workbook, worksheet } = target;
				const loc = injector.get(_univerjs_sheets_ui.IEditorBridgeService).getEditLocation();
				const eventParams = {
					workbook,
					worksheet,
					row: loc.row,
					column: loc.column,
					isZenEditor: true,
					isConfirm: commandInfo.id === _univerjs_sheets_zen_editor.ConfirmZenEditCommand.id
				};
				this.fireEvent(this.Event.SheetEditEnded, eventParams);
			}
		})));
		this.disposeWithMe(this.registerEventHandler(this.Event.SheetEditChanging, () => commandService.onCommandExecuted((commandInfo) => {
			if (commandInfo.id === _univerjs_docs.RichTextEditingMutation.id) {
				const target = this.getActiveSheet();
				if (!target) return;
				const { workbook, worksheet } = target;
				const editorBridgeService = injector.get(_univerjs_sheets_ui.IEditorBridgeService);
				const univerInstanceService = injector.get(_univerjs_core.IUniverInstanceService);
				const params = commandInfo.params;
				if (!editorBridgeService.isVisible().visible) return;
				const { unitId } = params;
				if (unitId === _univerjs_core.DOCS_ZEN_EDITOR_UNIT_ID_KEY) {
					const { row, column } = editorBridgeService.getEditLocation();
					const eventParams = {
						workbook,
						worksheet,
						row,
						column,
						value: _univerjs_core.RichTextValue.create(univerInstanceService.getUnit(_univerjs_core.DOCS_ZEN_EDITOR_UNIT_ID_KEY).getSnapshot()),
						isZenEditor: true
					};
					this.fireEvent(this.Event.SheetEditChanging, eventParams);
				}
			}
		})));
	}
	/**
	* @ignore
	*/
	_initialize(injector) {
		this._initSheetZenEditorEvent(injector);
	}
};
_univerjs_core_facade.FUniver.extend(FUniverSheetsZenEditorMixin);

//#endregion
//#region src/facade/f-workbook.ts
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
var FWorkbookSheetsZenEditorMixin = class extends _univerjs_sheets_facade.FWorkbook {
	startZenEditingAsync() {
		return this._injector.get(_univerjs_core.ICommandService).executeCommand(_univerjs_sheets_zen_editor.OpenZenEditorCommand.id);
	}
	endZenEditingAsync(save = true) {
		const commandService = this._injector.get(_univerjs_core.ICommandService);
		return save ? commandService.executeCommand(_univerjs_sheets_zen_editor.ConfirmZenEditCommand.id) : commandService.executeCommand(_univerjs_sheets_zen_editor.CancelZenEditCommand.id);
	}
};
_univerjs_sheets_facade.FWorkbook.extend(FWorkbookSheetsZenEditorMixin);

//#endregion