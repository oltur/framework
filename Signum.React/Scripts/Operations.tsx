import * as React from "react"
import { Dic } from './Globals'
import { ajaxPost } from './Services'
import {
  Lite, Entity, OperationMessage, EntityPack,
  OperationSymbol, ConstructSymbol_From, ConstructSymbol_FromMany, ConstructSymbol_Simple, ExecuteSymbol, DeleteSymbol
} from './Signum.Entities';
import { OperationLogEntity } from './Signum.Entities.Basics';
import { PseudoType, TypeInfo, getTypeInfo, OperationInfo, OperationType, GraphExplorer } from './Reflection';
import { TypeContext, EntityFrame } from './TypeContext';
import * as Finder from './Finder';
import * as QuickLinks from './QuickLinks';
import * as ContexualItems from './SearchControl/ContextualItems';
import { ButtonBarManager } from './Frames/ButtonBar';
import { getEntityOperationButtons, defaultOnClick, andClose, andNew } from './Operations/EntityOperations';
import { getConstructFromManyContextualItems, getEntityOperationsContextualItems, defaultContextualClick } from './Operations/ContextualOperations';
import { ContextualItemsContext } from './SearchControl/ContextualItems';
import { BsColor, KeyCodes } from "./Components/Basic";
import { IconProp } from "@fortawesome/fontawesome-svg-core";
import Notify from './Frames/Notify';

export namespace Options {
  export function maybeReadonly(ti: TypeInfo) {
    return false;
  }
}

export function start() {
  ButtonBarManager.onButtonBarRender.push(getEntityOperationButtons);
  ContexualItems.onContextualItems.push(getConstructFromManyContextualItems);
  ContexualItems.onContextualItems.push(getEntityOperationsContextualItems);

  QuickLinks.registerGlobalQuickLink(ctx => new QuickLinks.QuickLinkExplore({
    queryName: OperationLogEntity,
    parentToken: OperationLogEntity.token(e => e.target),
    parentValue: ctx.lite
  },
    {
      isVisible: getTypeInfo(ctx.lite.EntityType) && getTypeInfo(ctx.lite.EntityType).requiresSaveOperation && Finder.isFindable(OperationLogEntity, false),
      icon: "history",
      iconColor: "green",
      isShy: true,
    }));
}

export const operationSettings: { [operationKey: string]: OperationSettings } = {};

export function clearOperationSettings() {
  Dic.clear(operationSettings);
}

export function addSettings(...settings: OperationSettings[]) {
  settings.forEach(s => Dic.addOrThrow(operationSettings, s.operationSymbol, s));
}


export function getSettings(operation: OperationSymbol | string): OperationSettings | undefined {
  const operationKey = (operation as OperationSymbol).key || operation as string;

  return operationSettings[operationKey];
}

export const isOperationInfoAllowedEvent: Array<(oi: OperationInfo) => boolean> = [];
export function isOperationInfoAllowed(oi: OperationInfo) {
  return isOperationInfoAllowedEvent.every(a => a(oi));
}

export function isOperationAllowed(operation: OperationSymbol | string, type: PseudoType): boolean {
  return isOperationInfoAllowed(getOperationInfo(operation, type));
}

export function isSomeOperationAllowed(operations: (OperationSymbol | string)[], type: PseudoType): boolean {
  return operations.some(a => isOperationAllowed(a, type))

}

export function getOperationInfo(operation: OperationSymbol | string, type: PseudoType): OperationInfo {
  let operationKey = typeof operation == "string" ? operation : operation.key;

  let ti = getTypeInfo(type);

  let oi = ti?.operations && ti.operations[operationKey];

  if (oi == undefined)
    throw new Error(`Operation ${operationKey} not defined for ${ti.name}`);

  return oi;
}

export function assertOperationInfoAllowed(operation: OperationInfo) {
  if (!isOperationInfoAllowed(operation))
    throw new Error(`Operation ${operation.key} is denied`);
}

