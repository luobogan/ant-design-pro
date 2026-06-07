import { FEnum, FUniver } from "@univerjs/core/facade";
import { IWatermarkTypeEnum } from "@univerjs/engine-render";
import { WatermarkImageBaseConfig, WatermarkService, WatermarkTextBaseConfig } from "@univerjs/watermark";

//#region src/facade/f-univer.ts
var FWatermarkEnumMixin = class extends FEnum {
	get IWatermarkTypeEnum() {
		return IWatermarkTypeEnum;
	}
};
var FUniverWatermarkMixin = class extends FUniver {
	addWatermark(type, config) {
		const watermarkService = this._injector.get(WatermarkService);
		if (type === IWatermarkTypeEnum.Text) watermarkService.updateWatermarkConfig({
			type: IWatermarkTypeEnum.Text,
			config: { text: {
				...WatermarkTextBaseConfig,
				...config
			} }
		});
		else if (type === IWatermarkTypeEnum.Image) watermarkService.updateWatermarkConfig({
			type: IWatermarkTypeEnum.Image,
			config: { image: {
				...WatermarkImageBaseConfig,
				...config
			} }
		});
		else throw new Error("Unknown watermark type");
		return this;
	}
	deleteWatermark() {
		this._injector.get(WatermarkService).deleteWatermarkConfig();
		return this;
	}
};
FUniver.extend(FUniverWatermarkMixin);
FEnum.extend(FWatermarkEnumMixin);

//#endregion
export {  };