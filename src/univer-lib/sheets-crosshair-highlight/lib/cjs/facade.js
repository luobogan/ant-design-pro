let _univerjs_core = require("@univerjs/core");
let _univerjs_core_facade = require("@univerjs/core/facade");
let _univerjs_sheets_crosshair_highlight = require("@univerjs/sheets-crosshair-highlight");

//#region src/facade/f-univer.ts
/**
* @ignore
*/
var FUniverSheetsCrosshairHighlightMixin = class extends _univerjs_core_facade.FUniver {
	/**
	* @ignore
	*/
	_initialize(injector) {
		const commandService = injector.get(_univerjs_core.ICommandService);
		this.disposeWithMe(this.registerEventHandler(this.Event.CrosshairHighlightEnabledChanged, () => commandService.onCommandExecuted((commandInfo) => {
			if (commandInfo.id === _univerjs_sheets_crosshair_highlight.EnableCrosshairHighlightOperation.id || commandInfo.id === _univerjs_sheets_crosshair_highlight.DisableCrosshairHighlightOperation.id || commandInfo.id === _univerjs_sheets_crosshair_highlight.ToggleCrosshairHighlightOperation.id) {
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
			if (commandInfo.id === _univerjs_sheets_crosshair_highlight.SetCrosshairHighlightColorOperation.id) {
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
		if (enabled) this._commandService.syncExecuteCommand(_univerjs_sheets_crosshair_highlight.EnableCrosshairHighlightOperation.id);
		else this._commandService.syncExecuteCommand(_univerjs_sheets_crosshair_highlight.DisableCrosshairHighlightOperation.id);
		return this;
	}
	setCrosshairHighlightColor(color) {
		this._commandService.syncExecuteCommand(_univerjs_sheets_crosshair_highlight.SetCrosshairHighlightColorOperation.id, { value: color });
		return this;
	}
	getCrosshairHighlightEnabled() {
		return this._injector.get(_univerjs_sheets_crosshair_highlight.SheetsCrosshairHighlightService).enabled;
	}
	getCrosshairHighlightColor() {
		return this._injector.get(_univerjs_sheets_crosshair_highlight.SheetsCrosshairHighlightService).color;
	}
	get CROSSHAIR_HIGHLIGHT_COLORS() {
		return _univerjs_sheets_crosshair_highlight.CROSSHAIR_HIGHLIGHT_COLORS;
	}
};
_univerjs_core_facade.FUniver.extend(FUniverSheetsCrosshairHighlightMixin);

//#endregion
//#region src/facade/f-event.ts
/**
* @ignore
*/
var FSheetsCrosshairHighlightEventNameMixin = class extends _univerjs_core_facade.FEventName {
	get CrosshairHighlightEnabledChanged() {
		return "CrosshairHighlightEnabledChanged";
	}
	get CrosshairHighlightColorChanged() {
		return "CrosshairHighlightColorChanged";
	}
};
_univerjs_core_facade.FEventName.extend(FSheetsCrosshairHighlightEventNameMixin);

//#endregion