export function assertOperationAllowed(operation: OperationSymbol | string, type: PseudoType) {
  var oi = getOperationInfo(operation, type);
  if (!isOperationInfoAllowed(oi))
    throw new Error(`Operation ${oi.key} is denied for ${getTypeInfo(type).name}`);
}

export function operationInfos(ti: TypeInfo) {
  return Dic.getValues(ti.operations!).filter(isOperationInfoAllowed);
}

export function notifySuccess(message?: string) {
  Notify.singleton && Notify.singleton.notifyTimeout({ text: message ?? JavascriptMessage.executed.niceToString(), type: "success", priority: 20 });
}

/**
 * Operation Settings
 */
export abstract class OperationSettings {

  text?: () => string;
  operationSymbol: string;

  constructor(operationSymbol: OperationSymbol | string) {
    this.operationSymbol = typeof operationSymbol == "string" ? operationSymbol : operationSymbol.key;
  }
}



/**
 * Constructor Operation Settings
 */
export class ConstructorOperationSettings<T extends Entity> extends OperationSettings {

  isVisible?: (coc: ConstructorOperationContext<T>) => boolean;
  onConstruct?: (coc: ConstructorOperationContext<T>, props?: Partial<T>) => Promise<EntityPack<T> | undefined> | undefined;

  constructor(operationSymbol: ConstructSymbol_Simple<T> | string, options: ConstructorOperationOptions<T>) {
    super(operationSymbol);

    Dic.assign(this, options);
  }
}

export interface ConstructorOperationOptions<T extends Entity> {
  text?: () => string;
  isVisible?: (coc: ConstructorOperationContext<T>) => boolean;
  onConstruct?: (coc: ConstructorOperationContext<T>, props?: Partial<T>) => Promise<EntityPack<T> | undefined> | undefined;
}

export class ConstructorOperationContext<T extends Entity> {
  operationInfo: OperationInfo;
  settings: ConstructorOperationSettings<T>;
  typeInfo: TypeInfo;

  constructor(operationInfo: OperationInfo, settings: ConstructorOperationSettings<T>, typeInfo: TypeInfo) {
    this.operationInfo = operationInfo;
    this.settings = settings;
    this.typeInfo = typeInfo;
  }

  defaultConstruct(...args: any[]): Promise<EntityPack<T> | undefined> {
    return API.construct<T>(this.typeInfo.name, this.operationInfo.key, ...args);
  }

  assignProps(pack: EntityPack<T> | undefined, props?: Partial<T>) {
    if (pack && props)
      Dic.assign(pack.entity, props);

    return pack;
  }
}



/**
 * Contextual Operation Settings
 */
export class ContextualOperationSettings<T extends Entity> extends OperationSettings {

  isVisible?: (coc: ContextualOperationContext<T>) => boolean;
  hideOnCanExecute?: boolean;
  showOnReadOnly?: boolean;
  confirmMessage?: (coc: ContextualOperationContext<T>) => string | undefined | null;
  onClick?: (coc: ContextualOperationContext<T>) => void;
  color?: BsColor;
  icon?: IconProp;
  iconColor?: string;
  order?: number;

  constructor(operationSymbol: ConstructSymbol_FromMany<any, T> | string, options: ContextualOperationOptions<T>) {
    super(operationSymbol);

    Dic.assign(this, options);
  }
}

export interface ContextualOperationOptions<T extends Entity> {
  text?: () => string;
  isVisible?: (coc: ContextualOperationContext<T>) => boolean;
  hideOnCanExecute?: boolean;
  showOnReadOnly?: boolean;
  confirmMessage?: (coc: ContextualOperationContext<T>) => string | undefined | null;
  onClick?: (coc: ContextualOperationContext<T>) => void;
  color?: BsColor;
  icon?: IconProp;
  iconColor?: string;
  order?: number;
}

