import React from 'react';
import omit from 'lodash/omit';
import isEqual from 'lodash/isEqual';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import Button from 'app/components/button';
import {t, tct} from 'app/locale';
import {Panel, PanelAlert, PanelBody, PanelHeader} from 'app/components/panels';
import {Client} from 'app/api';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import ExternalLink from 'app/components/links/externalLink';
import SentryTypes from 'app/sentryTypes';
import {IconAdd} from 'app/icons/iconAdd';

import {EventIdFieldStatus} from './dataPrivacyRulesEventIdField';
import DataPrivacyRulesPanelForm from './dataPrivacyRulesPanelForm';
import {Suggestion, defaultSuggestions} from './dataPrivacyRulesPanelSelectorFieldTypes';
import {RULE_TYPE, METHOD_TYPE} from './utils';
import DataPrivacyRulesPanelAddRuleModal from './dataPrivacyRulesPanelAddRuleModal';
import DataPrivacyRulesPanelContent from './dataPrivacyRulesPanelContent';

type Rule = React.ComponentProps<typeof DataPrivacyRulesPanelForm>['rule'];

type PiiConfig = {
  type: RULE_TYPE;
  pattern: string;
  redaction?: {
    method?: METHOD_TYPE;
  };
};

type PiiConfigRule = {
  [key: string]: PiiConfig;
};

type Applications = {[key: string]: Array<string>};

type Props = {
  disabled?: boolean;
  endpoint: string;
  relayPiiConfig?: string;
  additionalContext?: React.ReactNode;
};

type State = {
  rules: Array<Rule>;
  savedRules: Array<Rule>;
  relayPiiConfig?: string;
  selectorSuggestions: Array<Suggestion>;
  eventIdInputValue: string;
  eventIdStatus: EventIdFieldStatus;
  isFormValid: boolean;
  showAddRuleModal: boolean;
};

