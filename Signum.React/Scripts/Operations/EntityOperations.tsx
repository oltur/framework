﻿import * as React from "react"
import { Router, Route, Redirect, IndexRoute } from "react-router"
import { Button, OverlayTrigger, Tooltip, MenuItem, DropdownButton } from "react-bootstrap"
import { IEntity, Lite, Entity, ModifiableEntity, EmbeddedEntity, LiteMessage, EntityPack, toLite, JavascriptMessage,
    OperationSymbol, ConstructSymbol_From, ConstructSymbol_FromMany, ConstructSymbol_Simple, ExecuteSymbol, DeleteSymbol, OperationMessage, getToString } from '../Signum.Entities';
import { PropertyRoute, PseudoType, EntityKind, TypeInfo, IType, Type, getTypeInfo, OperationInfo, OperationType  } from '../Reflection';
import {classes} from '../Globals';
import * as Navigator from '../Navigator';
import { ButtonsContext } from '../Frames/ButtonBar';
import Notify from '../Frames/Notify';
import { EntityFrame }  from '../Lines';
import { ajaxPost, ValidationError }  from '../Services';
import { operationInfos, getSettings, EntityOperationSettings, EntityOperationContext, EntityOperationGroup, CreateGroup, API } from '../Operations'


export function getButtonBarElements(ctx: ButtonsContext): Array<React.ReactElement<any>> {
    const ti = getTypeInfo(ctx.pack.entity.Type);

    if (ti == null)
        return null;

    const operations = operationInfos(ti)
        .filter(oi => isEntityOperation(oi.operationType) && (oi.allowNew || !ctx.pack.entity.isNew))
        .map(oi => {
            const eos = getSettings(oi.key) as EntityOperationSettings<Entity>;

            const eoc: EntityOperationContext<Entity> = {
                entity: ctx.pack.entity,
                frame: ctx.frame,
                canExecute: ctx.pack.canExecute[oi.key],
                operationInfo: oi,
                settings: eos
            };

            if (eos && eos.isVisible ? eos.isVisible(eoc) : ctx.showOperations)
                if (eoc.settings == null || !eoc.settings.hideOnCanExecute || eoc.canExecute == null)
                    return eoc;

            return null;
        })
        .filter(eoc => eoc != null);

    var groups = operations.groupByArray(eoc => {

        const group = getDefaultGroup(eoc);

        if (group == null)
            return "";

        return group.key;
    });



    var result = groups.flatMap((gr, i) => {
        if (gr.key == "") {
            return gr.elements.map((eoc, j) => ({
                order: eoc.settings && eoc.settings.order != null ? eoc.settings.order : 0,
                button: createDefaultButton(eoc, null, false, i + "-" + j)
            }));
        } else {
            var group = getDefaultGroup(gr.elements[0]);


            return [{
                order: group.order != null ? group.order : 100,
                button: (
                    <DropdownButton title={group.text() } data-key={group.key} key={i} id={group.key}>
                        { gr.elements
                            .orderBy(a => a.settings && a.settings.order)
                            .map((eoc, j) => createDefaultButton(eoc, group, true, j))
                        }
                    </DropdownButton>
                )
            }];
        }
    });

    return result.orderBy(a => a.order).map(a => a.button);
}

function getDefaultGroup(eoc: EntityOperationContext<Entity>) {
    if (eoc.settings != null && eoc.settings.group !== undefined) {
        return eoc.settings.group; //maybe null 
    }

    if (eoc.operationInfo.operationType == OperationType.ConstructorFrom)
        return CreateGroup;

    return null;
}

function createDefaultButton(eoc: EntityOperationContext<Entity>, group: EntityOperationGroup, asMenuItem: boolean, key: any) {

    var text = eoc.settings && eoc.settings.text ? eoc.settings.text() :
        group && group.simplifyName ? group.simplifyName(eoc.operationInfo.niceName) :
            eoc.operationInfo.niceName;

    var bsStyle = eoc.settings && eoc.settings.style || autoStyleFunction(eoc.operationInfo);

    var disabled = !!eoc.canExecute;

    var btn = !asMenuItem ?
        <Button bsStyle={bsStyle} className={disabled ? "disabled" : null} onClick={disabled? null : () => onClick(eoc) } data-operation={eoc.operationInfo.key} key={key}>{text}</Button> :
        <MenuItem className={classes("btn-" + bsStyle, disabled ? "disabled" : null) } onClick={disabled ? null : () => onClick(eoc) } data-operation={eoc.operationInfo.key} key={key}>{text}</MenuItem>;

    if (!eoc.canExecute)
        return btn;

    const tooltip = <Tooltip id={"tooltip_" + eoc.operationInfo.key.replace(".", "_") }>{eoc.canExecute}</Tooltip>;

    return <OverlayTrigger placement="bottom" overlay={tooltip}>{btn}</OverlayTrigger>;
}

