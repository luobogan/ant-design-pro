Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
let _univerjs_core = require("@univerjs/core");
let rxjs = require("rxjs");
let _univerjs_engine_render = require("@univerjs/engine-render");

//#region src/basics/const/default-slide.ts
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
const DEFAULT_SLIDE = {
	id: "default_slide",
	title: "defaultSlide",
	pageSize: {
		width: 300,
		height: 300
	}
};

//#endregion
//#region src/types/interfaces/i-slide-data.ts
let PageType = /* @__PURE__ */ function(PageType) {
	PageType[PageType["SLIDE"] = 0] = "SLIDE";
	PageType[PageType["MASTER"] = 1] = "MASTER";
	PageType[PageType["LAYOUT"] = 2] = "LAYOUT";
	PageType[PageType["HANDOUT_MASTER"] = 3] = "HANDOUT_MASTER";
	PageType[PageType["NOTES_MASTER"] = 4] = "NOTES_MASTER";
	return PageType;
}({});
let PageElementType = /* @__PURE__ */ function(PageElementType) {
	PageElementType[PageElementType["SHAPE"] = 0] = "SHAPE";
	PageElementType[PageElementType["IMAGE"] = 1] = "IMAGE";
	PageElementType[PageElementType["TEXT"] = 2] = "TEXT";
	PageElementType[PageElementType["SPREADSHEET"] = 3] = "SPREADSHEET";
	PageElementType[PageElementType["DOCUMENT"] = 4] = "DOCUMENT";
	PageElementType[PageElementType["SLIDE"] = 5] = "SLIDE";
	return PageElementType;
}({});
let RelativeSlideLink = /* @__PURE__ */ function(RelativeSlideLink) {
	RelativeSlideLink[RelativeSlideLink["RELATIVE_SLIDE_LINK_UNSPECIFIED"] = 0] = "RELATIVE_SLIDE_LINK_UNSPECIFIED";
	RelativeSlideLink[RelativeSlideLink["NEXT_SLIDE"] = 1] = "NEXT_SLIDE";
	RelativeSlideLink[RelativeSlideLink["PREVIOUS_SLIDE"] = 2] = "PREVIOUS_SLIDE";
	RelativeSlideLink[RelativeSlideLink["FIRST_SLIDE"] = 3] = "FIRST_SLIDE";
	RelativeSlideLink[RelativeSlideLink["LAST_SLIDE"] = 4] = "LAST_SLIDE";
	return RelativeSlideLink;
}({});

//#endregion
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
//#region src/data-model/slide-data-model.ts
var SlideDataModel = class extends _univerjs_core.UnitModel {
	get _activePage() {
		const activePage = this._activePage$.getValue();
		if (!activePage) {
			var _this$getPageOrder, _this$getPages;
			const activePageId = (_this$getPageOrder = this.getPageOrder()) === null || _this$getPageOrder === void 0 ? void 0 : _this$getPageOrder[0];
			if (!activePageId) return null;
			return (_this$getPages = this.getPages()) === null || _this$getPages === void 0 ? void 0 : _this$getPages[activePageId];
		}
		return activePage;
	}
	constructor(snapshot) {
		var _this$_snapshot$id;
		super();
		_defineProperty(this, "type", _univerjs_core.UniverInstanceType.UNIVER_SLIDE);
		_defineProperty(this, "_activePage$", new rxjs.BehaviorSubject(null));
		_defineProperty(this, "activePage$", this._activePage$.asObservable());
		_defineProperty(this, "_name$", void 0);
		_defineProperty(this, "name$", void 0);
		_defineProperty(this, "_snapshot", void 0);
		_defineProperty(this, "_unitId", void 0);
		this._snapshot = {
			...DEFAULT_SLIDE,
			...snapshot
		};
		this._unitId = (_this$_snapshot$id = this._snapshot.id) !== null && _this$_snapshot$id !== void 0 ? _this$_snapshot$id : (0, _univerjs_core.generateRandomId)(6);
		this._name$ = new rxjs.BehaviorSubject(this._snapshot.title);
		this.name$ = this._name$.asObservable();
	}
	setName(name) {
		var _this$_snapshot$id2;
		this._snapshot.title = name;
		this._name$.next(name);
		this._unitId = (_this$_snapshot$id2 = this._snapshot.id) !== null && _this$_snapshot$id2 !== void 0 ? _this$_snapshot$id2 : (0, _univerjs_core.generateRandomId)(6);
	}
	getRev() {
		return 0;
	}
	incrementRev() {}
	setRev(_rev) {}
	getSnapshot() {
		return this._snapshot;
	}
	getUnitId() {
		return this._unitId;
	}
	getPages() {
		var _this$_snapshot$body;
		return (_this$_snapshot$body = this._snapshot.body) === null || _this$_snapshot$body === void 0 ? void 0 : _this$_snapshot$body.pages;
	}
	getPageOrder() {
		var _this$_snapshot$body2;
		return (_this$_snapshot$body2 = this._snapshot.body) === null || _this$_snapshot$body2 === void 0 ? void 0 : _this$_snapshot$body2.pageOrder;
	}
	getPage(pageId) {
		const pages = this.getPages();
		return pages === null || pages === void 0 ? void 0 : pages[pageId];
	}
	getElementsByPage(pageId) {
		var _this$getPage;
		return (_this$getPage = this.getPage(pageId)) === null || _this$getPage === void 0 ? void 0 : _this$getPage.pageElements;
	}
	getElement(pageId, elementId) {
		var _this$getElementsByPa;
		return (_this$getElementsByPa = this.getElementsByPage(pageId)) === null || _this$getElementsByPa === void 0 ? void 0 : _this$getElementsByPa[elementId];
	}
	getPageSize() {
		return this._snapshot.pageSize;
	}
	getBlankPage() {
		const id = (0, _univerjs_core.generateRandomId)(6);
		return {
			id,
			pageType: 0,
			zIndex: 10,
			title: id,
			description: "",
			pageBackgroundFill: { rgb: "rgb(255,255,255)" },
			pageElements: {}
		};
	}
	setActivePage(page) {
		this._activePage$.next(page);
	}
	getActivePage() {
		return this._activePage;
	}
	updatePage(pageId, page) {
		if (!this._snapshot.body) return;
		this._snapshot.body.pages[pageId] = page;
	}
	appendPage(page) {
		var _activePage$id;
		if (!this._snapshot.body) return;
		this._snapshot.body.pages[page.id] = page;
		const activePage = this._activePage;
		const index = this._snapshot.body.pageOrder.indexOf((_activePage$id = activePage === null || activePage === void 0 ? void 0 : activePage.id) !== null && _activePage$id !== void 0 ? _activePage$id : "");
		this._snapshot.body.pageOrder.splice(index + 1, 0, page.id);
	}
};

