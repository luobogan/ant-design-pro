let _univerjs_core = require("@univerjs/core");
let _univerjs_docs_ui = require("@univerjs/docs-ui");
let _univerjs_docs_facade = require("@univerjs/docs/facade");
let _univerjs_engine_render = require("@univerjs/engine-render");

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
var FDocumentUIMixin = class extends _univerjs_docs_facade.FDocument {
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
		const docSelectionRenderService = (_renderManagerService = this._injector.get(_univerjs_engine_render.IRenderManagerService).getRenderUnitById(this.getId())) === null || _renderManagerService === void 0 ? void 0 : _renderManagerService.with(_univerjs_docs_ui.DocSelectionRenderService);
		docSelectionRenderService === null || docSelectionRenderService === void 0 || docSelectionRenderService.removeAllRanges();
		docSelectionRenderService === null || docSelectionRenderService === void 0 || docSelectionRenderService.addDocRanges([{
			startOffset,
			endOffset,
			rangeType: _univerjs_core.DOC_RANGE_TYPE.TEXT
		}], true);
	}
};
_univerjs_docs_facade.FDocument.extend(FDocumentUIMixin);

//#endregion