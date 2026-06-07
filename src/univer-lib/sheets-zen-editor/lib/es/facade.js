import { CanceledError, DOCS_ZEN_EDITOR_UNIT_ID_KEY, ICommandService, IUniverInstanceService, RichTextValue } from "@univerjs/core";
import { FUniver } from "@univerjs/core/facade";
import { RichTextEditingMutation } from "@univerjs/docs";
import { IEditorBridgeService } from "@univerjs/sheets-ui";
import { CancelZenEditCommand, ConfirmZenEditCommand, OpenZenEditorCommand } from "@univerjs/sheets-zen-editor";
import { FWorkbook } from "@univerjs/sheets/facade";

//#region src/facade/f-univer.ts
var FUniverSheetsZenEditorMixin = class extends FUniver {
	_initSheetZenEditorEvent(injector) {
		const commandService = injector.get(ICommandService);
		this.disposeWithMe(this.registerEventHandler(this.Event.BeforeSheetEditStart, () => commandService.beforeCommandExecuted((commandInfo) => {
			if (commandInfo.id === OpenZenEditorCommand.id) {
				const target = this.getSheetCommandTarget();
				if (!target) return;
				const { workbook, worksheet } = target;
				const loc = injector.get(IEditorBridgeService).getEditLocation();
				const eventParams = {
					workbook,
					worksheet,
					row: loc.row,
					column: loc.column,
					isZenEditor: true
				};
				this.fireEvent(this.Event.BeforeSheetEditStart, eventParams);
				if (eventParams.cancel) throw new CanceledError();
			}
		})));
		this.disposeWithMe(this.registerEventHandler(this.Event.BeforeSheetEditEnd, () => commandService.beforeCommandExecuted((commandInfo) => {
			if (commandInfo.id === CancelZenEditCommand.id || commandInfo.id === ConfirmZenEditCommand.id) {
				const target = this.getSheetCommandTarget();
				if (!target) return;
				const { workbook, worksheet } = target;
				const loc = injector.get(IEditorBridgeService).getEditLocation();
				const value = RichTextValue.create(injector.get(IUniverInstanceService).getUnit(DOCS_ZEN_EDITOR_UNIT_ID_KEY).getSnapshot());
				const eventParams = {
					workbook,
					worksheet,
					row: loc.row,
					column: loc.column,
					isZenEditor: true,
					value,
					isConfirm: commandInfo.id === ConfirmZenEditCommand.id
				};
				this.fireEvent(this.Event.BeforeSheetEditEnd, eventParams);
				if (eventParams.cancel) throw new CanceledError();
			}
		})));
		this.disposeWithMe(this.registerEventHandler(this.Event.SheetEditStarted, () => commandService.onCommandExecuted((commandInfo) => {
			if (commandInfo.id === OpenZenEditorCommand.id) {
				const target = this.getSheetCommandTarget();
				if (!target) return;
				const { workbook, worksheet } = target;
				const loc = injector.get(IEditorBridgeService).getEditLocation();
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
			if (commandInfo.id === CancelZenEditCommand.id || commandInfo.id === ConfirmZenEditCommand.id) {
				const target = this.getSheetCommandTarget();
				if (!target) return;
				const { workbook, worksheet } = target;
				const loc = injector.get(IEditorBridgeService).getEditLocation();
				const eventParams = {
					workbook,
					worksheet,
					row: loc.row,
					column: loc.column,
					isZenEditor: true,
					isConfirm: commandInfo.id === ConfirmZenEditCommand.id
				};
				this.fireEvent(this.Event.SheetEditEnded, eventParams);
			}
		})));
		this.disposeWithMe(this.registerEventHandler(this.Event.SheetEditChanging, () => commandService.onCommandExecuted((commandInfo) => {
			if (commandInfo.id === RichTextEditingMutation.id) {
				const target = this.getActiveSheet();
				if (!target) return;
				const { workbook, worksheet } = target;
				const editorBridgeService = injector.get(IEditorBridgeService);
				const univerInstanceService = injector.get(IUniverInstanceService);
				const params = commandInfo.params;
				if (!editorBridgeService.isVisible().visible) return;
				const { unitId } = params;
				if (unitId === DOCS_ZEN_EDITOR_UNIT_ID_KEY) {
					const { row, column } = editorBridgeService.getEditLocation();
					const eventParams = {
						workbook,
						worksheet,
						row,
						column,
						value: RichTextValue.create(univerInstanceService.getUnit(DOCS_ZEN_EDITOR_UNIT_ID_KEY).getSnapshot()),
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
FUniver.extend(FUniverSheetsZenEditorMixin);

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
var FWorkbookSheetsZenEditorMixin = class extends FWorkbook {
	startZenEditingAsync() {
		return this._injector.get(ICommandService).executeCommand(OpenZenEditorCommand.id);
	}
	endZenEditingAsync(save = true) {
		const commandService = this._injector.get(ICommandService);
		return save ? commandService.executeCommand(ConfirmZenEditCommand.id) : commandService.executeCommand(CancelZenEditCommand.id);
	}
};
FWorkbook.extend(FWorkbookSheetsZenEditorMixin);

//#endregion
export {  };