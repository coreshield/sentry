import * as React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';

import ConfigStore from 'app/stores/configStore';
import LatestContextStore from 'app/stores/latestContextStore';
import {Organization, OrganizationSummary, Project} from 'app/types';
import getDisplayName from 'app/utils/getDisplayName';
import withOrganizations from 'app/utils/withOrganizations';

type InjectedLatestContextProps = {
  organizations?: OrganizationSummary[];
  organization?: Organization;
  project?: Project;
  lastRoute?: string;
};

type WithPluginProps = {
  organization?: Organization;
  organizations: OrganizationSummary[];
};

type State = {
  latestContext: Omit<InjectedLatestContextProps, 'organizations'>;
};

const withLatestContext = <P extends InjectedLatestContextProps>(
  WrappedComponent: React.ComponentType<P>
) =>
  withOrganizations(
    createReactClass<
      Omit<P, keyof InjectedLatestContextProps> &
        Partial<InjectedLatestContextProps> &
        WithPluginProps,
      State
    >({
      displayName: `withLatestContext(${getDisplayName(WrappedComponent)})`,
      mixins: [Reflux.connect(LatestContextStore, 'latestContext') as any],

      render() {
        const {organizations} = this.props;
        const {latestContext} = this.state;
        const {
          organization,
          project,
          lastRoute,
        }: {organization?: Organization; project?: Project; lastRoute?: string} =
          latestContext || {};

        // Even though org details exists in LatestContextStore,
        // fetch organization from OrganizationsStore so that we can
        // expect consistent data structure because OrganizationsStore has a list
        // of orgs but not full org details
        const latestOrganization =
          organization ||
          (organizations && organizations.length
            ? organizations.find(
                ({slug}) => slug === ConfigStore.get('lastOrganization')
              ) || organizations[0]
            : null);

        // TODO(billy): Below is going to be wrong if component is passed project, it will override
        // project from `latestContext`
        return (
          <WrappedComponent
            organizations={organizations as OrganizationSummary[]}
            project={project as Project}
            lastRoute={lastRoute as string}
            {...(this.props as P)}
            organization={(this.props.organization || latestOrganization) as Organization}
          />
        );
      },
    })
  );

export default withLatestContext;
