import React from 'react';

import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ButtonBar from 'app/components/buttonBar';
import Button from 'app/components/button';
import {IconAdd} from 'app/icons/iconAdd';
import {t} from 'app/locale';

type Props = {
  onAddRule: () => void;
  disabled?: boolean;
};

const DataPrivacyRulesPanelEmpty = ({onAddRule, disabled}: Props) => (
  <EmptyMessage
    description={t("You don't have any saved data privacy rules yet!")}
    action={
      <ButtonBar gap={1.5}>
        <Button
          disabled={disabled}
          icon={<IconAdd size="xs" />}
          onClick={onAddRule}
          size="small"
          priority="primary"
        >
          {t('Add Rule')}
        </Button>
        <Button
          size="small"
          href="https://docs.sentry.io/data-management/advanced-datascrubbing/"
          target="_blank"
          disabled={disabled}
        >
          {t('Learn More')}
        </Button>
      </ButtonBar>
    }
  />
);

export default DataPrivacyRulesPanelEmpty;