//#endregion
//#region package.json
var name = "@univerjs/slides";
var version = "0.25.0";

//#endregion
//#region src/config/config.ts
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
const SLIDES_PLUGIN_CONFIG_KEY = "slides.config";
const configSymbol = Symbol(SLIDES_PLUGIN_CONFIG_KEY);
const defaultPluginConfig = {};

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
//#region src/plugin.ts
let UniverSlidesPlugin = class UniverSlidesPlugin extends _univerjs_core.Plugin {
	constructor(_config = defaultPluginConfig, _injector, _configService, _univerInstanceService) {
		super();
		this._config = _config;
		this._injector = _injector;
		this._configService = _configService;
		this._univerInstanceService = _univerInstanceService;
		_defineProperty(this, "_canvasEngine", null);
		const { ...rest } = (0, _univerjs_core.merge)({}, defaultPluginConfig, this._config);
		this._configService.setConfig(SLIDES_PLUGIN_CONFIG_KEY, rest);
		this._initializeDependencies(this._injector);
	}
	onStarting() {
		this._univerInstanceService.registerCtorForType(_univerjs_core.UniverInstanceType.UNIVER_SLIDE, SlideDataModel);
	}
	initialize() {
		this.initCanvasEngine();
	}
	onReady() {}
	getConfig() {
		return this._config;
	}
	initCanvasEngine() {
		this._canvasEngine = this._injector.get(_univerjs_engine_render.IRenderingEngine);
	}
	onRendered() {
		this.initialize();
	}
	getCanvasEngine() {
		return this._canvasEngine;
	}
	_initializeDependencies(slideInjector) {
		[].forEach((d) => {
			slideInjector.add(d);
		});
	}
};
_defineProperty(UniverSlidesPlugin, "pluginName", "UNIVER_SLIDES_PLUGIN");
_defineProperty(UniverSlidesPlugin, "packageName", name);
_defineProperty(UniverSlidesPlugin, "version", version);
_defineProperty(UniverSlidesPlugin, "type", _univerjs_core.UniverInstanceType.UNIVER_SLIDE);
UniverSlidesPlugin = __decorate([
	__decorateParam(1, (0, _univerjs_core.Inject)(_univerjs_core.Injector)),
	__decorateParam(2, _univerjs_core.IConfigService),
	__decorateParam(3, _univerjs_core.IUniverInstanceService)
], UniverSlidesPlugin);

