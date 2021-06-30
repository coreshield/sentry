import {browserHistory} from 'react-router';
import Reflux from 'reflux';

import GuideActions from 'app/actions/guideActions';
import OrganizationsActions from 'app/actions/organizationsActions';
import {Client} from 'app/api';
import getGuidesContent from 'app/components/assistant/getGuidesContent';
import {Guide, GuidesContent, GuidesServerData} from 'app/components/assistant/types';
import ConfigStore from 'app/stores/configStore';
import {trackAnalyticsEvent} from 'app/utils/analytics';

function guidePrioritySort(a: Guide, b: Guide) {
  const a_priority = a.priority ?? Number.MAX_SAFE_INTEGER;
  const b_priority = b.priority ?? Number.MAX_SAFE_INTEGER;
  if (a_priority === b_priority) {
    return a.guide.localeCompare(b.guide);
  }
  // lower number takes priority
  return a_priority - b_priority;
}

export type GuideStoreState = {
  /**
   * All tooltip guides
   */
  guides: Guide[];
  /**
   * Anchors that are currently mounted
   */
  anchors: Set<string>;
  /**
   * The current guide
   */
  currentGuide: Guide | null;
  /**
   * Current step of the current guide
   */
  currentStep: number;
  /**
   * Current organization id
   */
  orgId: string | null;
  /**
   * Current organization slug
   */
  orgSlug: string | null;
  /**
   * We force show a guide if the URL contains #assistant
   */
  forceShow: boolean;
  /**
   * The previously shown guide
   */
  prevGuide: Guide | null;
};

const defaultState: GuideStoreState = {
  guides: [],
  anchors: new Set(),
  currentGuide: null,
  currentStep: 0,
  orgId: null,
  orgSlug: null,
  forceShow: false,
  prevGuide: null,
};

type GuideStoreInterface = {
  state: GuideStoreState;

  onFetchSucceeded: (data: GuidesServerData) => void;
  onRegisterAnchor: (target: string) => void;
  onUnregisterAnchor: (target: string) => void;
  recordCue: (guide: string) => void;
  updatePrevGuide: (nextGuide: Guide | null) => void;
};

const guideStoreConfig: Reflux.StoreDefinition & GuideStoreInterface = {
  state: defaultState,

  init() {
    this.state = defaultState;

    this.api = new Client();
    this.listenTo(GuideActions.fetchSucceeded, this.onFetchSucceeded);
    this.listenTo(GuideActions.closeGuide, this.onCloseGuide);
    this.listenTo(GuideActions.nextStep, this.onNextStep);
    this.listenTo(GuideActions.toStep, this.onToStep);
    this.listenTo(GuideActions.registerAnchor, this.onRegisterAnchor);
    this.listenTo(GuideActions.unregisterAnchor, this.onUnregisterAnchor);
    this.listenTo(OrganizationsActions.setActive, this.onSetActiveOrganization);

    window.addEventListener('load', this.onURLChange, false);
    browserHistory.listen(() => this.onURLChange());
  },

  onURLChange() {
    this.state.forceShow = window.location.hash === '#assistant';
    this.updateCurrentGuide();
  },

  onSetActiveOrganization(data) {
    this.state.orgId = data ? data.id : null;
    this.state.orgSlug = data ? data.slug : null;
    this.updateCurrentGuide();
  },

  onFetchSucceeded(data) {
    // It's possible we can get empty responses (seems to be Firefox specific)
    // Do nothing if `data` is empty
    // also, temporarily check data is in the correct format from the updated
    // assistant endpoint
    if (!data || !Array.isArray(data)) {
      return;
    }

    const guidesContent: GuidesContent = getGuidesContent(this.state.orgSlug);
    // map server guide state (i.e. seen status) with guide content
    const guides = guidesContent.reduce((acc: Guide[], content) => {
      const serverGuide = data.find(guide => guide.guide === content.guide);
      serverGuide &&
        acc.push({
          ...content,
          ...serverGuide,
        });
      return acc;
    }, []);

    this.state.guides = guides;
    this.updateCurrentGuide();
  },

  onCloseGuide(dismissed?: boolean) {
    const {currentGuide, guides} = this.state;
    // update the current guide seen to true or all guides
    // if markOthersAsSeen is true and the user is dismissing
    guides
      .filter(
        guide =>
          guide.guide === currentGuide?.guide ||
          (currentGuide?.markOthersAsSeen && dismissed)
      )
      .forEach(guide => (guide.seen = true));
    this.state.forceShow = false;
    this.updateCurrentGuide();
  },

  onNextStep() {
    this.state.currentStep += 1;
    this.trigger(this.state);
  },

  onToStep(step: number) {
    this.state.currentStep = step;
    this.trigger(this.state);
  },

  onRegisterAnchor(target) {
    this.state.anchors.add(target);
    this.updateCurrentGuide();
  },

  onUnregisterAnchor(target) {
    this.state.anchors.delete(target);
    this.updateCurrentGuide();
  },

  recordCue(guide) {
    const user = ConfigStore.get('user');
    if (!user) {
      return;
    }

    const data = {
      guide,
      eventKey: 'assistant.guide_cued',
      eventName: 'Assistant Guide Cued',
      organization_id: this.state.orgId,
      user_id: parseInt(user.id, 10),
    };
    trackAnalyticsEvent(data);
  },

  updatePrevGuide(nextGuide) {
    const {prevGuide} = this.state;
    if (!nextGuide) {
      return;
    }

    if (!prevGuide || prevGuide.guide !== nextGuide.guide) {
      this.recordCue(nextGuide.guide);
      this.state.prevGuide = nextGuide;
    }
  },

  /**
   * Logic to determine if a guide is shown:
   *
   *  - If any required target is missing, don't show the guide
   *  - If the URL ends with #assistant, show the guide
   *  - If the user has already seen the guide, don't show the guide
   *  - Otherwise show the guide
   */
  updateCurrentGuide() {
    const {anchors, guides, forceShow} = this.state;

    let guideOptions = guides
      .sort(guidePrioritySort)
      .filter(guide => guide.requiredTargets.every(target => anchors.has(target)));

    const user = ConfigStore.get('user');
    const assistantThreshold = new Date(2019, 6, 1);
    const userDateJoined = new Date(user?.dateJoined);

    if (!forceShow) {
      guideOptions = guideOptions.filter(({seen, dateThreshold}) => {
        if (seen) {
          return false;
        } else if (user?.isSuperuser) {
          return true;
        } else if (dateThreshold) {
          // Show the guide to users who've joined before the date threshold
          return userDateJoined < dateThreshold;
        } else {
          return userDateJoined > assistantThreshold;
        }
      });
    }

    const nextGuide =
      guideOptions.length > 0
        ? {
            ...guideOptions[0],
            steps: guideOptions[0].steps.filter(
              step => step.target && anchors.has(step.target)
            ),
          }
        : null;

    this.updatePrevGuide(nextGuide);
    this.state.currentStep =
      this.state.currentGuide &&
      nextGuide &&
      this.state.currentGuide.guide === nextGuide.guide
        ? this.state.currentStep
        : 0;
    this.state.currentGuide = nextGuide;
    this.trigger(this.state);
  },
};

type GuideStore = Reflux.Store & GuideStoreInterface;

const GuideStore = Reflux.createStore(guideStoreConfig) as GuideStore;

export default GuideStore;
