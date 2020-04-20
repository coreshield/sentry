import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import {IconAdd} from 'app/icons/iconAdd';
import space from 'app/styles/space';
import {t} from 'app/locale';

type Props = {
  onAddRule: () => void;
  disabled?: boolean;
};

const DataPrivacyRulesPanelFooter = ({disabled, onAddRule}: Props) => (
  <PanelAction>
    <Button
      disabled={disabled}
      icon={<IconAdd size="xs" />}
      onClick={onAddRule}
      size="small"
      priority="primary"
    >
      {t('Add Rule')}
    </Button>
  </PanelAction>
);

export default DataPrivacyRulesPanelFooter;

const PanelAction = styled('div')`
  padding: ${space(1)} ${space(2)};
  position: relative;
  display: flex;
  justify-content: flex-end;
`;
