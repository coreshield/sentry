import React from 'react';
import Modal from 'react-bootstrap/lib/Modal';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {t} from 'app/locale';

import DataPrivacyRulesPanelForm from './dataPrivacyRulesPanelForm';

type Rule = React.ComponentProps<typeof DataPrivacyRulesPanelForm>['rule'];

type Props = {
  show: boolean;
  rule: Rule;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onChange: () => void;
  disabled?: boolean;
};

const dataPrivacyRulesPanelEditRuleModal = ({
  show,
  onCancel,
  onDelete,
  onSave,
  disabled,
  rule,
  onChange,
}: Props) => {
  return (
    <StyledModal show={show} animation={false} onHide={onCancel}>
      <Modal.Header closeButton />
      <ModalContent>
        <DataPrivacyRulesPanelForm
          onDelete={onDelete}
          onChange={onChange}
          selectorSuggestions={[]}
          rule={rule}
          disabled={disabled}
        />
        <Footer>
          <ButtonBar gap={1.5}>
            <Button disabled={disabled} onClick={onCancel} size="small">
              {t('Cancel')}
            </Button>
            <Button disabled={disabled} onClick={onSave} size="small" priority="primary">
              {t('Save')}
            </Button>
          </ButtonBar>
        </Footer>
      </ModalContent>
    </StyledModal>
  );
};

export default dataPrivacyRulesPanelEditRuleModal;

const ModalContent = styled(Modal.Body)`
  flex: 1;
  margin: 0 -30px -30px -30px;
`;

const Footer = styled('div')`
  display: flex;
  justify-content: flex-end;
  padding: ${space(1)} ${space(2)};
  position: relative;
`;

const StyledModal = styled(Modal)`
  .modal-dialog {
    width: 1000px;
    transform: translate(-50%, 50%) !important;
    margin-left: 0;
  }
`;