//#endregion
//#region src/types/enum/prst-geom-type.ts
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
let BasicShapes = /* @__PURE__ */ function(BasicShapes) {
	BasicShapes["Line"] = "line";
	BasicShapes["LineInv"] = "lineInv";
	BasicShapes["Triangle"] = "triangle";
	BasicShapes["RtTriangle"] = "rtTriangle";
	BasicShapes["Rect"] = "rect";
	BasicShapes["Diamond"] = "diamond";
	BasicShapes["Parallelogram"] = "parallelogram";
	BasicShapes["Trapezoid"] = "trapezoid";
	BasicShapes["NonIsocelesTrapezoid"] = "nonIsocelesTrapezoid";
	BasicShapes["Pentagon"] = "pentagon";
	BasicShapes["Hexagon"] = "hexagon";
	BasicShapes["Heptagon"] = "heptagon";
	BasicShapes["Octagon"] = "octagon";
	BasicShapes["Decagon"] = "decagon";
	BasicShapes["Dodecagon"] = "dodecagon";
	BasicShapes["Star4"] = "star4";
	BasicShapes["Star5"] = "star5";
	BasicShapes["Star6"] = "star6";
	BasicShapes["Star7"] = "star7";
	BasicShapes["Star8"] = "star8";
	BasicShapes["Star10"] = "star10";
	BasicShapes["Star12"] = "star12";
	BasicShapes["Star16"] = "star16";
	BasicShapes["Star24"] = "star24";
	BasicShapes["Star32"] = "star32";
	BasicShapes["RoundRect"] = "roundRect";
	BasicShapes["Round1Rect"] = "round1Rect";
	BasicShapes["Round2SameRect"] = "round2SameRect";
	BasicShapes["Round2DiagRect"] = "round2DiagRect";
	BasicShapes["Ellipse"] = "ellipse";
	return BasicShapes;
}({});
let ArrowsAndMarkersShapes = /* @__PURE__ */ function(ArrowsAndMarkersShapes) {
	ArrowsAndMarkersShapes["RightArrow"] = "rightArrow";
	ArrowsAndMarkersShapes["LeftArrow"] = "leftArrow";
	ArrowsAndMarkersShapes["UpArrow"] = "upArrow";
	ArrowsAndMarkersShapes["DownArrow"] = "downArrow";
	ArrowsAndMarkersShapes["LeftRightArrow"] = "leftRightArrow";
	ArrowsAndMarkersShapes["UpDownArrow"] = "upDownArrow";
	ArrowsAndMarkersShapes["QuadArrow"] = "quadArrow";
	ArrowsAndMarkersShapes["LeftRightUpArrow"] = "leftRightUpArrow";
	ArrowsAndMarkersShapes["BentArrow"] = "bentArrow";
	ArrowsAndMarkersShapes["UturnArrow"] = "uturnArrow";
	ArrowsAndMarkersShapes["CircularArrow"] = "circularArrow";
	ArrowsAndMarkersShapes["NotchedRightArrow"] = "notchedRightArrow";
	ArrowsAndMarkersShapes["HomePlate"] = "homePlate";
	ArrowsAndMarkersShapes["Chevron"] = "chevron";
	ArrowsAndMarkersShapes["LeftCircularArrow"] = "leftCircularArrow";
	ArrowsAndMarkersShapes["LeftRightCircularArrow"] = "leftRightCircularArrow";
	return ArrowsAndMarkersShapes;
}({});
let OtherShapes = /* @__PURE__ */ function(OtherShapes) {
	OtherShapes["Plaque"] = "plaque";
	OtherShapes["Can"] = "can";
	OtherShapes["Cube"] = "cube";
	OtherShapes["Bevel"] = "bevel";
	OtherShapes["Donut"] = "donut";
	OtherShapes["NoSmoking"] = "noSmoking";
	OtherShapes["BlockArc"] = "blockArc";
	OtherShapes["FoldedCorner"] = "foldedCorner";
	return OtherShapes;
}({});
let SpecialShapes = /* @__PURE__ */ function(SpecialShapes) {
	SpecialShapes["SmileyFace"] = "smileyFace";
	SpecialShapes["Heart"] = "heart";
	SpecialShapes["LightningBolt"] = "lightningBolt";
	SpecialShapes["Sun"] = "sun";
	SpecialShapes["Moon"] = "moon";
	SpecialShapes["Cloud"] = "cloud";
	SpecialShapes["Arc"] = "arc";
	SpecialShapes["Backpack"] = "backpack";
	SpecialShapes["Frame"] = "frame";
	SpecialShapes["HalfFrame"] = "halfFrame";
	SpecialShapes["Corner"] = "corner";
	SpecialShapes["Chord"] = "chord";
	SpecialShapes["Pie"] = "pie";
	SpecialShapes["Teardrop"] = "teardrop";
	SpecialShapes["WedgeRectCallout"] = "wedgeRectCallout";
	SpecialShapes["WedgeRRectCallout"] = "wedgeRRectCallout";
	SpecialShapes["WedgeEllipseCallout"] = "wedgeEllipseCallout";
	SpecialShapes["CloudCallout"] = "cloudCallout";
	SpecialShapes["BorderCallout1"] = "borderCallout1";
	SpecialShapes["BorderCallout2"] = "borderCallout2";
	SpecialShapes["BorderCallout3"] = "borderCallout3";
	SpecialShapes["AccentCallout1"] = "accentCallout1";
	SpecialShapes["AccentCallout2"] = "accentCallout2";
	SpecialShapes["AccentCallout3"] = "accentCallout3";
	SpecialShapes["Callout1"] = "callout1";
	SpecialShapes["Callout2"] = "callout2";
	SpecialShapes["Callout3"] = "callout3";
	SpecialShapes["ActionButtonBackPrevious"] = "actionButtonBackPrevious";
	SpecialShapes["ActionButtonEnd"] = "actionButtonEnd";
	SpecialShapes["ActionButtonForwardNext"] = "actionButtonForwardNext";
	SpecialShapes["ActionButtonHelp"] = "actionButtonHelp";
	SpecialShapes["ActionButtonHome"] = "actionButtonHome";
	SpecialShapes["ActionButtonInformation"] = "actionButtonInformation";
	SpecialShapes["ActionButtonMovie"] = "actionButtonMovie";
	SpecialShapes["ActionButtonReturn"] = "actionButtonReturn";
	SpecialShapes["ActionButtonSound"] = "actionButtonSound";
	return SpecialShapes;
}({});

//#endregion
//#region src/views/render/adaptor.ts
var ObjectAdaptor = class {
	constructor() {
		_defineProperty(this, "zIndex", 0);
		_defineProperty(this, "viewKey", null);
	}
	check(type) {
		if (type !== this.viewKey) return;
		return this;
	}
	create(injector) {}
};
const CanvasObjectProviderRegistry = _univerjs_core.Registry.create();

