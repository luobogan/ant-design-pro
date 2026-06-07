import { ICommandService, IResourceLoaderService, IUniverInstanceService, Inject, Injector, RedoCommand, UndoCommand, UniverInstanceType } from "@univerjs/core";
import { FBaseInitialable, FUniver } from "@univerjs/core/facade";
import { InsertTextCommand } from "@univerjs/docs";

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
//#region src/facade/f-document.ts
let FDocument = class FDocument extends FBaseInitialable {
	constructor(_documentDataModel, _injector, _univerInstanceService, _resourceLoaderService, _commandService) {
		super(_injector);
		this._documentDataModel = _documentDataModel;
		this._injector = _injector;
		this._univerInstanceService = _univerInstanceService;
		this._resourceLoaderService = _resourceLoaderService;
		this._commandService = _commandService;
		_defineProperty(this, "id", void 0);
		this.id = this._documentDataModel.getUnitId();
	}
	/**
	* Get the document data model of the document.
	* @returns {DocumentDataModel} The document data model.
	* @example
	* ```typescript
	* const fDocument = univerAPI.getActiveDocument();
	* const documentDataModel = fDocument.getDocumentDataModel();
	* console.log(documentDataModel);
	* ```
	*/
	getDocumentDataModel() {
		return this._documentDataModel;
	}
	dispose() {
		super.dispose();
	}
	/**
	* Get the document id.
	* @returns {string} The document id.
	* @example
	* ```typescript
	* const fDocument = univerAPI.getActiveDocument();
	* const unitId = fDocument.getId();
	* console.log(unitId);
	* ```
	*/
	getId() {
		return this.id;
	}
	/**
	* Get the document name.
	* @returns {string} The document name.
	* @example
	* ```typescript
	* const fDocument = univerAPI.getActiveDocument();
	* const name = fDocument.getName();
	* console.log(name);
	* ```
	*/
	getName() {
		return this._documentDataModel.getTitle() || "";
	}
	/**
	* Save the document snapshot data, including the document content and resource data, etc.
	* @returns {IDocumentData} The document snapshot data.
	* @example
	* ```typescript
	* const fDocument = univerAPI.getActiveDocument();
	* const snapshot = fDocument.save();
	* console.log(snapshot);
	* ```
	*/
	save() {
		return this._resourceLoaderService.saveUnit(this._documentDataModel.getUnitId());
	}
	/**
	* Undo the last operation in the document.
	* @returns {Promise<boolean>} A promise that resolves to true if the undo operation was successful, or false if it failed.
	* @example
	* ```typescript
	* const fDocument = univerAPI.getActiveDocument();
	* await fDocument.undo();
	* ```
	*/
	undo() {
		this._univerInstanceService.focusUnit(this.id);
		return this._commandService.executeCommand(UndoCommand.id);
	}
	/**
	* Redo the last undone operation in the document.
	* @returns {Promise<boolean>} A promise that resolves to true if the redo operation was successful, or false if it failed.
	* @example
	* ```typescript
	* const fDocument = univerAPI.getActiveDocument();
	* await fDocument.redo();
	* ```
	*/
	redo() {
		this._univerInstanceService.focusUnit(this.id);
		return this._commandService.executeCommand(RedoCommand.id);
	}
	/**
	* Adds the specified text to the end of this text region.
	* @param {string} text - The text to be added to the end of this text region.
	* @return {Promise<boolean>} A promise that resolves to true if the text was successfully appended, or false if it failed.
	* @example
	* ```typescript
	* const fDocument = univerAPI.getActiveDocument();
	* await fDocument.appendText('Hello, world!');
	* ```
	*/
	appendText(text) {
		const { body } = this.save();
		if (!body) throw new Error("The document body is empty");
		const lastPosition = body.dataStream.length - 2;
		return this.insertText(text, {
			startOffset: lastPosition,
			endOffset: lastPosition,
			segmentId: ""
		});
	}
	/**
	* Inserts text at the provided document range. Defaults to appending before the final section break.
	* @param {string} text - The text to insert.
	* @param {IDocumentInsertTextFacadeOptions} options - Optional target range, segment id, and cursor offset.
	* @returns {Promise<boolean>} A promise that resolves to true if the text was successfully inserted, or false if it failed.
	* @example
	*
	* // Insert text at a specific range in the document body
	* ```typescript
	* const fDocument = univerAPI.getActiveDocument();
	* await fDocument.insertText('Hello, world!', {
	*   startOffset: 5,
	*   endOffset: 5,
	*   segmentId: '',
	*   cursorOffset: 13,
	* });
	* ```
	*
	* // Insert text at the beginning of a header or footer segment
	* ```typescript
	* const fDocument = univerAPI.getActiveDocument();
	* const snapshot = fDocument.save();
	* const { headers, footers } = snapshot;
	*
	* if (headers) {
	*   for (const headerId in headers) {
	*     if (headerId === 'target-header-id') {
	*       await fDocument.insertText('Hello, header!', {
	*         startOffset: 0,
	*         endOffset: 0,
	*         segmentId: headerId,
	*       });
	*     }
	*   }
	* }
	*
	* if (footers) {
	*   for (const footerId in footers) {
	*     if (footerId === 'target-footer-id') {
	*       await fDocument.insertText('Hello, footer!', {
	*         startOffset: 0,
	*         endOffset: 0,
	*         segmentId: footerId,
	*       });
	*     }
	*   }
	* }
	* ```
	*/
	insertText(text, options = {}) {
		var _options$startOffset, _options$endOffset, _options$segmentId;
		const unitId = this.id;
		const { body } = this.save();
		if (!body) throw new Error("The document body is empty");
		const startOffset = (_options$startOffset = options.startOffset) !== null && _options$startOffset !== void 0 ? _options$startOffset : Math.max(0, body.dataStream.length - 2);
		const endOffset = (_options$endOffset = options.endOffset) !== null && _options$endOffset !== void 0 ? _options$endOffset : startOffset;
		const segmentId = (_options$segmentId = options.segmentId) !== null && _options$segmentId !== void 0 ? _options$segmentId : "";
		const activeRange = {
			startOffset,
			endOffset,
			collapsed: startOffset === endOffset,
			segmentId
		};
		return this._commandService.executeCommand(InsertTextCommand.id, {
			unitId,
			body: { dataStream: text },
			range: activeRange,
			segmentId,
			...options.cursorOffset == null ? {} : { cursorOffset: options.cursorOffset }
		});
	}
	/**
	* Inserts one or more plain-text paragraphs at the provided document range.
	* @param {string} text - The paragraph text to insert. Newlines are normalized to document paragraph separators.
	* @param {IDocumentInsertTextFacadeOptions} options - Optional target range, segment id, and cursor offset.
	* @returns {Promise<boolean>} A promise that resolves to true if the paragraphs were successfully inserted, or false if it failed.
	* @example
	* ```typescript
	* const fDocument = univerAPI.getActiveDocument();
	* await fDocument.insertParagraph('Hello, world! This is a new paragraph.', {
	*   startOffset: 5,
	*   endOffset: 5,
	* });
	* ```
	*/
	insertParagraph(text = "", options = {}) {
		var _options$cursorOffset;
		const dataStream = `${text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").join("\r\n")}\r\n`;
		return this.insertText(dataStream, {
			...options,
			cursorOffset: (_options$cursorOffset = options.cursorOffset) !== null && _options$cursorOffset !== void 0 ? _options$cursorOffset : dataStream.length
		});
	}
};
FDocument = __decorate([
	__decorateParam(1, Inject(Injector)),
	__decorateParam(2, IUniverInstanceService),
	__decorateParam(3, Inject(IResourceLoaderService)),
	__decorateParam(4, ICommandService)
], FDocument);

//#endregion
//#region src/facade/f-univer.ts
var FUniverDocsUIMixin = class extends FUniver {
	createDocument(data) {
		const document = this._injector.get(IUniverInstanceService).createUnit(UniverInstanceType.UNIVER_DOC, data);
		return this._injector.createInstance(FDocument, document);
	}
	getActiveDocument() {
		const document = this._univerInstanceService.getCurrentUnitOfType(UniverInstanceType.UNIVER_DOC);
		if (!document) return null;
		return this._injector.createInstance(FDocument, document);
	}
	getDocument(id) {
		const document = this._univerInstanceService.getUnit(id, UniverInstanceType.UNIVER_DOC);
		if (!document) return null;
		return this._injector.createInstance(FDocument, document);
	}
};
FUniver.extend(FUniverDocsUIMixin);

//#endregion
export { FDocument };