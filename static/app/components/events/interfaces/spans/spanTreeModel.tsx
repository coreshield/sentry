import {action, computed, makeObservable, observable} from 'mobx';

import {Client} from 'app/api';
import {t} from 'app/locale';
import {EventTransaction} from 'app/types/event';

import {ActiveOperationFilter} from './filter';
import {
  EnhancedProcessedSpanType,
  FetchEmbeddedChildrenState,
  FilterSpans,
  OrphanTreeDepth,
  RawSpanType,
  SpanChildrenLookupType,
  SpanType,
  TreeDepthType,
} from './types';
import {
  generateRootSpan,
  getSpanID,
  getSpanOperation,
  isEventFromBrowserJavaScriptSDK,
  isOrphanSpan,
  parseTrace,
  SpanBoundsType,
  SpanGeneratedBoundsType,
} from './utils';

class SpanTreeModel {
  api: Client;

  // readonly state
  span: Readonly<SpanType>;
  children: Array<SpanTreeModel> = [];
  isRoot: boolean;

  // readable/writable state
  fetchEmbeddedChildrenState: FetchEmbeddedChildrenState = 'idle';
  showEmbeddedChildren: boolean = false;
  embeddedChildren: Array<SpanTreeModel> = [];

  constructor(
    parentSpan: SpanType,
    childSpans: SpanChildrenLookupType,
    api: Client,
    isRoot: boolean = false
  ) {
    this.api = api;
    this.span = parentSpan;
    this.isRoot = isRoot;

    const spanID = getSpanID(parentSpan);
    const spanChildren: Array<RawSpanType> = childSpans?.[spanID] ?? [];

    // Mark descendents as being rendered. This is to address potential recursion issues due to malformed data.
    // For example if a span has a span_id that's identical to its parent_span_id.
    childSpans = {
      ...childSpans,
    };
    delete childSpans[spanID];

    this.children = spanChildren.map(span => {
      return new SpanTreeModel(span, childSpans, api);
    });

    makeObservable(this, {
      operationNameCounts: computed.struct,
      showEmbeddedChildren: observable,
      embeddedChildren: observable,
      fetchEmbeddedChildrenState: observable,
      toggleEmbeddedChildren: action,
      fetchEmbeddedTransactions: action,
    });
  }

  get operationNameCounts(): Map<string, number> {
    const result = new Map<string, number>();

    const operationName = this.span.op;

    if (typeof operationName === 'string' && operationName.length > 0) {
      result.set(operationName, 1);
    }

    for (const directChild of this.children) {
      const operationNameCounts = directChild.operationNameCounts;
      for (const [key, count] of operationNameCounts) {
        result.set(key, (result.get(key) ?? 0) + count);
      }
    }

    // sort alphabetically using case insensitive comparison
    return new Map(
      [...result].sort((a, b) =>
        String(a[0]).localeCompare(b[0], undefined, {sensitivity: 'base'})
      )
    );
  }

  isSpanFilteredOut = (props: {
    operationNameFilters: ActiveOperationFilter;
    filterSpans: FilterSpans | undefined;
  }): boolean => {
    const {operationNameFilters, filterSpans} = props;

    if (operationNameFilters.type === 'active_filter') {
      const operationName = getSpanOperation(this.span);

      if (
        typeof operationName === 'string' &&
        !operationNameFilters.operationNames.has(operationName)
      ) {
        return true;
      }
    }

    if (!filterSpans) {
      return false;
    }

    return !filterSpans.spanIDs.has(getSpanID(this.span));
  };

  generateSpanGap(
    event: Readonly<EventTransaction>,
    previousSiblingEndTimestamp: number | undefined,
    treeDepth: number,
    continuingTreeDepths: Array<TreeDepthType>
  ): EnhancedProcessedSpanType | undefined {
    // hide gap spans (i.e. "missing instrumentation" spans) for browser js transactions,
    // since they're not useful to indicate
    const shouldIncludeGap = !isEventFromBrowserJavaScriptSDK(event);

    const isValidGap =
      shouldIncludeGap &&
      typeof previousSiblingEndTimestamp === 'number' &&
      previousSiblingEndTimestamp < this.span.start_timestamp &&
      // gap is at least 100 ms
      this.span.start_timestamp - previousSiblingEndTimestamp >= 0.1;
    if (!isValidGap) {
      return undefined;
    }

    const gapSpan: EnhancedProcessedSpanType = {
      type: 'gap',
      span: {
        type: 'gap',
        start_timestamp: previousSiblingEndTimestamp || this.span.start_timestamp,
        timestamp: this.span.start_timestamp, // this is essentially end_timestamp
        description: t('Missing instrumentation'),
        isOrphan: isOrphanSpan(this.span),
      },
      numOfSpanChildren: 0,
      treeDepth,
      isLastSibling: false,
      continuingTreeDepths,
      fetchEmbeddedChildrenState: 'idle',
      showEmbeddedChildren: false,
      toggleEmbeddedChildren: undefined,
    };
    return gapSpan;
  }

