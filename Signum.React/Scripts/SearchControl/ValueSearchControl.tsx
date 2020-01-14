import * as React from 'react'
import numbro from 'numbro'
import * as moment from 'moment'
import { classes } from '../Globals'
import * as Finder from '../Finder'
import { FindOptions, FindOptionsParsed, SubTokensOptions, QueryToken, QueryValueRequest } from '../FindOptions'
import { Lite, Entity, getToString, EmbeddedEntity } from '../Signum.Entities'
import { getQueryKey, toNumbroFormat, toMomentFormat, getEnumInfo, QueryTokenString } from '../Reflection'
import { AbortableRequest } from "../Services";
import { SearchControlProps } from "./SearchControl";
import { BsColor } from '../Components';
import { toFilterRequests } from '../Finder';

export interface ValueSearchControlProps extends React.Props<ValueSearchControl> {
  valueToken?: string | QueryTokenString<any>;
  findOptions: FindOptions;
  isLink?: boolean;
  isBadge?: boolean | "MoreThanZero";
  badgeColor?: BsColor | ((value: any | undefined) => BsColor);
  formControlClass?: string;
  avoidAutoRefresh?: boolean;
  onValueChange?: (value: any) => void;
  onExplored?: () => void;
  onTokenLoaded?: () => void;
  initialValue?: any;
  customClass?: string;
  customStyle?: React.CSSProperties;
  format?: string;
  throwIfNotFindable?: boolean;
  avoidNotifyPendingRequest?: boolean;
  refreshKey?: string | number;
  searchControlProps?: Partial<SearchControlProps>;
  onRender?: (value: any | undefined, vsc: ValueSearchControl) => React.ReactNode;
}

export interface ValueSearchControlState {
  value?: any;
  token?: QueryToken;
}

function getQueryRequest(fo: FindOptionsParsed, valueToken?: string | QueryTokenString<any>): QueryValueRequest {

  return {
    queryKey: fo.queryKey,
    filters: toFilterRequests(fo.filterOptions),
    valueToken: valueToken?.toString(),
    systemTime: fo.systemTime && { ...fo.systemTime }
  };
}

export default class ValueSearchControl extends React.Component<ValueSearchControlProps, ValueSearchControlState> {

  static defaultProps = {
    isLink: false,
    isBadge: "MoreThanZero"
  }

  constructor(props: ValueSearchControlProps) {
    super(props);
    this.state = { value: props.initialValue };
  }

  componentDidMount() {
    if (this.props.initialValue == undefined) {
      this.loadToken(this.props);
      this.refreshValue(this.props);
    }
  }

  componentWillReceiveProps(newProps: ValueSearchControlProps) {

    function toString(token: string | QueryTokenString<any> | undefined) {
      return token?.toString();
    }

    if (Finder.findOptionsPath(this.props.findOptions) == Finder.findOptionsPath(newProps.findOptions) &&
      toString(this.props.valueToken) == toString(newProps.valueToken)) {

      if (this.props.refreshKey != newProps.refreshKey)
        this.refreshValue(newProps)

    } else {
      this.loadToken(newProps);

      if (newProps.initialValue == undefined)
        this.refreshValue(newProps);
    }
  }

  loadToken(props: ValueSearchControlProps) {

    if (props.valueToken == (this.state.token && this.state.token.fullKey))
      return;

    this.setState({ token: undefined, value: undefined });
    if (props.valueToken)
      Finder.parseSingleToken(props.findOptions.queryName, props.valueToken.toString(), SubTokensOptions.CanAggregate | SubTokensOptions.CanAnyAll)
        .then(st => {
          this.setState({ token: st });
          this.props.onTokenLoaded && this.props.onTokenLoaded();
        })
        .done();
  }

  componentWillUnmount() {
    this.abortableQuery.abort();
  }

  abortableQuery = new AbortableRequest<{ findOptions: FindOptions; valueToken?: string | QueryTokenString<any>, avoidNotify: boolean | undefined }, number>(
    (abortSignal, a) =>
      Finder.getQueryDescription(a.findOptions.queryName)
        .then(qd => Finder.parseFindOptions(a.findOptions, qd, false))
        .then(fop => Finder.API.queryValue(getQueryRequest(fop, a.valueToken), a.avoidNotify, abortSignal)));

