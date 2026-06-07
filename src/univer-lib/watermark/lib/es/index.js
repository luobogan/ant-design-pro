import { Disposable, IConfigService, ILocalStorageService, Inject, Injector, Plugin, RxDisposable, UniverInstanceType, UserManagerService, merge } from "@univerjs/core";
import { IRenderManagerService, IWatermarkTypeEnum, UNIVER_WATERMARK_LAYER_INDEX, UNIVER_WATERMARK_STORAGE_KEY, WatermarkLayer } from "@univerjs/engine-render";
import { Subject } from "rxjs";

//#region src/common/const.ts
const WATERMARK_IMAGE_ALLOW_IMAGE_LIST = [
	"image/png",
	"image/jpeg",
	"image/jpg",
	"image/bmp"
];
const WatermarkTextBaseConfig = {
	content: "",
	fontSize: 16,
	color: "rgb(0,0,0)",
	bold: false,
	italic: false,
	direction: "ltr",
	x: 60,
	y: 36,
	repeat: true,
	spacingX: 200,
	spacingY: 100,
	rotate: 0,
	opacity: .15
};
const WatermarkImageBaseConfig = {
	url: "",
	width: 100,
	height: 100,
	maintainAspectRatio: true,
	originRatio: 1,
	x: 60,
	y: 36,
	repeat: true,
	spacingX: 200,
	spacingY: 100,
	rotate: 0,
	opacity: .15
};
const WatermarkUserInfoBaseConfig = {
	name: true,
	email: false,
	phone: false,
	uid: false,
	fontSize: 16,
	color: "rgb(0,0,0)",
	bold: false,
	italic: false,
	direction: "ltr",
	x: 60,
	y: 60,
	repeat: true,
	spacingX: 200,
	spacingY: 100,
	rotate: -30,
	opacity: .15
};

//#endregion
//#region package.json
var name = "@univerjs/watermark";
var version = "0.25.0";

//#endregion
//#region src/config/config.ts
const WATERMARK_PLUGIN_CONFIG_KEY = "watermark.config";
const configSymbol = Symbol(WATERMARK_PLUGIN_CONFIG_KEY);
const defaultPluginConfig = {};

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
//#region src/services/watermark.service.ts
let WatermarkService = class WatermarkService extends Disposable {
	constructor(_localStorageService) {
		super();
		this._localStorageService = _localStorageService;
		_defineProperty(this, "_updateConfig$", new Subject());
		_defineProperty(this, "updateConfig$", this._updateConfig$.asObservable());
		_defineProperty(this, "_refresh$", new Subject());
		_defineProperty(this, "refresh$", this._refresh$.asObservable());
	}
	async getWatermarkConfig() {
		return await this._localStorageService.getItem(UNIVER_WATERMARK_STORAGE_KEY);
	}
	updateWatermarkConfig(config) {
		this._localStorageService.setItem(UNIVER_WATERMARK_STORAGE_KEY, config);
		this._updateConfig$.next(config);
	}
	deleteWatermarkConfig() {
		this._localStorageService.removeItem(UNIVER_WATERMARK_STORAGE_KEY);
		this._updateConfig$.next(null);
	}
	refresh() {
		this._refresh$.next(Math.random());
	}
	dispose() {
		this._refresh$.complete();
		this._updateConfig$.complete();
	}
};
WatermarkService = __decorate([__decorateParam(0, Inject(ILocalStorageService))], WatermarkService);

//#endregion
//#region src/controllers/watermark.render.controller.ts
let WatermarkRenderController = class WatermarkRenderController extends RxDisposable {
	constructor(_context, _watermarkService, _localStorageService, _userManagerService) {
		super();
		this._context = _context;
		this._watermarkService = _watermarkService;
		this._localStorageService = _localStorageService;
		this._userManagerService = _userManagerService;
		_defineProperty(this, "_watermarkLayer", void 0);
		this._watermarkLayer = new WatermarkLayer(_context.scene, [], UNIVER_WATERMARK_LAYER_INDEX);
		this._initAddRender();
		this._initWatermarkUpdate();
		this._initWatermarkConfig();
	}
	_initAddRender() {
		const { scene } = this._context;
		scene.addLayer(this._watermarkLayer);
	}
	async _initWatermarkConfig() {
		const config = await this._localStorageService.getItem(UNIVER_WATERMARK_STORAGE_KEY);
		if (config) {
			var _this$_context$mainCo;
			this._watermarkService.updateWatermarkConfig(config);
			(_this$_context$mainCo = this._context.mainComponent) === null || _this$_context$mainCo === void 0 || _this$_context$mainCo.makeDirty();
		}
	}
	_initWatermarkUpdate() {
		this.disposeWithMe(this._watermarkService.updateConfig$.subscribe((_config) => {
			var _this$_context$mainCo3;
			if (!_config) {
				var _this$_context$mainCo2;
				this._watermarkLayer.updateConfig();
				(_this$_context$mainCo2 = this._context.mainComponent) === null || _this$_context$mainCo2 === void 0 || _this$_context$mainCo2.makeDirty();
				return;
			}
			if (_config.type === IWatermarkTypeEnum.UserInfo) this._watermarkLayer.updateConfig(_config, this._userManagerService.getCurrentUser());
			else this._watermarkLayer.updateConfig(_config);
			(_this$_context$mainCo3 = this._context.mainComponent) === null || _this$_context$mainCo3 === void 0 || _this$_context$mainCo3.makeDirty();
		}));
	}
};
WatermarkRenderController = __decorate([
	__decorateParam(1, Inject(WatermarkService)),
	__decorateParam(2, Inject(ILocalStorageService)),
	__decorateParam(3, Inject(UserManagerService))
], WatermarkRenderController);