//#endregion
//#region src/views/render/adaptors/docs-adaptor.ts
let DocsAdaptor = class DocsAdaptor extends ObjectAdaptor {
	constructor(_localeService) {
		super();
		this._localeService = _localeService;
		_defineProperty(this, "zIndex", 5);
		_defineProperty(this, "viewKey", 4);
		_defineProperty(this, "_liquid", new _univerjs_engine_render.Liquid());
	}
	check(type) {
		if (type !== this.viewKey) return;
		return this;
	}
	convert(pageElement, mainScene) {
		var _documents$getSkeleto, _scene$getTransformer;
		const { id, zIndex, left = 0, top = 0, width, height, angle, scaleX, scaleY, skewX, skewY, flipX, flipY, title, description, document: documentData } = pageElement;
		if (documentData == null) return;
		const docViewModel = new _univerjs_engine_render.DocumentViewModel(new _univerjs_core.DocumentDataModel(documentData));
		const documentSkeleton = _univerjs_engine_render.DocumentSkeleton.create(docViewModel, this._localeService);
		const documents = new _univerjs_engine_render.Documents("__DocsRender__", documentSkeleton);
		documentSkeleton.calculate();
		const sv = new _univerjs_engine_render.SceneViewer("__DocsViewer__" + id, {
			top,
			left,
			width,
			height,
			zIndex,
			angle,
			scaleX,
			scaleY,
			skewX,
			skewY,
			flipX,
			flipY
		});
		const scene = new _univerjs_engine_render.Scene("__DocsScene__" + id, sv);
		const viewMain = new _univerjs_engine_render.Viewport("__DocsViewPort_" + id, scene, {
			left: 0,
			top: 0,
			bottom: 0,
			right: 0,
			explicitViewportWidthSet: false,
			explicitViewportHeightSet: false,
			isWheelPreventDefaultX: true
		});
		scene.attachControl();
		scene.onMouseWheel$.subscribeEvent((evt, state) => {
			const e = evt;
			if (e.ctrlKey) {
				const deltaFactor = Math.abs(e.deltaX);
				let scrollNum = deltaFactor < 40 ? .2 : deltaFactor < 80 ? .4 : .2;
				scrollNum *= e.deltaY > 0 ? -1 : 1;
				if (scene.scaleX < 1) scrollNum /= 2;
				if (scene.scaleX + scrollNum > 4) scene.scale(4, 4);
				else if (scene.scaleX + scrollNum < .1) scene.scale(.1, .1);
				else {
					e.deltaY;
					e.preventDefault();
				}
			} else viewMain.onMouseWheel(e, state);
		});
		new _univerjs_engine_render.ScrollBar(viewMain, { mainScene });
		scene.addObject(documents);
		const size = documentSkeleton.getActualSize();
		documents.resize(size.actualWidth, size.actualHeight);
		scene.resize(size.actualWidth, size.actualHeight + 200);
		(_documents$getSkeleto = documents.getSkeleton()) === null || _documents$getSkeleto === void 0 || _documents$getSkeleto.getPageSize();
		documents.pageRender$.subscribe((config) => {
			const { page, pageLeft, pageTop, ctx } = config;
			const { width, height, marginBottom, marginLeft, marginRight, marginTop } = page;
			ctx.save();
			ctx.translate(pageLeft - .5, pageTop - .5);
			ctx.restore();
		});
		const { left: docsLeft, top: docsTop } = documents;
		const skeletonData = documentSkeleton.getSkeletonData();
		if (skeletonData == null) return;
		const { pages } = skeletonData;
		const objectList = [];
		const pageMarginCache = /* @__PURE__ */ new Map();
		this._recalculateSizeBySkeleton(documents, scene, documentSkeleton);
		for (let i = 0, len = pages.length; i < len; i++) {
			const page = pages[i];
			const { skeDrawings, marginLeft, marginTop, pageWidth, pageHeight } = page;
			this._liquid.translatePagePadding(page);
			skeDrawings.forEach((drawing) => {
				const { aLeft, aTop, height, width, drawingOrigin } = drawing;
				const { docTransform } = drawingOrigin;
				const rect = new _univerjs_engine_render.Image(drawing.drawingId, {
					left: aLeft + docsLeft + this._liquid.x,
					top: aTop + docsTop + this._liquid.y,
					width,
					height,
					zIndex: 11
				});
				pageMarginCache.set(drawing.drawingId, {
					marginLeft: this._liquid.x,
					marginTop: this._liquid.y
				});
				objectList.push(rect);
			});
			this._liquid.translatePage(page, documents.pageLayoutType, documents.pageMarginLeft, documents.pageMarginTop);
		}
		scene.addObjects(objectList);
		objectList.forEach((object) => {
			scene.attachTransformerTo(object);
		});
		(_scene$getTransformer = scene.getTransformer()) === null || _scene$getTransformer === void 0 || _scene$getTransformer.changing$.subscribe((state) => {
			const { objects } = state;
			objects.forEach((object) => {
				const { oKey, left, top, height, width } = object;
				const cache = pageMarginCache.get(oKey);
				const marginLeft = (cache === null || cache === void 0 ? void 0 : cache.marginLeft) || 0;
				const marginTop = (cache === null || cache === void 0 ? void 0 : cache.marginTop) || 0;
				documentSkeleton === null || documentSkeleton === void 0 || documentSkeleton.getViewModel().getDataModel().updateDrawing(oKey, {
					left: left - docsLeft - marginLeft,
					top: top - docsTop - marginTop,
					height,
					width
				});
			});
			documentSkeleton === null || documentSkeleton === void 0 || documentSkeleton.calculate();
		});
		this._calculatePagePosition(documents, scene, viewMain);
		return sv;
	}
	_recalculateSizeBySkeleton(docsComponent, scene, skeleton) {
		var _skeleton$getSkeleton;
		const pages = (_skeleton$getSkeleton = skeleton.getSkeletonData()) === null || _skeleton$getSkeleton === void 0 ? void 0 : _skeleton$getSkeleton.pages;
		if (pages == null) return;
		let width = 0;
		let height = 0;
		for (let i = 0, len = pages.length; i < len; i++) {
			const { pageWidth, pageHeight } = pages[i];
			if (docsComponent.pageLayoutType === _univerjs_engine_render.PageLayoutType.VERTICAL) {
				height += pageHeight;
				height += docsComponent.pageMarginTop;
				if (i === len - 1) height += docsComponent.pageMarginTop;
				width = Math.max(width, pageWidth);
			} else if (docsComponent.pageLayoutType === _univerjs_engine_render.PageLayoutType.HORIZONTAL) {
				width += pageWidth;
				if (i !== len - 1) width += docsComponent.pageMarginLeft;
				height = Math.max(height, pageHeight);
			}
		}
		docsComponent.resize(width, height);
		scene.resize(width, height);
	}
	_calculatePagePosition(docsComponent, scene, viewport, zoomRatio = 1) {
		const parent = scene === null || scene === void 0 ? void 0 : scene.getParent();
		const { width: docsWidth, height: docsHeight, pageMarginLeft, pageMarginTop } = docsComponent;
		if (parent == null || docsWidth === Number.POSITIVE_INFINITY || docsHeight === Number.POSITIVE_INFINITY) return;
		const { width: engineWidth, height: engineHeight } = parent;
		let docsLeft = 0;
		let docsTop = 0;
		let sceneWidth = 0;
		let sceneHeight = 0;
		let scrollToX = Number.POSITIVE_INFINITY;
		if (engineWidth > (docsWidth + pageMarginLeft * 2) * zoomRatio) {
			docsLeft = engineWidth / 2 - docsWidth * zoomRatio / 2;
			docsLeft /= zoomRatio;
			sceneWidth = (engineWidth - pageMarginLeft * 2) / zoomRatio;
			scrollToX = 0;
		} else {
			docsLeft = pageMarginLeft;
			sceneWidth = docsWidth + pageMarginLeft * 2;
			scrollToX = (sceneWidth - engineWidth / zoomRatio) / 2;
		}
		if (engineHeight > docsHeight) {
			docsTop = engineHeight / 2 - docsHeight / 2;
			sceneHeight = (engineHeight - pageMarginTop * 2) / zoomRatio;
		} else {
			docsTop = pageMarginTop;
			sceneHeight = docsHeight + pageMarginTop * 2;
		}
		scene.resize(sceneWidth, sceneHeight + 200);
		docsComponent.translate(docsLeft, docsTop);
		if (scrollToX !== Number.POSITIVE_INFINITY && viewport != null) {
			const actualX = viewport.transScroll2ViewportScrollValue(scrollToX, 0).x;
			viewport.scrollToBarPos({ x: actualX });
		}
		return this;
	}
};
DocsAdaptor = __decorate([__decorateParam(0, (0, _univerjs_core.Inject)(_univerjs_core.LocaleService))], DocsAdaptor);
var DocsAdaptorFactory = class {
	constructor() {
		_defineProperty(this, "zIndex", 5);
	}
	create(injector) {
		return injector.createInstance(DocsAdaptor);
	}
};
CanvasObjectProviderRegistry.add(new DocsAdaptorFactory());