  refreshValue(props?: ValueSearchControlProps) {
    if (!props)
      props = this.props;

    var fo = props.findOptions;

    if (!Finder.isFindable(fo.queryName, false)) {
      if (this.props.throwIfNotFindable)
        throw Error(`Query ${getQueryKey(fo.queryName)} not allowed`);
      return;
    }

    if (Finder.validateNewEntities(fo))
      return;

    this.abortableQuery.getData({ findOptions: fo, valueToken: props.valueToken, avoidNotify: props!.avoidNotifyPendingRequest })
      .then(value => {
        const fixedValue = value === undefined ? null : value;
        this.setState({ value: fixedValue });
        this.props.onValueChange && this.props.onValueChange(fixedValue);
      })
      .done();
  }

  isNumeric() {
    let token = this.state.token;
    return token && (token.filterType == "Integer" || token.filterType == "Decimal");
  }

  render() {

    const p = this.props;
    const s = this.state;

    const fo = p.findOptions;

    if (!Finder.isFindable(fo.queryName, false))
      return null;

    var errorMessage = Finder.validateNewEntities(fo);
    if (errorMessage) {
      return (
        <div className="alert alert-danger" role="alert">
          <strong>Error in ValueSearchControl ({getQueryKey(fo.queryName)}): </strong>
          {errorMessage}
        </div>
      );
    }

    if (this.props.onRender)
      return this.props.onRender(this.state.value, this);

    const badgeColor = this.props.badgeColor;

    let className = classes(
      p.valueToken == undefined && "count-search",
      p.valueToken == undefined && (this.state.value > 0 ? "count-with-results" : "count-no-results"),
      s.token && (s.token.type.isLite || s.token!.type.isEmbedded) && "sf-entity-line-entity",
      p.formControlClass,
      p.formControlClass && this.isNumeric() && "numeric",

      p.isBadge == false ? "" : "badge badge-pill " +
        (badgeColor && typeof badgeColor == "function" ? "badge-" + badgeColor(this.state.value) :
          badgeColor ? "badge-" + badgeColor :
            p.isBadge == true || this.state.value > 0 ? "badge-secondary" : "badge-light text-muted"),
      p.customClass
    );

    if (p.formControlClass)
      return <div className={className} style={p.customStyle}>{this.renderValue()}</div>

    if (p.isLink) {
      return (
        <a className={className} onClick={this.handleClick} href="#" style={p.customStyle}>
          {this.renderValue()}
        </a>
      );
    }

    return <span className={className} style={p.customStyle}>{this.renderValue()}</span>
  }

  renderValue() {
    let value = this.state.value;

    if (value === undefined)
      return "…";

    if (value === null)
      return null;

    if (!this.props.valueToken)
      return this.state.value;

    let token = this.state.token;
    if (!token)
      return null;

    switch (token.filterType) {
      case "Integer":
      case "Decimal":
        const numbroFormat = toNumbroFormat(this.props.format ?? token.format);
        return numbro(value).format(numbroFormat);
      case "DateTime":
        const momentFormat = toMomentFormat(this.props.format ?? token.format);
        return moment(value).format(momentFormat);
      case "String": return value;
      case "Lite": return (value as Lite<Entity>).toStr;
      case "Embedded": return getToString(value as EmbeddedEntity);
      case "Boolean": return <input type="checkbox" disabled={true} checked={value} />
      case "Enum": return getEnumInfo(token!.type.name, value).niceName;
      case "Guid":
        let str = value as string;
        return <span className="guid">{str.substr(0, 4) + "…" + str.substring(str.length - 4)}</span>;
    }

    return value;
  }

  handleClick = (e: React.MouseEvent<any>) => {
    e.preventDefault();

    if (e.ctrlKey || e.button == 1)
      window.open(Finder.findOptionsPath(this.props.findOptions));
    else
      Finder.explore(this.props.findOptions, { searchControlProps: this.props.searchControlProps }).then(() => {
        if (!this.props.avoidAutoRefresh)
          this.refreshValue(this.props);

        if (this.props.onExplored)
          this.props.onExplored();
      }).done();
  }
}