//#endregion
//#region src/plugin.ts
let UniverWatermarkPlugin = class UniverWatermarkPlugin extends Plugin {
	constructor(_config = defaultPluginConfig, _injector, _configService, _renderManagerSrv, _localStorageService) {
		super();
		this._config = _config;
		this._injector = _injector;
		this._configService = _configService;
		this._renderManagerSrv = _renderManagerSrv;
		this._localStorageService = _localStorageService;
		const { ...rest } = merge({}, defaultPluginConfig, this._config);
		this._configService.setConfig(WATERMARK_PLUGIN_CONFIG_KEY, rest);
		this._initWatermarkStorage();
		this._initDependencies();
	}
	async _initWatermarkStorage() {
		const config = this._configService.getConfig(WATERMARK_PLUGIN_CONFIG_KEY);
		if (!config) return;
		const { userWatermarkSettings, textWatermarkSettings, imageWatermarkSettings } = config;
		if (userWatermarkSettings) this._localStorageService.setItem(UNIVER_WATERMARK_STORAGE_KEY, {
			type: IWatermarkTypeEnum.UserInfo,
			config: { userInfo: merge({}, WatermarkUserInfoBaseConfig, userWatermarkSettings) }
		});
		else if (textWatermarkSettings) this._localStorageService.setItem(UNIVER_WATERMARK_STORAGE_KEY, {
			type: IWatermarkTypeEnum.Text,
			config: { text: merge({}, WatermarkTextBaseConfig, textWatermarkSettings) }
		});
		else if (imageWatermarkSettings) this._localStorageService.setItem(UNIVER_WATERMARK_STORAGE_KEY, {
			type: IWatermarkTypeEnum.Image,
			config: { image: merge({}, WatermarkImageBaseConfig, imageWatermarkSettings) }
		});
		else {
			const config = await this._localStorageService.getItem(UNIVER_WATERMARK_STORAGE_KEY);
			if ((config === null || config === void 0 ? void 0 : config.type) === IWatermarkTypeEnum.UserInfo) this._localStorageService.removeItem(UNIVER_WATERMARK_STORAGE_KEY);
		}
	}
	_initDependencies() {
		[[WatermarkService]].forEach((d) => {
			this._injector.add(d);
		});
	}
	onRendered() {
		this._injector.get(WatermarkService);
		this._initRenderDependencies();
	}
	_initRenderDependencies() {
		[[WatermarkRenderController]].forEach((d) => {
			this._renderManagerSrv.registerRenderModule(UniverInstanceType.UNIVER_SHEET, d);
			this._renderManagerSrv.registerRenderModule(UniverInstanceType.UNIVER_DOC, d);
		});
	}
};
_defineProperty(UniverWatermarkPlugin, "pluginName", "UNIVER_WATERMARK_PLUGIN");
_defineProperty(UniverWatermarkPlugin, "packageName", name);
_defineProperty(UniverWatermarkPlugin, "version", version);
UniverWatermarkPlugin = __decorate([
	__decorateParam(1, Inject(Injector)),
	__decorateParam(2, IConfigService),
	__decorateParam(3, IRenderManagerService),
	__decorateParam(4, Inject(ILocalStorageService))
], UniverWatermarkPlugin);

//#endregion
export { UniverWatermarkPlugin, WATERMARK_IMAGE_ALLOW_IMAGE_LIST, WatermarkImageBaseConfig, WatermarkService, WatermarkTextBaseConfig, WatermarkUserInfoBaseConfig };