//#endregion
//#region src/views/render/adaptors/image-adaptor.ts
var ImageAdaptor = class extends ObjectAdaptor {
	constructor(..._args) {
		super(..._args);
		_defineProperty(this, "zIndex", 1);
		_defineProperty(this, "viewKey", 1);
	}
	check(type) {
		if (type !== this.viewKey) return;
		return this;
	}
	convert(pageElement) {
		const { id, zIndex, left = 0, top = 0, width, height, angle, scaleX, scaleY, skewX, skewY, flipX, flipY, title, description, image = {} } = pageElement;
		const { imageProperties, placeholder, link } = image;
		return new _univerjs_engine_render.Image(id, {
			url: (imageProperties === null || imageProperties === void 0 ? void 0 : imageProperties.contentUrl) || "",
			top,
			left,
			width,
			height,
			zIndex,
			angle,
			scaleX,
			scaleY,
			skewX,
			skewY,
			flipX,
			flipY,
			forceRender: true
		});
	}
};
var ImageAdaptorFactory = class {
	constructor() {
		_defineProperty(this, "zIndex", 4);
	}
	create(injector) {
		return injector.createInstance(ImageAdaptor);
	}
};
CanvasObjectProviderRegistry.add(new ImageAdaptorFactory());

//#endregion
//#region src/views/render/adaptors/rich-text-adaptor.ts
let RichTextAdaptor = class RichTextAdaptor extends ObjectAdaptor {
	constructor(_localeService) {
		super();
		this._localeService = _localeService;
		_defineProperty(this, "zIndex", 2);
		_defineProperty(this, "viewKey", 2);
	}
	check(type) {
		if (type !== this.viewKey) return;
		return this;
	}
	convert(pageElement, _mainScene) {
		const { id, zIndex, left = 0, top = 0, width, height, angle, scaleX, scaleY, skewX, skewY, flipX, flipY, title, description, richText = {} } = pageElement;
		const { text, ff, fs, it, bl, ul, st, ol, bg, bd, cl, rich } = richText;
		let config = {
			top,
			left,
			width,
			height,
			zIndex,
			angle,
			scaleX,
			scaleY,
			skewX,
			skewY,
			flipX,
			flipY,
			forceRender: true
		};
		let isNotNull = false;
		if (text != null) {
			config = {
				...config,
				text,
				ff,
				fs,
				it,
				bl,
				ul,
				st,
				ol,
				bg,
				bd,
				cl
			};
			isNotNull = true;
		} else if (rich != null) {
			config = {
				...config,
				richText: rich
			};
			isNotNull = true;
		}
		if (isNotNull === false) return;
		return new _univerjs_engine_render.RichText(this._localeService, id, config);
	}
};
RichTextAdaptor = __decorate([__decorateParam(0, (0, _univerjs_core.Inject)(_univerjs_core.LocaleService))], RichTextAdaptor);
var RichTextAdaptorFactory = class {
	constructor() {
		_defineProperty(this, "zIndex", 0);
	}
	create(injector) {
		return injector.createInstance(RichTextAdaptor);
	}
};
CanvasObjectProviderRegistry.add(new RichTextAdaptorFactory());

