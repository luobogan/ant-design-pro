import { DOC_RANGE_TYPE } from "@univerjs/core";
import { DocSelectionRenderService } from "@univerjs/docs-ui";
import { FDocument } from "@univerjs/docs/facade";
import { IRenderManagerService } from "@univerjs/engine-render";

//#region src/facade/f-document.ts
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
var FDocumentUIMixin = class extends FDocument {
	/**
	* Sets the selection to a specified text range in the document.
	* @param startOffset - The starting offset of the selection in the document.
	* @param endOffset - The ending offset of the selection in the document.
	* @example
	* ```typescript
	* const fDocument = univerAPI.getActiveDocument();
	* fDocument.setSelection(10, 20);
	* ```
	*/
	setSelection(startOffset, endOffset) {
		var _renderManagerService;
		const docSelectionRenderService = (_renderManagerService = this._injector.get(IRenderManagerService).getRenderUnitById(this.getId())) === null || _renderManagerService === void 0 ? void 0 : _renderManagerService.with(DocSelectionRenderService);
		docSelectionRenderService === null || docSelectionRenderService === void 0 || docSelectionRenderService.removeAllRanges();
		docSelectionRenderService === null || docSelectionRenderService === void 0 || docSelectionRenderService.addDocRanges([{
			startOffset,
			endOffset,
			rangeType: DOC_RANGE_TYPE.TEXT
		}], true);
	}
};
FDocument.extend(FDocumentUIMixin);

//#endregion
export {  };