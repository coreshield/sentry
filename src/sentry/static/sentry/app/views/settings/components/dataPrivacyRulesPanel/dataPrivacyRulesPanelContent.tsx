import React from 'react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';

import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {IconDelete} from 'app/icons/iconDelete';

import DataPrivacyRulesPanelEmpty from './dataPrivacyRulesPanelEmpty';
import DataPrivacyRulesPanelForm from './dataPrivacyRulesPanelForm';
import DataPrivacyRulesPanelContentFilter from './dataPrivacyRulesPanelContentFilter';
import DataPrivacyRulesPanelEditRuleModal from './dataPrivacyRulesPanelEditRuleModal';
import DataPrivacyRulesPanelContentAddRuleModal from './dataPrivacyRulesPanelAddRuleModal';

type Rule = React.ComponentProps<typeof DataPrivacyRulesPanelForm>['rule'];

type Props = {
  rules: Array<Rule>;
  disabled?: boolean;
  onAddRule: () => void;
  onDeleteRule: (ruleId: Rule['id']) => void;
};

type State = {
  selectedRules: Array<Rule['id']>;
  editRule?: Rule;
  newRule?: Rule;
};

class DataPrivacyRulesPanelContent extends React.Component<Props, State> {
  state: State = {
    selectedRules: [],
  };

  handleClickItem = (rule: Rule) => () => {
    this.setState({
      editRule: rule,
    });
  };

  handleSelectRule = (ruleId: number, isChecked: boolean) => (
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    event.preventDefault();

    const {selectedRules} = this.state;

    if (isChecked) {
      this.setState({
        selectedRules: selectedRules.filter(selectedRule => selectedRule !== ruleId),
      });
      return;
    }

    this.setState({
      selectedRules: [...selectedRules, ruleId],
    });
  };

  handleDeleteRule = (ruleId: Rule['id']) => (event: React.MouseEvent<SVGAElement>) => {
    event.preventDefault();

    const {onDeleteRule} = this.props;

    onDeleteRule(ruleId);
  };

  handleSelectAll = (selectAll: boolean) => {
    if (selectAll) {
      const {rules} = this.props;

      this.setState({
        selectedRules: rules.map(rule => rule.id),
      });
      return;
    }

    this.setState({
      selectedRules: [],
    });
  };

  handleDeleteAllSelected = () => {
    console.log('work in progress');
  };

  handleCloseEditRuleModal = () => {
    this.setState({
      editRule: undefined,
    });
  };

  render() {
    const {selectedRules, editRule} = this.state;
    const {rules, disabled, onAddRule} = this.props;

    if (rules.length === 0) {
      return <DataPrivacyRulesPanelEmpty onAddRule={onAddRule} disabled={disabled} />;
    }

    return (
      <React.Fragment>
        <DataPrivacyRulesPanelContentFilter
          onSelectAll={this.handleSelectAll}
          onDeleteAllSelected={this.handleDeleteAllSelected}
          selectedQuantity={selectedRules.length}
          isAllSelected={selectedRules.length === rules.length}
        />
        <List>
          {rules.map(rule => {
            const {id, method, type, from} = rule;
            const isChecked = selectedRules.includes(id);
            return (
              <ListItem
                key={id}
                isChecked={isChecked}
                onClick={this.handleClickItem(rule)}
              >
                <CheckboxFancy
                  onClick={this.handleSelectRule(id, isChecked)}
                  isChecked={isChecked}
                />
                <span>{`${capitalize(method)} ${type} ${t('from')} ${from}`}</span>
                <StyledIconDelete onClick={this.handleDeleteRule(id)} />
              </ListItem>
            );
          })}
        </List>
        {editRule && (
          <DataPrivacyRulesPanelEditRuleModal
            show={!!editRule}
            onCancel={this.handleCloseEditRuleModal}
            disabled={disabled}
            rule={editRule}
            onSave={() => console.log('save')}
            onChange={() => console.log('cancel')}
            onDelete={() => console.log('onDelete')}
          />
        )}
      </React.Fragment>
    );
  }
}

export default DataPrivacyRulesPanelContent;

const List = styled('ul')`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const StyledIconDelete = styled(IconDelete)`
  opacity: 0.3;
`;

const ListItem = styled('li')<{isChecked?: boolean}>`
  display: grid;
  grid-template-columns: 20px 1fr 16px;
  grid-column-gap: ${space(1)};
  align-items: center;
  padding: ${space(1)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.borderDark};
  cursor: pointer;
  :hover {
    background-color: ${p => p.theme.offWhite};
    box-shadow: ${p => p.theme.dropShadowHeavy};
  }

  ${CheckboxFancy} {
    opacity: ${p => (p.isChecked ? 1 : 0.3)};
  }

  &:hover ${StyledIconDelete}, &:hover ${CheckboxFancy} {
    opacity: 1;
  }
`;