//#endregion
//#region src/views/render/adaptors/shape-adaptor.ts
var ShapeAdaptor = class extends ObjectAdaptor {
	constructor(..._args) {
		super(..._args);
		_defineProperty(this, "zIndex", 2);
		_defineProperty(this, "viewKey", 0);
	}
	check(type) {
		if (type !== this.viewKey) return;
		return this;
	}
	convert(pageElement) {
		const { id, zIndex, left = 0, top = 0, width, height, angle, scaleX, scaleY, skewX, skewY, flipX, flipY, title, description } = pageElement;
		const { shapeType, text, shapeProperties, placeholder, link } = pageElement.shape || {};
		const fill = shapeProperties == null ? "" : (0, _univerjs_core.getColorStyle)(shapeProperties.shapeBackgroundFill) || "rgba(255,255,255,1)";
		const outline = shapeProperties === null || shapeProperties === void 0 ? void 0 : shapeProperties.outline;
		const strokeStyle = {};
		if (outline) {
			const { outlineFill, weight } = outline;
			strokeStyle.strokeWidth = weight;
			strokeStyle.stroke = (0, _univerjs_core.getColorStyle)(outlineFill) || "rgba(0,0,0,1)";
		}
		if (shapeType === "rect") return new _univerjs_engine_render.Rect(id, {
			fill,
			top,
			left,
			width,
			height,
			zIndex,
			angle,
			scaleX,
			scaleY,
			skewX,
			skewY,
			flipX,
			flipY,
			forceRender: true,
			...strokeStyle
		});
		if (shapeType === "roundRect") return new _univerjs_engine_render.Rect(id, {
			fill,
			top,
			left,
			width,
			height,
			zIndex,
			angle,
			scaleX,
			scaleY,
			skewX,
			skewY,
			flipX,
			flipY,
			forceRender: true,
			radius: (shapeProperties === null || shapeProperties === void 0 ? void 0 : shapeProperties.radius) || 0,
			...strokeStyle
		});
		if (shapeType === "ellipse") {
			console.warn(shapeProperties === null || shapeProperties === void 0 ? void 0 : shapeProperties.radius);
			return new _univerjs_engine_render.Circle(id, {
				fill,
				top,
				left,
				width,
				height,
				zIndex,
				angle,
				scaleX,
				scaleY,
				skewX,
				skewY,
				flipX,
				flipY,
				forceRender: true,
				radius: (shapeProperties === null || shapeProperties === void 0 ? void 0 : shapeProperties.radius) || 0,
				...strokeStyle
			});
		}
	}
};
var ShapeAdaptorFactory = class {
	constructor() {
		_defineProperty(this, "zIndex", 2);
	}
	create(injector) {
		return injector.createInstance(ShapeAdaptor);
	}
};
CanvasObjectProviderRegistry.add(new ShapeAdaptorFactory());

//#endregion
//#region src/views/render/object-provider.ts
let ObjectProvider = class ObjectProvider {
	constructor(_injector) {
		this._injector = _injector;
		_defineProperty(this, "_adaptors", []);
		this._adaptorLoader();
	}
	convertToRenderObjects(pageElements, mainScene) {
		const pageKeys = Object.keys(pageElements);
		const objects = [];
		pageKeys.forEach((key) => {
			const pageElement = pageElements[key];
			const o = this._executor(pageElement, mainScene);
			if (o != null) objects.push(o);
		});
		return objects;
	}
	convertToRenderObject(pageElement, mainScene) {
		return this._executor(pageElement, mainScene);
	}
	_executor(pageElement, mainScene) {
		const { id: pageElementId, type } = pageElement;
		for (const adaptor of this._adaptors) {
			var _adaptor$check;
			const o = (_adaptor$check = adaptor.check(type)) === null || _adaptor$check === void 0 ? void 0 : _adaptor$check.convert(pageElement, mainScene);
			if (o != null) return o;
		}
	}
	_adaptorLoader() {
		CanvasObjectProviderRegistry.getData().sort(_univerjs_core.sortRules).forEach((adaptorFactory) => {
			this._adaptors.push(adaptorFactory.create(this._injector));
		});
	}
};
ObjectProvider = __decorate([__decorateParam(0, (0, _univerjs_core.Inject)(_univerjs_core.Injector))], ObjectProvider);

