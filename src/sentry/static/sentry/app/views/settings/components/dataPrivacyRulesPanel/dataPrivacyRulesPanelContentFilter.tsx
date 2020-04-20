import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {t, tct} from 'app/locale';
import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';
import {IconDelete} from 'app/icons/iconDelete';

type Props = {
  selectedQuantity: number;
  isAllSelected: boolean;
  onSelectAll: (selectAll: boolean) => void;
  onDeleteAllSelected: () => void;
};

const DataPrivacyRulesPanelContentFilter = ({
  selectedQuantity,
  isAllSelected,
  onSelectAll,
  onDeleteAllSelected,
}: Props) => {
  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();

    if (isAllSelected) {
      onSelectAll(false);
      return;
    }

    onSelectAll(true);
  };

  const getCheckboxLabel = () => {
    if (isAllSelected) {
      return t('Unselect All');
    }

    if (selectedQuantity === 0) {
      return t('Select All');
    }

    return tct('[selectedQuantity] selected', {selectedQuantity});
  };

  return (
    <Wrapper>
      <CheckboxWrapper onClick={handleClick}>
        <CheckboxFancy
          isChecked={isAllSelected}
          isIndeterminate={!isAllSelected && selectedQuantity > 0}
        />
        <span>{getCheckboxLabel()}</span>
        {selectedQuantity > 0 && <StyledIconDelete onClick={onDeleteAllSelected} />}
      </CheckboxWrapper>
    </Wrapper>
  );
};

const Wrapper = styled('div')`
  display: flex;
  background-color: ${p => p.theme.offWhite};
  padding: ${space(1)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.borderDark};
`;

const CheckboxWrapper = styled('div')`
  align-items: center;
  display: grid;
  grid-gap: ${space(1)};
  grid-template-columns: 20px minmax(100px, auto) 16px;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const StyledIconDelete = styled(IconDelete)`
  cursor: pointer;
`;

export default DataPrivacyRulesPanelContentFilter;