export class ContextualOperationContext<T extends Entity> {
  context: ContextualItemsContext<T>
  operationInfo: OperationInfo;
  settings?: ContextualOperationSettings<T>;
  entityOperationSettings?: EntityOperationSettings<T>;
  canExecute?: string;
  isReadonly?: boolean;
  event?: React.MouseEvent<any>;
  onContextualSuccess?: (pack: API.ErrorReport) => void;
  onConstructFromSuccess?: (pack: EntityPack<Entity>) => void;

  defaultContextualClick(...args: any[]) {
    defaultContextualClick(this, ...args);
  }

  constructor(operationInfo: OperationInfo, context: ContextualItemsContext<T>) {
    this.operationInfo = operationInfo;
    this.context = context;
  }
}

export class EntityOperationContext<T extends Entity> {

  static fromTypeContext<T extends Entity>(ctx: TypeContext<T>, operation: ExecuteSymbol<T> | DeleteSymbol<T> | ConstructSymbol_From<T, any> | string): EntityOperationContext<T> {

    if (!ctx.frame)
      throw new Error("a frame is necessary");

    if (!ctx.frame.pack)
      throw new Error("a pack is necessary");

    return EntityOperationContext.fromEntityPack(ctx.frame, ctx.frame.pack! as EntityPack<T>, operation);
  }

  static fromEntityPack<T extends Entity>(frame: EntityFrame, pack: EntityPack<T>, operation: ExecuteSymbol<T> | DeleteSymbol<T> | ConstructSymbol_From<T, any> | string) {
    const operationKey = (operation as OperationSymbol).key || operation as string;

    const oi = getTypeInfo(pack.entity.Type).operations![operationKey];

    const result = new EntityOperationContext<T>(frame, pack.entity, oi);
    result.settings = getSettings(operationKey) as EntityOperationSettings<T>;
    result.canExecute = pack?.canExecute && pack.canExecute[operationKey];
    result.complete();
    return result;
  }

  frame: EntityFrame;
  tag?: string;
  entity: T;
  operationInfo: OperationInfo;
  settings?: EntityOperationSettings<T>;
  canExecute?: string;
  event?: React.MouseEvent<any>;
  onExecuteSuccess?: (pack: EntityPack<T>) => void;
  onConstructFromSuccess?: (pack: EntityPack<Entity>) => void;
  onDeleteSuccess?: () => void;

  color?: BsColor;
  group?: EntityOperationGroup;
  keyboardShortcut?: KeyboardShortcut;
  alternatives?: AlternativeOperationSetting<T>[];

  constructor(frame: EntityFrame, entity: T, operationInfo: OperationInfo) {
    this.frame = frame;
    this.entity = entity;
    this.operationInfo =  operationInfo;
  }

  complete() {
    var s = this.settings;
    this.color = s?.color ?? Defaults.getColor(this.operationInfo);
    this.group = s?.group !== undefined ? (s.group ?? undefined) : Defaults.getGroup(this.operationInfo);
    this.keyboardShortcut = s?.keyboardShortcut !== undefined ? (s.keyboardShortcut ?? undefined) : Defaults.getKeyboardShortcut(this.operationInfo);
    this.alternatives = s?.alternatives != null ? s.alternatives(this) : Defaults.getAlternatives(this);
  }

  defaultClick(...args: any[]) {
    defaultOnClick(this, ...args);
  }

  click() {
    if (this.settings && this.settings.onClick)
      this.settings.onClick(this);
    else
      defaultOnClick(this);
  }

  isAllowed() {
    return isOperationInfoAllowed(this.operationInfo);
  }

  textOrNiceName() {
    return (this.settings && this.settings.text && this.settings.text()) ?? this.operationInfo.niceName
  }

  onKeyDown(e: KeyboardEvent): boolean {
    if (this.keyboardShortcut) {
      if (isShortcut(e, this.keyboardShortcut)) {
        this.click();
        return true;
      }
    }

    if (this.alternatives != null) {

      for (var i = 0; i < this.alternatives.length; i++) {
        const a = this.alternatives[i];
        if (a.isVisible != false && a.keyboardShortcut) {
          if (isShortcut(e, a.keyboardShortcut)) {
            a.onClick(this);
            return true;
          }
        }
      }
    }

    return false;
  }
}