//#endregion
//#region src/views/render/adaptors/slide-adaptor.ts
let SLIDE_VIEW_KEY = /* @__PURE__ */ function(SLIDE_VIEW_KEY) {
	SLIDE_VIEW_KEY["MAIN"] = "__SLIDERender__";
	SLIDE_VIEW_KEY["SCENE_VIEWER"] = "__SLIDEViewer__";
	SLIDE_VIEW_KEY["SCENE"] = "__SLIDEScene__";
	SLIDE_VIEW_KEY["VIEWPORT"] = "__SLIDEViewPort_";
	return SLIDE_VIEW_KEY;
}({});
let SlideAdaptor = class SlideAdaptor extends ObjectAdaptor {
	constructor(_injector) {
		super();
		this._injector = _injector;
		_defineProperty(this, "zIndex", 6);
		_defineProperty(this, "viewKey", 5);
		_defineProperty(this, "_ObjectProvider", null);
	}
	check(type) {
		if (type !== this.viewKey) return;
		return this;
	}
	convert(pageElement, mainScene) {
		const { id, zIndex, left = 0, top = 0, width, height, angle, scaleX, scaleY, skewX, skewY, flipX, flipY, title, description, slide: slideData } = pageElement;
		if (slideData == null) return;
		const model = new SlideDataModel(slideData);
		const slideComponent = new _univerjs_engine_render.Slide("__SLIDERender__" + id, {
			top,
			left,
			width,
			height,
			zIndex,
			angle,
			scaleX,
			scaleY,
			skewX,
			skewY,
			flipX,
			flipY,
			forceRender: true
		});
		slideComponent.enableNav();
		slideComponent.enableSelectedClipElement();
		const pageOrder = model.getPageOrder();
		const pages = model.getPages();
		if (!pageOrder || !pages) return slideComponent;
		this._ObjectProvider = new ObjectProvider(this._injector);
		for (let i = 0, len = pageOrder.length; i < len; i++) {
			const page = pages[pageOrder[i]];
			const { id } = page;
			slideComponent.addPageScene(this._createScene(id, slideComponent, page, mainScene, model));
		}
		slideComponent.activeFirstPage();
		return slideComponent;
	}
	_createScene(pageId, parent, page, mainScene, model) {
		var _this$_ObjectProvider;
		const { width, height } = parent;
		const scene = new _univerjs_engine_render.Scene(pageId, parent, {
			width,
			height
		});
		new _univerjs_engine_render.Viewport(`PageViewer_${pageId}`, scene, {
			left: 0,
			top: 0,
			bottom: 0,
			right: 0,
			explicitViewportWidthSet: false,
			explicitViewportHeightSet: false
		}).closeClip();
		const { pageElements, pageBackgroundFill } = page;
		const objects = (_this$_ObjectProvider = this._ObjectProvider) === null || _this$_ObjectProvider === void 0 ? void 0 : _this$_ObjectProvider.convertToRenderObjects(pageElements, mainScene);
		this._addBackgroundRect(scene, pageBackgroundFill, model);
		scene.addObjects(objects);
		objects === null || objects === void 0 || objects.forEach((object) => {
			scene.attachTransformerTo(object);
		});
		return scene;
	}
	_addBackgroundRect(scene, fill, model) {
		const { width: pageWidth = 0, height: pageHeight = 0 } = model.getPageSize();
		const page = new _univerjs_engine_render.Rect("canvas", {
			left: 0,
			top: 0,
			width: pageWidth,
			height: pageHeight,
			strokeWidth: 1,
			stroke: "rgba(198,198,198, 1)",
			fill: (0, _univerjs_core.getColorStyle)(fill) || "rgba(255,255,255, 1)",
			zIndex: 0,
			evented: false
		});
		scene.addObject(page, 0);
	}
};
SlideAdaptor = __decorate([__decorateParam(0, (0, _univerjs_core.Inject)(_univerjs_core.Injector))], SlideAdaptor);
var SlideAdaptorFactory = class {
	constructor() {
		_defineProperty(this, "zIndex", 6);
	}
	create(injector) {
		return injector.createInstance(SlideAdaptor);
	}
};
CanvasObjectProviderRegistry.add(new SlideAdaptorFactory());