class DataPrivacyRulesPanel extends React.Component<Props, State> {
  static contextTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
  };

  state: State = {
    rules: [],
    savedRules: [],
    relayPiiConfig: this.props.relayPiiConfig,
    selectorSuggestions: [],
    eventIdStatus: EventIdFieldStatus.NONE,
    eventIdInputValue: '',
    isFormValid: true,
    showAddRuleModal: false,
  };

  componentDidMount() {
    this.loadRules();
    this.loadSelectorSuggestions();
  }

  componentDidUpdate(_prevProps: Props, prevState: State) {
    if (prevState.relayPiiConfig !== this.state.relayPiiConfig) {
      this.loadRules();
    }
  }

  componentWillUnmount() {
    this.api.clear();
  }

  api = new Client();

  loadRules() {
    try {
      const relayPiiConfig = this.state.relayPiiConfig;
      const piiConfig = relayPiiConfig ? JSON.parse(relayPiiConfig) : {};
      const rules: PiiConfigRule = piiConfig.rules || {};
      const applications: Applications = piiConfig.applications || {};
      const convertedRules: Array<Rule> = [];

      for (const application in applications) {
        for (const rule of applications[application]) {
          if (!rules[rule]) {
            if (rule[0] === '@') {
              const [type, method] = rule.slice(1).split(':');
              convertedRules.push({
                id: convertedRules.length,
                type: type as RULE_TYPE,
                method: method as METHOD_TYPE,
                from: application,
              });
            }
            continue;
          }

          const resolvedRule = rules[rule];
          if (resolvedRule.type === RULE_TYPE.PATTERN && resolvedRule.pattern) {
            const method = resolvedRule?.redaction?.method;

            convertedRules.push({
              id: convertedRules.length,
              type: RULE_TYPE.PATTERN,
              method: method as METHOD_TYPE,
              from: application,
              customRegularExpression: resolvedRule.pattern,
            });
          }
        }
      }

      this.setState({
        rules: convertedRules,
        savedRules: convertedRules,
      });
    } catch {
      addErrorMessage(t('Unable to load the rules'));
    }
  }

  loadSelectorSuggestions = async () => {
    const {organization, project} = this.context;
    const {eventIdInputValue} = this.state;

    if (!eventIdInputValue) {
      this.setState({
        selectorSuggestions: defaultSuggestions,
        eventIdStatus: EventIdFieldStatus.NONE,
      });
      return;
    }

    this.setState({eventIdStatus: EventIdFieldStatus.LOADING});

    try {
      const query: {projectId?: string; eventId: string} = {eventId: eventIdInputValue};
      if (project?.id) {
        query.projectId = project.id;
      }
      const rawSuggestions = await this.api.requestPromise(
        `/organizations/${organization.slug}/data-scrubbing-selector-suggestions/`,
        {method: 'GET', query}
      );
      const selectorSuggestions: Array<Suggestion> = rawSuggestions.suggestions;

      if (selectorSuggestions && selectorSuggestions.length > 0) {
        this.setState({
          selectorSuggestions,
          eventIdStatus: EventIdFieldStatus.LOADED,
        });
        return;
      }

      this.setState({
        selectorSuggestions: defaultSuggestions,
        eventIdStatus: EventIdFieldStatus.NOT_FOUND,
      });
    } catch {
      this.setState({
        eventIdStatus: EventIdFieldStatus.ERROR,
      });
    }
  };

  handleEventIdChange = (value: string) => {
    const eventId = value.replace(/-/g, '').trim();
    this.setState({
      eventIdStatus: EventIdFieldStatus.NONE,
      selectorSuggestions: defaultSuggestions,
      eventIdInputValue: eventId,
    });
  };

  isEventIdValueValid = (): boolean => {
    const {eventIdInputValue} = this.state;
    if (eventIdInputValue && eventIdInputValue.length !== 32) {
      this.setState({eventIdStatus: EventIdFieldStatus.INVALID});
      return false;
    }

    return true;
  };

  handleEventIdBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    event.preventDefault();

    if (this.isEventIdValueValid()) {
      this.loadSelectorSuggestions();
    }
  };

  handleEventIdKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    event.persist();

    const {keyCode} = event;

    if (keyCode === 13 && this.isEventIdValueValid()) {
      this.loadSelectorSuggestions();
    }
  };

  handleToggleAddRuleModal = (showModal: boolean) => () => {
    this.setState({
      showAddRuleModal: showModal,
      isFormValid: !showModal,
    });
  };

  handleDeleteRule = (ruleId: Rule['id']) => {
    this.setState(
      prevState => ({
        rules: prevState.rules.filter(rule => rule.id !== ruleId),
      }),
      () => {
        this.handleSubmit();
      }
    );
  };

  handleChange = (updatedRule: Rule) => {
    this.setState(
      prevState => ({
        rules: prevState.rules.map(rule => {
          if (rule.id === updatedRule.id) {
            return updatedRule;
          }
          return rule;
        }),
      }),
      () => {
        this.handleValidation();
      }
    );
  };

  handleSubmit = async () => {
    const {endpoint} = this.props;
    const {rules} = this.state;

    let customRulesCounter = 0;
    const applications: Applications = {};
    const customRules: PiiConfigRule = {};

    for (const rule of rules) {
      let ruleName = `@${rule.type}:${rule.method}`;
      if (rule.type === RULE_TYPE.PATTERN && rule.customRegularExpression) {
        ruleName = `customRule${customRulesCounter}`;

        customRulesCounter += 1;

        customRules[ruleName] = {
          type: RULE_TYPE.PATTERN,
          pattern: rule.customRegularExpression,
          redaction: {
            method: rule.method,
          },
        };
      }

      if (!applications[rule.from]) {
        applications[rule.from] = [];
      }

      if (!applications[rule.from].includes(ruleName)) {
        applications[rule.from].push(ruleName);
      }
    }

    const piiConfig = {
      rules: customRules,
      applications,
    };

    const relayPiiConfig = JSON.stringify(piiConfig);

    await this.api
      .requestPromise(endpoint, {
        method: 'PUT',
        data: {relayPiiConfig},
      })
      .then(() => {
        this.setState({
          relayPiiConfig,
        });
      })
      .then(() => {
        addSuccessMessage(t('Successfully saved data privacy rules'));
      })
      .catch(error => {
        const errorMessage = error.responseJSON?.relayPiiConfig[0];

        if (!errorMessage) {
          addErrorMessage(t('Unknown error occurred while saving data privacy rules'));
          return;
        }

        if (errorMessage.startsWith('invalid selector: ')) {
          for (const line of errorMessage.split('\n')) {
            if (line.startsWith('1 | ')) {
              const selector = line.slice(3);
              addErrorMessage(t('Invalid selector: %s', selector));
              break;
            }
          }
          return;
        }

        if (errorMessage.startsWith('regex parse error:')) {
          for (const line of errorMessage.split('\n')) {
            if (line.startsWith('error:')) {
              const regex = line.slice(6).replace(/at line \d+ column \d+/, '');
              addErrorMessage(t('Invalid regex: %s', regex));
              break;
            }
          }
          return;
        }

        addErrorMessage(t('Unknown error occurred while saving data privacy rules'));
      });
  };

  handleValidation = () => {
    const {rules} = this.state;
    const isAnyRuleFieldEmpty = rules.find(rule => {
      const ruleKeys = Object.keys(omit(rule, 'id'));
      const anyEmptyField = ruleKeys.find(ruleKey => !rule[ruleKey]);
      return !!anyEmptyField;
    });

    const isFormValid = !isAnyRuleFieldEmpty;

    this.setState({
      isFormValid,
    });
  };

  handleSaveForm = () => {
    const {isFormValid} = this.state;

    if (isFormValid) {
      this.handleSubmit();
      return;
    }

    addErrorMessage(t('Invalid rules form'));
  };

  handleCancelForm = () => {
    this.setState(prevState => ({
      rules: prevState.savedRules,
    }));
  };

  render() {
    const {additionalContext, disabled} = this.props;
    const {rules, showAddRuleModal} = this.state;

    return (
      <React.Fragment>
        <Panel>
          <PanelHeader>
            <div>{t('Data Privacy Rules')}</div>
          </PanelHeader>
          <PanelAlert type="info">
            {additionalContext}{' '}
            {tct('For more details, see [linkToDocs].', {
              linkToDocs: (
                <ExternalLink href="https://docs.sentry.io/data-management/advanced-datascrubbing/">
                  {t('full documentation on data scrubbing')}
                </ExternalLink>
              ),
            })}
          </PanelAlert>
          <PanelBody>
            <DataPrivacyRulesPanelContent
              rules={rules}
              disabled={disabled}
              onDeleteRule={this.handleDeleteRule}
              onAddRule={this.handleToggleAddRuleModal(true)}
            />
            <DataPrivacyRulesPanelAddRuleModal
              show={showAddRuleModal}
              nextRuleId={rules.length + 1}
              onCancel={this.handleToggleAddRuleModal(false)}
              disabled={disabled}
              onSave={() => console.log('save')}
              onChange={() => console.log('cancel')}
            />
          </PanelBody>
          {rules.length > 0 && (
            <PanelAction>
              <Button
                disabled={disabled}
                icon={<IconAdd size="xs" />}
                onClick={this.handleToggleAddRuleModal(true)}
                size="small"
                priority="primary"
              >
                {t('Add Rule')}
              </Button>
            </PanelAction>
          )}
        </Panel>
      </React.Fragment>
    );
  }
}

export default DataPrivacyRulesPanel;

const PanelAction = styled('div')`
  padding: ${space(1)} ${space(2)};
  position: relative;
  display: flex;
  justify-content: flex-end;
`;
