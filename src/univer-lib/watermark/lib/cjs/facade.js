let _univerjs_core_facade = require("@univerjs/core/facade");
let _univerjs_engine_render = require("@univerjs/engine-render");
let _univerjs_watermark = require("@univerjs/watermark");

//#region src/facade/f-univer.ts
var FWatermarkEnumMixin = class extends _univerjs_core_facade.FEnum {
	get IWatermarkTypeEnum() {
		return _univerjs_engine_render.IWatermarkTypeEnum;
	}
};
var FUniverWatermarkMixin = class extends _univerjs_core_facade.FUniver {
	addWatermark(type, config) {
		const watermarkService = this._injector.get(_univerjs_watermark.WatermarkService);
		if (type === _univerjs_engine_render.IWatermarkTypeEnum.Text) watermarkService.updateWatermarkConfig({
			type: _univerjs_engine_render.IWatermarkTypeEnum.Text,
			config: { text: {
				..._univerjs_watermark.WatermarkTextBaseConfig,
				...config
			} }
		});
		else if (type === _univerjs_engine_render.IWatermarkTypeEnum.Image) watermarkService.updateWatermarkConfig({
			type: _univerjs_engine_render.IWatermarkTypeEnum.Image,
			config: { image: {
				..._univerjs_watermark.WatermarkImageBaseConfig,
				...config
			} }
		});
		else throw new Error("Unknown watermark type");
		return this;
	}
	deleteWatermark() {
		this._injector.get(_univerjs_watermark.WatermarkService).deleteWatermarkConfig();
		return this;
	}
};
_univerjs_core_facade.FUniver.extend(FUniverWatermarkMixin);
_univerjs_core_facade.FEnum.extend(FWatermarkEnumMixin);

//#endregion