//#endregion
//#region src/views/render/adaptors/spreadsheet-adaptor.ts
let SpreadsheetAdaptor = class SpreadsheetAdaptor extends ObjectAdaptor {
	constructor(_localeService, _contextService, _configService, _injector) {
		super();
		this._localeService = _localeService;
		this._contextService = _contextService;
		this._configService = _configService;
		this._injector = _injector;
		_defineProperty(this, "zIndex", 4);
		_defineProperty(this, "viewKey", 3);
	}
	check(type) {
		if (type !== this.viewKey) return;
		return this;
	}
	convert(pageElement, mainScene) {
		const { id, zIndex, left = 0, top = 0, width, height, angle, scaleX, scaleY, skewX, skewY, flipX, flipY, spreadsheet: spreadsheetModel } = pageElement;
		if (spreadsheetModel == null) return;
		const { worksheet, styles } = spreadsheetModel;
		const styleModel = new _univerjs_core.Styles(styles);
		const spreadsheetSkeleton = new _univerjs_engine_render.SpreadsheetSkeleton(new _univerjs_core.Worksheet(id, worksheet, styleModel), styleModel, this._localeService, this._contextService, this._configService, this._injector);
		const { rowTotalHeight, columnTotalWidth, rowHeaderWidth, columnHeaderHeight } = spreadsheetSkeleton;
		const allWidth = columnTotalWidth + worksheet.rowHeader.width || 0;
		const allHeight = rowTotalHeight + worksheet.columnHeader.height || 0;
		const sv = new _univerjs_engine_render.SceneViewer("spreadInSlideSceneViewer" + id, {
			top,
			left,
			width,
			height,
			zIndex,
			angle,
			scaleX,
			scaleY,
			skewX,
			skewY,
			flipX,
			flipY,
			forceRender: true
		});
		const scene = new _univerjs_engine_render.Scene("spreadInSlideScene" + id, sv, {
			width: allWidth,
			height: allHeight
		});
		this._updateViewport(id, rowHeaderWidth, columnHeaderHeight, scene, mainScene);
		const spreadsheet = new _univerjs_engine_render.Spreadsheet("testSheetViewer", spreadsheetSkeleton, false);
		const spreadsheetRowHeader = new _univerjs_engine_render.SpreadsheetRowHeader("spreadInSlideRow", spreadsheetSkeleton);
		const spreadsheetColumnHeader = new _univerjs_engine_render.SpreadsheetColumnHeader("spreadInSlideColumn", spreadsheetSkeleton);
		const SpreadsheetLeftTopPlaceholder = new _univerjs_engine_render.Rect("spreadInSlideLeftTop", {
			zIndex: 2,
			left: -1,
			top: -1,
			width: rowHeaderWidth,
			height: columnHeaderHeight,
			fill: (0, _univerjs_engine_render.getColor)([
				248,
				249,
				250
			]),
			stroke: (0, _univerjs_engine_render.getColor)([
				217,
				217,
				217
			]),
			strokeWidth: 1
		});
		spreadsheet.zIndex = 10;
		scene.addObjects([spreadsheet], 1);
		scene.addObjects([
			spreadsheetRowHeader,
			spreadsheetColumnHeader,
			SpreadsheetLeftTopPlaceholder
		], 2);
		return sv;
	}
	_updateViewport(id, rowHeaderWidth, columnHeaderHeight, scene, mainScene) {
		if (mainScene == null) return;
		const rowHeaderWidthScale = rowHeaderWidth * scene.scaleX;
		const columnHeaderHeightScale = columnHeaderHeight * scene.scaleY;
		const viewMain = new _univerjs_engine_render.Viewport("spreadInSlideViewMain" + id, scene, {
			left: rowHeaderWidthScale,
			top: columnHeaderHeightScale,
			bottom: 0,
			right: 0,
			explicitViewportWidthSet: false,
			explicitViewportHeightSet: false,
			isWheelPreventDefaultX: true
		});
		const viewTop = new _univerjs_engine_render.Viewport("spreadInSlideViewTop" + id, scene, {
			left: rowHeaderWidthScale,
			height: columnHeaderHeightScale,
			top: 0,
			right: 0,
			explicitViewportWidthSet: false,
			isWheelPreventDefaultX: true
		});
		const viewLeft = new _univerjs_engine_render.Viewport("spreadInSlideViewLeft" + id, scene, {
			left: 0,
			bottom: 0,
			top: columnHeaderHeightScale,
			width: rowHeaderWidthScale,
			explicitViewportHeightSet: false,
			isWheelPreventDefaultX: true
		});
		new _univerjs_engine_render.Viewport("spreadInSlideViewLeftTop" + id, scene, {
			left: 0,
			top: 0,
			width: rowHeaderWidthScale,
			height: columnHeaderHeightScale,
			isWheelPreventDefaultX: true
		});
		viewMain.onScrollAfter$.subscribeEvent((param) => {
			const { scrollX, scrollY, viewportScrollX, viewportScrollY } = param;
			viewTop.updateScrollVal({
				scrollX,
				viewportScrollX
			});
			viewLeft.updateScrollVal({
				scrollY,
				viewportScrollY
			});
		});
		scene.attachControl();
		new _univerjs_engine_render.ScrollBar(viewMain, { mainScene });
		scene.onMouseWheel$.subscribeEvent((evt, state) => {
			const e = evt;
			if (e.ctrlKey) {
				const deltaFactor = Math.abs(e.deltaX);
				let scrollNum = deltaFactor < 40 ? .05 : deltaFactor < 80 ? .02 : .01;
				scrollNum *= e.deltaY > 0 ? -1 : 1;
				if (scene.scaleX < 1) scrollNum /= 2;
				if (scene.scaleX + scrollNum > 4) scene.scale(4, 4);
				else if (scene.scaleX + scrollNum < .1) scene.scale(.1, .1);
				else {
					scene.scaleBy(scrollNum, scrollNum);
					e.preventDefault();
				}
			} else viewMain.onMouseWheel(e, state);
		});
	}
};
SpreadsheetAdaptor = __decorate([
	__decorateParam(0, (0, _univerjs_core.Inject)(_univerjs_core.LocaleService)),
	__decorateParam(1, _univerjs_core.IContextService),
	__decorateParam(2, _univerjs_core.IConfigService),
	__decorateParam(3, (0, _univerjs_core.Inject)(_univerjs_core.Injector))
], SpreadsheetAdaptor);
var SpreadsheetAdaptorFactory = class {
	constructor() {
		_defineProperty(this, "zIndex", 4);
	}
	create(injector) {
		return injector.createInstance(SpreadsheetAdaptor);
	}
};
CanvasObjectProviderRegistry.add(new SpreadsheetAdaptorFactory());

//#endregion
//#region src/views/render/index.ts
let SLIDE_KEY = /* @__PURE__ */ function(SLIDE_KEY) {
	SLIDE_KEY["COMPONENT"] = "__slideRender__";
	SLIDE_KEY["SCENE"] = "__mainScene__";
	SLIDE_KEY["VIEW"] = "__mainView__";
	return SLIDE_KEY;
}({});

//#endregion
exports.ArrowsAndMarkersShapes = ArrowsAndMarkersShapes;
exports.BasicShapes = BasicShapes;
exports.CanvasObjectProviderRegistry = CanvasObjectProviderRegistry;
exports.DEFAULT_SLIDE = DEFAULT_SLIDE;
exports.ObjectAdaptor = ObjectAdaptor;
Object.defineProperty(exports, 'ObjectProvider', {
  enumerable: true,
  get: function () {
    return ObjectProvider;
  }
});
exports.OtherShapes = OtherShapes;
exports.PageElementType = PageElementType;
exports.PageType = PageType;
exports.RelativeSlideLink = RelativeSlideLink;
exports.SLIDE_KEY = SLIDE_KEY;
exports.SLIDE_VIEW_KEY = SLIDE_VIEW_KEY;
exports.SlideDataModel = SlideDataModel;
exports.SpecialShapes = SpecialShapes;
Object.defineProperty(exports, 'UniverSlidesPlugin', {
  enumerable: true,
  get: function () {
    return UniverSlidesPlugin;
  }
});