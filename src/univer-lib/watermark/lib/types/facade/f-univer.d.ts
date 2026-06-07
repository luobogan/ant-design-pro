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
import type { IImageWatermarkConfig, ITextWatermarkConfig } from '@univerjs/engine-render';
import { FEnum, FUniver } from '@univerjs/core/facade';
import { IWatermarkTypeEnum } from '@univerjs/engine-render';
interface IFWatermarkEnumMixin {
    IWatermarkTypeEnum: typeof IWatermarkTypeEnum;
}
export declare class FWatermarkEnumMixin extends FEnum implements IFWatermarkEnumMixin {
    get IWatermarkTypeEnum(): typeof IWatermarkTypeEnum;
}
/**
 * @ignore
 */
export interface IFUniverWatermarkMixin {
    /**
     * Adds a watermark to the unit. Supports both text and image watermarks based on the specified type.
     * @param {IWatermarkTypeEnum.Text} type - The type of watermark to add is Text.
     * @param {ITextWatermarkConfig} config - The configuration object for the text type watermark.
     * @returns {FUniver} The {@link FUniver} instance for chaining.
     * @throws {Error} Throws an error if the watermark type is unknown.
     * @example
     * ```ts
     * univerAPI.addWatermark('text', {
     *   content: 'Univer',
     *   fontSize: 20,
     *   repeat: true,
     * });
     * ```
     */
    addWatermark(type: IWatermarkTypeEnum.Text, config: ITextWatermarkConfig): FUniver;
    /**
     * Adds a watermark to the unit. Supports both text and image watermarks based on the specified type.
     * @param {IWatermarkTypeEnum.Image} type - The type of watermark to add is Image.
     * @param {IImageWatermarkConfig} config - The configuration object for the image type watermark.
     * @returns {FUniver} The {@link FUniver} instance for chaining.
     * @throws {Error} Throws an error if the watermark type is unknown.
     * @example
     * ```ts
     * univerAPI.addWatermark('image', {
     *   url: 'https://avatars.githubusercontent.com/u/61444807?s=48&v=4',
     *   width: 100,
     *   height: 100,
     * });
     * ```
     */
    addWatermark(type: IWatermarkTypeEnum.Image, config: IImageWatermarkConfig): FUniver;
    addWatermark(type: IWatermarkTypeEnum.Text | IWatermarkTypeEnum.Image, config: ITextWatermarkConfig | IImageWatermarkConfig): FUniver;
    /**
     * Deletes the currently applied watermark from the unit.
     * This function retrieves the watermark service and invokes the method to remove any existing watermark configuration.
     * @returns {FUniver} The {@link FUniver} instance for chaining.
     * @example
     * ```ts
     * univerAPI.deleteWatermark();
     * ```
     */
    deleteWatermark(): FUniver;
}
export declare class FUniverWatermarkMixin extends FUniver {
    addWatermark(type: IWatermarkTypeEnum.Text, config: ITextWatermarkConfig): FUniver;
    addWatermark(type: IWatermarkTypeEnum.Image, config: IImageWatermarkConfig): FUniver;
    deleteWatermark(): FUniver;
}
declare module '@univerjs/core/facade' {
    interface FUniver extends IFUniverWatermarkMixin {
    }
    interface FEnum extends IFWatermarkEnumMixin {
    }
}
export {};
