import {Component} from 'react';
import DocumentTitle from 'react-document-title';
import * as Sentry from '@sentry/react';
import {Location} from 'history';

import NotFound from 'app/components/errors/notFound';
import Footer from 'app/components/footer';
import Sidebar from 'app/components/sidebar';

type Props = {
  location: Location;
};

class RouteNotFound extends Component<Props> {
  componentDidMount() {
    Sentry.withScope(scope => {
      scope.setFingerprint(['RouteNotFound']);
      Sentry.captureException(new Error('Route not found'));
    });
  }

  getTitle = () => 'Page Not Found';

  render() {
    // TODO(dcramer): show additional resource links
    return (
      <DocumentTitle title={this.getTitle()}>
        <div className="app">
          <Sidebar location={this.props.location} />
          <div className="container">
            <div className="content">
              <section className="body">
                <NotFound />
              </section>
            </div>
          </div>
          <Footer />
        </div>
      </DocumentTitle>
    );
  }
}

export default RouteNotFound;