function onClick(eoc: EntityOperationContext<Entity>): void{

    if (eoc.settings && eoc.settings.onClick)
        return eoc.settings.onClick(eoc);

    if (eoc.operationInfo.lite) {
        switch (eoc.operationInfo.operationType) {
            case OperationType.ConstructorFrom: defaultConstructFromLite(eoc); return;
            case OperationType.Execute: defaultExecuteEntity(eoc); return;
            case OperationType.Delete: defaultDeleteEntity(eoc); return;
        }
    } else {
        switch (eoc.operationInfo.operationType) {
            case OperationType.ConstructorFrom: defaultConstructFromEntity(eoc); return;
            case OperationType.Execute: defaultExecuteEntity(eoc); return;
            case OperationType.Delete: defaultDeleteEntity(eoc); return;
        }
    }

    throw new Error("Unexpected OperationType");
}

export function notifySuccess() {
    Notify.singletone.notifyTimeout({ text: JavascriptMessage.executed.niceToString(), type: "success" });
    return true;
}

export function defaultConstructFromEntity(eoc: EntityOperationContext<Entity>): Promise<boolean> {

    if (!confirmInNecessary(eoc))
        return;

    return API.constructFromEntity(eoc.entity, eoc.operationInfo.key, null)
        .then(pack => Navigator.view(pack).then(a => notifySuccess()))
        .catch(e => catchValidationError(e, eoc.frame));
}

export function defaultConstructFromLite(eoc: EntityOperationContext<Entity>): Promise<boolean> {

    if (!confirmInNecessary(eoc))
        return;

    return API.constructFromLite(toLite(eoc.entity), eoc.operationInfo.key, null)
        .then(pack => Navigator.view(pack).then(a => notifySuccess()))
        .catch(e => catchValidationError(e, eoc.frame));
}

function catchValidationError(error: any, frame: EntityFrame<Entity>) {
    if (error instanceof ValidationError) {
        frame.setError((error as ValidationError).modelState);
        return false;
    }

    throw error;
}


export function defaultExecuteEntity(eoc: EntityOperationContext<Entity>): Promise<boolean> {

    if (!confirmInNecessary(eoc))
        return;

    return API.executeEntity(eoc.entity, eoc.operationInfo.key, null)
        .then(pack => { eoc.frame.onReload(pack); return notifySuccess(); })
        .catch(e => catchValidationError(e, eoc.frame));
}

export function defaultExecuteLite(eoc: EntityOperationContext<Entity>): Promise<boolean> {

    if (!confirmInNecessary(eoc))
        return;

    return API.executeLite(toLite(eoc.entity), eoc.operationInfo.key, null)
        .then(pack => { eoc.frame.onReload(pack); return notifySuccess(); })
        .catch(e => catchValidationError(e, eoc.frame));
}

export function defaultDeleteEntity(eoc: EntityOperationContext<Entity>): Promise<boolean> {

    if (!confirmInNecessary(eoc))
        return;

    return API.deleteEntity(eoc.entity, eoc.operationInfo.key, null)
        .then(() => { eoc.frame.onClose(); return notifySuccess(); })
        .catch(e => catchValidationError(e, eoc.frame));
}

export function defaultDeleteLite(eoc: EntityOperationContext<Entity>): Promise<boolean> {

    if (!confirmInNecessary(eoc))
        return;

    return API.deleteLite(toLite(eoc.entity), eoc.operationInfo.key, null)
        .then(() => { eoc.frame.onClose(); return notifySuccess(); })
        .catch(e => catchValidationError(e, eoc.frame));
}


export function confirmInNecessary(eoc: EntityOperationContext<Entity>): boolean {

    var confirmMessage = getConfirmMessage(eoc);

    return confirmMessage == null || confirm(confirmMessage);
}

function getConfirmMessage(eoc: EntityOperationContext<Entity>) {
    if (eoc.settings && eoc.settings.confirmMessage === null)
        return null;

    if (eoc.settings && eoc.settings.confirmMessage != null)
        return eoc.settings.confirmMessage(eoc);

    //eoc.settings.confirmMessage === undefined
    if (eoc.operationInfo.operationType == OperationType.Delete)
        return OperationMessage.PleaseConfirmYouDLikeToDeleteTheEntityFromTheSystem.niceToString(getToString(eoc.entity));

    return null;
}


export function autoStyleFunction(oi: OperationInfo) {
    return oi.operationType == OperationType.Delete ? "danger" :
        oi.operationType == OperationType.Execute && oi.key.endsWith(".Save") ? "primary" : "default";
}


function isEntityOperation(operationType: OperationType) {
    return operationType == OperationType.ConstructorFrom ||
        operationType == OperationType.Execute ||
        operationType == OperationType.Delete;
}