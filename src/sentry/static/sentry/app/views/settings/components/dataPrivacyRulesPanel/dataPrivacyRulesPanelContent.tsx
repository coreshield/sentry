import React from 'react';
import styled from '@emotion/styled';

import CheckboxFancy from 'app/components/checkboxFancy';
import {space} from 'app/styles/space';

import DataPrivacyRulesPanelEmpty from './dataPrivacyRulesPanelEmpty';
import DataPrivacyRulesPanelForm from './dataPrivacyRulesPanelForm';

type Rule = React.ComponentProps<typeof DataPrivacyRulesPanelForm>['rule'];

type Props = {
  rules: Array<Rule>;
  disabled?: boolean;
  onAddRule: () => void;
};

class DataPrivacyRulesPanelContent extends React.Component<Props> {
  handleClickItem = (ruleId: number) => {
    console.log('ruleId', ruleId);
  };

  render() {
    const {rules, disabled, onAddRule} = this.props;

    if (rules.length === 0) {
      return <DataPrivacyRulesPanelEmpty onAddRule={onAddRule} disabled={disabled} />;
    }

    return (
      <List>
        {rules.map(({id, method, from}) => (
          <ListItem key={id} isChecked={false} onClick={this.handleClickItem(id)}>
            <span>{description}</span>
            <CheckboxFancy isChecked={false} />
          </ListItem>
        ))}
      </List>
    );
  }
}

export default DataPrivacyRulesPanelContent;

const List = styled('ul')`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const ListItem = styled('li')<{isChecked?: boolean}>`
  display: grid;
  grid-template-columns: 20px 1fr 16px;
  grid-column-gap: ${space(1)};
  align-items: center;
  padding: ${space(1)};
  cursor: pointer;
  font-size: ${p => p.theme.fontSizeMedium};
  border-bottom: 1px solid ${p => p.theme.borderLight};
  border-top: 1px solid ${p => p.theme.borderLight};
  margin-top: -1px;
  :hover {
    background-color: ${p => p.theme.offWhite};
  }
  :last-child {
    border-bottom: 0;
  }
`;