export interface AlternativeOperationSetting<T extends Entity> {
  name: string;
  text: () => string;
  color?: BsColor;
  classes?: string;
  icon?: IconProp;
  iconAlign?: "start" | "end";
  iconColor?: string;
  isVisible?: boolean;
  inDropdown?: boolean;
  confirmMessage?: (eoc: EntityOperationContext<T>) => string | undefined | null;
  onClick: (eoc: EntityOperationContext<T>) => void;
  keyboardShortcut?: KeyboardShortcut;
}

export class EntityOperationSettings<T extends Entity> extends OperationSettings {

  contextual?: ContextualOperationSettings<T>;
  contextualFromMany?: ContextualOperationSettings<T>;

  isVisible?: (eoc: EntityOperationContext<T>) => boolean;
  confirmMessage?: (eoc: EntityOperationContext<T>) => string | undefined | null;
  overrideCanExecute?: (ctx: EntityOperationContext<T>) => string | undefined | null;
  onClick?: (eoc: EntityOperationContext<T>) => void;
  hideOnCanExecute?: boolean;
  showOnReadOnly?: boolean;
  group?: EntityOperationGroup | null;
  order?: number;
  color?: BsColor;
  classes?: string;
  icon?: IconProp;
  iconAlign?: "start" | "end";
  iconColor?: string;
  alternatives?: (ctx: EntityOperationContext<T>) => AlternativeOperationSetting<T>[];
  keyboardShortcut?: KeyboardShortcut | null;

  constructor(operationSymbol: ExecuteSymbol<T> | DeleteSymbol<T> | ConstructSymbol_From<any, T> | string, options: EntityOperationOptions<T>) {
    super(operationSymbol)

    Dic.assign(this, options);

    this.contextual = options.contextual ? new ContextualOperationSettings(operationSymbol as any, options.contextual) : undefined;
    this.contextualFromMany = options.contextualFromMany ? new ContextualOperationSettings(operationSymbol as any, options.contextualFromMany) : undefined;
  }
}

export interface EntityOperationOptions<T extends Entity> {
  contextual?: ContextualOperationOptions<T>;
  contextualFromMany?: ContextualOperationOptions<T>;

  text?: () => string;
  isVisible?: (ctx: EntityOperationContext<T>) => boolean;
  overrideCanExecute?: (ctx: EntityOperationContext<T>) => string | undefined | null;
  confirmMessage?: (ctx: EntityOperationContext<T>) => string | undefined | null;
  onClick?: (ctx: EntityOperationContext<T>) => void;
  hideOnCanExecute?: boolean;
  showOnReadOnly?: boolean;
  group?: EntityOperationGroup | null;
  order?: number;
  color?: BsColor;
  classes?: string;
  icon?: IconProp;
  iconAlign?: "start" | "end";
  iconColor?: string;
  keyboardShortcut?: KeyboardShortcut | null;
  alternatives?: (ctx: EntityOperationContext<T>) => AlternativeOperationSetting<T>[];
}

export interface KeyboardShortcut{
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  key?: string;
  keyCode?: number; //lowercase
}

export function isShortcut(e: KeyboardEvent, ks: KeyboardShortcut) {

  function toLower(a: string | undefined) {
    return a?.toLowerCase();
  }

  return (toLower(e.key) == toLower(ks.key) || e.keyCode == ks.keyCode) &&
    e.ctrlKey == (ks.ctrlKey || false) &&
    e.altKey == (ks.altKey || false) &&
    e.shiftKey == (ks.shiftKey || false);
}



