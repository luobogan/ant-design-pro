import { ICommandService } from "@univerjs/core";
import { FEventName, FUniver } from "@univerjs/core/facade";
import { CROSSHAIR_HIGHLIGHT_COLORS, DisableCrosshairHighlightOperation, EnableCrosshairHighlightOperation, SetCrosshairHighlightColorOperation, SheetsCrosshairHighlightService, ToggleCrosshairHighlightOperation } from "@univerjs/sheets-crosshair-highlight";

//#region src/facade/f-univer.ts
/**
* @ignore
*/
var FUniverSheetsCrosshairHighlightMixin = class extends FUniver {
	/**
	* @ignore
	*/
	_initialize(injector) {
		const commandService = injector.get(ICommandService);
		this.disposeWithMe(this.registerEventHandler(this.Event.CrosshairHighlightEnabledChanged, () => commandService.onCommandExecuted((commandInfo) => {
			if (commandInfo.id === EnableCrosshairHighlightOperation.id || commandInfo.id === DisableCrosshairHighlightOperation.id || commandInfo.id === ToggleCrosshairHighlightOperation.id) {
				const activeSheet = this.getActiveSheet();
				if (!activeSheet) return;
				const eventParams = {
					enabled: this.getCrosshairHighlightEnabled(),
					...activeSheet
				};
				this.fireEvent(this.Event.CrosshairHighlightEnabledChanged, eventParams);
			}
		})));
		this.disposeWithMe(this.registerEventHandler(this.Event.CrosshairHighlightColorChanged, () => commandService.onCommandExecuted((commandInfo) => {
			if (commandInfo.id === SetCrosshairHighlightColorOperation.id) {
				const activeSheet = this.getActiveSheet();
				if (!activeSheet) return;
				const eventParams = {
					color: this.getCrosshairHighlightColor(),
					...activeSheet
				};
				this.fireEvent(this.Event.CrosshairHighlightColorChanged, eventParams);
			}
		})));
	}
	setCrosshairHighlightEnabled(enabled) {
		if (enabled) this._commandService.syncExecuteCommand(EnableCrosshairHighlightOperation.id);
		else this._commandService.syncExecuteCommand(DisableCrosshairHighlightOperation.id);
		return this;
	}
	setCrosshairHighlightColor(color) {
		this._commandService.syncExecuteCommand(SetCrosshairHighlightColorOperation.id, { value: color });
		return this;
	}
	getCrosshairHighlightEnabled() {
		return this._injector.get(SheetsCrosshairHighlightService).enabled;
	}
	getCrosshairHighlightColor() {
		return this._injector.get(SheetsCrosshairHighlightService).color;
	}
	get CROSSHAIR_HIGHLIGHT_COLORS() {
		return CROSSHAIR_HIGHLIGHT_COLORS;
	}
};
FUniver.extend(FUniverSheetsCrosshairHighlightMixin);

//#endregion
//#region src/facade/f-event.ts
/**
* @ignore
*/
var FSheetsCrosshairHighlightEventNameMixin = class extends FEventName {
	get CrosshairHighlightEnabledChanged() {
		return "CrosshairHighlightEnabledChanged";
	}
	get CrosshairHighlightColorChanged() {
		return "CrosshairHighlightColorChanged";
	}
};
FEventName.extend(FSheetsCrosshairHighlightEventNameMixin);

//#endregion
export {  };