  getSpansList = (props: {
    operationNameFilters: ActiveOperationFilter;
    generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
    treeDepth: number;
    isLastSibling: boolean;
    continuingTreeDepths: Array<TreeDepthType>;
    hiddenSpanGroups: Set<String>;
    spanGroups: Set<String>;
    filterSpans: FilterSpans | undefined;
    previousSiblingEndTimestamp: number | undefined;
    event: Readonly<EventTransaction>;
  }): EnhancedProcessedSpanType[] => {
    const {
      operationNameFilters,
      generateBounds,
      treeDepth,
      isLastSibling,
      continuingTreeDepths,
      hiddenSpanGroups,
      // The set of ancestor span IDs whose sub-tree that the span belongs to
      spanGroups,
      filterSpans,
      previousSiblingEndTimestamp,
      event,
    } = props;

    const treeDepthEntry = isOrphanSpan(this.span)
      ? ({type: 'orphan', depth: treeDepth} as OrphanTreeDepth)
      : treeDepth;

    const descendantContinuingTreeDepths = isLastSibling
      ? continuingTreeDepths
      : [...continuingTreeDepths, treeDepthEntry];

    const parentSpanID = getSpanID(this.span);
    const childSpanGroup = new Set(spanGroups);
    childSpanGroup.add(parentSpanID);

    const descendantsSource = this.showEmbeddedChildren
      ? [...this.embeddedChildren, ...this.children]
      : this.children;

    const lastIndex = descendantsSource.length - 1;

    const {descendants} = descendantsSource.reduce(
      (
        acc: {
          descendants: EnhancedProcessedSpanType[];
          previousSiblingEndTimestamp: number | undefined;
        },
        span,
        index
      ) => {
        acc.descendants.push(
          ...span.getSpansList({
            operationNameFilters,
            generateBounds,
            treeDepth: treeDepth + 1,
            isLastSibling: index === lastIndex,
            continuingTreeDepths: descendantContinuingTreeDepths,
            hiddenSpanGroups,
            spanGroups: new Set(childSpanGroup),
            filterSpans,
            previousSiblingEndTimestamp: acc.previousSiblingEndTimestamp,
            event,
          })
        );

        acc.previousSiblingEndTimestamp = span.span.timestamp;

        return acc;
      },
      {
        descendants: [],
        previousSiblingEndTimestamp: undefined,
      }
    );

    for (const hiddenSpanGroup of hiddenSpanGroups) {
      if (spanGroups.has(hiddenSpanGroup)) {
        return descendants;
      }
    }

    if (this.isSpanFilteredOut(props)) {
      return [
        {
          type: 'filtered_out',
          span: this.span,
        },
        ...descendants,
      ];
    }

    const bounds = generateBounds({
      startTimestamp: this.span.start_timestamp,
      endTimestamp: this.span.timestamp,
    });
    const isCurrentSpanOutOfView = !bounds.isSpanVisibleInView;

    if (isCurrentSpanOutOfView) {
      return [
        {
          type: 'out_of_view',
          span: this.span,
        },
        ...descendants,
      ];
    }

    const wrappedSpan: EnhancedProcessedSpanType = {
      type: this.isRoot ? 'root_span' : 'span',
      span: this.span,
      numOfSpanChildren: descendantsSource.length,
      treeDepth,
      isLastSibling,
      continuingTreeDepths,
      fetchEmbeddedChildrenState: this.fetchEmbeddedChildrenState,
      showEmbeddedChildren: this.showEmbeddedChildren,
      toggleEmbeddedChildren: this.toggleEmbeddedChildren,
    };
    const gapSpan = this.generateSpanGap(
      event,
      previousSiblingEndTimestamp,
      treeDepth,
      continuingTreeDepths
    );

    if (gapSpan) {
      return [gapSpan, wrappedSpan, ...descendants];
    }

    return [wrappedSpan, ...descendants];
  };

  toggleEmbeddedChildren = (props: {orgSlug: string; eventSlug: string}) => {
    this.showEmbeddedChildren = !this.showEmbeddedChildren;
    this.fetchEmbeddedChildrenState = 'idle';

    if (this.showEmbeddedChildren && this.embeddedChildren.length === 0) {
      return this.fetchEmbeddedTransactions(props);
    }

    return Promise.resolve(undefined);
  };

  fetchEmbeddedTransactions({orgSlug, eventSlug}: {orgSlug: string; eventSlug: string}) {
    const url = `/organizations/${orgSlug}/events/${eventSlug}/`;

    this.fetchEmbeddedChildrenState = 'loading_embedded_transactions';

    return this.api
      .requestPromise(url, {
        method: 'GET',
        query: {},
      })
      .then(
        action('fetchEmbeddedTransactionsSuccess', (event: EventTransaction) => {
          if (!event) {
            return;
          }

          const parsedTrace = parseTrace(event);
          const rootSpan = generateRootSpan(parsedTrace);
          const parsedRootSpan = new SpanTreeModel(
            rootSpan,
            parsedTrace.childSpans,
            this.api,
            false
          );

          this.embeddedChildren = [parsedRootSpan];
          this.fetchEmbeddedChildrenState = 'idle';
        })
      )
      .catch(
        action('fetchEmbeddedTransactionsError', () => {
          this.embeddedChildren = [];
          this.fetchEmbeddedChildrenState = 'error_fetching_embedded_transactions';
        })
      );
  }
}

export default SpanTreeModel;