export function getShortcutToString(ks: KeyboardShortcut) {
  
  function getKeyName(keyCode: number) {

    var pair = Dic.map(KeyCodes as any, (key: string, value: number) => ({ key, value })).singleOrNull(a => a.value == ks.keyCode);
    return pair ? pair.key.firstUpper() : "(KeyCode=" + keyCode + ")";
  }

  return (ks.ctrlKey ? "Ctrl+" : "") +
    (ks.altKey ? "Alt+" : "") +
    (ks.shiftKey ? "Shift+" : "") +
    (ks.key ? ks.key.firstUpper() : getKeyName(ks.keyCode!));

}

export const CreateGroup: EntityOperationGroup = {
  key: "create",
  text: () => OperationMessage.Create.niceToString(),
  simplifyName: cs => {
    const array = new RegExp(OperationMessage.CreateFromRegex.niceToString()).exec(cs);
    return array ? array[1].firstUpper() : cs;
  },
  cssClass: "sf-operation",
  order: 200,
};

export interface EntityOperationGroup {
  key: string;
  text: () => string;
  simplifyName?: (complexName: string) => string;
  cssClass?: string;
  color?: BsColor;
  order?: number;
}





export namespace Defaults {

  export function isSave(oi: OperationInfo): boolean {
    return oi.key.endsWith(".Save");
  }

  export function getColor(oi: OperationInfo): BsColor {
    return oi.operationType == OperationType.Delete ? "danger" :
      oi.operationType == OperationType.Execute && Defaults.isSave(oi) ? "primary" : "light";
  }

  export function getGroup(oi: OperationInfo): EntityOperationGroup | undefined {
    return oi.operationType == OperationType.ConstructorFrom ? CreateGroup : undefined;
  }

  export function getKeyboardShortcut(oi: OperationInfo): KeyboardShortcut | undefined {
    return oi.operationType == OperationType.Delete ? ({ ctrlKey: true, shiftKey: true, keyCode: KeyCodes.delete }) :
      oi.operationType == OperationType.Execute && Defaults.isSave(oi) ? ({ ctrlKey: true, key: "s", keyCode: 83 }) : undefined;
  }

  export function getAlternatives<T extends Entity>(eoc: EntityOperationContext<T>): AlternativeOperationSetting<T>[] | undefined {
    if (Defaults.isSave(eoc.operationInfo)) {
      return [
        andClose(eoc),
        andNew(eoc)
      ]
    }

    return undefined;
  }
}

export function isEntityOperation(operationType: OperationType) {
  return operationType == OperationType.ConstructorFrom ||
    operationType == OperationType.Execute ||
    operationType == OperationType.Delete;
}



export namespace API {

  export function construct<T extends Entity>(type: string, operationKey: string | ConstructSymbol_Simple<T>, ...args: any[]): Promise<EntityPack<T>> {
    return ajaxPost({ url: "~/api/operation/construct" }, { operationKey: getOperationKey(operationKey), args, type });
  }

  export function constructFromEntity<T extends Entity, F extends Entity>(entity: F, operationKey: string | ConstructSymbol_From<T, F>, ...args: any[]): Promise<EntityPack<T>> {
    GraphExplorer.propagateAll(entity, args);
    return ajaxPost({ url: "~/api/operation/constructFromEntity" }, { entity: entity, operationKey: getOperationKey(operationKey), args: args } as EntityOperationRequest);
  }

  export function constructFromLite<T extends Entity, F extends Entity>(lite: Lite<F>, operationKey: string | ConstructSymbol_From<T, F>, ...args: any[]): Promise<EntityPack<T>> {
    GraphExplorer.propagateAll(lite, args);
    return ajaxPost({ url: "~/api/operation/constructFromLite" }, { lite: lite, operationKey: getOperationKey(operationKey), args: args } as LiteOperationRequest);
  }

  export function constructFromMultiple<T extends Entity, F extends Entity>(lites: Lite<F>[], operationKey: string | ConstructSymbol_From<T, F>, ...args: any[]): Promise<ErrorReport> {
    GraphExplorer.propagateAll(lites, args);
    return ajaxPost({ url: "~/api/operation/constructFromMultiple" }, { lites: lites, operationKey: getOperationKey(operationKey), args: args } as MultiOperationRequest);
  }

  export function constructFromMany<T extends Entity, F extends Entity>(lites: Lite<F>[], operationKey: string | ConstructSymbol_From<T, F>, ...args: any[]): Promise<EntityPack<T>> {
    GraphExplorer.propagateAll(lites, args);
    return ajaxPost({ url: "~/api/operation/constructFromMany" }, { lites: lites, operationKey: getOperationKey(operationKey), args: args } as MultiOperationRequest);
  }

  export function executeEntity<T extends Entity>(entity: T, operationKey: string | ExecuteSymbol<T>, ...args: any[]): Promise<EntityPack<T>> {
    GraphExplorer.propagateAll(entity, args);
    return ajaxPost({ url: "~/api/operation/executeEntity" }, { entity: entity, operationKey: getOperationKey(operationKey), args: args } as EntityOperationRequest);
  }

  export function executeLite<T extends Entity>(lite: Lite<T>, operationKey: string | ExecuteSymbol<T>, ...args: any[]): Promise<EntityPack<T>> {
    GraphExplorer.propagateAll(lite, args);
    return ajaxPost({ url: "~/api/operation/executeLite" }, { lite: lite, operationKey: getOperationKey(operationKey), args: args } as LiteOperationRequest);
  }

  export function executeMultiple<T extends Entity>(lites: Lite<T>[], operationKey: string | ExecuteSymbol<T>, ...args: any[]): Promise<ErrorReport> {
    GraphExplorer.propagateAll(lites, args);
    return ajaxPost({ url: "~/api/operation/executeMultiple" }, { lites: lites, operationKey: getOperationKey(operationKey), args: args } as MultiOperationRequest);
  }

  export function deleteEntity<T extends Entity>(entity: T, operationKey: string | DeleteSymbol<T>, ...args: any[]): Promise<void> {
    GraphExplorer.propagateAll(entity, args);
    return ajaxPost({ url: "~/api/operation/deleteEntity" }, { entity: entity, operationKey: getOperationKey(operationKey), args: args } as EntityOperationRequest);
  }

  export function deleteLite<T extends Entity>(lite: Lite<T>, operationKey: string | DeleteSymbol<T>, ...args: any[]): Promise<void> {
    GraphExplorer.propagateAll(lite, args);
    return ajaxPost({ url: "~/api/operation/deleteLite" }, { lite: lite, operationKey: getOperationKey(operationKey), args: args } as LiteOperationRequest);
  }

  export function deleteMultiple<T extends Entity>(lites: Lite<T>[], operationKey: string | DeleteSymbol<T>, ...args: any[]): Promise<ErrorReport> {
    GraphExplorer.propagateAll(lites, args);
    return ajaxPost({ url: "~/api/operation/deleteMultiple" }, { lites: lites, operationKey: getOperationKey(operationKey), args: args } as MultiOperationRequest);
  }

  export interface ErrorReport {
    errors: { [liteKey: string]: string; }
  }




  export function getOperationKey(operationKey: string | OperationSymbol) {
    return (operationKey as OperationSymbol).key || operationKey as string;
  }



  export interface MultiOperationRequest {
    operationKey: string;
    type?: string;
    lites: Lite<Entity>[];
    args: any[]
  }

  export interface ConstructOperationRequest {
    operationKey: string;
    type?: string;
    args: any[];
  }


  export interface EntityOperationRequest {
    operationKey: string;
    entity: Entity;
    type?: string;
    args: any[];
  }

  export interface LiteOperationRequest {
    operationKey: string;
    lite: Lite<Entity>;
    type?: string;
    args: any[];
  }


  export function stateCanExecutes<T extends Entity>(lites: Lite<T>[], operationKeys: string[]): Promise<CanExecutesResponse> {
    return ajaxPost({ url: "~/api/operation/stateCanExecutes" }, { lites, operationKeys });
  }

  export interface CanExecutesResponse {
    canExecutes: { [operationKey: string]: string };
    isReadOnly?: boolean;
  }
}


